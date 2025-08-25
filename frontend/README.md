# IKAS Frontend

**Intelligentes Keycloak Admin System - Frontend Application**

A sophisticated Next.js 15 web application providing German voice-controlled administration for Keycloak instances through an intelligent AI-powered interface.

## 🎯 Overview

IKAS Frontend is a production-ready dashboard that revolutionizes Keycloak administration by combining:

- **🗣️ German Voice Interface**: "Hey Keycloak" activation with full voice command processing
- **⚡ Real-time Communication**: WebSocket-powered live updates and notifications
- **🧠 AI Integration**: Connected to AI Gateway for intelligent command interpretation
- **📊 Visual Analytics**: D3.js-powered graphs and compliance monitoring
- **🌙 Dark Mode**: Complete theme switching with responsive design

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- IKAS backend services running:
  - WebSocket Server (port 3001)
  - AI Gateway (port 8005)
  - MCP Services (Keycloak + Neo4j)

### Installation & Development

```bash
# Install dependencies
npm install

# Start development server with Turbopack
npm run dev

# Open application
open http://localhost:3000
```

### Available Commands

```bash
npm run dev          # Development with Turbopack hot reload
npm run build        # Production build with TypeScript compilation
npm run start        # Start production server
npm run lint         # ESLint code checking
npm run test         # Run Jest test suite (79 tests)
npm run test:watch   # Watch mode for testing
npm run test:coverage # Generate coverage report
```

## 🎤 German Voice Commands

Activate with **"Hey Keycloak"** or **"Hallo Keycloak"**, then:

```german
"zeige alle Benutzer"           # List all users
"analysiere die Compliance"     # Run compliance analysis
"finde doppelte Benutzer"       # Find duplicate users
"erstelle einen Benutzer"       # Create new user
"zeige die Statistiken"         # Show usage statistics
"lösche Benutzer [name]"        # Delete specific user
"ändere Passwort für [user]"    # Change user password
"zeige Admin Events"            # Display admin events
```

**Browser Support**: Chrome, Edge, Safari (with WebKit Speech API)

## 🏗️ Architecture Overview

### Technology Stack

- **Frontend**: Next.js 15 + React 19 + TypeScript 5
- **Styling**: Tailwind CSS 4 with dark mode
- **State Management**: Zustand with subscriptions
- **Real-time**: Socket.io-client WebSocket connections
- **Voice**: Web Speech API (German locale)
- **Visualization**: D3.js for graph rendering
- **Animation**: Framer Motion for smooth transitions
- **Testing**: Jest + Testing Library (79/79 tests passing)

### Key Components

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout with German locale
│   ├── page.tsx            # Main page loading IKASDashboard
│   └── globals.css         # Tailwind CSS + custom styles
├── components/dashboard/   # Dashboard components
│   ├── IKASDashboard.tsx   # Main dashboard with navigation
│   ├── VoicePanel.tsx      # Voice control interface
│   ├── SystemStatus.tsx    # Real-time system monitoring
│   ├── EventsPanel.tsx     # Live event stream
│   ├── UsersPanel.tsx      # User management interface
│   ├── CompliancePanel.tsx # Compliance monitoring
│   └── AnalysisPanel.tsx   # Data analysis results
├── services/               # External integrations
│   ├── voice.ts            # Speech Recognition/Synthesis
│   └── websocket.ts        # Real-time WebSocket client
├── store/                  # Zustand state management
│   └── old_index.ts            # Global application state
└── types/                  # TypeScript definitions
    ├── events.ts           # WebSocket event types
    └── speech-recognition.ts # Speech API types
```

## 🔗 Integration Points

### WebSocket Events (13 Types)

The frontend subscribes to real-time events from the WebSocket server:

- **Voice Events**: `voice:command`, `voice:response`, `voice:error`
- **User Events**: `user:created`, `user:updated`, `user:deleted`
- **Analysis Events**: `analysis:started`, `analysis:progress`, `analysis:completed`
- **Compliance Events**: `compliance:check`, `compliance:alert`, `compliance:report`
- **System Events**: `connection:status`, `heartbeat`, `error:occurred`

### Backend Communication Flow

```
Voice Input → Browser Speech API → WebSocket → AI Gateway → MCP Services
     ↓
Real-time Response → WebSocket → Frontend State → UI Update
```

## 🎨 User Interface

### Dashboard Views

1. **📊 Dashboard**: System overview with status indicators
2. **🎤 Sprachsteuerung**: Voice control panel with command history
3. **👥 Benutzer**: User management with real-time updates
4. **✅ Compliance**: Security compliance monitoring
5. **📈 Analyse**: Data analysis results and patterns

### Features

- **Responsive Design**: Mobile-first with Tailwind CSS
- **Dark Mode**: System preference detection + manual toggle
- **Real-time Updates**: Live WebSocket event streaming
- **Voice Transcription**: Live speech-to-text with confidence scores
- **Notifications**: Toast notifications for all system events
- **Connection Status**: Visual indicators for service health

## 🧪 Testing

Comprehensive test suite with 79 passing tests:

```bash
# Run all tests
npm run test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

### Test Coverage

- **Component Testing**: All dashboard panels and UI components
- **Service Testing**: WebSocket client, Voice service with mocks
- **Integration Testing**: State management and event flows
- **Mock Setup**: Complete browser API mocks (Speech, WebSocket)

## 🚀 Deployment

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm run start
```

### Environment Configuration

```bash
# WebSocket connection
NEXT_PUBLIC_WS_URL=ws://localhost:3001

# AI Gateway endpoint (indirect via WebSocket)
NEXT_PUBLIC_API_URL=http://localhost:8005
```

## 📚 Documentation

Detailed documentation available in `/docs`:

- **[Architecture](docs/ARCHITECTURE.md)**: Technical architecture and patterns
- **[Voice Commands](docs/VOICE_COMMANDS.md)**: Complete German voice reference
- **[API Reference](docs/API_REFERENCE.md)**: WebSocket events and payloads
- **[Components](docs/COMPONENTS.md)**: Component API and usage
- **[Development](docs/DEVELOPMENT.md)**: Developer workflow and guidelines
- **[Testing](docs/TESTING.md)**: Testing strategies and best practices

## 🐛 Troubleshooting

### Common Issues

**Voice Recognition Not Working:**
- Ensure HTTPS or localhost (required for Speech API)
- Check microphone permissions in browser
- Verify German language support in browser settings

**WebSocket Connection Failed:**
- Confirm WebSocket server running on port 3001
- Check NEXT_PUBLIC_WS_URL environment variable
- Verify firewall/proxy settings

**Dark Mode Issues:**
- Clear browser localStorage
- Check system theme preferences
- Ensure Tailwind CSS dark: prefix classes are compiled

## 🤝 Contributing

1. Follow TypeScript strict mode
2. Maintain test coverage above 90%
3. Use conventional commit messages
4. Test voice commands in German
5. Verify real-time WebSocket functionality

## 📝 License

Part of the IKAS project - Intelligentes Keycloak Admin System

---

**Made with ❤️ for German-speaking Keycloak administrators**
