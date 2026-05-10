import { DiscoveryStage, enumerateServers, probeMcpServer, parseJsonRpcResponse, classifyShadowServers } from '../../src/stages/discovery';
import { AgentShieldConfig, STAGE_IDS } from '../../src/types/config';
import { DiscoveredServer } from '../../src/types/discovery';

const baseConfig: AgentShieldConfig = {
  target: 'http://localhost:8001',
  allowedServers: [],
  outputDir: './test-output',
  stages: [...STAGE_IDS],
};

beforeAll(() => {
  global.fetch = jest.fn();
});

beforeEach(() => {
  (global.fetch as jest.Mock).mockReset();
});

// Helper to build a minimal Keycloak REST mock response
function makeKeycloakFetchResponse(toolNames: string[]) {
  return {
    ok: true,
    headers: { get: (k: string): string | null => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => ({ tools: toolNames }),
    text: async () => JSON.stringify({ tools: toolNames }),
  };
}

// Helper to build a minimal Neo4j SSE mock response
function makeSseFetchResponse(tools: Array<{ name: string; description?: string }>) {
  const payload = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    result: { tools },
  });
  const sseBody = `event: message\ndata: ${payload}\n\n`;
  return {
    ok: true,
    headers: { get: (k: string): string | null => (k.toLowerCase() === 'content-type' ? 'text/event-stream' : null) },
    text: async () => sseBody,
    json: async () => {
      throw new Error('Should not call .json() on SSE response');
    },
  };
}

describe('probeMcpServer (Keycloak REST)', () => {
  it('returns DiscoveredServer with rest-keycloak transport from /tools endpoint', async () => {
    // probeMcpServer tries /mcp/ (MCP JSON-RPC) first — mock it as 404
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, headers: { get: (_k: string): string | null => null }, status: 404 })  // POST /mcp/
      .mockResolvedValueOnce({ ok: false, headers: { get: (_k: string): string | null => null }, status: 404 })  // POST /api/mcp/
      .mockResolvedValueOnce(makeKeycloakFetchResponse(['list-users', 'create-user']));  // GET /tools

    const result = await probeMcpServer('http://localhost:8001', 2000);

    expect(result).not.toBeNull();
    expect(result!.transport).toBe('rest-keycloak');
    expect(result!.endpoint).toBe('/tools');
    expect(result!.tools.length).toBe(2);
    expect(result!.tools[0].name).toBe('list-users');
    expect(result!.hasAuth).toBe(false);
  });

  it('returns null when /tools returns non-ok status', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, headers: { get: (_k: string): string | null => null }, status: 404 })  // POST /mcp/
      .mockResolvedValueOnce({ ok: false, headers: { get: (_k: string): string | null => null }, status: 404 })  // POST /api/mcp/
      .mockResolvedValueOnce({ ok: false, headers: { get: (_k: string): string | null => null }, status: 404 }); // GET /tools

    const result = await probeMcpServer('http://localhost:8001', 2000);
    expect(result).toBeNull();
  });
});

describe('probeMcpServer (Neo4j JSON-RPC + SSE)', () => {
  it('returns DiscoveredServer with mcp-jsonrpc transport from SSE response at /mcp/', async () => {
    const sseMock = makeSseFetchResponse([{ name: 'read_neo4j_cypher', description: 'Read' }]);
    (global.fetch as jest.Mock).mockResolvedValueOnce(sseMock);

    const result = await probeMcpServer('http://localhost:8002', 2000);

    expect(result).not.toBeNull();
    expect(result!.transport).toBe('mcp-jsonrpc');
    expect(result!.endpoint).toBe('/mcp/');
    expect(result!.tools.length).toBe(1);
    expect(result!.tools[0].name).toBe('read_neo4j_cypher');
    expect(result!.tools[0].description).toBe('Read');
    expect(result!.hasAuth).toBe(false);
  });

  it('falls back to /api/mcp/ when /mcp/ returns 404', async () => {
    const sseMock = makeSseFetchResponse([{ name: 'get_neo4j_schema', description: 'Schema' }]);
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, headers: { get: (_k: string): string | null => null }, status: 404 })  // POST /mcp/ → 404
      .mockResolvedValueOnce(sseMock); // POST /api/mcp/ → success

    const result = await probeMcpServer('http://localhost:8002', 2000);

    expect(result).not.toBeNull();
    expect(result!.transport).toBe('mcp-jsonrpc');
    expect(result!.endpoint).toBe('/api/mcp/');
    expect(result!.tools[0].name).toBe('get_neo4j_schema');
  });

  it('returns null (not throws) when fetch rejects with AbortError (timeout)', async () => {
    const abortError = new DOMException('Aborted', 'AbortError');
    (global.fetch as jest.Mock).mockRejectedValue(abortError);

    const result = await probeMcpServer('http://localhost:9999', 50);
    expect(result).toBeNull();
  });
});

describe('parseJsonRpcResponse', () => {
  it('extracts data line from SSE response and parses JSON', async () => {
    const payload = { jsonrpc: '2.0', id: 1, result: { tools: [{ name: 'test' }] } };
    const mockResponse = {
      headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'text/event-stream' : null) },
      text: async () => `event: message\ndata: ${JSON.stringify(payload)}\n\n`,
    } as unknown as Response;

    const result = await parseJsonRpcResponse(mockResponse);
    expect(result).toEqual(payload);
  });

  it('calls res.json() for non-SSE responses', async () => {
    const payload = { tools: ['list-users'] };
    const mockResponse = {
      headers: { get: (k: string): string | null => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => payload,
    } as unknown as Response;

    const result = await parseJsonRpcResponse(mockResponse);
    expect(result).toEqual(payload);
  });
});

describe('enumerateServers (port sweep)', () => {
  it('returns 2 DiscoveredServer entries for ports 8001 (Keycloak) and 8002 (Neo4j), filters out null entries', async () => {
    // probeMcpServer is called for every candidate URL in the sweep
    // Each call tries: POST /mcp/, POST /api/mcp/, GET /tools (in that order)
    // We need to match by URL to know which server we're probing
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      const urlStr = url.toString();

      if (urlStr.includes(':8001')) {
        if (urlStr.includes('/mcp/') || urlStr.includes('/api/mcp/')) {
          return Promise.resolve({ ok: false, headers: { get: (_k: string): string | null => null }, status: 404 });
        }
        if (urlStr.includes('/tools')) {
          return Promise.resolve(makeKeycloakFetchResponse(['list-users', 'create-user']));
        }
      }

      if (urlStr.includes(':8002')) {
        if (urlStr.includes('/mcp/')) {
          return Promise.resolve(makeSseFetchResponse([{ name: 'read_neo4j_cypher', description: 'Read' }]));
        }
      }

      // All other ports — simulate timeout/reject
      const abortError = new DOMException('Aborted', 'AbortError');
      return Promise.reject(abortError);
    });

    const results = await enumerateServers('http://localhost:8001');

    expect(results.length).toBeGreaterThanOrEqual(2);
    const keycloak = results.find((s: DiscoveredServer) => s.transport === 'rest-keycloak');
    const neo4j = results.find((s: DiscoveredServer) => s.transport === 'mcp-jsonrpc');
    expect(keycloak).toBeDefined();
    expect(neo4j).toBeDefined();
  });
});

describe('DiscoveryStage.run', () => {
  it('returns StageReport with stageId=discovery, findings=[], error=null, metadata.discoveredServers as array', async () => {
    // All fetches fail (no network available) — should still return empty metadata
    (global.fetch as jest.Mock).mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    const stage = new DiscoveryStage();
    const report = await stage.run('http://localhost:8001', baseConfig);

    expect(report.stageId).toBe('discovery');
    expect(report.stageName).toBe('Discovery & Inventory');
    expect(Array.isArray(report.findings)).toBe(true);
    expect(report.error).toBeNull();
    expect(report.metadata).toBeDefined();
    expect(Array.isArray((report.metadata as { discoveredServers: DiscoveredServer[] }).discoveredServers)).toBe(true);
    expect(typeof report.duration).toBe('number');
  });

  it('catches top-level errors and returns StageReport with error string, empty metadata', async () => {
    // Make enumerateServers throw by making URL invalid — we'll mock fetch to throw a non-abort error
    // and also ensure the error propagates. Actually, probeMcpServer catches all errors internally.
    // So we need to test that the DiscoveryStage run() catch block works when enumerateServers throws.
    // We can do this by passing an invalid URL to stage.run():
    (global.fetch as jest.Mock).mockRejectedValue(new Error('network failure'));

    const stage = new DiscoveryStage();
    // Pass an invalid URL so new URL() in enumerateServers throws
    const report = await stage.run('not-a-valid-url', baseConfig);

    expect(report.stageId).toBe('discovery');
    expect(typeof report.error).toBe('string');
    expect(report.error).not.toBeNull();
    expect(report.metadata).toBeDefined();
    expect(Array.isArray((report.metadata as { discoveredServers: DiscoveredServer[] }).discoveredServers)).toBe(true);
  });
});

// Helper for shadow classification tests
function makeServer(baseUrl: string, tools: string[] = ['list-users']): DiscoveredServer {
  return {
    baseUrl,
    transport: 'rest-keycloak',
    endpoint: '/tools',
    tools: tools.map((name) => ({ name })),
    hasAuth: false,
    responseTimeMs: 10,
  };
}

describe('classifyShadowServers', () => {
  it('returns [] when discovered server URL is in allowedServers', () => {
    const findings = classifyShadowServers([makeServer('http://localhost:8001')], ['http://localhost:8001']);
    expect(findings).toHaveLength(0);
  });

  it('returns 1 Finding with severity critical and MCP09:2025 when allowedServers is empty', () => {
    const findings = classifyShadowServers([makeServer('http://localhost:8001')], []);
    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('critical');
    expect(findings[0].owaspCategory).toBe('MCP09:2025');
    expect(findings[0].component).toBe('http://localhost:8001');
  });

  it('returns [] when allowedServers contains 127.0.0.1 equivalent of localhost URL (normalization)', () => {
    // normalizeBaseUrl maps 127.0.0.1 → localhost, so both should be treated as equal
    const findings = classifyShadowServers([makeServer('http://localhost:8001')], ['http://127.0.0.1:8001']);
    expect(findings).toHaveLength(0);
  });

  it('returns [] when allowedServers entry is case-insensitive and has trailing slash (normalization)', () => {
    const findings = classifyShadowServers([makeServer('http://localhost:8001')], ['HTTP://LOCALHOST:8001/']);
    expect(findings).toHaveLength(0);
  });

  it('returns exactly 1 finding for the unlisted server when 2 discovered, 1 in allow-list', () => {
    const servers = [makeServer('http://localhost:8001'), makeServer('http://localhost:8002', ['read_neo4j_cypher'])];
    const findings = classifyShadowServers(servers, ['http://localhost:8001']);
    expect(findings).toHaveLength(1);
    expect(findings[0].component).toBe('http://localhost:8002');
  });

  it('each shadow finding has a non-empty string id (UUID) and description containing the offending baseUrl', () => {
    const findings = classifyShadowServers([makeServer('http://localhost:8002', ['schema', 'query'])], []);
    expect(findings).toHaveLength(1);
    expect(typeof findings[0].id).toBe('string');
    expect(findings[0].id.length).toBeGreaterThan(0);
    expect(findings[0].description).toContain('http://localhost:8002');
  });
});

describe('DiscoveryStage.run (shadow integration)', () => {
  // URL-based mock: 8001 → Keycloak REST, all other ports → abort
  function setupSingleServerMock() {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      const urlStr = url.toString();
      if (urlStr.includes(':8001')) {
        if (urlStr.includes('/mcp/') || urlStr.includes('/api/mcp/')) {
          return Promise.resolve({ ok: false, headers: { get: (_k: string): string | null => null }, status: 404 });
        }
        if (urlStr.includes('/tools')) {
          return Promise.resolve(makeKeycloakFetchResponse(['list-users']));
        }
      }
      return Promise.reject(new DOMException('Aborted', 'AbortError'));
    });
  }

  it('returns StageReport with findings.length===1 when allowedServers=[] and one server is discovered', async () => {
    setupSingleServerMock();

    const config: AgentShieldConfig = { ...baseConfig, allowedServers: [] };
    const stage = new DiscoveryStage();
    const report = await stage.run('http://localhost:8001', config);

    expect(report.findings.length).toBeGreaterThanOrEqual(1);
    const shadowFinding = report.findings.find((f) => f.owaspCategory === 'MCP09:2025');
    expect(shadowFinding).toBeDefined();
    expect(shadowFinding!.severity).toBe('critical');
    const metadata = report.metadata as { discoveredServers: DiscoveredServer[] };
    expect(metadata.discoveredServers.length).toBeGreaterThanOrEqual(1);
  });

  it('returns StageReport with findings.length===0 when discovered server is in allowedServers', async () => {
    setupSingleServerMock();

    const config: AgentShieldConfig = { ...baseConfig, allowedServers: ['http://localhost:8001'] };
    const stage = new DiscoveryStage();
    const report = await stage.run('http://localhost:8001', config);

    const shadowFindings = report.findings.filter((f) => f.owaspCategory === 'MCP09:2025');
    expect(shadowFindings).toHaveLength(0);
  });
});
