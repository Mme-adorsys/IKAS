import { render, screen } from '@testing-library/react'
import { SystemStatus } from '../SystemStatus'
import { useIKASStore } from '@/store'

// Mock the Zustand store
jest.mock('@/store', () => ({
  useIKASStore: jest.fn()
}))

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
    }
  }

  beforeEach(() => {
    mockUseIKASStore.mockReturnValue(mockSystemState as any)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders system status component', () => {
    render(<SystemStatus />)
    
    expect(screen.getByText('System Status')).toBeInTheDocument()
    expect(screen.getByText('WebSocket Verbindung')).toBeInTheDocument()
    expect(screen.getByText('Spracherkennung')).toBeInTheDocument()
  })

  it('shows connected status when WebSocket is connected', () => {
    render(<SystemStatus />)
    
    expect(screen.getByText((content, element) => {
      return content.includes('Session:') && content.includes('test-session-123')
    })).toBeInTheDocument()
  })

  it('shows disconnected status when WebSocket is not connected', () => {
    mockUseIKASStore.mockReturnValue({
      ...mockSystemState,
      system: {
        ...mockSystemState.system,
        websocketConnected: false,
        sessionId: null
      }
    } as any)

    render(<SystemStatus />)
    
    expect(screen.getByText((content, element) => {
      return content.includes('Session:') && content.includes('Nicht verbunden')
    })).toBeInTheDocument()
  })

  it('displays voice support status', () => {
    render(<SystemStatus />)
    
    expect(screen.getByText('Verfügbar')).toBeInTheDocument()
  })

  it('shows voice not supported when unavailable', () => {
    mockUseIKASStore.mockReturnValue({
      ...mockSystemState,
      voice: {
        ...mockSystemState.voice,
        voiceSupported: false
      }
    } as any)

    render(<SystemStatus />)
    
    expect(screen.getByText('Nicht verfügbar')).toBeInTheDocument()
  })

  it('displays all MCP services status', () => {
    render(<SystemStatus />)
    
    expect(screen.getByText('AI Gateway')).toBeInTheDocument()
    expect(screen.getByText('WebSocket')).toBeInTheDocument()
    expect(screen.getByText('Keycloak MCP')).toBeInTheDocument()
    expect(screen.getByText('Neo4j MCP')).toBeInTheDocument()
    
    // Should show "Gesund" for all healthy services
    const healthyBadges = screen.getAllByText('Gesund')
    expect(healthyBadges).toHaveLength(4)
  })

  it('shows hotword and listening status when active', () => {
    mockUseIKASStore.mockReturnValue({
      ...mockSystemState,
      voice: {
        ...mockSystemState.voice,
        hotwordMode: true,
        isListening: true
      }
    } as any)

    render(<SystemStatus />)
    
    expect(screen.getByText(/Hotword aktiv/)).toBeInTheDocument()
    expect(screen.getByText(/Hörend/)).toBeInTheDocument()
  })
})