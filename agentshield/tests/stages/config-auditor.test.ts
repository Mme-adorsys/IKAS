import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { auditConfigFiles } from '../../src/stages/static-analysis/config-auditor';
import { AgentShieldConfig, STAGE_IDS } from '../../src/types/config';

let scanRoot: string;

function makeConfig(overrides: Partial<AgentShieldConfig> = {}): AgentShieldConfig {
  return {
    target: 'http://localhost:8001',
    allowedServers: [],
    outputDir: join(scanRoot, 'output'),
    stages: [...STAGE_IDS],
    ...overrides,
  };
}

beforeEach(() => {
  scanRoot = mkdtempSync(join(tmpdir(), 'cfg-audit-'));
});

afterEach(() => {
  rmSync(scanRoot, { recursive: true, force: true });
});

// High-entropy credential value that passes the entropy threshold (> 3.5 bits/char)
const HIGH_ENTROPY_CRED = 'sk-ant-api03-AbCdEf1234567890XyZqWeRtYuIoPaSdFgHjKlZxCvBnM';
const HIGH_ENTROPY_DC = 'AbCdEf1234567890XyZqWeRtYuIoPaSdFgHjKlZxCvBnM';

describe("auditConfigFiles — credential entropy (D-11)", () => {
  it('flags high-entropy value with credential-keyword key as HIGH', () => {
    writeFileSync(join(scanRoot, '.env'), `ANTHROPIC_API_KEY=${HIGH_ENTROPY_CRED}\n`);
    const findings = auditConfigFiles(makeConfig({ configPaths: [join(scanRoot, '**/*.env')] }));
    const credFinding = findings.find((f) => f.title.includes('ANTHROPIC_API_KEY'));
    expect(credFinding).toBeDefined();
    expect(credFinding!.severity).toBe('high');
    expect(credFinding!.score).toBe(8.5);
    expect(credFinding!.owaspCategory).toBe('MCP07:2025');
    expect(credFinding!.component).toBe(join(scanRoot, '.env'));
    expect(credFinding!.title).toContain('ANTHROPIC_API_KEY');
    // The credential value must NOT be echoed in the description
    expect(credFinding!.description).not.toContain(HIGH_ENTROPY_CRED);
  });

  it('does NOT flag low-entropy placeholder value (admin/password)', () => {
    writeFileSync(
      join(scanRoot, '.env'),
      'KEYCLOAK_ADMIN_PASSWORD=admin\nNEO4J_PASSWORD=password\n',
    );
    const findings = auditConfigFiles(makeConfig({ configPaths: [join(scanRoot, '**/*.env')] }));
    const credFindings = findings.filter((f) => f.severity === 'high');
    expect(credFindings).toHaveLength(0);
  });

  it('does NOT flag env-var reference syntax ${VAR}', () => {
    writeFileSync(join(scanRoot, '.env'), 'API_KEY=${ANTHROPIC_API_KEY}\n');
    const findings = auditConfigFiles(makeConfig({ configPaths: [join(scanRoot, '**/*.env')] }));
    const credFindings = findings.filter((f) => f.severity === 'high');
    expect(credFindings).toHaveLength(0);
  });

  it('does NOT flag angle-bracket placeholder <REPLACE_ME>', () => {
    writeFileSync(join(scanRoot, '.env'), 'SECRET=<REPLACE_ME>\n');
    const findings = auditConfigFiles(makeConfig({ configPaths: [join(scanRoot, '**/*.env')] }));
    const credFindings = findings.filter((f) => f.severity === 'high');
    expect(credFindings).toHaveLength(0);
  });

  it('does NOT flag values whose keys are not credential keywords', () => {
    // High entropy but key name is not a credential keyword
    writeFileSync(join(scanRoot, '.env'), `LOG_LEVEL=${HIGH_ENTROPY_DC}\n`);
    const findings = auditConfigFiles(makeConfig({ configPaths: [join(scanRoot, '**/*.env')] }));
    const credFindings = findings.filter((f) => f.severity === 'high');
    expect(credFindings).toHaveLength(0);
  });
});

describe("auditConfigFiles — insecure transport (D-12)", () => {
  it('flags http:// to public host', () => {
    writeFileSync(join(scanRoot, '.env'), 'API_URL=http://api.example.com\n');
    const findings = auditConfigFiles(makeConfig({ configPaths: [join(scanRoot, '**/*.env')] }));
    const transportFinding = findings.find((f) =>
      f.title.toLowerCase().includes('insecure transport'),
    );
    expect(transportFinding).toBeDefined();
    expect(transportFinding!.severity).toBe('medium');
    expect(transportFinding!.owaspCategory).toBe('MCP07:2025');
  });

  it('does NOT flag http://localhost', () => {
    writeFileSync(join(scanRoot, '.env'), 'API_URL=http://localhost:8005\n');
    const findings = auditConfigFiles(makeConfig({ configPaths: [join(scanRoot, '**/*.env')] }));
    const transportFindings = findings.filter((f) =>
      f.title.toLowerCase().includes('insecure transport'),
    );
    expect(transportFindings).toHaveLength(0);
  });

  it('does NOT flag http://127.0.0.1', () => {
    writeFileSync(join(scanRoot, '.env'), 'API_URL=http://127.0.0.1:8005\n');
    const findings = auditConfigFiles(makeConfig({ configPaths: [join(scanRoot, '**/*.env')] }));
    const transportFindings = findings.filter((f) =>
      f.title.toLowerCase().includes('insecure transport'),
    );
    expect(transportFindings).toHaveLength(0);
  });
});

describe("auditConfigFiles — docker-compose env formats (Pitfall 6)", () => {
  it('handles list format environment block', () => {
    const yaml = [
      'services:',
      '  app:',
      '    environment:',
      `      - KEYCLOAK_ADMIN_PASSWORD=${HIGH_ENTROPY_DC}`,
    ].join('\n');
    writeFileSync(join(scanRoot, 'docker-compose.dev.yml'), yaml);
    const findings = auditConfigFiles(
      makeConfig({ configPaths: [join(scanRoot, '**/*.yml')] }),
    );
    const credFinding = findings.find((f) => f.title.includes('KEYCLOAK_ADMIN_PASSWORD'));
    expect(credFinding).toBeDefined();
    expect(credFinding!.severity).toBe('high');
  });

  it('handles map format environment block', () => {
    const yaml = [
      'services:',
      '  app:',
      '    environment:',
      `      KEYCLOAK_ADMIN_PASSWORD: ${HIGH_ENTROPY_DC}`,
    ].join('\n');
    writeFileSync(join(scanRoot, 'docker-compose.dev.yml'), yaml);
    const findings = auditConfigFiles(
      makeConfig({ configPaths: [join(scanRoot, '**/*.yml')] }),
    );
    const credFinding = findings.find((f) => f.title.includes('KEYCLOAK_ADMIN_PASSWORD'));
    expect(credFinding).toBeDefined();
    expect(credFinding!.severity).toBe('high');
  });
});

describe("auditConfigFiles — configPaths override (D-10)", () => {
  it('honours configPaths when set, ignoring files outside the configured paths', () => {
    mkdirSync(join(scanRoot, 'included'), { recursive: true });
    mkdirSync(join(scanRoot, 'excluded'), { recursive: true });
    writeFileSync(join(scanRoot, 'included', '.env'), `API_KEY=${HIGH_ENTROPY_CRED}\n`);
    writeFileSync(join(scanRoot, 'excluded', '.env'), `API_KEY=${HIGH_ENTROPY_CRED}\n`);

    const findings = auditConfigFiles(
      makeConfig({ configPaths: [join(scanRoot, 'included/**/*.env')] }),
    );

    const excludedFindings = findings.filter((f) =>
      f.component.includes('excluded'),
    );
    expect(excludedFindings).toHaveLength(0);

    const includedFindings = findings.filter((f) =>
      f.component.includes('included'),
    );
    expect(includedFindings.length).toBeGreaterThanOrEqual(1);
  });
});

describe("auditConfigFiles — Pitfall 4 (node_modules exclusion)", () => {
  it('does NOT scan into node_modules', () => {
    mkdirSync(join(scanRoot, 'node_modules', 'foo'), { recursive: true });
    writeFileSync(
      join(scanRoot, 'node_modules', 'foo', '.env'),
      `API_KEY=${HIGH_ENTROPY_CRED}\n`,
    );
    writeFileSync(join(scanRoot, '.env'), `API_KEY=${HIGH_ENTROPY_CRED}\n`);

    const findings = auditConfigFiles(
      makeConfig({ configPaths: [join(scanRoot, '**/*.env')] }),
    );

    const nmFindings = findings.filter((f) =>
      f.component.includes('node_modules'),
    );
    expect(nmFindings).toHaveLength(0);
  });
});

describe("auditConfigFiles — empty inputs", () => {
  it('returns [] for empty configPaths array', () => {
    const findings = auditConfigFiles(makeConfig({ configPaths: [] }));
    expect(findings).toEqual([]);
  });

  it('returns [] for paths matching no files', () => {
    const findings = auditConfigFiles(
      makeConfig({ configPaths: [join(scanRoot, 'nonexistent/*.env')] }),
    );
    expect(findings).toEqual([]);
  });
});

describe("auditConfigFiles — Finding shape contract", () => {
  it('every Finding has required fields', () => {
    writeFileSync(join(scanRoot, '.env'), `API_KEY=${HIGH_ENTROPY_CRED}\nAPI_URL=http://api.example.com\n`);
    const findings = auditConfigFiles(makeConfig({ configPaths: [join(scanRoot, '**/*.env')] }));
    expect(findings.length).toBeGreaterThan(0);
    for (const f of findings) {
      expect(typeof f.id).toBe('string');
      expect(f.id.length).toBeGreaterThan(0);
      expect(typeof f.title).toBe('string');
      expect(f.title.length).toBeGreaterThan(0);
      expect(typeof f.description).toBe('string');
      expect(f.description.length).toBeGreaterThan(0);
      expect(['critical', 'high', 'medium', 'low', 'info']).toContain(f.severity);
      expect(typeof f.component).toBe('string');
      expect(f.component.length).toBeGreaterThan(0);
      expect(typeof f.score).toBe('number');
      expect(typeof f.owaspCategory).toBe('string');
    }
  });
});
