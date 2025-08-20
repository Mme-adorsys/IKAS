import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VoicePanel } from '../VoicePanel'
import { useIKASStore } from '@/store'

jest.mock('@/store', () => ({
  useIKASStore: jest.fn()
}))

const mockUseIKASStore = useIKASStore as jest.MockedFunction<typeof useIKASStore>

describe('VoicePanel Component', () => {
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
  }

  beforeEach(() => {
    mockUseIKASStore.mockReturnValue(mockVoiceState as any)
    jest.clearAllMocks()
  })

  it('renders voice control panel', () => {
    render(<VoicePanel />)
    
    expect(screen.getByText('Sprachsteuerung')).toBeInTheDocument()
    expect(screen.getByText('Verwende deutsche Sprachbefehle um IKAS zu steuern')).toBeInTheDocument()
    expect(screen.getByText('Kontrolle')).toBeInTheDocument()
  })

  it('shows voice not supported message when unavailable', () => {
    mockUseIKASStore.mockReturnValue({
      ...mockVoiceState,
      voice: {
        ...mockVoiceState.voice,
        voiceSupported: false
      }
    } as any)

    render(<VoicePanel />)
    
    expect(screen.getByText('Spracherkennung wird von diesem Browser nicht unterstützt')).toBeInTheDocument()
  })

  it('displays correct status when inactive', () => {
    render(<VoicePanel />)
    
    expect(screen.getByText('Inaktiv')).toBeInTheDocument()
  })

  it('displays correct status when listening', () => {
    mockUseIKASStore.mockReturnValue({
      ...mockVoiceState,
      voice: {
        ...mockVoiceState.voice,
        isListening: true
      }
    } as any)

    render(<VoicePanel />)
    
    expect(screen.getByText('Hört zu...')).toBeInTheDocument()
  })

  it('displays correct status when in hotword mode', () => {
    mockUseIKASStore.mockReturnValue({
      ...mockVoiceState,
      voice: {
        ...mockVoiceState.voice,
        hotwordMode: true
      }
    } as any)

    render(<VoicePanel />)
    
    expect(screen.getByText((content, element) => {
      return content.includes('Wartet auf') && content.includes('Hey Keycloak')
    })).toBeInTheDocument()
  })

  it('shows current transcript when available', () => {
    mockUseIKASStore.mockReturnValue({
      ...mockVoiceState,
      voice: {
        ...mockVoiceState.voice,
        currentTranscript: 'zeige alle benutzer'
      }
    } as any)

    render(<VoicePanel />)
    
    expect(screen.getByText((content, element) => {
      return content.includes('zeige alle benutzer')
    })).toBeInTheDocument()
  })

  it('handles start/stop listening button clicks', async () => {
    const user = userEvent.setup()
    render(<VoicePanel />)
    
    const listenButton = screen.getByText('Hören')
    await user.click(listenButton)
    
    expect(mockVoiceState.startListening).toHaveBeenCalledTimes(1)
  })

  it('handles hotword mode toggle', async () => {
    const user = userEvent.setup()
    render(<VoicePanel />)
    
    const hotwordButton = screen.getByText('Hotword Aus')
    await user.click(hotwordButton)
    
    expect(mockVoiceState.toggleHotwordMode).toHaveBeenCalledTimes(1)
  })

  it('shows stop button when listening', async () => {
    mockUseIKASStore.mockReturnValue({
      ...mockVoiceState,
      voice: {
        ...mockVoiceState.voice,
        isListening: true
      }
    } as any)

    const user = userEvent.setup()
    render(<VoicePanel />)
    
    const stopButton = screen.getByText('Stoppen')
    await user.click(stopButton)
    
    expect(mockVoiceState.stopListening).toHaveBeenCalledTimes(1)
  })

  it('shows active hotword button when hotword mode is on', () => {
    mockUseIKASStore.mockReturnValue({
      ...mockVoiceState,
      voice: {
        ...mockVoiceState.voice,
        hotwordMode: true
      }
    } as any)

    render(<VoicePanel />)
    
    expect(screen.getByText('Hotword An')).toBeInTheDocument()
  })

  it('displays sample commands', () => {
    render(<VoicePanel />)
    
    expect(screen.getByText('Beispielbefehle:')).toBeInTheDocument()
    expect(screen.getByText('Hey Keycloak, zeige alle Benutzer')).toBeInTheDocument()
    expect(screen.getByText('Hey Keycloak, analysiere die Compliance')).toBeInTheDocument()
    expect(screen.getByText('Hey Keycloak, finde doppelte Benutzer')).toBeInTheDocument()
  })

  it('displays last command when available', () => {
    mockUseIKASStore.mockReturnValue({
      ...mockVoiceState,
      voice: {
        ...mockVoiceState.voice,
        lastCommand: {
          command: 'zeige alle benutzer',
          transcript: 'zeige alle benutzer',
          confidence: 0.95,
          language: 'de-DE',
          timestamp: '2024-01-01T10:00:00Z'
        }
      }
    } as any)

    render(<VoicePanel />)
    
    expect(screen.getByText('Letzter Befehl:')).toBeInTheDocument()
    expect(screen.getByText((content, element) => {
      return content.includes('zeige alle benutzer')
    })).toBeInTheDocument()
    expect(screen.getByText('Vertrauen: 95%')).toBeInTheDocument()
  })

  it('displays last response when available', () => {
    mockUseIKASStore.mockReturnValue({
      ...mockVoiceState,
      voice: {
        ...mockVoiceState.voice,
        lastResponse: 'Hier sind alle Benutzer im System...'
      }
    } as any)

    render(<VoicePanel />)
    
    expect(screen.getByText('Letzte Antwort:')).toBeInTheDocument()
    expect(screen.getByText('Hier sind alle Benutzer im System...')).toBeInTheDocument()
  })

  it('handles test command button', async () => {
    const user = userEvent.setup()
    render(<VoicePanel />)
    
    const testButton = screen.getByText('Test Sprachbefehl')
    await user.click(testButton)
    
    expect(mockVoiceState.addNotification).toHaveBeenCalledWith({
      type: 'info',
      title: 'Test Mode',
      message: 'Sage &ldquo;Hey Keycloak, zeige alle Benutzer&rdquo; zum Testen'
    })
  })

  it('disables test button while test is running', async () => {
    const user = userEvent.setup()
    render(<VoicePanel />)
    
    const testButton = screen.getByText('Test Sprachbefehl')
    await user.click(testButton)
    
    // Button should show "Test läuft..." and be disabled
    await waitFor(() => {
      expect(screen.getByText('Test läuft...')).toBeInTheDocument()
    })
  })

  it('displays usage tips', () => {
    render(<VoicePanel />)
    
    expect(screen.getByText('💡 Tipps:')).toBeInTheDocument()
    expect(screen.getByText('• Spreche deutlich und nicht zu schnell')).toBeInTheDocument()
    expect(screen.getByText((content, element) => {
      return content.includes('• Nutze') && content.includes('Hey Keycloak') && content.includes('als Hotword')
    })).toBeInTheDocument()
    expect(screen.getByText('• Warte auf die Bestätigung bevor du weitersprichst')).toBeInTheDocument()
    expect(screen.getByText('• Chrome/Edge bieten die beste Unterstützung')).toBeInTheDocument()
  })
})