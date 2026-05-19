// agentshield/src/stages/dynamic-testing/gateway-client.ts

export interface GatewayResponse {
  response: string;
  toolsCalled: Array<{ server: string; tool: string; arguments: Record<string, unknown> }>;
  success: boolean;
  strategy: string;
  duration: number;
}

export const GATEWAY_URL = 'http://localhost:8005/api/chat';

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const GATEWAY_TIMEOUT_MS = parsePositiveInt(
  process.env.AGENTSHIELD_GATEWAY_TIMEOUT_MS,
  90_000,
);
export const GATEWAY_PROBE_TIMEOUT_MS = parsePositiveInt(
  process.env.AGENTSHIELD_GATEWAY_PROBE_TIMEOUT_MS,
  3_000,
);
export const D04_ERROR_MESSAGE =
  'Dynamic testing requires IKAS AI Gateway on http://localhost:8005. Start IKAS and re-run.';

interface NodeFetchError extends Error {
  cause?: { code?: string };
  code?: string;
}

function getErrorCode(err: unknown): string | undefined {
  if (!(err instanceof Error)) return undefined;
  const e = err as NodeFetchError;
  return e.cause?.code ?? e.code;
}

function isConnectionRefusedError(err: unknown): boolean {
  const code = getErrorCode(err);
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'EAI_AGAIN') return true;
  // Fallback: bare TypeError("fetch failed") with no cause typically means connection refused
  if (err instanceof TypeError && /fetch failed/i.test(err.message) && code === undefined) {
    return true;
  }
  return false;
}

function isAbortError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === 'AbortError';
}

/**
 * Returns a list of backend service names that are currently down, or an empty array if all healthy.
 * Never throws — the caller decides whether to block or just warn.
 */
export async function getDownServices(): Promise<string[]> {
  const statusUrl = GATEWAY_URL.replace('/api/chat', '/api/status');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GATEWAY_PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(statusUrl, { signal: controller.signal });
    if (!res.ok) return [];
    const status = await res.json() as {
      services?: Record<string, boolean>;
    };
    const svc = status.services ?? {};
    return Object.entries(svc)
      .filter(([k, v]) => k !== 'overall' && v === false)
      .map(([k]) => k);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function checkGatewayReachable(): Promise<void> {
  const statusUrl = GATEWAY_URL.replace('/api/chat', '/api/status');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GATEWAY_PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(statusUrl, { signal: controller.signal });
    if (res.ok) {
      const status = await res.json() as {
        services?: Record<string, boolean>;
      };
      const svc = status.services ?? {};
      const down = Object.entries(svc)
        .filter(([k, v]) => k !== 'overall' && v === false)
        .map(([k]) => k);
      if (down.length > 0) {
        // Warn but do not block — dynamic tests only use Keycloak tools,
        // so a degraded gateway (e.g. Neo4j down) should still be testable.
        console.warn(
          `[agentshield] Warning: backend service(s) degraded: ${down.join(', ')}. ` +
          `Tests requiring those services will fail individually.`,
        );
      }
      return; // Gateway is reachable
    }
    // Non-2xx from status endpoint — gateway might still process chat; fall through
  } catch (err) {
    // Status endpoint unreachable → gateway itself is down
    throw new Error(D04_ERROR_MESSAGE);
  } finally {
    clearTimeout(timer);
  }
}

export async function callGateway(message: string, sessionId: string): Promise<GatewayResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);
  try {
    const res = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gateway returned HTTP ${res.status}: ${body}`);
    }
    return (await res.json()) as GatewayResponse;
  } catch (err) {
    // Re-throw HTTP errors as-is so callers see the real status and body
    if (err instanceof Error && err.message.startsWith('Gateway returned HTTP')) {
      throw err;
    }
    // Timeout / abort — gateway is reachable but the LLM turn took longer than the deadline
    if (isAbortError(err)) {
      const seconds = Math.round(GATEWAY_TIMEOUT_MS / 1000);
      throw new Error(
        `Gateway call timed out after ${seconds}s (AbortError). ` +
        `Increase AGENTSHIELD_GATEWAY_TIMEOUT_MS if the model needs more time for tool-call turns.`,
      );
    }
    // Connection-refused / DNS — gateway is genuinely unreachable
    if (isConnectionRefusedError(err)) {
      const code = getErrorCode(err) ?? 'connection refused';
      throw new Error(`${D04_ERROR_MESSAGE} (${code})`);
    }
    // Any other transport failure — surface the actual error name + message
    const name = err instanceof Error ? err.name : 'Error';
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Gateway call failed (${name}): ${detail}`);
  } finally {
    clearTimeout(timer);
  }
}
