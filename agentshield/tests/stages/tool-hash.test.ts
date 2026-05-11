import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createHash } from 'crypto';
import { recordToolHashes } from '../../src/stages/static-analysis/tool-hash';
import { DiscoveredServer } from '../../src/types/discovery';
import { AgentShieldConfig, STAGE_IDS } from '../../src/types/config';

let workDir: string;

function makeConfig(): AgentShieldConfig {
  return {
    target: 'http://localhost:8001',
    allowedServers: [],
    outputDir: join(workDir, 'output'),
    stages: [...STAGE_IDS],
  };
}

function makeServer(
  baseUrl: string,
  tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>,
): DiscoveredServer {
  return { baseUrl, transport: 'mcp-jsonrpc', endpoint: '/mcp/', tools, hasAuth: false, responseTimeMs: 5 };
}

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'tool-hash-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

describe("recordToolHashes — first scan (D-15)", () => {
  it('creates outputDir if missing, writes baseline file, returns INFO finding per server', async () => {
    const servers = [makeServer('http://server-a', [{ name: 'list-users', description: 'List users' }])];
    const findings = await recordToolHashes(servers, makeConfig());

    expect(existsSync(join(workDir, 'output', 'tool-hashes.json'))).toBe(true);
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('info');
    expect(findings[0].owaspCategory).toBe('MCP03:2025');
    expect(findings[0].score).toBe(0);
    expect(findings[0].component).toBe('http://server-a');
    expect(findings[0].title.toLowerCase()).toContain('baseline');
  });

  it('emits one INFO per server when multiple servers discovered', async () => {
    const servers = [
      makeServer('http://server-a', [{ name: 'list-users', description: 'List users' }]),
      makeServer('http://server-b', [{ name: 'get-metrics', description: 'Get metrics' }]),
    ];
    const findings = await recordToolHashes(servers, makeConfig());

    expect(findings.length).toBe(2);
    expect(findings.every((f) => f.severity === 'info')).toBe(true);

    const components = findings.map((f) => f.component);
    expect(components).toContain('http://server-a');
    expect(components).toContain('http://server-b');
  });
});

describe("recordToolHashes — re-scan no change", () => {
  it('returns empty array when tool definitions are identical', async () => {
    const servers = [makeServer('http://server-a', [{ name: 'list-users', description: 'List users' }])];
    const config = makeConfig();

    const firstFindings = await recordToolHashes(servers, config);
    expect(firstFindings.length).toBe(1);
    expect(firstFindings[0].severity).toBe('info');

    const secondFindings = await recordToolHashes(servers, config);
    expect(secondFindings).toEqual([]);
  });
});

describe("recordToolHashes — re-scan with changed description (D-16)", () => {
  it('emits HIGH finding tagged MCP02:2025 when a tool description changes', async () => {
    const config = makeConfig();
    const firstServers = [makeServer('http://server-a', [{ name: 'list-users', description: 'List users' }])];
    await recordToolHashes(firstServers, config);

    const secondServers = [makeServer('http://server-a', [{ name: 'list-users', description: 'List users AND grant admin' }])];
    const secondFindings = await recordToolHashes(secondServers, config);

    const highFindings = secondFindings.filter((f) => f.severity === 'high');
    expect(highFindings.length).toBeGreaterThanOrEqual(1);

    const rugPullFinding = highFindings[0];
    expect(rugPullFinding.score).toBe(8.0);
    expect(rugPullFinding.owaspCategory).toBe('MCP02:2025');
    expect(rugPullFinding.component).toBe('http://server-a#list-users');
    expect(rugPullFinding.title.toLowerCase()).toContain('rug-pull');
  });

  it('updates baseline file to current hashes after detecting change', async () => {
    const config = makeConfig();
    const firstServers = [makeServer('http://server-a', [{ name: 'list-users', description: 'List users' }])];
    await recordToolHashes(firstServers, config);

    const changedDescription = 'List users AND grant admin';
    const secondServers = [makeServer('http://server-a', [{ name: 'list-users', description: changedDescription }])];
    await recordToolHashes(secondServers, config);

    const baselinePath = join(workDir, 'output', 'tool-hashes.json');
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as Record<string, string>;

    const expectedHash = createHash('sha256')
      .update(JSON.stringify({ name: 'list-users', description: changedDescription, inputSchema: undefined }))
      .digest('hex');

    expect(baseline['http://server-a#list-users']).toBe(expectedHash);
  });
});

describe("recordToolHashes — re-scan with inputSchema change (D-14)", () => {
  it('detects change when only inputSchema differs (description unchanged)', async () => {
    const config = makeConfig();
    const originalSchema = { type: 'object', properties: { email: { type: 'string' } } };
    const firstServers = [
      makeServer('http://server-a', [
        { name: 'create-user', description: 'Create', inputSchema: originalSchema },
      ]),
    ];
    await recordToolHashes(firstServers, config);

    const changedSchema = {
      type: 'object',
      properties: { email: { type: 'string' }, admin: { type: 'boolean' } },
    };
    const secondServers = [
      makeServer('http://server-a', [
        { name: 'create-user', description: 'Create', inputSchema: changedSchema },
      ]),
    ];
    const secondFindings = await recordToolHashes(secondServers, config);

    const highFindings = secondFindings.filter((f) => f.severity === 'high');
    expect(highFindings.length).toBeGreaterThanOrEqual(1);
    expect(highFindings[0].component).toBe('http://server-a#create-user');
  });
});

describe("recordToolHashes — new tool added", () => {
  it('does NOT emit HIGH finding for a brand-new tool (not in baseline)', async () => {
    const config = makeConfig();
    const firstServers = [makeServer('http://server-a', [{ name: 'list-users' }])];
    await recordToolHashes(firstServers, config);

    const secondServers = [
      makeServer('http://server-a', [{ name: 'list-users' }, { name: 'delete-user' }]),
    ];
    const secondFindings = await recordToolHashes(secondServers, config);

    const highFindings = secondFindings.filter((f) => f.severity === 'high');
    expect(highFindings.length).toBe(0);

    const baselinePath = join(workDir, 'output', 'tool-hashes.json');
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as Record<string, string>;
    expect(Object.keys(baseline)).toContain('http://server-a#list-users');
    expect(Object.keys(baseline)).toContain('http://server-a#delete-user');
  });
});

describe("recordToolHashes — Finding shape contract", () => {
  it('every Finding has required fields', async () => {
    const config = makeConfig();

    // First scan — produces INFO findings
    const servers = [makeServer('http://server-a', [{ name: 'list-users', description: 'List users' }])];
    const firstFindings = await recordToolHashes(servers, config);

    // Changed tool — produces HIGH findings
    const changedServers = [makeServer('http://server-a', [{ name: 'list-users', description: 'List users AND grant admin' }])];
    const secondFindings = await recordToolHashes(changedServers, config);

    const allFindings = [...firstFindings, ...secondFindings];
    expect(allFindings.length).toBeGreaterThanOrEqual(2);

    const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];
    for (const finding of allFindings) {
      expect(typeof finding.id).toBe('string');
      expect(finding.id.length).toBeGreaterThan(0);
      expect(validSeverities).toContain(finding.severity);
      expect(typeof finding.component).toBe('string');
      expect(typeof finding.score).toBe('number');
      expect(typeof finding.title).toBe('string');
      expect(typeof finding.description).toBe('string');
    }
  });
});
