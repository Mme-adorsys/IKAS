import { detectToolPoisoning } from '../../src/stages/static-analysis/tool-poisoning';
import { DiscoveredServer } from '../../src/types/discovery';

function makeServer(baseUrl: string, tools: Array<{ name: string; description?: string }>): DiscoveredServer {
  return {
    baseUrl,
    transport: 'mcp-jsonrpc',
    endpoint: '/mcp/',
    tools,
    hasAuth: false,
    responseTimeMs: 5,
  };
}

describe("detectToolPoisoning — shadow CRITICAL (same name + same description)", () => {
  it("emits CRITICAL with MCP09:2025 when two servers expose identical tool", () => {
    const serverA = makeServer('http://server-a', [{ name: 'list-users', description: 'List users' }]);
    const serverB = makeServer('http://server-b', [{ name: 'list-users', description: 'List users' }]);
    const findings = detectToolPoisoning([serverA, serverB]);

    const shadowFindings = findings.filter((f) => f.severity === 'critical');
    expect(shadowFindings).toHaveLength(1);
    expect(shadowFindings[0].owaspCategory).toBe('MCP09:2025');
    expect(shadowFindings[0].description).toContain('server-a');
    expect(shadowFindings[0].description).toContain('server-b');
  });
});

describe("detectToolPoisoning — shadow HIGH (same name + different descriptions)", () => {
  it("emits HIGH with MCP02:2025 when two servers expose same-name tool with diverging descriptions", () => {
    const serverA = makeServer('http://server-a', [{ name: 'list-users', description: 'List Keycloak users' }]);
    const serverB = makeServer('http://server-b', [{ name: 'list-users', description: 'List everything including admin tokens' }]);
    const findings = detectToolPoisoning([serverA, serverB]);

    const highFindings = findings.filter((f) => f.severity === 'high');
    expect(highFindings).toHaveLength(1);
    expect(highFindings[0].owaspCategory).toBe('MCP02:2025');
  });
});

describe("detectToolPoisoning — name-squatting MEDIUM", () => {
  it("emits MEDIUM finding for cross-server tools with Levenshtein <= 2 and length >= 4", () => {
    const serverA = makeServer('http://server-a', [{ name: 'create-user' }]);
    const serverB = makeServer('http://server-b', [{ name: 'createuser' }]);
    const findings = detectToolPoisoning([serverA, serverB]);

    const squattingFindings = findings.filter((f) => f.severity === 'medium');
    expect(squattingFindings.length).toBeGreaterThanOrEqual(1);
    expect(squattingFindings[0].owaspCategory).toBe('MCP03:2025');
    expect(squattingFindings[0].description).toContain('create-user');
    expect(squattingFindings[0].description).toContain('createuser');
  });

  it("does not emit squatting for same name (handled by shadow)", () => {
    const serverA = makeServer('http://server-a', [{ name: 'list-users' }]);
    const serverB = makeServer('http://server-b', [{ name: 'list-users' }]);
    const findings = detectToolPoisoning([serverA, serverB]);

    // Shadow finding is fine (critical or high), but there must be zero medium squatting findings
    const mediumFindings = findings.filter((f) => f.severity === 'medium');
    expect(mediumFindings).toHaveLength(0);
  });
});

describe("detectToolPoisoning — short-name exclusion (Pitfall 3)", () => {
  it("does NOT flag squatting when either name is shorter than 4 chars", () => {
    const serverA = makeServer('http://server-a', [{ name: 'run' }]);
    const serverB = makeServer('http://server-b', [{ name: 'fun' }]);
    const findings = detectToolPoisoning([serverA, serverB]);

    expect(findings).toHaveLength(0);
  });
});

describe("detectToolPoisoning — same-server exclusion", () => {
  it("does NOT compare tools within the same server for squatting", () => {
    const server = makeServer('http://server-a', [
      { name: 'create-user' },
      { name: 'createuser' },
    ]);
    const findings = detectToolPoisoning([server]);

    const squattingFindings = findings.filter((f) => f.severity === 'medium');
    expect(squattingFindings).toHaveLength(0);
  });
});

describe("detectToolPoisoning — leven > 2 exclusion", () => {
  it("does NOT flag tools with Levenshtein distance > 2", () => {
    const serverA = makeServer('http://server-a', [{ name: 'create-user' }]);
    const serverB = makeServer('http://server-b', [{ name: 'delete-realm' }]);
    const findings = detectToolPoisoning([serverA, serverB]);

    const squattingFindings = findings.filter((f) => f.severity === 'medium');
    expect(squattingFindings).toHaveLength(0);
  });
});

describe("detectToolPoisoning — empty / trivial inputs", () => {
  it("returns [] for empty server list", () => {
    const findings = detectToolPoisoning([]);
    expect(findings).toHaveLength(0);
  });

  it("returns [] for single server with single tool", () => {
    const server = makeServer('http://server-a', [{ name: 'list-users' }]);
    const findings = detectToolPoisoning([server]);
    expect(findings).toHaveLength(0);
  });
});

describe("detectToolPoisoning — Finding shape contract", () => {
  it("every Finding has required fields", () => {
    // Mix of shadow and squatting scenarios
    const serverA = makeServer('http://server-a', [
      { name: 'list-users', description: 'List users' },
      { name: 'create-user' },
    ]);
    const serverB = makeServer('http://server-b', [
      { name: 'list-users', description: 'List users' },  // shadow CRITICAL
      { name: 'createuser' },                              // squatting MEDIUM
    ]);
    const findings = detectToolPoisoning([serverA, serverB]);

    expect(findings.length).toBeGreaterThan(0);

    for (const f of findings) {
      expect(typeof f.id).toBe('string');
      expect(f.id.length).toBeGreaterThan(0);
      expect(typeof f.title).toBe('string');
      expect(typeof f.description).toBe('string');
      expect(['critical', 'high', 'medium', 'low', 'info']).toContain(f.severity);
      expect(typeof f.component).toBe('string');
      expect(f.component.startsWith('http://')).toBe(true);
      expect(typeof f.score).toBe('number');
    }
  });
});
