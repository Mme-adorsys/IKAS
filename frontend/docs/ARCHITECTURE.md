# IKAS Frontend Architecture

This document provides a comprehensive overview of the IKAS Frontend architecture, design patterns, and technical implementation details.

## 🏗️ High-Level Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 IKAS Frontend                                    │
│                              (Next.js 15 + React 19)                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │
│  │   App Router    │  │  Zustand Store  │  │  Service Layer  │                 │
│  │                 │  │                 │  │                 │                 │
│  │ • layout.tsx    │  │ • Global State  │  │ • WebSocket     │                 │
│  │ • page.tsx      │  │ • Subscriptions │  │ • Voice API     │                 │
│  │ • globals.css   │  │ • DevTools      │  │ • Error Handler │                 │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘                 │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────────┤
│  │                          Component Layer                                    │
│  ├─────────────────────────────────────────────────────────────────────────────┤
│  │                                                                             │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐ │
│  │  │IKASDashboard│ │VoicePanel │ │SystemStatus │ │EventsPanel │ │UsersPanel│ │
│  │  │             │ │           │ │             │ │            │ │          │ │
│  │  │• Navigation │ │• Hotword  │ │• Services  │ │• Real-time │ │• CRUD    │ │
│  │  │• Layout     │ │• Commands │ │• Health    │ │• Filtering │ │• Search  │ │
│  │  │• State Mgmt │ │• Speech   │ │• Monitoring │ │• History   │ │• Actions │ │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └──────────┘ │
│  │                                                                             │
│  │  ┌────────────┐ ┌────────────┐ ┌─────────────────────────────────────────┐ │
│  │  │Compliance  │ │AnalysisPanel│ │          NotificationsPanel              │ │
│  │  │Panel       │ │             │ │                                          │ │
│  │  │• Audits    │ │• Graphs     │ │ • Toast Notifications                    │ │
│  │  │• Alerts    │ │• D3.js      │ │ • System Messages                        │ │
│  │  │• Reports   │ │• Progress   │ │ • Event Notifications                    │ │
│  │  └────────────┘ └────────────┘ └─────────────────────────────────────────┘ │
│  └─────────────────────────────────────────────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ WebSocket (Socket.io)
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            Backend Services                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  WebSocket Server     AI Gateway         MCP Services                          │
│  (Port 3001)         (Port 8005)        (Keycloak + Neo4j)                    │
│                                                                                 │
│  • Real-time Hub     • LLM Orchestration  • User Management                    │
│  • Event Routing    • Function Calling    • Graph Analytics                    │
│  • Session Mgmt     • Smart Routing       • Admin APIs                         │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 🧱 Technology Stack

### Core Framework

- **Next.js 15**: App Router architecture with React Server Components
- **React 19**: Latest React with concurrent features
- **TypeScript 5**: Strict type checking with comprehensive coverage
- **Turbopack**: High-performance bundler for development

### Styling & UI

- **Tailwind CSS 4**: Utility-first styling with JIT compilation
- **Dark Mode**: System preference detection with manual override
- **Responsive Design**: Mobile-first approach with breakpoints
- **Framer Motion**: Smooth animations and page transitions
- **Lucide React**: Consistent iconography throughout the app

### State Management

- **Zustand**: Lightweight state management with subscriptions
- **Immer**: Immutable state updates with natural syntax
- **DevTools**: Redux DevTools integration for debugging
- **Persistence**: LocalStorage integration for user preferences

### Communication

- **Socket.io Client**: WebSocket communication with auto-reconnection
- **Web Speech API**: Browser-native speech recognition (German)
- **Fetch API**: REST communication fallback
- **Error Boundaries**: Comprehensive error handling

### Visualization

- **D3.js**: Data visualization for graph analysis
- **Canvas API**: High-performance rendering for large datasets
- **SVG**: Scalable vector graphics for charts and diagrams

## 📁 Directory Structure Deep Dive

```
frontend/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout with providers
│   │   ├── page.tsx                  # Main page route
│   │   ├── globals.css               # Global Tailwind styles
│   │   └── favicon.ico               # Application icon
│   │
│   ├── components/                   # React components
│   │   └── dashboard/                # Dashboard-specific components
│   │       ├── IKASDashboard.tsx     # Main dashboard container
│   │       ├── VoicePanel.tsx        # Voice interface controls
│   │       ├── SystemStatus.tsx      # System health monitoring
│   │       ├── EventsPanel.tsx       # Real-time event display
│   │       ├── UsersPanel.tsx        # User management interface
│   │       ├── CompliancePanel.tsx   # Compliance monitoring
│   │       ├── AnalysisPanel.tsx     # Data analysis results
│   │       ├── NotificationsPanel.tsx # Toast notifications
│   │       └── __tests__/            # Component tests
│   │           ├── IKASDashboard.test.tsx
│   │           ├── VoicePanel.test.tsx
│   │           └── SystemStatus.test.tsx
│   │
│   ├── services/                     # External service integrations
│   │   ├── voice.ts                  # Speech Recognition/Synthesis wrapper
│   │   ├── websocket.ts              # WebSocket client with reconnection
│   │   └── __tests__/                # Service tests
│   │       ├── voice.test.ts
│   │       └── websocket.test.ts
│   │
│   ├── store/                        # State management
│   │   └── old_index.ts                  # Zustand store configuration
│   │
│   └── types/                        # TypeScript type definitions
│       ├── events.ts                 # WebSocket event types
│       └── speech-recognition.ts     # Web Speech API types
│
├── docs/                             # Documentation
│   ├── ARCHITECTURE.md               # This file
│   ├── VOICE_COMMANDS.md            # German voice commands
│   ├── API_REFERENCE.md             # WebSocket API reference
│   ├── COMPONENTS.md                # Component documentation
│   ├── DEVELOPMENT.md               # Development guide
│   └── TESTING.md                   # Testing documentation
│
├── tests/                            # Test configuration
│   ├── __mocks__/                    # Test mocks
│   └── setup.js                     # Jest setup
│
├── package.json                     # Dependencies and scripts
├── tailwind.config.js               # Tailwind configuration
├── tsconfig.json                    # TypeScript configuration
├── next.config.js                   # Next.js configuration
├── jest.config.js                   # Jest testing configuration
├── eslint.config.js                 # ESLint configuration
└── README.md                        # Main documentation
```

## 🗄️ State Management Architecture

### Zustand Store Structure

The application uses a single Zustand store with domain-specific slices:

```typescript
interface IKASStore {
  // System state - WebSocket connections, service health
  system: {
    websocketConnected: boolean;
    services: Record<string, ServiceStatus>;
    lastHeartbeat: string | null;
  };

  // Voice interface state
  voice: {
    isListening: boolean;
    isHotwordMode: boolean;
    currentTranscript: string;
    commands: VoiceCommand[];
    responses: VoiceResponse[];
    confidence: number;
  };

  // Real-time events
  events: {
    events: IKASEvent[];
    filters: EventFilter;
    subscription: Subscription | null;
  };

  // Analysis and processing
  analysis: {
    activeAnalysis: Record<string, AnalysisProgress>;
    results: AnalysisResult[];
    graphData: GraphData | null;
  };

  // Application data
  data: {
    users: KeycloakUser[];
    complianceIssues: ComplianceIssue[];
    adminEvents: AdminEvent[];
  };

  // UI state
  ui: {
    darkMode: boolean;
    sidebarOpen: boolean;
    activeView: ViewType;
    notifications: Notification[];
  };
}
```

### State Update Patterns

1. **Immutable Updates**: All state changes use Immer for immutability
2. **Subscription-based**: WebSocket events automatically update relevant slices
3. **Optimistic Updates**: UI updates immediately with server confirmation
4. **Error Handling**: Failed operations revert optimistic changes

### State Persistence

- **User Preferences**: Dark mode, sidebar state, notification settings
- **Session Data**: Active subscriptions, filter preferences
- **Cache Strategy**: Recent events cached for offline viewing

## 🔌 Communication Architecture

### WebSocket Integration

#### Connection Management

```typescript
class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  connect(userId: string, realm: string): Promise<void> {
    // Connection logic with exponential backoff
  }

  subscribe(subscription: Subscription): void {
    // Event subscription management
  }

  private handleReconnection(): void {
    // Automatic reconnection with circuit breaker
  }
}
```

#### Event Flow

```
1. Voice Input → Speech Recognition
2. Command Processing → WebSocket Emission
3. Backend Processing → AI Gateway → MCP Services
4. Response → WebSocket Event
5. State Update → UI Refresh
```

### Voice Service Architecture

#### Speech Recognition Pipeline

```typescript
class VoiceService {
  // Hotword detection for "Hey Keycloak"
  private hotwordMode = true;
  
  // Command processing with confidence thresholds
  private processTranscript(transcript: string, confidence: number): void {
    if (this.hotwordMode) {
      this.detectHotword(transcript);
    } else {
      this.processCommand(transcript, confidence);
    }
  }

  // German language optimization
  private initializeRecognition(): void {
    this.recognition.lang = 'de-DE';
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
  }
}
```

## 🎨 Component Architecture

### Component Hierarchy

```
IKASDashboard (Root Container)
├── Header
│   ├── Navigation Toggle
│   ├── System Status Indicator
│   ├── Dark Mode Toggle
│   └── User Menu
├── Sidebar Navigation
│   ├── Dashboard Link
│   ├── Voice Control Link
│   ├── Users Link
│   ├── Compliance Link
│   └── Analysis Link
└── Main Content Area
    ├── VoicePanel (Active when selected)
    ├── SystemStatus (Dashboard view)
    ├── EventsPanel (Real-time events)
    ├── UsersPanel (User management)
    ├── CompliancePanel (Security monitoring)
    └── AnalysisPanel (Data visualization)
```

### Component Design Principles

1. **Single Responsibility**: Each component has one clear purpose
2. **Composition**: Components compose together rather than inherit
3. **Props Interface**: Strict TypeScript interfaces for all props
4. **State Isolation**: Components manage only their local state
5. **Event Handling**: Events bubble up to parent components

### Component Communication

- **Props Down**: Data flows down through props
- **Events Up**: User actions bubble up through callbacks
- **Global State**: Zustand store for cross-component state
- **Context**: React Context for theme and i18n

## 🔄 Data Flow Architecture

### Real-time Event Processing

```
1. WebSocket Event Reception
   ↓
2. Event Type Classification
   ↓
3. Zustand Store Update
   ↓
4. Component Re-render
   ↓
5. UI State Synchronization
```

### Voice Command Processing

```
1. Hotword Detection ("Hey Keycloak")
   ↓
2. Command Recognition (German)
   ↓
3. Confidence Validation (>0.7)
   ↓
4. WebSocket Transmission
   ↓
5. Backend Processing
   ↓
6. Real-time Response
   ↓
7. Voice Synthesis (Optional)
```

### State Synchronization

- **WebSocket Events**: Automatic state updates
- **Optimistic UI**: Immediate feedback with rollback capability
- **Conflict Resolution**: Server state always wins
- **Cache Invalidation**: Smart cache updates based on event types

## 🎯 Performance Architecture

### Optimization Strategies

1. **React Optimizations**:
   - Memo for expensive components
   - useMemo for computed values
   - useCallback for stable references

2. **Bundle Optimization**:
   - Code splitting with dynamic imports
   - Tree shaking for unused code
   - Asset optimization with Next.js

3. **Rendering Performance**:
   - Virtual scrolling for large lists
   - Debounced search inputs
   - Lazy loading for non-critical components

4. **Memory Management**:
   - Event cleanup in useEffect
   - WebSocket connection pooling
   - Voice recognition resource cleanup

### Caching Strategy

- **Browser Cache**: Static assets with versioning
- **Memory Cache**: Recent events and user data
- **LocalStorage**: User preferences and session data
- **Service Worker**: Offline functionality (future enhancement)

## 🔒 Security Architecture

### Client-Side Security

- **Input Validation**: All user inputs validated before transmission
- **XSS Prevention**: React's built-in XSS protection
- **CSRF Protection**: Token-based protection for actions
- **Content Security Policy**: Strict CSP headers

### WebSocket Security

- **Connection Authentication**: Session-based authentication
- **Message Validation**: All messages validated against schemas
- **Rate Limiting**: Client-side request throttling
- **Secure Protocols**: WSS in production

### Voice Interface Security

- **Microphone Permissions**: Explicit user permission required
- **Command Validation**: Voice commands validated server-side
- **Confidence Thresholds**: Low-confidence commands rejected
- **Privacy**: No voice data stored permanently

## 🧪 Testing Architecture

### Test Strategy

1. **Unit Tests**: Individual components and functions
2. **Integration Tests**: Component interactions and data flow
3. **E2E Tests**: Full user workflows (Playwright)
4. **Performance Tests**: Rendering and state update performance

### Mock Strategy

- **WebSocket Mocks**: Socket.io mock for testing
- **Voice API Mocks**: Speech Recognition/Synthesis mocks
- **State Mocks**: Zustand store testing utilities
- **Component Mocks**: Shallow rendering for unit tests

### Test Coverage Targets

- **Components**: 90%+ test coverage
- **Services**: 95%+ test coverage
- **Store**: 100% test coverage
- **Types**: Full TypeScript coverage

## 🚀 Build & Deployment Architecture

### Build Process

1. **TypeScript Compilation**: Strict type checking
2. **Tailwind CSS Processing**: JIT compilation with purging
3. **Asset Optimization**: Images, fonts, and static files
4. **Bundle Analysis**: Size monitoring and optimization
5. **Static Generation**: Pre-rendered pages where possible

### Deployment Strategy

- **Static Export**: Fully static build for CDN deployment
- **Environment Variables**: Configuration via environment
- **Health Checks**: Built-in health monitoring endpoints
- **Progressive Enhancement**: Works without JavaScript

## 📈 Monitoring & Observability

### Client-Side Monitoring

- **Error Boundaries**: Comprehensive error catching
- **Performance Metrics**: Core Web Vitals monitoring
- **User Analytics**: Usage patterns and feature adoption
- **Console Logging**: Structured logging for debugging

### Real-time Monitoring

- **Connection Status**: WebSocket health monitoring
- **Voice Recognition**: Success/failure rates
- **Component Performance**: Render time tracking
- **Memory Usage**: Memory leak detection

---

This architecture supports the IKAS project's goals of providing an intelligent, German voice-controlled Keycloak administration interface with real-time capabilities and comprehensive monitoring.
