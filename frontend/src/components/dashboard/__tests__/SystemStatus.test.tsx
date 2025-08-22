import { render, screen, act } from '@testing-library/react'
import { SystemStatus } from '../SystemStatus'
import { useIKASStore } from '@/store'

// Mock the Zustand store
jest.mock('@/store', () => ({
  useIKASStore: jest.fn()
}))

// Suppress React act warnings for this test file
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('An update to') &&
      args[0].includes('was not wrapped in act')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})

const mockUseIKASStore = useIKASStore as jest.MockedFunction<typeof useIKASStore>

describe('SystemStatus Component', () => {
  const mockSystemState = {
    system: {
      websocketConnected: true,
      sessionId: 'test-session-123',
      services: {
        aiGateway: 'healthy' as const,
        websocket: 'healthy' as const,
        keycloakMcp: 'healthy' as const,
        neo4jMcp: 'healthy' as const
      }
    },
    voice: {
      isListening: false,
      hotwordMode: false,
      currentTranscript: '',
      lastCommand: null,
      lastResponse: null,
      voiceSupported: true
    },
    // Add missing mock functions
    reconnectWebSocket: jest.fn(),
    checkServiceHealth: jest.fn().mockImplementation(() => Promise.resolve()),
    addNotification: jest.fn()
  }

  beforeEach(() => {
    mockUseIKASStore.mockReturnValue(mockSystemState as any)
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('renders system status component', async () => {
    await act(async () => {
      render(<SystemStatus />)
    })
    
    expect(screen.getByText('System Status')).toBeInTheDocument()
    expect(screen.getByText('WebSocket Verbindung')).toBeInTheDocument()
    expect(screen.getByText('Spracherkennung')).toBeInTheDocument()
  })

  it('shows connected status when WebSocket is connected', async () => {
    await act(async () => {
      render(<SystemStatus />)
    })
    
    expect(screen.getByText((content, element) => {
      return content.includes('Session:') && content.includes('test-session-123')
    })).toBeInTheDocument()
  })

  it('shows disconnected status when WebSocket is not connected', async () => {
    mockUseIKASStore.mockReturnValue({
      ...mockSystemState,
      system: {
        ...mockSystemState.system,
        websocketConnected: false,
        sessionId: null
      }
    } as any)

    await act(async () => {
      render(<SystemStatus />)
    })
    
    expect(screen.getByText((content, element) => {
      return content.includes('Session:') && content.includes('Nicht verbunden')
    })).toBeInTheDocument()
  })

  it('displays voice support status', async () => {
    await act(async () => {
      render(<SystemStatus />)
    })
    
    expect(screen.getByText('Verfügbar')).toBeInTheDocument()
  })

  it('shows voice not supported when unavailable', async () => {
    mockUseIKASStore.mockReturnValue({
      ...mockSystemState,
      voice: {
        ...mockSystemState.voice,
        voiceSupported: false
      }
    } as any)

    await act(async () => {
      render(<SystemStatus />)
    })
    
    expect(screen.getByText('Nicht verfügbar')).toBeInTheDocument()
  })

  it('displays all MCP services status', async () => {
    await act(async () => {
      render(<SystemStatus />)
    })
    
    expect(screen.getByText('AI Gateway')).toBeInTheDocument()
    expect(screen.getByText('WebSocket Server')).toBeInTheDocument()
    expect(screen.getByText('Keycloak MCP')).toBeInTheDocument()
    expect(screen.getByText('Neo4j MCP')).toBeInTheDocument()
    
    // Should show "✅ Gesund" for all healthy services
    const healthyBadges = screen.getAllByText('✅ Gesund')
    expect(healthyBadges).toHaveLength(4)
  })

  it('shows hotword and listening status when active', async () => {
    mockUseIKASStore.mockReturnValue({
      ...mockSystemState,
      voice: {
        ...mockSystemState.voice,
        hotwordMode: true,
        isListening: true
      }
    } as any)

    await act(async () => {
      render(<SystemStatus />)
    })
    
    expect(screen.getByText(/Hotword aktiv/)).toBeInTheDocument()
    expect(screen.getByText(/Hörend/)).toBeInTheDocument()
  })
})