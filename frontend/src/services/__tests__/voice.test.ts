import { VoiceService, checkVoiceSupport } from '../voice'

// Mock Speech Recognition and Speech Synthesis
const mockRecognition = {
  start: jest.fn(),
  stop: jest.fn(),
  onstart: null,
  onresult: null,
  onerror: null,
  onend: null,
  lang: 'de-DE',
  continuous: false,
  interimResults: true,
  maxAlternatives: 3
}

const mockSynthesis = {
  speak: jest.fn(),
  cancel: jest.fn(),
  getVoices: jest.fn(() => [])
}

const mockUtterance = {
  text: '',
  lang: 'de-DE',
  rate: 0.9,
  pitch: 1,
  volume: 1,
  onend: null,
  onerror: null
}

// Mock global objects
Object.defineProperty(global, 'SpeechRecognition', {
  value: jest.fn(() => mockRecognition),
  writable: true
})

Object.defineProperty(global, 'webkitSpeechRecognition', {
  value: jest.fn(() => mockRecognition),
  writable: true
})

Object.defineProperty(global, 'speechSynthesis', {
  value: mockSynthesis,
  writable: true
})

Object.defineProperty(global, 'SpeechSynthesisUtterance', {
  value: jest.fn(() => mockUtterance),
  writable: true
})

// Set window properties if not already set
if (typeof window !== 'undefined') {
  window.SpeechRecognition = global.SpeechRecognition
  window.webkitSpeechRecognition = global.webkitSpeechRecognition
  window.speechSynthesis = mockSynthesis
}

describe('VoiceService', () => {
  let voiceService: VoiceService
  let mockHandlers: any

  beforeEach(() => {
    mockHandlers = {
      onResult: jest.fn(),
      onCommand: jest.fn(),
      onHotword: jest.fn(),
      onStart: jest.fn(),
      onEnd: jest.fn(),
      onError: jest.fn()
    }

    voiceService = new VoiceService(
      {
        language: 'de-DE',
        continuous: false,
        interimResults: true,
        hotwordEnabled: true,
        hotwords: ['hey keycloak', 'hallo keycloak']
      },
      mockHandlers
    )

    jest.clearAllMocks()
  })

  afterEach(() => {
    voiceService.destroy()
  })

  describe('initialization', () => {
    it('creates voice service with default config', () => {
      const service = new VoiceService()
      expect(service.getConfig().language).toBe('de-DE')
      expect(service.getConfig().hotwordEnabled).toBe(true)
      expect(service.getConfig().hotwords).toContain('hey keycloak')
    })

    it('merges provided config with defaults', () => {
      const service = new VoiceService({ language: 'en-US', continuous: true })
      const config = service.getConfig()
      
      expect(config.language).toBe('en-US')
      expect(config.continuous).toBe(true)
      expect(config.hotwordEnabled).toBe(true) // default
    })
  })

  describe('speech recognition', () => {
    it('starts listening successfully', async () => {
      await voiceService.startListening()
      expect(mockRecognition.start).toHaveBeenCalledTimes(1)
    })

    it('stops listening successfully', () => {
      // Simulate listening state
      voiceService['isListening'] = true
      voiceService.stopListening()
      expect(mockRecognition.stop).toHaveBeenCalledTimes(1)
    })

    it('does not start if already listening', async () => {
      // Simulate already listening
      voiceService['isListening'] = true
      
      await voiceService.startListening()
      expect(mockRecognition.start).not.toHaveBeenCalled()
    })

    it('calls onStart handler when recognition starts', () => {
      mockRecognition.onstart?.()
      expect(mockHandlers.onStart).toHaveBeenCalledTimes(1)
    })

    it('calls onEnd handler when recognition ends', () => {
      mockRecognition.onend?.()
      expect(mockHandlers.onEnd).toHaveBeenCalledTimes(1)
    })

    it('calls onError handler on recognition error', () => {
      const errorEvent = { error: 'network' }
      mockRecognition.onerror?.(errorEvent)
      expect(mockHandlers.onError).toHaveBeenCalledWith('network')
    })
  })

  describe('hotword detection', () => {
    it('toggles hotword mode', () => {
      expect(voiceService.getHotwordMode()).toBe(false)
      
      const result = voiceService.toggleHotwordMode()
      expect(result).toBe(true)
      expect(voiceService.getHotwordMode()).toBe(true)
      
      voiceService.toggleHotwordMode()
      expect(voiceService.getHotwordMode()).toBe(false)
    })

    it('detects hotwords in transcript', () => {
      const mockEvent = {
        resultIndex: 0,
        results: [{
          0: { transcript: 'hey keycloak zeige alle benutzer', confidence: 0.9 },
          isFinal: true,
          length: 1
        }]
      }

      mockRecognition.onresult?.(mockEvent)
      
      expect(mockHandlers.onHotword).toHaveBeenCalledWith('hey keycloak zeige alle benutzer')
      expect(mockHandlers.onCommand).toHaveBeenCalledWith({
        command: 'zeige alle benutzer',
        transcript: 'hey keycloak zeige alle benutzer',
        confidence: 0.9,
        language: 'de-DE',
        timestamp: expect.any(String)
      })
    })

    it('handles multiple hotwords', () => {
      const mockEvent = {
        resultIndex: 0,
        results: [{
          0: { transcript: 'hallo keycloak erstelle benutzer', confidence: 0.8 },
          isFinal: true,
          length: 1
        }]
      }

      mockRecognition.onresult?.(mockEvent)
      
      expect(mockHandlers.onHotword).toHaveBeenCalled()
      expect(mockHandlers.onCommand).toHaveBeenCalledWith({
        command: 'erstelle benutzer',
        transcript: 'hallo keycloak erstelle benutzer',
        confidence: 0.8,
        language: 'de-DE',
        timestamp: expect.any(String)
      })
    })
  })

  describe('speech synthesis', () => {
    it('speaks text successfully', async () => {
      const speakPromise = voiceService.speak('Hallo Welt')
      
      // Simulate successful speech completion
      mockUtterance.onend?.()
      
      await expect(speakPromise).resolves.toBeUndefined()
      expect(mockSynthesis.speak).toHaveBeenCalledTimes(1)
    })

    it('handles speech synthesis errors', async () => {
      const speakPromise = voiceService.speak('Test')
      
      // Simulate error
      const errorEvent = { error: 'synthesis-failed' }
      mockUtterance.onerror?.(errorEvent)
      
      await expect(speakPromise).rejects.toThrow('Fehler bei der Sprachausgabe')
    })

    it('cancels ongoing speech before speaking new text', async () => {
      voiceService.speak('First text')
      expect(mockSynthesis.cancel).toHaveBeenCalledTimes(1)
    })

    it('cancels speech manually', () => {
      voiceService.cancelSpeech()
      expect(mockSynthesis.cancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('configuration updates', () => {
    it('updates config successfully', () => {
      voiceService.updateConfig({ language: 'en-US', continuous: true })
      
      const config = voiceService.getConfig()
      expect(config.language).toBe('en-US')
      expect(config.continuous).toBe(true)
    })

    it('updates handlers successfully', () => {
      const newHandlers = { onStart: jest.fn() }
      voiceService.updateHandlers(newHandlers)
      
      mockRecognition.onstart?.()
      expect(newHandlers.onStart).toHaveBeenCalledTimes(1)
      expect(mockHandlers.onStart).not.toHaveBeenCalled()
    })
  })

  describe('cleanup', () => {
    it('cleans up resources on destroy', () => {
      // Simulate listening state for stop to be called
      voiceService['isListening'] = true
      voiceService.destroy()
      
      expect(mockRecognition.stop).toHaveBeenCalledTimes(1)
      expect(mockSynthesis.cancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('result processing', () => {
    it('processes interim results', () => {
      const mockEvent = {
        resultIndex: 0,
        results: [{
          0: { transcript: 'zeige alle', confidence: 0.7 },
          isFinal: false,
          length: 1
        }]
      }

      mockRecognition.onresult?.(mockEvent)
      
      expect(mockHandlers.onResult).toHaveBeenCalledWith('zeige alle', false, 0)
    })

    it('processes final results', () => {
      const mockEvent = {
        resultIndex: 0,
        results: [{
          0: { transcript: 'zeige alle benutzer', confidence: 0.9 },
          isFinal: true,
          length: 1
        }]
      }

      mockRecognition.onresult?.(mockEvent)
      
      expect(mockHandlers.onResult).toHaveBeenCalledWith('zeige alle benutzer', true, 0.9)
    })
  })
})

describe('checkVoiceSupport', () => {
  it('returns support status correctly when supported', () => {
    const support = checkVoiceSupport()
    
    expect(support.speechRecognition).toBe(true)
    expect(support.speechSynthesis).toBe(true)
  })

  it('returns false when window is undefined (SSR)', () => {
    const originalWindow = global.window
    const originalSpeechRecognition = (global as any).SpeechRecognition
    const originalWebkitSpeechRecognition = (global as any).webkitSpeechRecognition
    const originalSpeechSynthesis = (global as any).speechSynthesis
    
    // Delete all window and global speech objects to simulate SSR
    delete (global as any).window
    delete (global as any).SpeechRecognition
    delete (global as any).webkitSpeechRecognition
    delete (global as any).speechSynthesis
    
    const support = checkVoiceSupport()
    
    expect(support.speechRecognition).toBe(false)
    expect(support.speechSynthesis).toBe(false)
    
    // Restore everything
    global.window = originalWindow
    if (originalSpeechRecognition) (global as any).SpeechRecognition = originalSpeechRecognition
    if (originalWebkitSpeechRecognition) (global as any).webkitSpeechRecognition = originalWebkitSpeechRecognition
    if (originalSpeechSynthesis) (global as any).speechSynthesis = originalSpeechSynthesis
  })
})