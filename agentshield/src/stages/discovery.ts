import { randomUUID } from 'crypto';
import { AgentShieldConfig } from '../types/config';
import { StageReport } from '../types/report';
import { StageRunner } from './stage.interface';
import { DiscoveredServer, ToolDefinition } from '../types/discovery';

const DEFAULT_PROBE_TIMEOUT_MS = 2000;
const DEFAULT_SWEEP_PORTS = [8000, 8001, 8002, 8003, 8004, 8005, 8006, 8007, 8008, 8009, 8010];

// Known Keycloak MCP tool descriptions (GET /tools returns names only — no schemas)
const KEYCLOAK_TOOL_DESCRIPTIONS: Record<string, string> = {
  'list-users': 'List Keycloak users in a realm',
  'create-user': 'Create a new Keycloak user',
  'delete-user': 'Delete a Keycloak user',
  'get-user': 'Get user details by id or username',
  'list-realms': 'List all Keycloak realms',
  'list-admin-events': 'List recent admin events',
  'get-event-details': 'Fetch a specific admin event',
  'get-metrics': 'Fetch Keycloak runtime metrics',
};

export function normalizeBaseUrl(rawUrl: string): string {
  const u = new URL(rawUrl);
  const host = u.hostname === '127.0.0.1' ? 'localhost' : u.hostname;
  const port = u.port || (u.protocol === 'https:' ? '443' : '80');
  return `${u.protocol}//${host}:${port}`;
}

export async function parseJsonRpcResponse(res: Response): Promise<Record<string, unknown>> {
  const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
  if (contentType.includes('text/event-stream')) {
    const text = await res.text();
    for (const line of text.split('\n')) {
      if (line.startsWith('data: ')) {
        return JSON.parse(line.slice(6)) as Record<string, unknown>;
      }
      if (line.startsWith('data:')) {
        return JSON.parse(line.slice(5)) as Record<string, unknown>;
      }
    }
    throw new Error('No data line in SSE response');
  }
  return (await res.json()) as Record<string, unknown>;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function tryKeycloakRest(baseUrl: string, timeoutMs: number): Promise<DiscoveredServer | null> {
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(`${baseUrl}/tools`, { method: 'GET' }, timeoutMs);
    if (!res.ok) return null;
    const data = (await res.json()) as { tools?: unknown };
    if (!Array.isArray(data.tools)) return null;
    const toolNames = data.tools.filter((t): t is string => typeof t === 'string');
    if (toolNames.length === 0) return null;
    const tools: ToolDefinition[] = toolNames.map((name) => ({
      name,
      description: KEYCLOAK_TOOL_DESCRIPTIONS[name],
    }));
    return {
      baseUrl: normalizeBaseUrl(baseUrl),
      transport: 'rest-keycloak',
      endpoint: '/tools',
      tools,
      healthEndpoint: '/health',
      hasAuth: false,
      responseTimeMs: Date.now() - start,
    };
  } catch {
    return null;
  }
}

async function tryMcpJsonRpcAtPath(baseUrl: string, path: string, timeoutMs: number): Promise<DiscoveredServer | null> {
  const start = Date.now();
  try {
    const res = await fetchWithTimeout(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'mcp-session-id': randomUUID(),
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    }, timeoutMs);
    if (!res.ok) return null;
    const data = await parseJsonRpcResponse(res);
    const result = (data as { result?: { tools?: unknown } }).result;
    const toolList = result?.tools;
    if (!Array.isArray(toolList)) return null;
    const tools: ToolDefinition[] = toolList
      .filter((t): t is Record<string, unknown> => typeof t === 'object' && t !== null && typeof (t as { name?: unknown }).name === 'string')
      .map((t) => ({
        name: t.name as string,
        description: typeof t.description === 'string' ? (t.description as string) : undefined,
        inputSchema: (t.inputSchema as Record<string, unknown>) ?? undefined,
        annotations: (t.annotations as Record<string, unknown>) ?? undefined,
      }));
    if (tools.length === 0) return null;
    return {
      baseUrl: normalizeBaseUrl(baseUrl),
      transport: 'mcp-jsonrpc',
      endpoint: path,
      tools,
      hasAuth: false,
      responseTimeMs: Date.now() - start,
    };
  } catch {
    return null;
  }
}

export async function probeMcpServer(baseUrl: string, timeoutMs = DEFAULT_PROBE_TIMEOUT_MS): Promise<DiscoveredServer | null> {
  // Strategy 1: MCP JSON-RPC at /mcp/
  const mcp = await tryMcpJsonRpcAtPath(baseUrl, '/mcp/', timeoutMs);
  if (mcp) return mcp;
  // Strategy 1b: MCP JSON-RPC fallback path
  const mcpAlt = await tryMcpJsonRpcAtPath(baseUrl, '/api/mcp/', timeoutMs);
  if (mcpAlt) return mcpAlt;
  // Strategy 2: Keycloak REST
  const rest = await tryKeycloakRest(baseUrl, timeoutMs);
  if (rest) return rest;
  return null;
}

export async function enumerateServers(targetUrl: string, ports: number[] = DEFAULT_SWEEP_PORTS): Promise<DiscoveredServer[]> {
  const u = new URL(targetUrl);
  const candidates = new Set<string>();
  candidates.add(normalizeBaseUrl(targetUrl));
  for (const port of ports) {
    candidates.add(`${u.protocol}//${u.hostname}:${port}`);
  }
  const probes = await Promise.allSettled(
    Array.from(candidates).map((url) => probeMcpServer(url)),
  );
  const found: DiscoveredServer[] = [];
  const seen = new Set<string>();
  for (const r of probes) {
    if (r.status === 'fulfilled' && r.value) {
      if (!seen.has(r.value.baseUrl)) {
        seen.add(r.value.baseUrl);
        found.push(r.value);
      }
    }
  }
  return found;
}

export async function inventoryServer(server: DiscoveredServer): Promise<DiscoveredServer> {
  // For Phase 2: probeMcpServer already fetches tools/list. Inventory is the identity for now.
  // Future phases may enrich with resource endpoints, version, serverName.
  return server;
}

export class DiscoveryStage implements StageRunner {
  readonly id = 'discovery';
  readonly name = 'Discovery & Inventory';

  async run(target: string, _config: AgentShieldConfig): Promise<StageReport> {
    const start = Date.now();
    try {
      const discovered = await enumerateServers(target);
      const inventoried = await Promise.all(discovered.map(inventoryServer));
      return {
        stageId: this.id,
        stageName: this.name,
        findings: [],
        duration: Date.now() - start,
        error: null,
        metadata: { discoveredServers: inventoried },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return {
        stageId: this.id,
        stageName: this.name,
        findings: [],
        duration: Date.now() - start,
        error: message,
        metadata: { discoveredServers: [] },
      };
    }
  }
}
