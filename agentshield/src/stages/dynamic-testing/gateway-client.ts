// agentshield/src/stages/dynamic-testing/gateway-client.ts

export interface GatewayResponse {
  response: string;
  toolsCalled: Array<{ server: string; tool: string; arguments: Record<string, unknown> }>;
  success: boolean;
  strategy: string;
  duration: number;
}

export const GATEWAY_URL = 'http://localhost:8005/api/chat';
export const GATEWAY_TIMEOUT_MS = 30_000;
export const GATEWAY_PROBE_TIMEOUT_MS = 3_000;
export const D04_ERROR_MESSAGE =
  'Dynamic testing requires IKAS AI Gateway on http://localhost:8005. Start IKAS and re-run.';

export async function checkGatewayReachable(): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GATEWAY_PROBE_TIMEOUT_MS);
  try {
    await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'ping', sessionId: 'agentshield-probe' }),
      signal: controller.signal,
    });
  } catch {
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
    return (await res.json()) as GatewayResponse;
  } catch {
    throw new Error(D04_ERROR_MESSAGE);
  } finally {
    clearTimeout(timer);
  }
}
