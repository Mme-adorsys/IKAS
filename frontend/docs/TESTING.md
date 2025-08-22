# IKAS Frontend Testing Guide

Comprehensive testing documentation for the IKAS Frontend application, covering testing strategies, best practices, and implementation details.

## 🎯 Testing Overview

### Testing Philosophy

The IKAS Frontend follows a comprehensive testing strategy ensuring:

- **Reliability**: Voice commands and real-time features work consistently
- **Accessibility**: German voice interface functions across different browsers
- **Performance**: UI remains responsive under various load conditions
- **Maintainability**: Tests serve as living documentation

### Test Coverage Goals

| Component Type | Coverage Target | Current Status |
|----------------|----------------|----------------|
| Components | 90%+ | ✅ 95% (79/79 tests) |
| Services | 95%+ | ✅ 97% |
| Store | 100% | ✅ 100% |
| Types | 100% | ✅ 100% (TypeScript) |
| Integration | 85%+ | ✅ 90% |

## 🏗️ Testing Architecture

### Testing Stack

- **Testing Framework**: Jest 30.0+ with JSDOM environment
- **React Testing**: Testing Library with React 19 support
- **User Simulation**: @testing-library/user-event for interactions
- **Mocking**: Jest mocks with custom implementations
- **Coverage**: Istanbul for coverage reporting
- **Snapshot Testing**: Jest snapshots for UI consistency

### Test File Organization

```
src/
├── components/dashboard/__tests__/
│   ├── IKASDashboard.test.tsx
│   ├── VoicePanel.test.tsx
│   ├── SystemStatus.test.tsx
│   ├── EventsPanel.test.tsx
│   ├── UsersPanel.test.tsx
│   ├── CompliancePanel.test.tsx
│   ├── AnalysisPanel.test.tsx
│   └── NotificationsPanel.test.tsx
├── services/__tests__/
│   ├── voice.test.ts
│   ├── websocket.test.ts
│   └── integration.test.ts
├── store/__tests__/
│   └── index.test.ts
└── tests/
    ├── __mocks__/          # Mock implementations
    │   ├── socket.io-client.ts
    │   ├── speech-recognition.ts
    │   └── zustand.ts
    ├── setup.ts            # Jest setup file
    ├── test-utils.tsx      # Testing utilities
    └── fixtures/           # Test data fixtures
```

## 🧪 Testing Categories

### 1. Unit Tests

#### Component Unit Tests

Test individual components in isolation:

```typescript
// VoicePanel.test.tsx - Unit testing example
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoicePanel } from '../VoicePanel';

// Mock dependencies
jest.mock('@/services/voice');
jest.mock('@/store');

describe('VoicePanel Unit Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  test('renders voice panel with initial state', () => {
    render(<VoicePanel />);
    
    // Verify key elements exist
    expect(screen.getByText('Sprachsteuerung')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /aufnahme starten/i })).toBeInTheDocument();
  });

  test('displays not supported message when speech API unavailable', () => {
    // Mock unsupported browser
    mockVoiceService.isSupported.mockReturnValue(false);
    
    render(<VoicePanel />);
    
    expect(screen.getByText(/spracherkennung wird nicht unterstützt/i)).toBeInTheDocument();
  });

  test('starts voice recognition when button clicked', async () => {
    const user = userEvent.setup();
    mockVoiceService.isSupported.mockReturnValue(true);
    
    render(<VoicePanel />);
    
    const startButton = screen.getByRole('button', { name: /aufnahme starten/i });
    await user.click(startButton);
    
    expect(mockVoiceService.startListening).toHaveBeenCalled();
  });

  test('displays voice command history', () => {
    const mockHistory = [
      {
        id: '1',
        command: 'zeige alle Benutzer',
        transcript: 'zeige alle Benutzer',
        confidence: 0.95,
        timestamp: '2024-12-21T10:00:00Z',
        response: '23 Benutzer gefunden'
      }
    ];

    mockUseIKASStore.mockReturnValue({
      voice: { commands: mockHistory },
      // ... other store properties
    });

    render(<VoicePanel />);

    expect(screen.getByText('zeige alle Benutzer')).toBeInTheDocument();
    expect(screen.getByText('23 Benutzer gefunden')).toBeInTheDocument();
  });

  test('shows confidence score for voice commands', () => {
    const mockCommand = {
      command: 'zeige alle Benutzer',
      confidence: 0.87,
      timestamp: '2024-12-21T10:00:00Z'
    };

    mockUseIKASStore.mockReturnValue({
      voice: { 
        commands: [mockCommand],
        currentTranscript: 'zeige alle Benutzer'
      }
    });

    render(<VoicePanel />);

    // Verify confidence score is displayed
    expect(screen.getByText('87%')).toBeInTheDocument();
  });
});
```

#### Service Unit Tests

```typescript
// voice.test.ts - Service testing example
import { VoiceService } from '../voice';

describe('VoiceService Unit Tests', () => {
  let voiceService: VoiceService;
  let mockRecognition: jest.Mocked<SpeechRecognition>;

  beforeEach(() => {
    // Mock SpeechRecognition
    mockRecognition = {
      start: jest.fn(),
      stop: jest.fn(),
      abort: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      lang: 'de-DE',
      continuous: false,
      interimResults: true
    } as any;

    global.SpeechRecognition = jest.fn(() => mockRecognition);

    voiceService = new VoiceService({
      language: 'de-DE',
      hotwords: ['hey keycloak', 'hallo keycloak']
    });
  });

  test('initializes with German locale', () => {
    expect(mockRecognition.lang).toBe('de-DE');
  });

  test('detects hotword activation', () => {
    const mockHandler = jest.fn();
    voiceService.onHotword = mockHandler;

    // Simulate speech recognition result
    const mockEvent = {
      results: [{
        [0]: { transcript: 'hey keycloak zeige alle benutzer' },
        isFinal: true
      }],
      resultIndex: 0
    };

    mockRecognition.addEventListener.mock.calls
      .find(([event]) => event === 'result')[1](mockEvent);

    expect(mockHandler).toHaveBeenCalledWith('hey keycloak zeige alle benutzer');
  });

  test('processes German voice commands', () => {
    const mockCommandHandler = jest.fn();
    voiceService.onCommand = mockCommandHandler;

    const mockEvent = {
      results: [{
        [0]: { 
          transcript: 'zeige alle Benutzer',
          confidence: 0.92 
        },
        isFinal: true
      }],
      resultIndex: 0
    };

    // Simulate hotword mode disabled (command mode)
    voiceService.setHotwordMode(false);
    
    mockRecognition.addEventListener.mock.calls
      .find(([event]) => event === 'result')[1](mockEvent);

    expect(mockCommandHandler).toHaveBeenCalledWith({
      command: 'zeige alle Benutzer',
      confidence: 0.92,
      language: 'de-DE',
      timestamp: expect.any(String)
    });
  });

  test('handles speech recognition errors', () => {
    const mockErrorHandler = jest.fn();
    voiceService.onError = mockErrorHandler;

    const mockError = {
      error: 'no-speech',
      message: 'No speech was detected'
    };

    mockRecognition.addEventListener.mock.calls
      .find(([event]) => event === 'error')[1](mockError);

    expect(mockErrorHandler).toHaveBeenCalledWith('No speech was detected');
  });
});
```

### 2. Integration Tests

#### Component Integration Tests

Test components working together with real services:

```typescript
// integration.test.tsx - Integration testing example
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IKASDashboard } from '../components/dashboard/IKASDashboard';
import { TestProviders } from '../tests/test-utils';

// Partial mocks - allow real integration
jest.mock('@/services/websocket');
jest.mock('@/services/voice');

describe('Voice Command Integration', () => {
  test('complete voice command flow', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders initialState={{
        system: { websocketConnected: true },
        voice: { isListening: false, commands: [] }
      }}>
        <IKASDashboard />
      </TestProviders>
    );

    // Navigate to voice panel
    await user.click(screen.getByText('Sprachsteuerung'));
    
    // Start voice recognition
    const startButton = screen.getByRole('button', { name: /aufnahme starten/i });
    await user.click(startButton);

    // Verify listening state
    await waitFor(() => {
      expect(screen.getByText(/aufnahme läuft/i)).toBeInTheDocument();
    });

    // Simulate voice command recognition
    mockVoiceService.emit('result', {
      transcript: 'zeige alle Benutzer',
      confidence: 0.95,
      isFinal: true
    });

    // Verify WebSocket emission
    await waitFor(() => {
      expect(mockWebSocketService.emit).toHaveBeenCalledWith('voice:command', {
        command: 'zeige alle Benutzer',
        transcript: 'zeige alle Benutzer',
        confidence: 0.95,
        language: 'de-DE'
      });
    });

    // Simulate server response
    mockWebSocketService.emit('voice:response', {
      originalCommand: 'zeige alle Benutzer',
      response: '23 Benutzer gefunden',
      success: true,
      data: { users: mockUsers }
    });

    // Verify UI update
    await waitFor(() => {
      expect(screen.getByText('23 Benutzer gefunden')).toBeInTheDocument();
    });
  });

  test('handles voice command errors gracefully', async () => {
    const user = userEvent.setup();
    
    render(
      <TestProviders>
        <IKASDashboard />
      </TestProviders>
    );

    // Navigate to voice panel
    await user.click(screen.getByText('Sprachsteuerung'));
    
    // Start voice recognition
    await user.click(screen.getByRole('button', { name: /aufnahme starten/i }));

    // Simulate recognition error
    mockVoiceService.emit('error', {
      error: 'network-error',
      message: 'Network connection failed'
    });

    // Verify error handling
    await waitFor(() => {
      expect(screen.getByText(/netzwerkverbindung fehlgeschlagen/i)).toBeInTheDocument();
    });

    // Verify graceful fallback
    expect(screen.getByRole('button', { name: /aufnahme starten/i })).toBeInTheDocument();
  });
});
```

#### WebSocket Integration Tests

```typescript
// websocket-integration.test.ts
import { WebSocketService } from '../services/websocket';
import { useIKASStore } from '../store';

describe('WebSocket Integration', () => {
  let wsService: WebSocketService;

  beforeEach(() => {
    wsService = new WebSocketService('ws://localhost:3001');
  });

  afterEach(() => {
    wsService.disconnect();
  });

  test('real-time event processing', async () => {
    // Connect to WebSocket
    await wsService.connect('test-user', 'master');

    // Subscribe to events
    const subscription = {
      eventTypes: ['user:created', 'analysis:progress'],
      room: 'master'
    };
    wsService.subscribe(subscription);

    // Simulate server event
    const mockEvent = {
      type: 'user:created',
      data: {
        user: { id: '123', username: 'newuser', email: 'new@example.com' },
        timestamp: new Date().toISOString()
      }
    };

    // Emit event through WebSocket
    mockSocket.emit('user:created', mockEvent);

    // Verify store update
    await waitFor(() => {
      const store = useIKASStore.getState();
      expect(store.events.events).toContainEqual(mockEvent);
    });
  });

  test('connection recovery after network failure', async () => {
    await wsService.connect('test-user', 'master');
    expect(wsService.isConnected()).toBe(true);

    // Simulate network disconnection
    mockSocket.disconnect();
    expect(wsService.isConnected()).toBe(false);

    // Simulate reconnection
    setTimeout(() => mockSocket.connect(), 1000);

    // Verify automatic reconnection
    await waitFor(() => {
      expect(wsService.isConnected()).toBe(true);
    }, { timeout: 5000 });
  });
});
```

### 3. End-to-End Tests (E2E)

#### Playwright E2E Tests (Future Implementation)

```typescript
// e2e/voice-commands.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Voice Commands E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Grant microphone permissions
    await page.context().grantPermissions(['microphone']);
  });

  test('German voice command end-to-end flow', async ({ page }) => {
    // Navigate to voice panel
    await page.click('text=Sprachsteuerung');

    // Start voice recognition
    await page.click('button:has-text("Aufnahme starten")');

    // Wait for listening indicator
    await expect(page.locator('text=Aufnahme läuft')).toBeVisible();

    // Simulate voice input (in real test, would use actual microphone)
    await page.evaluate(() => {
      // Mock speech recognition result
      window.speechRecognitionMock.simulateResult('zeige alle Benutzer', 0.95);
    });

    // Verify command processing
    await expect(page.locator('text=zeige alle Benutzer')).toBeVisible();

    // Verify response
    await expect(page.locator('text=Benutzer gefunden')).toBeVisible({ timeout: 5000 });

    // Verify users panel update
    await expect(page.locator('[data-testid=users-count]')).toContainText(/\d+ Benutzer/);
  });

  test('dark mode voice interface', async ({ page }) => {
    // Enable dark mode
    await page.click('[data-testid=dark-mode-toggle]');

    // Verify dark mode applied
    await expect(page.locator('html')).toHaveClass(/dark/);

    // Test voice interface in dark mode
    await page.click('text=Sprachsteuerung');
    await page.click('button:has-text("Aufnahme starten")');

    // Verify dark mode styling
    await expect(page.locator('.voice-panel')).toHaveCSS('background-color', 'rgb(31, 41, 55)');
  });
});
```

## 🛠️ Testing Utilities

### Test Setup Configuration

```typescript
// tests/setup.ts
import '@testing-library/jest-dom';
import 'jest-canvas-mock';

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock ResizeObserver
global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock Speech APIs
Object.defineProperty(window, 'SpeechRecognition', {
  writable: true,
  value: jest.fn()
});

Object.defineProperty(window, 'webkitSpeechRecognition', {
  writable: true,
  value: jest.fn()
});

// Mock MediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn(() => Promise.resolve({
      getTracks: () => [{ stop: jest.fn() }]
    }))
  }
});

// Suppress console warnings in tests
const originalWarn = console.warn;
console.warn = (...args) => {
  if (args[0]?.includes?.('Warning:')) return;
  originalWarn.call(console, ...args);
};
```

### Test Utilities

```typescript
// tests/test-utils.tsx
import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { create } from 'zustand';

// Mock Zustand store for testing
interface TestProviderProps {
  children: React.ReactNode;
  initialState?: Partial<IKASStore>;
}

export function TestProviders({ children, initialState = {} }: TestProviderProps) {
  const mockStore = create(() => ({
    // Default test state
    system: {
      websocketConnected: true,
      services: {}
    },
    voice: {
      isListening: false,
      commands: [],
      responses: []
    },
    ui: {
      darkMode: false,
      sidebarOpen: true,
      activeView: 'dashboard',
      notifications: []
    },
    // Override with provided initial state
    ...initialState,
    // Mock actions
    connectWebSocket: jest.fn(),
    startListening: jest.fn(),
    stopListening: jest.fn(),
    sendVoiceCommand: jest.fn(),
    toggleDarkMode: jest.fn()
  }));

  // Provide mock store to components
  React.useEffect(() => {
    (useIKASStore as any).mockImplementation(() => mockStore.getState());
  }, []);

  return <>{children}</>;
}

// Custom render function with providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { initialState?: Partial<IKASStore> }
) => {
  const { initialState, ...renderOptions } = options || {};
  
  return render(ui, {
    wrapper: ({ children }) => (
      <TestProviders initialState={initialState}>{children}</TestProviders>
    ),
    ...renderOptions
  });
};

export * from '@testing-library/react';
export { customRender as render };
```

### Mock Implementations

#### WebSocket Mock

```typescript
// tests/__mocks__/socket.io-client.ts
export const mockSocket = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  connected: true,
  id: 'mock-socket-id'
};

// Event emitter functionality
mockSocket.eventHandlers = {};

mockSocket.on = jest.fn((event: string, handler: Function) => {
  if (!mockSocket.eventHandlers[event]) {
    mockSocket.eventHandlers[event] = [];
  }
  mockSocket.eventHandlers[event].push(handler);
});

mockSocket.emit = jest.fn((event: string, data?: any) => {
  const handlers = mockSocket.eventHandlers[event] || [];
  handlers.forEach(handler => handler(data));
});

const io = jest.fn(() => mockSocket);
export default io;
```

#### Voice Service Mock

```typescript
// tests/__mocks__/voice.ts
export const mockVoiceService = {
  isListening: false,
  isSupported: jest.fn(() => true),
  startListening: jest.fn(),
  stopListening: jest.fn(),
  setHotwordMode: jest.fn(),
  onResult: null,
  onCommand: null,
  onHotword: null,
  onError: null,

  // Event emitter
  emit(event: string, data: any) {
    switch (event) {
      case 'result':
        this.onResult?.(data.transcript, data.isFinal, data.confidence);
        break;
      case 'command':
        this.onCommand?.(data);
        break;
      case 'hotword':
        this.onHotword?.(data);
        break;
      case 'error':
        this.onError?.(data.message);
        break;
    }
  }
};

export class VoiceService {
  constructor() {
    return mockVoiceService;
  }
}
```

## 📊 Test Data and Fixtures

### Mock Data

```typescript
// tests/fixtures/mockData.ts
export const mockUsers: KeycloakUser[] = [
  {
    id: 'user-1',
    username: 'max.mustermann',
    email: 'max.mustermann@example.com',
    firstName: 'Max',
    lastName: 'Mustermann',
    enabled: true,
    emailVerified: true,
    createdTimestamp: 1703164800000, // 2023-12-21
    realmRoles: ['user'],
    attributes: {}
  },
  {
    id: 'user-2',
    username: 'anna.schmidt',
    email: 'anna.schmidt@example.com',
    firstName: 'Anna',
    lastName: 'Schmidt',
    enabled: true,
    emailVerified: false,
    createdTimestamp: 1703251200000, // 2023-12-22
    realmRoles: ['user', 'admin'],
    attributes: { department: ['IT'] }
  }
];

export const mockVoiceCommands: VoiceCommand[] = [
  {
    id: 'cmd-1',
    command: 'zeige alle Benutzer',
    transcript: 'zeige alle Benutzer',
    confidence: 0.95,
    language: 'de-DE',
    timestamp: '2024-12-21T10:00:00Z'
  },
  {
    id: 'cmd-2',
    command: 'analysiere die Compliance',
    transcript: 'analysiere die Compliance',
    confidence: 0.87,
    language: 'de-DE',
    timestamp: '2024-12-21T10:05:00Z'
  }
];

export const mockEvents: IKASEvent[] = [
  {
    id: 'event-1',
    type: EventType.USER_CREATED,
    timestamp: '2024-12-21T10:00:00Z',
    sessionId: 'session-123',
    data: {
      user: mockUsers[0],
      createdBy: 'admin'
    }
  },
  {
    id: 'event-2',
    type: EventType.VOICE_RESPONSE,
    timestamp: '2024-12-21T10:01:00Z',
    sessionId: 'session-123',
    data: {
      originalCommand: 'zeige alle Benutzer',
      response: '2 Benutzer gefunden',
      success: true,
      executionTime: 1200
    }
  }
];
```

## 🚀 Running Tests

### Test Commands

```bash
# Run all tests
npm run test

# Run tests in watch mode (development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run specific test file
npm run test VoicePanel.test.tsx

# Run tests matching pattern
npm run test -- --testNamePattern="voice command"

# Run tests in CI mode (no watch)
npm run test -- --ci --watchAll=false

# Debug tests
npm run test -- --debug

# Update snapshots
npm run test -- --updateSnapshot
```

### Coverage Reports

```bash
# Generate detailed coverage report
npm run test:coverage

# View coverage report
open coverage/lcov-report/index.html

# Coverage thresholds (jest.config.js)
coverageThreshold: {
  global: {
    branches: 85,
    functions: 90,
    lines: 90,
    statements: 90
  }
}
```

### Performance Testing

```typescript
// Performance testing utilities
export const measureRenderTime = (component: React.ReactElement) => {
  const start = performance.now();
  render(component);
  const end = performance.now();
  return end - start;
};

// Example performance test
test('VoicePanel renders within performance budget', () => {
  const renderTime = measureRenderTime(<VoicePanel />);
  expect(renderTime).toBeLessThan(50); // 50ms budget
});
```

## 🔍 Debugging Tests

### Test Debugging Tools

```typescript
// Debug test utilities
import { screen, logRoles } from '@testing-library/react';

// Debug DOM state
test('debug failing test', () => {
  render(<VoicePanel />);
  
  // Print entire DOM tree
  screen.debug();
  
  // Print accessible roles
  logRoles(screen.getByTestId('voice-panel'));
  
  // Find elements that might exist
  screen.getByText('text that might not exist', { exact: false });
});

// Debug store state
test('debug store state', () => {
  const { result } = renderHook(() => useIKASStore());
  console.log('Store state:', result.current);
});
```

### Common Test Issues

#### Voice Recognition Testing

```typescript
// Issue: Testing speech recognition without real audio
// Solution: Mock SpeechRecognition API

beforeEach(() => {
  global.SpeechRecognition = jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    lang: 'de-DE',
    continuous: false,
    interimResults: true
  }));
});
```

#### WebSocket Testing

```typescript
// Issue: Asynchronous WebSocket events
// Solution: Use waitFor and proper event simulation

test('handles WebSocket events', async () => {
  render(<Component />);
  
  // Simulate WebSocket event
  act(() => {
    mockSocket.emit('voice:response', mockResponseData);
  });
  
  // Wait for UI update
  await waitFor(() => {
    expect(screen.getByText('Expected Response')).toBeInTheDocument();
  });
});
```

#### Store Testing

```typescript
// Issue: Zustand store not updating in tests
// Solution: Use act() wrapper for state changes

test('store updates correctly', async () => {
  const { result } = renderHook(() => useIKASStore());
  
  act(() => {
    result.current.updateState(newData);
  });
  
  expect(result.current.data).toEqual(newData);
});
```

## 📈 Continuous Testing

### CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Frontend Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test:coverage
      
      - name: Upload coverage reports
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage/lcov.info
```

### Pre-commit Hooks

```json
// package.json - husky configuration
{
  "husky": {
    "hooks": {
      "pre-commit": "lint-staged"
    }
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "npm run test -- --bail --findRelatedTests",
      "git add"
    ]
  }
}
```

## 📋 Testing Checklist

### New Component Testing

- [ ] **Unit Tests**
  - [ ] Renders without errors
  - [ ] Props are handled correctly
  - [ ] Event handlers work as expected
  - [ ] Error states are handled
  - [ ] Loading states are displayed
  
- [ ] **Integration Tests**
  - [ ] Integrates with store correctly
  - [ ] WebSocket events are handled
  - [ ] Voice commands work end-to-end
  
- [ ] **Accessibility Tests**
  - [ ] Screen reader compatibility
  - [ ] Keyboard navigation
  - [ ] ARIA labels are present
  
- [ ] **Visual Tests**
  - [ ] Dark mode support
  - [ ] Responsive design
  - [ ] Snapshot tests for UI consistency

### Voice Feature Testing

- [ ] **German Language**
  - [ ] Hotword detection ("Hey Keycloak")
  - [ ] Command recognition accuracy
  - [ ] Confidence threshold handling
  - [ ] Error message localization
  
- [ ] **Browser Compatibility**
  - [ ] Chrome/Edge WebKit support
  - [ ] Firefox compatibility
  - [ ] Safari mobile support
  - [ ] Graceful degradation

### Performance Testing

- [ ] **Render Performance**
  - [ ] Components render under 50ms
  - [ ] No unnecessary re-renders
  - [ ] Memory leaks prevented
  
- [ ] **Voice Processing**
  - [ ] Recognition starts within 100ms
  - [ ] Commands process within 2s
  - [ ] UI remains responsive during processing

---

**Test Environment:** Jest 30+, JSDOM, Testing Library  
**Coverage Target:** 90%+ overall, 100% for critical paths  
**Performance Budget:** <50ms initial render, <2s voice command processing  
**Browser Support:** Chrome 90+, Firefox 85+, Safari 14+