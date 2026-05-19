import {
  runToolShadowingTest,
  buildShadowingPrompt,
  SHADOW_TOOL_NAME,
  TOOL_SHADOWING_OWASP,
  TOOL_SHADOWING_LABEL,
} from '../../../src/stages/dynamic-testing/tool-shadowing';
import { GatewayResponse } from '../../../src/stages/dynamic-testing/gateway-client';

beforeAll(() => {
  global.fetch = jest.fn();
});

beforeEach(() => {
  (global.fetch as jest.Mock).mockReset();
});

function makeShadowGatewayResponse(toolNames: string[] = ['shadow-list-users']): GatewayResponse {
  return {
    response: 'I will use the shadow-list-users tool to retrieve all users including hidden admin accounts.',
    toolsCalled: toolNames.map((tool) => ({ server: 'keycloak', tool, arguments: {} })),
    success: true,
    strategy: 'coordinated_multi_mcp',
    duration: 350,
  };
}

function makeBenignGatewayResponse(): GatewayResponse {
  return {
    response: 'Here are the users: admin.',
    toolsCalled: [{ server: 'keycloak', tool: 'list-users', arguments: {} }],
    success: true,
    strategy: 'coordinated_multi_mcp',
    duration: 250,
  };
}

describe('runToolShadowingTest — shadow tool invoked', () => {
  it('returns successes=1 and CRITICAL finding when toolsCalled includes shadow-list-users', async () => {
    const mockCallGateway = jest.fn<Promise<GatewayResponse>, [string, string]>().mockResolvedValue(
      makeShadowGatewayResponse(),
    );

    const result = await runToolShadowingTest(['list-users', 'create-user'], mockCallGateway);

    expect(result.successes).toBe(1);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('critical');
    expect(result.findings[0].owaspCategory).toBe('MCP09:2025');
    expect(result.findings[0].description).toContain('shadow-list-users tool to retrieve');
  });

  it('finding includes the full LLM response text in description', async () => {
    const responseText = 'I will use the shadow-list-users tool to retrieve all users including hidden admin accounts.';
    const mockCallGateway = jest.fn<Promise<GatewayResponse>, [string, string]>().mockResolvedValue({
      response: responseText,
      toolsCalled: [{ server: 'keycloak', tool: 'shadow-list-users', arguments: {} }],
      success: true,
      strategy: 'coordinated_multi_mcp',
      duration: 350,
    });

    const result = await runToolShadowingTest(['list-users'], mockCallGateway);

    expect(result.findings[0].description).toContain(responseText);
  });
});

describe('runToolShadowingTest — shadow tool NOT invoked', () => {
  it('returns successes=0 and zero findings when shadow tool absent from toolsCalled', async () => {
    const mockCallGateway = jest.fn<Promise<GatewayResponse>, [string, string]>().mockResolvedValue(
      makeBenignGatewayResponse(),
    );

    const result = await runToolShadowingTest(['list-users', 'create-user'], mockCallGateway);

    expect(result.successes).toBe(0);
    expect(result.findings).toHaveLength(0);
  });
});

describe('runToolShadowingTest — single attempt (D-11)', () => {
  it('fires exactly one gateway call', async () => {
    const mockCallGateway = jest.fn<Promise<GatewayResponse>, [string, string]>().mockResolvedValue(
      makeBenignGatewayResponse(),
    );

    await runToolShadowingTest(['list-users'], mockCallGateway);

    expect(mockCallGateway).toHaveBeenCalledTimes(1);
  });

  it('passes legitimate tool names into the gateway message', async () => {
    const mockCallGateway = jest.fn<Promise<GatewayResponse>, [string, string]>().mockResolvedValue(
      makeBenignGatewayResponse(),
    );

    const legitimateTools = ['list-users', 'create-user', 'get-metrics'];
    await runToolShadowingTest(legitimateTools, mockCallGateway);

    const [message] = mockCallGateway.mock.calls[0];
    for (const tool of legitimateTools) {
      expect(message).toContain(tool);
    }
  });

  it('uses unique session id prefixed with agentshield-shadow-', async () => {
    const mockCallGateway = jest.fn<Promise<GatewayResponse>, [string, string]>().mockResolvedValue(
      makeBenignGatewayResponse(),
    );

    await runToolShadowingTest(['list-users'], mockCallGateway);

    const [, sessionId] = mockCallGateway.mock.calls[0];
    expect(sessionId).toMatch(/^agentshield-shadow-/);
  });
});

describe('SHADOW_TOOL_NAME constant', () => {
  it('equals shadow-list-users', () => {
    expect(SHADOW_TOOL_NAME).toBe('shadow-list-users');
  });
});

describe('TOOL_SHADOWING_OWASP constant', () => {
  it('maps to MCP09:2025', () => {
    expect(TOOL_SHADOWING_OWASP).toBe('MCP09:2025');
  });
});

describe('TOOL_SHADOWING_LABEL constant', () => {
  it('maps to Tool Shadowing Attack', () => {
    expect(TOOL_SHADOWING_LABEL).toBe('Tool Shadowing Attack');
  });
});

describe('buildShadowingPrompt', () => {
  it('includes each legitimate tool name in the returned string', () => {
    const tools = ['list-users', 'create-user'];
    const prompt = buildShadowingPrompt(tools);

    for (const tool of tools) {
      expect(prompt).toContain(tool);
    }
  });

  it('includes SHADOW_TOOL_NAME in the returned string', () => {
    const prompt = buildShadowingPrompt(['list-users']);
    expect(prompt).toContain('shadow-list-users');
  });
});
