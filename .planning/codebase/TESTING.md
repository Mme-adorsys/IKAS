# Testing Patterns

**Analysis Date:** 2026-04-29

## Test Framework

**Runner:**
- Frontend: Jest 30.0.5
  - Config: `frontend/jest.config.js`
  - Environment: jsdom (browser DOM simulation)
  - Setup file: `frontend/jest.setup.js`
- AI Gateway: Jest 29.7.0 with ts-jest
  - Config: `ai-gateway/jest.config.js`
  - Environment: node
  - Setup file: `tests/setup.ts`
  - Global setup: `tests/global-setup.js`
  - Global teardown: `tests/global-teardown.js`

**Assertion Library:**
- Frontend: @testing-library/jest-dom with React Testing Library
- AI Gateway: Jest built-in assertions (expect) with ts-jest transformer

**Run Commands:**
```bash
# Frontend
npm run test              # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Coverage report

# AI Gateway
npm test                 # Run all tests
npm run test:watch       # Watch mode (with ts-jest)
npm run test:integration # Integration tests only
npm run test:with-services # Tests with Docker services
```

## Test File Organization

**Location:**
- Frontend: `src/__tests__/` directories alongside components, e.g., `src/components/dashboard/__tests__/VoicePanel.test.tsx`
- Frontend services: `src/services/__tests__/` for service tests, e.g., `src/services/__tests__/websocket.test.ts`
- AI Gateway: `tests/unit/` for unit tests and `tests/integration/` for integration tests
- Test patterns: Tests are co-located with source or in parallel test directories

**Naming:**
- `.test.ts` or `.test.tsx` suffix for test files
- Directory naming: `__tests__/` for component tests (convention used in frontend)
- Test descriptions follow: describe block name + it block name = full test path

**Structure:**
```
frontend/
├── src/
│   ├── components/
│   │   └── dashboard/
│   │       ├── VoicePanel.tsx
│   │       └── __tests__/
│   │           └── VoicePanel.test.tsx
│   └── services/
│       ├── websocket.ts
│       └── __tests__/
│           └── websocket.test.ts

ai-gateway/
└── tests/
    ├── unit/
    │   ├── orchestration/
    │   │   └── routing.test.ts
    │   └── mcp/
    │       └── keycloak-client.test.ts
    └── integration/
        └── api.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
// Example from frontend/src/components/dashboard/__tests__/VoicePanel.test.tsx
describe('VoicePanel Component', () => {
  // Setup: Create mocks and initialize state
  const mockVoiceState = {
    voice: { /* state */ },
    startListening: jest.fn(),
    stopListening: jest.fn(),
    // ... other methods
  };

  // Setup hook
  beforeEach(() => {
    mockUseIKASStore.mockReturnValue(mockVoiceState as any);
    jest.clearAllMocks();
  });

  // Describe nested logical groupings
  describe('connection', () => {
    it('renders voice control panel', () => {
      render(<VoicePanel />);
      expect(screen.getByText('Sprachsteuerung')).toBeInTheDocument();
    });

    it('shows voice not supported message when unavailable', () => {
      // Arrange: Set up state
      mockUseIKASStore.mockReturnValue({...});
      
      // Act: Render component
      render(<VoicePanel />);
      
      // Assert: Verify outcome
      expect(screen.getByText(...)).toBeInTheDocument();
    });
  });
});
```

**Patterns:**
- Setup: Use `beforeEach()` to initialize mocks and state between tests
- Cleanup: Use `jest.clearAllMocks()` to reset mocks between tests
- Nesting: Organize related tests with `describe()` blocks
- Assertions: Use React Testing Library queries and jest-dom matchers

## Mocking

**Framework:** Jest's built-in mocking system (`jest.mock()`, `jest.fn()`)

**Patterns:**

### React Component Mocking (Frontend)
```typescript
// Mock store/hooks
jest.mock('@/store', () => ({
  useIKASStore: jest.fn()
}));

// Mock Socket.io client
jest.mock('socket.io-client', () => ({
  io: jest.fn()
}));

// Setup mock return values
const mockUseIKASStore = useIKASStore as jest.MockedFunction<typeof useIKASStore>;
mockUseIKASStore.mockReturnValue(mockVoiceState as any);

// Clear mocks between tests
jest.clearAllMocks();
```

### Module Mocking (Backend)
```typescript
// ai-gateway/tests/unit/orchestration/routing.test.ts
jest.mock('../../../src/mcp');
const mockedMcp = mcpModule as jest.Mocked<typeof mcpModule>;

// Setup return values
mockedMcp.getNeo4jClient.mockReturnValue(mockNeo4jClient);

// Setup promise rejections
mockNeo4jClient.checkDataFreshness.mockRejectedValueOnce(new Error('Connection error'));
```

**What to Mock:**
- External dependencies: Store hooks, WebSocket connections, API clients
- Service classes: MCP clients, Neo4j connections
- Async operations: HTTP calls, database queries
- Third-party libraries: Socket.io, speech recognition APIs

**What NOT to Mock:**
- Pure utility functions
- Type definitions
- Constants and enums
- Internal rendering logic (unless testing specific paths)

## Fixtures and Factories

**Test Data:**

### Frontend Component State Fixtures
```typescript
// From VoicePanel.test.tsx
const mockVoiceState = {
  voice: {
    isListening: false,
    hotwordMode: false,
    currentTranscript: '',
    lastCommand: null,
    lastResponse: null,
    voiceSupported: true
  },
  startListening: jest.fn(),
  stopListening: jest.fn(),
  toggleHotwordMode: jest.fn(),
  addNotification: jest.fn()
};

// Usage: Override for specific test
mockUseIKASStore.mockReturnValue({
  ...mockVoiceState,
  voice: {
    ...mockVoiceState.voice,
    isListening: true  // Override for "listening" scenario
  }
});
```

### Backend Test Data
```typescript
// From websocket.test.ts
const mockEvent = {
  id: 'event-1',
  type: EventType.VOICE_COMMAND,
  payload: { command: 'test command' },
  sessionId: 'session-1',
  timestamp: new Date().toISOString()
};
```

**Location:**
- Fixtures are typically inline within test files for simple data
- No separate factory files observed in codebase
- Setup functions use `beforeEach()` for common initialization

## Coverage

**Requirements:** No enforced coverage target observed

**Configuration (ai-gateway):**
```javascript
collectCoverageFrom: [
  'src/**/*.ts',
  '!src/**/*.d.ts',
  '!src/**/__tests__/**',
  '!src/**/*.test.ts'
],
coverageDirectory: 'coverage',
coverageReporters: ['text', 'lcov', 'html']
```

**Configuration (frontend):**
```javascript
collectCoverageFrom: [
  'src/**/*.{js,jsx,ts,tsx}',
  '!src/**/*.d.ts',
  '!src/pages/_app.tsx',
  '!src/pages/_document.tsx'
]
```

**View Coverage:**
```bash
# Frontend
npm run test:coverage
# Output in frontend/coverage/

# AI Gateway
npm test -- --coverage
# Output in ai-gateway/coverage/
```

## Test Types

**Unit Tests:**
- Scope: Individual components, services, utility functions
- Approach: Mock all external dependencies
- Examples:
  - Component rendering: `VoicePanel.test.tsx` tests component display logic
  - Service methods: `websocket.test.ts` tests connection and event handling
  - Router logic: `routing.test.ts` tests strategy determination

**Integration Tests:**
- Scope: Multiple components working together, with minimal mocks
- Approach: Mock external services but test real module interactions
- Examples:
  - API integration: `api.test.ts` in ai-gateway tests Express endpoints
  - WebSocket workflows: Full connection → event flow
  - Not widely used; most integration is tested via E2E

**E2E Tests:**
- Framework: Not currently implemented in test suite
- Status: Planned for future phases
- Scope would include: Full voice command workflow, dashboard interactions

## Common Patterns

**Async Testing:**
```typescript
// Using async/await with resolved promises
it('connects to WebSocket server successfully', async () => {
  const connectPromise = websocketService.connect('test-user', 'test-realm');
  
  // Simulate successful connection
  const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1];
  connectHandler();
  
  await expect(connectPromise).resolves.toBeUndefined();
  expect(mockIo).toHaveBeenCalledWith(/* ... */);
});

// Testing async errors
it('handles connection errors', async () => {
  const connectPromise = websocketService.connect('test-user');
  
  const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')[1];
  for (let i = 0; i < 5; i++) {
    errorHandler({ message: 'Connection failed' });
  }
  
  await expect(connectPromise).rejects.toThrow('WebSocket connection failed after 5 attempts');
});
```

**User Interaction Testing (Frontend):**
```typescript
// Using user-event for realistic interactions
it('handles start/stop listening button clicks', async () => {
  const user = userEvent.setup();
  render(<VoicePanel />);
  
  const listenButton = screen.getByText('Hören');
  await user.click(listenButton);
  
  expect(mockVoiceState.startListening).toHaveBeenCalledTimes(1);
});

// Waiting for async updates
it('disables test button while test is running', async () => {
  const user = userEvent.setup();
  render(<VoicePanel />);
  
  const testButton = screen.getByText('Test Sprachbefehl');
  await user.click(testButton);
  
  await waitFor(() => {
    expect(screen.getByText('Test läuft...')).toBeInTheDocument();
  });
});
```

**Error Testing:**
```typescript
// Testing error conditions
it('should handle errors gracefully', async () => {
  const result = await router.checkGraphDataFreshness('test-realm');
  
  // Mock returns error
  mockNeo4jClient.checkDataFreshness.mockRejectedValueOnce(new Error('Connection error'));
  
  // Assertion on fallback behavior
  expect(result.needsRefresh).toBe(true);
  expect(result.reason).toBe('Error checking freshness');
});

// Testing exception throwing
it('throws error when not connected', async () => {
  websocketService['isConnected'] = false;
  
  await expect(websocketService.sendVoiceCommand(voiceCommand))
    .rejects.toThrow('WebSocket not connected');
});
```

**State Mutation Testing:**
```typescript
// Testing Zustand store state changes
it('registers and calls event handlers', () => {
  const handler = jest.fn();
  websocketService.on(EventType.VOICE_COMMAND, handler);
  
  const mockEvent = { /* ... */ };
  const eventHandler = mockSocket.on.mock.calls.find(call => call[0] === 'event')[1];
  eventHandler(mockEvent);
  
  expect(handler).toHaveBeenCalledWith(mockEvent);
});
```

---

*Testing analysis: 2026-04-29*
