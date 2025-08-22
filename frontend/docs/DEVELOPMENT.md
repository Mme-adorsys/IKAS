# IKAS Frontend Development Guide

Complete developer guide for contributing to and extending the IKAS Frontend application.

## 🚀 Getting Started

### Prerequisites

**Required Software:**
- Node.js 18+ (LTS recommended)
- npm 9+ or yarn 3+
- Git 2.30+
- VS Code (recommended) or similar IDE

**IKAS Backend Services:**
- WebSocket Server (Port 3001)
- AI Gateway (Port 8005)
- MCP Services (Keycloak + Neo4j)
- Docker & Docker Compose

### Initial Setup

```bash
# 1. Clone and navigate to frontend
cd frontend/

# 2. Install dependencies
npm install

# 3. Start backend services (from root directory)
cd ..
./scripts/start-dev.sh

# 4. Return to frontend and start development server
cd frontend/
npm run dev

# 5. Open application
open http://localhost:3000
```

### Development Environment

```bash
# Environment variables (.env.local)
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:8005
NODE_ENV=development
```

### Verification Steps

1. ✅ Frontend loads on localhost:3000
2. ✅ WebSocket connection indicator shows "Verbunden"
3. ✅ Voice interface responds to "Hey Keycloak"
4. ✅ System status shows all services healthy
5. ✅ Test voice command: "zeige alle Benutzer"

---

## 🏗️ Project Structure

### Directory Organization

```
frontend/
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx            # Root layout with providers
│   │   ├── page.tsx              # Home page (loads dashboard)
│   │   └── globals.css           # Global styles
│   │
│   ├── components/               # React components
│   │   └── dashboard/            # Dashboard-specific components
│   │       ├── [Component].tsx   # Individual components
│   │       └── __tests__/        # Component test files
│   │
│   ├── services/                 # External service integrations
│   │   ├── voice.ts              # Speech Recognition/Synthesis
│   │   ├── websocket.ts          # WebSocket client
│   │   └── __tests__/            # Service test files
│   │
│   ├── store/                    # State management
│   │   └── index.ts              # Zustand store configuration
│   │
│   └── types/                    # TypeScript type definitions
│       ├── events.ts             # WebSocket event types
│       └── speech-recognition.ts # Speech API types
│
├── docs/                         # Documentation
├── tests/                        # Test configuration and mocks
├── package.json                  # Dependencies and scripts
├── tailwind.config.js            # Tailwind configuration
├── tsconfig.json                 # TypeScript configuration
├── next.config.js                # Next.js configuration
├── jest.config.js                # Jest testing configuration
└── eslint.config.js              # ESLint rules
```

### File Naming Conventions

- **Components**: PascalCase (e.g., `VoicePanel.tsx`)
- **Services**: camelCase (e.g., `websocket.ts`)
- **Types**: camelCase with descriptive names (e.g., `events.ts`)
- **Tests**: Match source file with `.test.tsx/.test.ts`
- **Mocks**: `__mocks__` directory with matching names

---

## 🔧 Development Workflow

### 1. Feature Development Process

```bash
# 1. Create feature branch
git checkout -b feature/voice-command-improvements

# 2. Make changes with tests
# ... development work ...

# 3. Run development checks
npm run lint          # ESLint checking
npm run type-check    # TypeScript compilation
npm run test          # Jest test suite
npm run build         # Production build test

# 4. Commit changes
git add .
git commit -m "feat(voice): improve German command recognition

- Enhanced hotword detection sensitivity
- Added new voice commands for realm management
- Updated voice panel UI with better feedback"

# 5. Push and create PR
git push origin feature/voice-command-improvements
```

### 2. Code Style Guidelines

#### TypeScript Standards

```typescript
// Use strict TypeScript
interface ComponentProps {
  userId: string;
  onUserUpdate: (user: KeycloakUser) => void;
  className?: string;
}

// Prefer const assertions
const VOICE_COMMANDS = ['zeige', 'erstelle', 'lösche'] as const;
type VoiceCommand = typeof VOICE_COMMANDS[number];

// Use proper function typing
const handleVoiceCommand = useCallback((
  command: VoiceCommand, 
  confidence: number
): void => {
  // Implementation
}, [dependencies]);
```

#### React Patterns

```typescript
// Function component with TypeScript
interface VoicePanelProps {
  className?: string;
  onCommandProcessed?: (result: VoiceResult) => void;
}

export function VoicePanel({ className, onCommandProcessed }: VoicePanelProps) {
  // State with proper typing
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>('');
  
  // Memoized values
  const isVoiceSupported = useMemo(() => 
    typeof window !== 'undefined' && 'webkitSpeechRecognition' in window
  , []);
  
  // Event handlers
  const handleStartListening = useCallback(() => {
    setIsListening(true);
    // Voice service logic
  }, []);
  
  return (
    <div className={`voice-panel ${className}`}>
      {/* Component JSX */}
    </div>
  );
}
```

#### State Management Patterns

```typescript
// Zustand slice pattern
interface VoiceSlice {
  voice: {
    isListening: boolean;
    commands: VoiceCommand[];
    responses: VoiceResponse[];
  };
  startListening: () => void;
  stopListening: () => void;
  addCommand: (command: VoiceCommand) => void;
}

// Implementation with Immer
const createVoiceSlice: StateCreator<VoiceSlice> = (set) => ({
  voice: {
    isListening: false,
    commands: [],
    responses: []
  },
  startListening: () => set((state) => {
    state.voice.isListening = true;
  }),
  addCommand: (command) => set((state) => {
    state.voice.commands.push(command);
  })
});
```

### 3. Component Development

#### Creating New Components

```bash
# 1. Create component file
touch src/components/dashboard/NewPanel.tsx

# 2. Create test file
touch src/components/dashboard/__tests__/NewPanel.test.tsx

# 3. Add to exports (if needed)
# Update relevant index files
```

#### Component Template

```typescript
// src/components/dashboard/NewPanel.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useIKASStore } from '@/store';

interface NewPanelProps {
  title?: string;
  className?: string;
  onDataChange?: (data: any) => void;
}

export function NewPanel({ 
  title = 'New Panel', 
  className = '',
  onDataChange 
}: NewPanelProps) {
  // Local state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Global state
  const { data, ui } = useIKASStore();
  
  // Effects
  useEffect(() => {
    // Component initialization
  }, []);
  
  // Event handlers
  const handleAction = useCallback(async () => {
    try {
      setLoading(true);
      // Async operation
      onDataChange?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [onDataChange]);
  
  // Render
  return (
    <div className={`new-panel ${className}`}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          {title}
        </h2>
        
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-4">
            <p className="text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Component content */}
          </div>
        )}
      </div>
    </div>
  );
}
```

#### Component Test Template

```typescript
// src/components/dashboard/__tests__/NewPanel.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NewPanel } from '../NewPanel';
import { useIKASStore } from '@/store';

// Mock store
jest.mock('@/store');
const mockUseIKASStore = useIKASStore as jest.MockedFunction<typeof useIKASStore>;

describe('NewPanel', () => {
  beforeEach(() => {
    mockUseIKASStore.mockReturnValue({
      data: {},
      ui: { darkMode: false }
    } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('renders with default props', () => {
    render(<NewPanel />);
    expect(screen.getByText('New Panel')).toBeInTheDocument();
  });

  test('displays custom title', () => {
    render(<NewPanel title="Custom Title" />);
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  test('handles user interaction', async () => {
    const user = userEvent.setup();
    const mockOnDataChange = jest.fn();
    
    render(<NewPanel onDataChange={mockOnDataChange} />);
    
    const button = screen.getByRole('button', { name: /action/i });
    await user.click(button);
    
    await waitFor(() => {
      expect(mockOnDataChange).toHaveBeenCalled();
    });
  });
});
```

### 4. Service Development

#### Adding New Services

```typescript
// src/services/newService.ts
class NewService {
  private config: ServiceConfig;
  
  constructor(config: ServiceConfig) {
    this.config = config;
  }
  
  async initialize(): Promise<void> {
    // Service initialization
  }
  
  async performOperation(params: OperationParams): Promise<OperationResult> {
    try {
      // Service operation
      return result;
    } catch (error) {
      console.error('Service operation failed:', error);
      throw new ServiceError('Operation failed', error);
    }
  }
  
  dispose(): void {
    // Cleanup resources
  }
}

// Export singleton instance
export const newService = new NewService(defaultConfig);
```

#### Service Testing

```typescript
// src/services/__tests__/newService.test.ts
import { newService } from '../newService';

describe('NewService', () => {
  beforeEach(async () => {
    await newService.initialize();
  });

  afterEach(() => {
    newService.dispose();
  });

  test('performs operation successfully', async () => {
    const result = await newService.performOperation({ param: 'value' });
    expect(result).toBeDefined();
    expect(result.success).toBe(true);
  });

  test('handles operation failure', async () => {
    await expect(
      newService.performOperation({ invalid: true })
    ).rejects.toThrow('Operation failed');
  });
});
```

---

## 🎨 Styling Development

### Tailwind CSS Usage

#### Design System

```typescript
// Consistent design tokens
const designTokens = {
  colors: {
    primary: {
      50: '#eff6ff',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8'
    },
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444'
  },
  spacing: {
    xs: '0.5rem',    // 8px
    sm: '1rem',      // 16px
    md: '1.5rem',    // 24px
    lg: '2rem',      // 32px
    xl: '3rem'       // 48px
  },
  breakpoints: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px'
  }
};
```

#### Component Styling Patterns

```typescript
// Consistent component styling
const componentStyles = {
  // Panel base styles
  panel: "bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6",
  
  // Button variants
  button: {
    primary: "bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-white font-medium px-4 py-2 rounded-md transition-colors",
    secondary: "bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 text-gray-700 border border-gray-300 px-4 py-2 rounded-md",
    danger: "bg-red-600 hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 text-white px-4 py-2 rounded-md"
  },
  
  // Input styles
  input: "block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
  
  // Status badges
  badge: {
    success: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    warning: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    error: "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
  }
};
```

#### Dark Mode Implementation

```typescript
// Dark mode utility
const useDarkMode = () => {
  const { ui, toggleDarkMode } = useIKASStore();
  
  useEffect(() => {
    // Apply dark mode to document
    if (ui.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [ui.darkMode]);
  
  return { darkMode: ui.darkMode, toggle: toggleDarkMode };
};

// Component usage
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  <button 
    onClick={toggle}
    className="p-2 rounded-md bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
  >
    {darkMode ? '☀️' : '🌙'}
  </button>
</div>
```

### Responsive Design Patterns

```typescript
// Mobile-first responsive components
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Cards adjust based on screen size */}
</div>

// Responsive text sizing
<h1 className="text-xl md:text-2xl lg:text-3xl font-bold">
  Responsive Heading
</h1>

// Conditional rendering for mobile
<div className="block md:hidden">
  {/* Mobile-only content */}
</div>
<div className="hidden md:block">
  {/* Desktop-only content */}
</div>
```

---

## 🧪 Testing Development

### Testing Strategy

1. **Unit Tests**: Individual functions and components
2. **Integration Tests**: Component interactions and data flow
3. **E2E Tests**: Complete user workflows (future implementation)

### Writing Tests

#### Component Testing Best Practices

```typescript
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoicePanel } from '../VoicePanel';

// Test wrapper with providers
const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <TestProviders>
      {component}
    </TestProviders>
  );
};

describe('VoicePanel Integration', () => {
  test('voice command flow', async () => {
    const user = userEvent.setup();
    
    renderWithProviders(<VoicePanel />);
    
    // Start listening
    const startButton = screen.getByRole('button', { name: /aufnahme starten/i });
    await user.click(startButton);
    
    // Simulate voice input
    mockVoiceService.emit('result', {
      transcript: 'zeige alle Benutzer',
      confidence: 0.95,
      isFinal: true
    });
    
    // Verify command processing
    await waitFor(() => {
      expect(screen.getByText('zeige alle Benutzer')).toBeInTheDocument();
    });
    
    // Verify WebSocket emission
    expect(mockWebSocket.emit).toHaveBeenCalledWith('voice:command', {
      command: 'zeige alle Benutzer',
      confidence: 0.95
    });
  });
});
```

#### Service Testing

```typescript
import { WebSocketService } from '../websocket';

describe('WebSocketService', () => {
  let service: WebSocketService;
  
  beforeEach(() => {
    service = new WebSocketService('ws://localhost:3001');
  });
  
  afterEach(() => {
    service.disconnect();
  });
  
  test('connects to WebSocket server', async () => {
    await service.connect('test-user', 'master');
    
    expect(service.isConnected()).toBe(true);
  });
  
  test('handles connection errors', async () => {
    mockSocket.connect.mockRejectedValue(new Error('Connection failed'));
    
    await expect(
      service.connect('test-user', 'master')
    ).rejects.toThrow('Connection failed');
  });
});
```

### Mock Development

#### WebSocket Mocks

```typescript
// tests/__mocks__/socket.io-client.ts
const mockSocket = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
  connect: jest.fn(),
  disconnect: jest.fn(),
  connected: true
};

export default jest.fn(() => mockSocket);
export { mockSocket };
```

#### Voice Service Mocks

```typescript
// tests/__mocks__/voice.ts
class MockVoiceService {
  isListening = false;
  isSupported = true;
  
  startListening = jest.fn(() => {
    this.isListening = true;
  });
  
  stopListening = jest.fn(() => {
    this.isListening = false;
  });
  
  // Simulate voice events
  emit(event: string, data: any) {
    const handlers = this.eventHandlers[event] || [];
    handlers.forEach(handler => handler(data));
  }
}
```

---

## 🚀 Build and Deployment

### Development Build

```bash
# Development with hot reload
npm run dev

# Development with turbopack (faster)
npm run dev --turbo

# Type checking
npm run type-check

# Linting
npm run lint
```

### Production Build

```bash
# Create production build
npm run build

# Test production build locally
npm run start

# Analyze bundle size
npm run build:analyze
```

### Environment Configuration

```bash
# .env.local (development)
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_API_URL=http://localhost:8005
NODE_ENV=development

# .env.production (production)
NEXT_PUBLIC_WS_URL=wss://ikas.yourdomain.com/ws
NEXT_PUBLIC_API_URL=https://ikas.yourdomain.com/api
NODE_ENV=production
```

### Performance Optimization

```javascript
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable Turbopack for faster builds
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js'
        }
      }
    }
  },
  
  // Bundle analyzer
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    if (process.env.ANALYZE) {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'server',
          openAnalyzer: true
        })
      );
    }
    return config;
  }
};
```

---

## 🐛 Debugging

### Debug Tools

#### React Developer Tools
```bash
# Install React DevTools browser extension
# Access component tree and props/state inspection
```

#### Zustand DevTools
```typescript
// Store configuration with DevTools
import { devtools } from 'zustand/middleware';

export const useIKASStore = create<IKASStore>()(
  devtools(
    (set, get) => ({
      // Store implementation
    }),
    { name: 'IKAS-Store' }
  )
);
```

#### WebSocket Debugging
```typescript
// Enable WebSocket debugging
const socket = io('ws://localhost:3001', {
  // Enable detailed logging
  debug: process.env.NODE_ENV === 'development',
  transports: ['websocket']
});

// Log all WebSocket events
socket.onAny((eventName, ...args) => {
  console.log(`[WebSocket] ${eventName}:`, args);
});
```

#### Voice Service Debugging
```typescript
// Voice recognition debugging
const voiceService = new VoiceService({
  language: 'de-DE',
  continuous: false,
  interimResults: true
}, {
  onResult: (transcript, isFinal, confidence) => {
    console.log(`[Voice] "${transcript}" (${confidence.toFixed(2)}, ${isFinal ? 'final' : 'interim'})`);
  },
  onError: (error) => {
    console.error('[Voice] Error:', error);
  }
});
```

### Common Issues

#### Voice Recognition Problems
```typescript
// Debugging voice recognition issues
const debugVoiceSupport = () => {
  console.log('Speech Recognition Support:', {
    hasWebkitSpeechRecognition: 'webkitSpeechRecognition' in window,
    hasSpeechRecognition: 'SpeechRecognition' in window,
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages
  });
};
```

#### WebSocket Connection Issues
```typescript
// Debug WebSocket connection
const debugWebSocket = () => {
  socket.on('connect', () => {
    console.log('[WebSocket] Connected:', socket.id);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('[WebSocket] Disconnected:', reason);
  });
  
  socket.on('connect_error', (error) => {
    console.error('[WebSocket] Connection Error:', error);
  });
};
```

---

## 📋 Code Review Checklist

### Pre-PR Checklist

- [ ] **Code Quality**
  - [ ] TypeScript strict mode compliance
  - [ ] ESLint rules passing
  - [ ] No console.log statements (use proper logging)
  - [ ] Proper error handling
  
- [ ] **Testing**
  - [ ] Unit tests for new components
  - [ ] Integration tests for complex interactions
  - [ ] Test coverage above 90%
  - [ ] All tests passing
  
- [ ] **Performance**
  - [ ] No unnecessary re-renders
  - [ ] Proper use of useMemo/useCallback
  - [ ] Bundle size impact assessed
  
- [ ] **Accessibility**
  - [ ] ARIA labels where needed
  - [ ] Keyboard navigation support
  - [ ] Screen reader compatibility
  
- [ ] **German Language**
  - [ ] All German text reviewed by native speaker
  - [ ] Voice commands tested with German pronunciation
  - [ ] Cultural appropriateness verified

### Review Guidelines

1. **Architecture Consistency**: Does the code follow established patterns?
2. **Type Safety**: Are all types properly defined and used?
3. **Error Handling**: Are errors handled gracefully?
4. **Performance**: Will this impact application performance?
5. **User Experience**: Does this improve the user experience?

---

## 🔄 Maintenance

### Regular Maintenance Tasks

#### Weekly
- [ ] Update dependencies with `npm audit`
- [ ] Review test coverage reports
- [ ] Check performance metrics
- [ ] Verify voice command accuracy

#### Monthly
- [ ] Update major dependencies
- [ ] Review and update documentation
- [ ] Performance optimization review
- [ ] Security vulnerability scan

#### Quarterly
- [ ] TypeScript version update
- [ ] Next.js version update
- [ ] Architecture review
- [ ] User feedback integration

### Monitoring

```typescript
// Error tracking setup
const logError = (error: Error, context?: Record<string, any>) => {
  console.error('Application Error:', {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href
  });
  
  // Send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    // errorTracker.captureException(error, context);
  }
};

// Performance monitoring
const measurePerformance = (name: string, fn: () => void) => {
  const start = performance.now();
  fn();
  const end = performance.now();
  
  console.log(`[Performance] ${name}: ${(end - start).toFixed(2)}ms`);
};
```

---

**Development Environment:** Node.js 18+, TypeScript 5, Next.js 15  
**Primary IDE:** VS Code with TypeScript, ESLint, Tailwind CSS extensions  
**Browser Support:** Chrome 90+, Firefox 85+, Safari 14+, Edge 90+