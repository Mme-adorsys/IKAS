import { WebSocketService } from '../websocket'
import { EventType } from '@/types/events'
import { io } from 'socket.io-client'

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn()
}))

const mockIo = io as jest.MockedFunction<typeof io>

describe('WebSocketService', () => {
  let websocketService: WebSocketService
  let mockSocket: any

  beforeEach(() => {
    mockSocket = {
      id: 'mock-socket-id',
      connected: true,
      on: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      connect: jest.fn()
    }

    mockIo.mockReturnValue(mockSocket)
    websocketService = new WebSocketService('http://localhost:3001')
    jest.clearAllMocks()
  })

  afterEach(() => {
    websocketService.disconnect()
  })

  describe('connection', () => {
    it('connects to WebSocket server successfully', async () => {
      const connectPromise = websocketService.connect('test-user', 'test-realm')
      
      // Simulate successful connection
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1]
      connectHandler()
      
      await expect(connectPromise).resolves.toBeUndefined()
      
      expect(mockIo).toHaveBeenCalledWith('http://localhost:3001', {
        auth: {
          userId: 'test-user',
          realm: 'test-realm'
        },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
        transports: ['websocket', 'polling'],
        forceNew: false,
        autoConnect: true
      })
    })

    it('handles connection with default auth values', async () => {
      const connectPromise = websocketService.connect()
      
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1]
      connectHandler()
      
      await connectPromise
      
      expect(mockIo).toHaveBeenCalledWith('http://localhost:3001', 
        expect.objectContaining({
          auth: {
            userId: 'frontend-user',
            realm: 'master'
          }
        })
      )
    })

    it('handles connection errors', async () => {
      const connectPromise = websocketService.connect('test-user')
      
      // Simulate connection error multiple times to exceed retry limit
      const errorHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect_error')[1]
      for (let i = 0; i < 5; i++) {
        errorHandler({ message: 'Connection failed' })
      }
      
      await expect(connectPromise).rejects.toThrow('WebSocket connection failed after 5 attempts')
    })

    it('sets session ID when connected event is received', () => {
      websocketService.connect()
      
      const connectedHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connected')[1]
      connectedHandler({ sessionId: 'test-session-123', message: 'Connected successfully' })
      
      expect(websocketService.getSessionId()).toBe('test-session-123')
    })
  })

  describe('event handling', () => {
    beforeEach(async () => {
      const connectPromise = websocketService.connect()
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1]
      connectHandler()
      await connectPromise
    })

    it('handles incoming events', () => {
      const mockEvent = {
        id: 'event-1',
        type: EventType.VOICE_COMMAND,
        payload: { command: 'test command' },
        sessionId: 'session-1',
        timestamp: new Date().toISOString()
      }

      const eventHandler = mockSocket.on.mock.calls.find(call => call[0] === 'event')[1]
      eventHandler(mockEvent)
      
      // Should log the event (check via console.log spy if needed)
      expect(mockSocket.on).toHaveBeenCalledWith('event', expect.any(Function))
    })

    it('registers and calls event handlers', () => {
      const handler = jest.fn()
      websocketService.on(EventType.VOICE_COMMAND, handler)
      
      // Simulate receiving an event
      const mockEvent = {
        id: 'event-1',
        type: EventType.VOICE_COMMAND,
        payload: { command: 'test command' },
        sessionId: 'session-1',
        timestamp: new Date().toISOString()
      }

      const eventHandler = mockSocket.on.mock.calls.find(call => call[0] === 'event')[1]
      eventHandler(mockEvent)
      
      expect(handler).toHaveBeenCalledWith(mockEvent)
    })

    it('registers global event handlers', () => {
      const globalHandler = jest.fn()
      websocketService.on('*', globalHandler)
      
      const mockEvent = {
        id: 'event-1',
        type: EventType.VOICE_COMMAND,
        payload: { command: 'test command' },
        sessionId: 'session-1',
        timestamp: new Date().toISOString()
      }

      const eventHandler = mockSocket.on.mock.calls.find(call => call[0] === 'event')[1]
      eventHandler(mockEvent)
      
      expect(globalHandler).toHaveBeenCalledWith(mockEvent)
    })

    it('removes event handlers', () => {
      const handler = jest.fn()
      websocketService.on(EventType.VOICE_COMMAND, handler)
      websocketService.off(EventType.VOICE_COMMAND)
      
      const mockEvent = {
        id: 'event-1',
        type: EventType.VOICE_COMMAND,
        payload: { command: 'test command' },
        sessionId: 'session-1',
        timestamp: new Date().toISOString()
      }

      const eventHandler = mockSocket.on.mock.calls.find(call => call[0] === 'event')[1]
      eventHandler(mockEvent)
      
      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('voice commands', () => {
    beforeEach(async () => {
      const connectPromise = websocketService.connect()
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1]
      connectHandler()
      await connectPromise
    })

    it('sends voice commands successfully', async () => {
      const voiceCommand = {
        command: 'zeige alle benutzer',
        transcript: 'zeige alle benutzer',
        confidence: 0.9,
        language: 'de-DE',
        timestamp: new Date().toISOString()
      }

      await websocketService.sendVoiceCommand(voiceCommand)
      
      expect(mockSocket.emit).toHaveBeenCalledWith('voiceCommand', voiceCommand)
    })

    it('throws error when not connected', async () => {
      websocketService['isConnected'] = false
      
      const voiceCommand = {
        command: 'test',
        transcript: 'test',
        confidence: 1.0,
        language: 'de-DE',
        timestamp: new Date().toISOString()
      }

      await expect(websocketService.sendVoiceCommand(voiceCommand))
        .rejects.toThrow('WebSocket not connected')
    })
  })

  describe('subscriptions', () => {
    beforeEach(async () => {
      const connectPromise = websocketService.connect()
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1]
      connectHandler()
      await connectPromise
    })

    it('subscribes to events', async () => {
      const subscription = {
        eventTypes: [EventType.VOICE_COMMAND, EventType.USER_CREATED],
        room: 'test-room'
      }

      await websocketService.subscribe(subscription)
      
      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe', subscription)
    })

    it('unsubscribes from events', async () => {
      const eventTypes = [EventType.VOICE_COMMAND]
      const room = 'test-room'

      await websocketService.unsubscribe(eventTypes, room)
      
      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe', { eventTypes, room })
    })
  })

  describe('room management', () => {
    beforeEach(async () => {
      const connectPromise = websocketService.connect()
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1]
      connectHandler()
      await connectPromise
    })

    it('joins rooms', async () => {
      await websocketService.joinRoom('test-room')
      
      expect(mockSocket.emit).toHaveBeenCalledWith('joinRoom', { room: 'test-room' })
    })

    it('leaves rooms', async () => {
      await websocketService.leaveRoom('test-room')
      
      expect(mockSocket.emit).toHaveBeenCalledWith('leaveRoom', { room: 'test-room' })
    })
  })

  describe('analysis', () => {
    beforeEach(async () => {
      const connectPromise = websocketService.connect()
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1]
      connectHandler()
      await connectPromise
    })

    it('starts analysis', async () => {
      await websocketService.startAnalysis('duplicate-users', { realm: 'master' })
      
      expect(mockSocket.emit).toHaveBeenCalledWith('startAnalysis', {
        analysisType: 'duplicate-users',
        parameters: { realm: 'master' }
      })
    })
  })

  describe('utility methods', () => {
    it('returns connection status', () => {
      expect(websocketService.isSocketConnected()).toBe(false)
      
      // Simulate connection
      websocketService['socket'] = mockSocket
      websocketService['isConnected'] = true
      mockSocket.connected = true
      
      expect(websocketService.isSocketConnected()).toBe(true)
    })

    it('returns detailed connection status', () => {
      // Set up the socket connection
      websocketService['socket'] = mockSocket
      websocketService['sessionId'] = 'test-session'
      websocketService['reconnectAttempts'] = 2
      
      const status = websocketService.getConnectionStatus()
      
      expect(status).toEqual({
        connected: false,
        socketId: 'mock-socket-id',
        sessionId: 'test-session',
        reconnectAttempts: 2
      })
    })

    it('sends ping', () => {
      // Set up the socket connection
      websocketService['socket'] = mockSocket
      
      websocketService.ping()
      
      expect(mockSocket.emit).toHaveBeenCalledWith('ping')
    })
  })

  describe('disconnection', () => {
    it('disconnects and cleans up', async () => {
      // Set up the socket connection first
      websocketService['socket'] = mockSocket
      websocketService['isConnected'] = true
      websocketService['sessionId'] = 'test-session'
      
      await websocketService.disconnect()
      
      expect(mockSocket.disconnect).toHaveBeenCalledTimes(1)
      expect(websocketService.getSessionId()).toBeNull()
      expect(websocketService.isSocketConnected()).toBe(false)
    })

    it('handles disconnect event', async () => {
      const connectPromise = websocketService.connect()
      const connectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'connect')[1]
      connectHandler()
      await connectPromise

      const disconnectHandler = mockSocket.on.mock.calls.find(call => call[0] === 'disconnect')[1]
      disconnectHandler('transport close')
      
      expect(websocketService.isSocketConnected()).toBe(false)
    })
  })
})