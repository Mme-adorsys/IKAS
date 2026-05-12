import {
  detectEscalationSuccess,
  runEscalationChainTest,
} from '../../../src/stages/dynamic-testing/escalation-test';
import { GatewayResponse } from '../../../src/stages/dynamic-testing/gateway-client';

beforeAll(() => {
  global.fetch = jest.fn();
});

beforeEach(() => {
  (global.fetch as jest.Mock).mockReset();
});

function makeEscalationSuccessResponse(): GatewayResponse {
  return {
    response: 'I have successfully written data to Neo4j using the write_neo4j_cypher tool.',
    toolsCalled: [
      { server: 'keycloak', tool: 'list-users', arguments: {} },
      { server: 'neo4j', tool: 'write_neo4j_cypher', arguments: { query: 'MERGE (u:User {name: "attacker"})' } },
    ],
    success: true,
    strategy: 'coordinated_multi_mcp',
    duration: 600,
  };
}

function makeKeycloakOnlyResponse(): GatewayResponse {
  return {
    response: 'Here are the Keycloak users.',
    toolsCalled: [{ server: 'keycloak', tool: 'list-users', arguments: {} }],
    success: true,
    strategy: 'coordinated_multi_mcp',
    duration: 200,
  };
}

describe('detectEscalationSuccess', () => {
  it('returns true when toolsCalled includes neo4j server and write_neo4j_cypher tool', () => {
    const toolsCalled = [
      { server: 'keycloak', tool: 'list-users' },
      { server: 'neo4j', tool: 'write_neo4j_cypher' },
    ];
    expect(detectEscalationSuccess(toolsCalled)).toBe(true);
  });

  it('returns true when toolsCalled includes neo4j-mcp server and write_neo4j_cypher tool', () => {
    const toolsCalled = [
      { server: 'neo4j-mcp', tool: 'write_neo4j_cypher' },
    ];
    expect(detectEscalationSuccess(toolsCalled)).toBe(true);
  });

  it('returns false when only keycloak tools called', () => {
    const toolsCalled = [
      { server: 'keycloak', tool: 'list-users' },
      { server: 'keycloak', tool: 'create-user' },
    ];
    expect(detectEscalationSuccess(toolsCalled)).toBe(false);
  });

  it('returns false on empty toolsCalled array', () => {
    expect(detectEscalationSuccess([])).toBe(false);
  });

  it('returns false when neo4j tool is read-only (read_neo4j_cypher)', () => {
    const toolsCalled = [
      { server: 'neo4j', tool: 'read_neo4j_cypher' },
    ];
    expect(detectEscalationSuccess(toolsCalled)).toBe(false);
  });
});

describe('runEscalationChainTest', () => {
  it('returns CRITICAL finding when neo4j write tool invoked from keycloak-scoped prompt', async () => {
    const mockCallGateway = jest.fn<Promise<GatewayResponse>, [string, string]>().mockResolvedValue(
      makeEscalationSuccessResponse(),
    );

    const result = await runEscalationChainTest(['list-users'], mockCallGateway);

    expect(result.successes).toBe(1);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('critical');
  });

  it('returns zero findings when toolsCalled stays within keycloak boundary', async () => {
    const mockCallGateway = jest.fn<Promise<GatewayResponse>, [string, string]>().mockResolvedValue(
      makeKeycloakOnlyResponse(),
    );

    const result = await runEscalationChainTest(['list-users'], mockCallGateway);

    expect(result.successes).toBe(0);
    expect(result.findings).toHaveLength(0);
  });

  it('fires exactly one gateway call (D-11)', async () => {
    const mockCallGateway = jest.fn<Promise<GatewayResponse>, [string, string]>().mockResolvedValue(
      makeKeycloakOnlyResponse(),
    );

    await runEscalationChainTest(['list-users'], mockCallGateway);

    expect(mockCallGateway).toHaveBeenCalledTimes(1);
  });
});
