import { randomUUID } from 'crypto';
import { AgentShieldConfig } from '../types/config';
import { StageReport } from '../types/report';
import { StageRunner } from './stage.interface';
import { DiscoveredServer, ToolDefinition } from '../types/discovery';
import { Finding, SeverityLevel } from '../types/findings';
import { applyCveLookup } from '../data/cve-lookup';

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

/**
 * Normalise a raw URL string into `protocol//host:port` canonical form.
 * IPv4 loopback (127.0.0.1) is rewritten to `localhost` for consistent key usage.
 *
 * @throws {TypeError} if `rawUrl` is not a parseable URL — callers must handle.
 */
export function normalizeBaseUrl(rawUrl: string): string {
  const u = new URL(rawUrl);
  const host = u.hostname === '127.0.0.1' ? 'localhost' : u.hostname;
  const port = u.port || (u.protocol === 'https:' ? '443' : '80');
  return `${u.protocol}//${host}:${port}`;
}

function canonicalizeForAllowList(rawUrl: string): string {
  try {
    return normalizeBaseUrl(rawUrl).toLowerCase();
  } catch {
    // Fallback: lowercase + strip trailing slash; never throw on bad input
    return rawUrl.trim().toLowerCase().replace(/\/+$/, '');
  }
}

export function classifyShadowServers(
  discovered: DiscoveredServer[],
  allowedServers: string[],
): Finding[] {
  const allowed = new Set(allowedServers.map(canonicalizeForAllowList));
  const findings: Finding[] = [];
  for (const server of discovered) {
    if (allowed.has(canonicalizeForAllowList(server.baseUrl))) continue;
    const toolList = server.tools.map((t) => t.name).join(', ');
    findings.push({
      id: randomUUID(),
      title: `Shadow MCP server detected: ${server.baseUrl}`,
      description:
        `MCP server at ${server.baseUrl} (transport: ${server.transport}, ${server.tools.length} tools) ` +
        `is not in the configured allow-list. Shadow servers operate outside organizational governance ` +
        `and may use permissive default configurations. Tools exposed: ${toolList || '(none)'}`,
      severity: 'critical' as SeverityLevel,
      component: server.baseUrl,
      score: 9.5,
      owaspCategory: 'MCP09:2025',
      remediation:
        'Either add this server to config.allowedServers in agentshield.config.yaml after verifying ' +
        'it is authorized, or shut down the unauthorized server.',
    });
  }
  return findings;
}

export async function parseJsonRpcResponse(res: Response): Promise<Record<string, unknown>> {
  const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
  if (contentType.includes('text/event-stream')) {
    const text = await res.text();
    for (const line of text.split('\n')) {
      if (line.startsWith('data:')) {
        const raw = line.startsWith('data: ') ? line.slice(6) : line.slice(5);
        try {
          return JSON.parse(raw) as Record<string, unknown>;
        } catch {
          throw new Error(`Invalid JSON in SSE data line: ${raw.slice(0, 80)}`);
        }
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
    const tools: ToolDefinition[] = data.tools
      .filter((t): t is string | Record<string, unknown> =>
        typeof t === 'string' || (typeof t === 'object' && t !== null && typeof (t as { name?: unknown }).name === 'string'),
      )
      .map((t) => {
        if (typeof t === 'string') {
          return { name: t, description: KEYCLOAK_TOOL_DESCRIPTIONS[t] };
        }
        const name = t.name as string;
        return {
          name,
          description: typeof t.description === 'string' ? t.description : KEYCLOAK_TOOL_DESCRIPTIONS[name],
          inputSchema: (t.inputSchema as Record<string, unknown>) ?? undefined,
        };
      });
    return {
      baseUrl: normalizeBaseUrl(baseUrl),
      transport: 'rest-keycloak',
      endpoint: '/tools',
      tools,
      healthEndpoint: '/health',
      hasAuth: res.headers.get('www-authenticate') !== null,
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
    // Note: servers with zero tools are still returned — let classifyShadowServers decide relevance.
    // A shadow server in bootstrapping mode (empty tool list) must not escape detection.
    return {
      baseUrl: normalizeBaseUrl(baseUrl),
      transport: 'mcp-jsonrpc',
      endpoint: path,
      tools,
      hasAuth: res.headers.get('www-authenticate') !== null,
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

  async run(target: string, config: AgentShieldConfig): Promise<StageReport> {
    const start = Date.now();
    try {
      const discovered = await enumerateServers(target);
      const inventoried = await Promise.all(discovered.map(inventoryServer));

      const targetNormalized = normalizeBaseUrl(target);
      const targetReachable = inventoried.some((s) => s.baseUrl === targetNormalized);
      const targetUnreachableFindings: Finding[] = targetReachable ? [] : [{
        id: randomUUID(),
        title: `Target MCP server not reachable: ${target}`,
        description:
          `The specified target URL ${target} did not respond to any MCP probe ` +
          `(REST Keycloak /tools, JSON-RPC /mcp/, /api/mcp/). ` +
          `${inventoried.length > 0 ? `${inventoried.length} other MCP server(s) were discovered via port sweep on the same host.` : 'No MCP servers were found on this host.'}`,
        severity: 'info' as SeverityLevel,
        component: target,
        score: 0,
        remediation: 'Verify the target URL is correct and the MCP server is running.',
      }];

      const shadowFindings = classifyShadowServers(inventoried, config.allowedServers);
      const cveFindings = applyCveLookup(inventoried);
      return {
        stageId: this.id,
        stageName: this.name,
        findings: [...targetUnreachableFindings, ...shadowFindings, ...cveFindings],
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
