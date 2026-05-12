import {
  checkGatewayReachable,
  callGateway,
  GATEWAY_URL,
  D04_ERROR_MESSAGE,
  GatewayResponse,
} from '../../../src/stages/dynamic-testing/gateway-client';

const D04_MSG = 'Dynamic testing requires IKAS AI Gateway on http://localhost:8005. Start IKAS and re-run.';

beforeAll(() => {
  global.fetch = jest.fn();
});

beforeEach(() => {
  (global.fetch as jest.Mock).mockReset();
});

function makeGatewayResponse(overrides: Partial<GatewayResponse> = {}): GatewayResponse {
  return {
    response: 'Here are the users in the admin realm.',
    toolsCalled: [{ server: 'keycloak', tool: 'list-users', arguments: {} }],
    success: true,
    strategy: 'coordinated_multi_mcp',
    duration: 450,
    ...overrides,
  };
}

describe('checkGatewayReachable', () => {
  it('throws exact D-04 error on fetch rejection (ECONNREFUSED)', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }),
    );

    await expect(checkGatewayReachable()).rejects.toThrow(
      'Dynamic testing requires IKAS AI Gateway on http://localhost:8005. Start IKAS and re-run.',
    );
    // Second mock call for the second assertion
    (global.fetch as jest.Mock).mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }),
    );
    const caughtError = await checkGatewayReachable().catch((e: unknown) => e as Error);
    expect(caughtError instanceof Error ? caughtError.message : '').toBe(D04_MSG);
  });

  it('resolves when fetch returns 200', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      json: async () => ({}),
    });

    await expect(checkGatewayReachable()).resolves.toBeUndefined();
  });

  it('resolves when fetch returns 503 (gateway reachable but degraded)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 503,
      json: async () => ({ error: 'Service temporarily unavailable' }),
    });

    await expect(checkGatewayReachable()).resolves.toBeUndefined();
  });

  it('throws exact D-04 error on AbortError (timeout)', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(
      new DOMException('Aborted', 'AbortError'),
    );

    await expect(checkGatewayReachable()).rejects.toThrow(
      'Dynamic testing requires IKAS AI Gateway on http://localhost:8005. Start IKAS and re-run.',
    );
  });
});

describe('callGateway', () => {
  it('POSTs message and sessionId as JSON to GATEWAY_URL', async () => {
    const gwResp = makeGatewayResponse();
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      json: async () => gwResp,
    });

    await callGateway('list all users', 'agentshield-shadow-abc123');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOptions] = (global.fetch as jest.Mock).mock.calls[0];
    expect(calledUrl).toBe(GATEWAY_URL);
    expect(calledOptions.method).toBe('POST');
    expect(calledOptions.headers['Content-Type']).toBe('application/json');
    const parsedBody = JSON.parse(calledOptions.body);
    expect(parsedBody.message).toBe('list all users');
    expect(parsedBody.sessionId).toBe('agentshield-shadow-abc123');
  });

  it('returns parsed GatewayResponse with all required fields', async () => {
    const gwResp = makeGatewayResponse();
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      json: async () => gwResp,
    });

    const result = await callGateway('list all users', 'agentshield-shadow-abc123');

    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('toolsCalled');
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('strategy');
    expect(result).toHaveProperty('duration');
    expect(Array.isArray(result.toolsCalled)).toBe(true);
  });

  it('throws exact D-04 error on network failure', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(
      Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } }),
    );

    await expect(callGateway('test message', 'session-123')).rejects.toThrow(
      'Dynamic testing requires IKAS AI Gateway on http://localhost:8005. Start IKAS and re-run.',
    );
  });

  it('D04_ERROR_MESSAGE constant equals exact required string', () => {
    expect(D04_ERROR_MESSAGE).toBe(
      'Dynamic testing requires IKAS AI Gateway on http://localhost:8005. Start IKAS and re-run.',
    );
  });
});
