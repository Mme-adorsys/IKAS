import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { IKASEvent, EventType, VoiceCommand } from '@/types/events';
import { PromptTemplate, PromptCategory, PromptFilter, PromptExecution, DEFAULT_PROMPT_TEMPLATES } from '@/types/prompts';
import { VoiceService } from '@/services/voice';
import { websocketService } from '@/services/websocket';

// System state interfaces
interface SystemStatus {
  websocketConnected: boolean;
  sessionId: string | null;
  services: {
    aiGateway: 'healthy' | 'unhealthy' | 'unknown';
    websocket: 'healthy' | 'unhealthy' | 'unknown';
    keycloakMcp: 'healthy' | 'unhealthy' | 'unknown';
    neo4jMcp: 'healthy' | 'unhealthy' | 'unknown';
  };
}

// Voice state interfaces
interface VoiceState {
  isListening: boolean;
  hotwordMode: boolean;
  currentTranscript: string;
  lastCommand: VoiceCommand | null;
  lastResponse: string | null;
  voiceSupported: boolean;
}

// Model and Chat state interfaces
interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  model: string;
  capabilities: string[];
  description: string;
  available: boolean;
  current: boolean;
}

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
  sessionId?: string;
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

interface ModelState {
  availableModels: ModelInfo[];
  currentModel: ModelInfo | null;
  isLoading: boolean;
  lastError: string | null;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  textInput: string;
  sessionId: string | null;
}

// Event state interfaces
interface EventState {
  events: IKASEvent[];
  unreadCount: number;
  filteredEventTypes: EventType[];
}

// Analysis state interfaces
interface AnalysisState {
  activeAnalyses: Map<string, {
    id: string;
    type: string;
    progress: number;
    status: 'started' | 'running' | 'completed' | 'failed';
    startTime: Date;
    result?: any;
    error?: string;
  }>;
  analysisHistory: Array<{
    id: string;
    type: string;
    completedAt: Date;
    duration: number;
    success: boolean;
    result?: any;
  }>;
}

// Users and compliance state
interface DataState {
  users: Array<{
    id: string;
    username: string;
    email: string;
    firstName?: string;
    lastName?: string;
    enabled: boolean;
    realm: string;
  }>;
  clients: Array<{
    id: string;
    clientId: string;
    name?: string;
    description?: string;
    enabled: boolean;
    realm: string;
  }>;
  realms: Array<{
    id: string;
    realm: string;
    displayName?: string;
    enabled: boolean;
  }>;
  complianceIssues: Array<{
    id: string;
    severity: 'info' | 'warning' | 'error' | 'critical';
    rule: string;
    description: string;
    affected: Array<{ type: string; id: string; name: string }>;
    timestamp: Date;
  }>;
  graphData: {
    nodes: any[];
    relationships: any[];
    lastUpdate: Date | null;
  };
}

// UI state
interface UIState {
  darkMode: boolean;
  sidebarOpen: boolean;
  activeView: 'dashboard' | 'users' | 'compliance' | 'analysis' | 'voice' | 'prompts';
  notifications: Array<{
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
  }>;
}

// Prompt management state
interface PromptState {
  prompts: PromptTemplate[];
  categories: PromptCategory[];
  filter: PromptFilter;
  selectedPrompt: PromptTemplate | null;
  isLoading: boolean;
  isLibraryOpen: boolean;
  executionHistory: PromptExecution[];
  searchQuery: string;
}

// Combined store interface
interface IKASStore {
  // State
  system: SystemStatus;
  voice: VoiceState;
  model: ModelState;
  chat: ChatState;
  events: EventState;
  analysis: AnalysisState;
  data: DataState;
  ui: UIState;
  prompts: PromptState;

  // Voice service instance
  voiceService: VoiceService | null;

  // Actions
  initializeServices: () => Promise<void>;
  connectWebSocket: (userId?: string, realm?: string) => Promise<void>;
  disconnectWebSocket: () => Promise<void>;
  reconnectWebSocket: (userId?: string, realm?: string) => Promise<void>;
  checkServiceHealth: () => Promise<void>;
  
  // Voice actions
  initializeVoice: () => void;
  startListening: () => void;
  stopListening: () => void;
  toggleHotwordMode: () => void;
  sendVoiceCommand: (command: VoiceCommand) => Promise<void>;

  // Model actions
  loadAvailableModels: () => Promise<void>;
  switchModel: (modelId: string) => Promise<void>;
  getCurrentModel: () => Promise<void>;

  // Chat actions
  sendTextMessage: (message: string) => Promise<void>;
  updateTextInput: (input: string) => void;
  clearChatHistory: () => void;
  addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;

  // Event actions
  addEvent: (event: IKASEvent) => void;
  handleIncomingEvent: (event: IKASEvent) => void;
  markEventsAsRead: () => void;
  filterEvents: (eventTypes: EventType[]) => void;
  clearEvents: () => void;

  // Analysis actions
  startAnalysis: (type: string, parameters?: Record<string, any>) => Promise<void>;
  updateAnalysisProgress: (analysisId: string, progress: number, status?: string) => void;
  completeAnalysis: (analysisId: string, result: any, success: boolean) => void;


  // Prompt management actions
  loadPrompts: () => void;
  savePrompt: (prompt: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount'>) => string;
  updatePrompt: (id: string, updates: Partial<PromptTemplate>) => void;
  deletePrompt: (id: string) => void;
  toggleFavorite: (id: string) => void;
  setFilter: (filter: Partial<PromptFilter>) => void;
  setSearchQuery: (query: string) => void;
  selectPrompt: (prompt: PromptTemplate | null) => void;
  loadPromptToChat: (id: string, variables?: Record<string, string>) => void;
  executePrompt: (id: string, variables?: Record<string, string>) => Promise<void>;
  togglePromptLibrary: () => void;
  exportPrompts: () => void;
  importPrompts: (prompts: PromptTemplate[]) => void;
  getFilteredPrompts: () => PromptTemplate[];
  getFavoritePrompts: () => PromptTemplate[];

  // UI actions
  toggleDarkMode: () => void;
  toggleSidebar: () => void;
  setActiveView: (view: UIState['activeView']) => void;
  addNotification: (notification: Omit<UIState['notifications'][0], 'id' | 'timestamp' | 'read'>) => void;
  markNotificationAsRead: (id: string) => void;
  clearNotifications: () => void;
}

export const useIKASStore = create<IKASStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // Initial state
      system: {
        websocketConnected: false,
        sessionId: null,
        services: {
          aiGateway: 'unknown',
          websocket: 'unknown',
          keycloakMcp: 'unknown',
          neo4jMcp: 'unknown'
        }
      },

      voice: {
        isListening: false,
        hotwordMode: false,
        currentTranscript: '',
        lastCommand: null,
        lastResponse: null,
        voiceSupported: false
      },

      model: {
        availableModels: [],
        currentModel: null,
        isLoading: false,
        lastError: null
      },

      chat: {
        messages: [],
        isLoading: false,
        textInput: '',
        sessionId: null
      },

      events: {
        events: [],
        unreadCount: 0,
        filteredEventTypes: []
      },

      analysis: {
        activeAnalyses: new Map(),
        analysisHistory: []
      },

      data: {
        users: [],
        clients: [],
        realms: [],
        complianceIssues: [],
        graphData: {
          nodes: [],
          relationships: [],
          lastUpdate: null
        }
      },

      ui: {
        darkMode: false,
        sidebarOpen: true,
        activeView: 'dashboard',
        notifications: []
      },

      prompts: {
        prompts: [],
        categories: ['sync', 'compliance', 'analysis', 'management', 'monitoring', 'reporting', 'custom'],
        filter: {},
        selectedPrompt: null,
        isLoading: false,
        isLibraryOpen: false,
        executionHistory: [],
        searchQuery: ''
      },

      voiceService: null,

      // Service initialization
      initializeServices: async () => {
        const { initializeVoice, loadAvailableModels, loadPrompts } = get();
        initializeVoice();
        
        // Load available models on initialization (non-blocking)
        loadAvailableModels().catch((error) => {
          console.warn('Models not available during initialization:', error);
          // Add a notification instead of blocking
          get().addNotification({
            type: 'warning',
            title: 'Models Unavailable',
            message: 'AI Gateway not connected. Some features may be limited.'
          });
        });
        
        // Load saved prompts
        loadPrompts();
      },

      connectWebSocket: async (userId?: string, realm?: string) => {
        try {
          // Update connection status to connecting
          set((state) => ({
            system: {
              ...state.system,
              services: {
                ...state.system.services,
                websocket: 'unknown'
              }
            }
          }));

          await websocketService.connect(userId, realm);
          
          // Set up event handlers
          websocketService.on('*', (event: IKASEvent) => {
            const store = get();
            store.addEvent(event);
            store.handleIncomingEvent(event);
          });

          websocketService.on('voiceCommandReceived', (data) => {
            get().addNotification({
              type: 'success',
              title: 'Voice Command Received',
              message: `Command acknowledged: ${data.eventId}`
            });
          });

          // Handle connection retry events
          websocketService.on('connectionRetrying', (data) => {
            get().addNotification({
              type: 'warning',
              title: 'Reconnecting...',
              message: `Attempt ${data.attempts}/${data.maxAttempts}`
            });
          });

          // Handle connection failure events
          websocketService.on('connectionFailed', (data) => {
            set((state) => ({
              system: {
                ...state.system,
                websocketConnected: false,
                services: {
                  ...state.system.services,
                  websocket: 'unhealthy'
                }
              }
            }));

            get().addNotification({
              type: 'error',
              title: 'Connection Failed',
              message: `Failed to connect to WebSocket server. Please check if the server is running at ${data.url}`
            });
          });

          // Subscribe to all event types
          await websocketService.subscribe({
            eventTypes: Object.values(EventType),
            room: 'global'
          });

          // Test connection health
          const healthy = await websocketService.testConnection();

          set((state) => ({
            system: {
              ...state.system,
              websocketConnected: true,
              sessionId: websocketService.getSessionId(),
              services: {
                ...state.system.services,
                websocket: healthy ? 'healthy' : 'unhealthy'
              }
            }
          }));

          get().addNotification({
            type: 'success',
            title: 'Connected',
            message: 'Connected to IKAS WebSocket server successfully'
          });

        } catch (error) {
          console.error('Failed to connect WebSocket:', error);
          
          set((state) => ({
            system: {
              ...state.system,
              websocketConnected: false,
              services: {
                ...state.system.services,
                websocket: 'unhealthy'
              }
            }
          }));

          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          get().addNotification({
            type: 'error',
            title: 'Connection Failed',
            message: `WebSocket connection failed: ${errorMessage}`
          });

          throw error; // Re-throw for caller to handle
        }
      },

      disconnectWebSocket: async () => {
        await websocketService.disconnect();
        set((state) => ({
          system: {
            ...state.system,
            websocketConnected: false,
            sessionId: null,
            services: {
              ...state.system.services,
              websocket: 'unknown'
            }
          }
        }));
      },

      reconnectWebSocket: async (userId?: string, realm?: string) => {
        try {
          get().addNotification({
            type: 'info',
            title: 'Reconnecting',
            message: 'Attempting to reconnect to WebSocket server...'
          });

          // Force reconnection using the service method
          await websocketService.forceReconnect(userId, realm);
          
          // Re-setup event handlers and subscriptions
          await get().connectWebSocket(userId, realm);

        } catch (error) {
          console.error('Forced reconnection failed:', error);
          get().addNotification({
            type: 'error', 
            title: 'Reconnection Failed',
            message: 'Manual reconnection attempt failed. Please check WebSocket server status.'
          });
        }
      },

      checkServiceHealth: async () => {
        try {
          // Check WebSocket health
          const wsStatus = await websocketService.getEnhancedConnectionStatus();
          
          set((state) => ({
            system: {
              ...state.system,
              websocketConnected: wsStatus.connected,
              services: {
                ...state.system.services,
                websocket: wsStatus.healthy ? 'healthy' : (wsStatus.connected ? 'unhealthy' : 'unknown')
              }
            }
          }));

          // Check health of services via Next.js proxy to avoid CORS issues
          const services = ['aiGateway', 'keycloakMcp', 'neo4jMcp'] as const;
          const healthUrls = {
            aiGateway: '/api/ai-gateway/health',    // Proxied via Next.js
            keycloakMcp: '/api/keycloak/health',    // Proxied via Next.js
            neo4jMcp: '/api/neo4j/health'           // Proxied via Next.js
          };

          for (const service of services) {
            try {
              // Implement timeout using AbortController
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 5000);
              
              const response = await fetch(healthUrls[service], { 
                method: 'GET',
                signal: controller.signal
                // No need for CORS mode since we're using Next.js proxy
              });
              
              clearTimeout(timeoutId);
              
              set((state) => ({
                system: {
                  ...state.system,
                  services: {
                    ...state.system.services,
                    [service]: response.ok ? 'healthy' : 'unhealthy'
                  }
                }
              }));
            } catch (error) {
              set((state) => ({
                system: {
                  ...state.system,
                  services: {
                    ...state.system.services,
                    [service]: 'unhealthy'
                  }
                }
              }));
            }
          }

        } catch (error) {
          console.error('Health check failed:', error);
        }
      },

      // Voice actions
      initializeVoice: () => {
        if (typeof window === 'undefined') return;

        const voiceService = new VoiceService(
          {
            language: 'en-US',
            continuous: false,
            interimResults: true,
            hotwordEnabled: true,
            hotwords: ['ikas', 'hey ikas']
          },
          {
            onResult: (transcript, isFinal, confidence) => {
              set((state) => ({
                voice: {
                  ...state.voice,
                  currentTranscript: transcript
                }
              }));
            },
            onCommand: async (command) => {
              set((state) => ({
                voice: {
                  ...state.voice,
                  lastCommand: command
                }
              }));
              
              await get().sendVoiceCommand(command);
            },
            onHotword: (transcript) => {
              get().addNotification({
                type: 'info',
                title: 'Hotword Detected',
                message: `"${transcript}" recognized`
              });
            },
            onStart: () => {
              set((state) => ({
                voice: {
                  ...state.voice,
                  isListening: true
                }
              }));
            },
            onEnd: () => {
              set((state) => ({
                voice: {
                  ...state.voice,
                  isListening: false
                }
              }));
            },
            onError: (error) => {
              get().addNotification({
                type: 'error',
                title: 'Voice Recognition Error',
                message: error
              });
            }
          }
        );

        set((state) => ({
          voiceService,
          voice: {
            ...state.voice,
            voiceSupported: true
          }
        }));
      },

      startListening: () => {
        const { voiceService } = get();
        voiceService?.startListening();
      },

      stopListening: () => {
        const { voiceService } = get();
        voiceService?.stopListening();
      },

      toggleHotwordMode: () => {
        const { voiceService } = get();
        if (voiceService) {
          const hotwordMode = voiceService.toggleHotwordMode();
          set((state) => ({
            voice: {
              ...state.voice,
              hotwordMode
            }
          }));
        }
      },

      sendVoiceCommand: async (command: VoiceCommand) => {
        try {
          await websocketService.sendVoiceCommand(command);
          get().addNotification({
            type: 'info',
            title: 'Voice Command Sent',
            message: `"${command.command}" sent for processing`
          });
        } catch (error) {
          get().addNotification({
            type: 'error',
            title: 'Failed to Send Command',
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      },

      // Model actions
      loadAvailableModels: async () => {
        set((state) => ({
          model: {
            ...state.model,
            isLoading: true,
            lastError: null
          }
        }));

        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
          const response = await fetch(`${apiUrl}/api/models`);
          
          if (!response.ok) {
            throw new Error(`Failed to load models: ${response.statusText}`);
          }

          const data = await response.json();

          set((state) => ({
            model: {
              ...state.model,
              availableModels: data.models || [],
              currentModel: data.current ? data.models.find((m: ModelInfo) => m.current) || null : null,
              isLoading: false
            }
          }));
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          set((state) => ({
            model: {
              ...state.model,
              isLoading: false,
              lastError: errorMessage
            }
          }));

          get().addNotification({
            type: 'error',
            title: 'Failed to Load Models',
            message: errorMessage
          });
        }
      },

      switchModel: async (modelId: string) => {
        set((state) => ({
          model: {
            ...state.model,
            isLoading: true,
            lastError: null
          }
        }));

        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
          const response = await fetch(`${apiUrl}/api/models/switch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              provider: modelId,
              sessionId: get().chat.sessionId
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to switch model: ${response.statusText}`);
          }

          const data = await response.json();

          // Update current model
          set((state) => ({
            model: {
              ...state.model,
              currentModel: state.model.availableModels.find(m => m.id === modelId) || null,
              availableModels: state.model.availableModels.map(m => ({
                ...m,
                current: m.id === modelId
              })),
              isLoading: false
            }
          }));

          // Clear chat if session was cleared
          if (data.sessionCleared) {
            get().clearChatHistory();
          }

          get().addNotification({
            type: 'success',
            title: 'Model Switched',
            message: `Now using ${data.provider} (${data.model})`
          });

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          set((state) => ({
            model: {
              ...state.model,
              isLoading: false,
              lastError: errorMessage
            }
          }));

          get().addNotification({
            type: 'error',
            title: 'Failed to Switch Model',
            message: errorMessage
          });
        }
      },

      getCurrentModel: async () => {
        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
          const response = await fetch(`${apiUrl}/api/models`);
          
          if (!response.ok) {
            throw new Error(`Failed to get current model: ${response.statusText}`);
          }

          const data = await response.json();

          set((state) => ({
            model: {
              ...state.model,
              currentModel: data.current ? data.models.find((m: ModelInfo) => m.current) || null : null,
              availableModels: data.models || []
            }
          }));
        } catch (error) {
          console.error('Failed to get current model:', error);
        }
      },

      // Chat actions
      sendTextMessage: async (message: string) => {
        if (!message.trim()) return;

        const messageId = Date.now().toString();
        const sessionId = get().chat.sessionId || Date.now().toString();

        // Add user message to chat
        get().addChatMessage({
          type: 'user',
          content: message.trim(),
          sessionId
        });

        // Update session ID if needed
        if (!get().chat.sessionId) {
          set((state) => ({
            chat: {
              ...state.chat,
              sessionId
            }
          }));
        }

        set((state) => ({
          chat: {
            ...state.chat,
            isLoading: true,
            textInput: ''
          }
        }));

        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
          const response = await fetch(`${apiUrl}/api/chat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              message: message.trim(),
              sessionId,
              context: {
                realm: 'master',
                preferredLanguage: 'en',
                priority: 'normal'
              }
            })
          });

          if (!response.ok) {
            throw new Error(`Failed to send message: ${response.statusText}`);
          }

          const data = await response.json();

          // Add assistant response to chat
          get().addChatMessage({
            type: 'assistant',
            content: data.response || 'No response received',
            sessionId,
            model: get().model.currentModel?.name,
            tokens: data.data?.usage ? {
              prompt: data.data.usage.promptTokens,
              completion: data.data.usage.completionTokens,
              total: data.data.usage.totalTokens
            } : undefined
          });

          set((state) => ({
            chat: {
              ...state.chat,
              isLoading: false
            }
          }));

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          
          // Add error message to chat
          get().addChatMessage({
            type: 'system',
            content: `Error: ${errorMessage}`,
            sessionId
          });

          set((state) => ({
            chat: {
              ...state.chat,
              isLoading: false
            }
          }));

          get().addNotification({
            type: 'error',
            title: 'Failed to Send Message',
            message: errorMessage
          });
        }
      },

      updateTextInput: (input: string) => {
        set((state) => ({
          chat: {
            ...state.chat,
            textInput: input
          }
        }));
      },

      clearChatHistory: () => {
        set((state) => ({
          chat: {
            ...state.chat,
            messages: [],
            sessionId: null
          }
        }));
      },

      addChatMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
        const newMessage: ChatMessage = {
          ...message,
          id: Date.now().toString(),
          timestamp: new Date()
        };

        set((state) => ({
          chat: {
            ...state.chat,
            messages: [...state.chat.messages, newMessage]
          }
        }));
      },

      // Event handling
      addEvent: (event: IKASEvent) => {
        set((state) => ({
          events: {
            ...state.events,
            events: [event, ...state.events.events].slice(0, 1000), // Keep last 1000 events
            unreadCount: state.events.unreadCount + 1
          }
        }));
      },

      handleIncomingEvent: (event: IKASEvent) => {
        // Handle different event types
        switch (event.type) {
          case EventType.VOICE_RESPONSE:
            if (event.payload.response) {
              set((state) => ({
                voice: {
                  ...state.voice,
                  lastResponse: event.payload.response || null
                }
              }));
              
              // Speak the response
              get().voiceService?.speak(event.payload.response);
            }
            break;

          case EventType.ANALYSIS_PROGRESS:
            get().updateAnalysisProgress(
              event.payload.analysisId, 
              event.payload.progress || 0,
              event.payload.status
            );
            break;

          case EventType.ANALYSIS_COMPLETED:
            get().completeAnalysis(
              event.payload.analysisId,
              event.payload.result,
              event.payload.status === 'completed'
            );
            break;

          case EventType.USER_CREATED:
          case EventType.USER_UPDATED:
          case EventType.USER_DELETED:
            // Update users data
            // Implementation depends on specific requirements
            break;

          case EventType.DATA_UPDATE:
            // Handle data updates from backend
            const { dataType, data } = event.payload;
            set((state) => {
              const updatedData = { ...state.data };
              
              switch (dataType) {
                case 'users':
                  updatedData.users = Array.isArray(data) ? data : [];
                  break;
                case 'clients':
                  updatedData.clients = Array.isArray(data) ? data : [];
                  break;
                case 'realms':
                  updatedData.realms = Array.isArray(data) ? data : [];
                  break;
                case 'metrics':
                  // Handle metrics update
                  break;
                default:
                  console.warn('Unknown data type:', dataType);
              }
              
              return { data: updatedData };
            });
            break;

          case EventType.COMPLIANCE_ALERT:
            // Add compliance issue
            set((state) => ({
              data: {
                ...state.data,
                complianceIssues: [
                  {
                    id: event.payload.checkId,
                    severity: event.payload.severity,
                    rule: event.payload.rule,
                    description: event.payload.description,
                    affected: event.payload.affected,
                    timestamp: new Date(event.timestamp)
                  },
                  ...state.data.complianceIssues
                ]
              }
            }));
            break;

          case EventType.GRAPH_UPDATE:
            // Update graph data
            if (event.payload.nodes || event.payload.relationships) {
              set((state) => ({
                data: {
                  ...state.data,
                  graphData: {
                    nodes: event.payload.nodes || state.data.graphData.nodes,
                    relationships: event.payload.relationships || state.data.graphData.relationships,
                    lastUpdate: new Date()
                  }
                }
              }));
            }
            break;
        }
      },

      markEventsAsRead: () => {
        set((state) => ({
          events: {
            ...state.events,
            unreadCount: 0
          }
        }));
      },

      filterEvents: (eventTypes: EventType[]) => {
        set((state) => ({
          events: {
            ...state.events,
            filteredEventTypes: eventTypes
          }
        }));
      },

      clearEvents: () => {
        set((state) => ({
          events: {
            ...state.events,
            events: [],
            unreadCount: 0
          }
        }));
      },

      // Analysis actions
      startAnalysis: async (type: string, parameters: Record<string, any> = {}) => {
        try {
          await websocketService.startAnalysis(type, parameters);
          
          const analysisId = `analysis-${Date.now()}`;
          const activeAnalyses = new Map(get().analysis.activeAnalyses);
          activeAnalyses.set(analysisId, {
            id: analysisId,
            type,
            progress: 0,
            status: 'started',
            startTime: new Date()
          });

          set((state) => ({
            analysis: {
              ...state.analysis,
              activeAnalyses
            }
          }));

        } catch (error) {
          get().addNotification({
            type: 'error',
            title: 'Analysis Failed',
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      },

      updateAnalysisProgress: (analysisId: string, progress: number, status?: string) => {
        const activeAnalyses = new Map(get().analysis.activeAnalyses);
        const analysis = activeAnalyses.get(analysisId);
        
        if (analysis) {
          activeAnalyses.set(analysisId, {
            ...analysis,
            progress,
            status: (status as any) || analysis.status
          });

          set((state) => ({
            analysis: {
              ...state.analysis,
              activeAnalyses
            }
          }));
        }
      },

      completeAnalysis: (analysisId: string, result: any, success: boolean) => {
        const activeAnalyses = new Map(get().analysis.activeAnalyses);
        const analysis = activeAnalyses.get(analysisId);
        
        if (analysis) {
          const completedAnalysis = {
            id: analysisId,
            type: analysis.type,
            completedAt: new Date(),
            duration: Date.now() - analysis.startTime.getTime(),
            success,
            result
          };

          activeAnalyses.delete(analysisId);

          set((state) => ({
            analysis: {
              ...state.analysis,
              activeAnalyses,
              analysisHistory: [completedAnalysis, ...state.analysis.analysisHistory].slice(0, 50)
            }
          }));

          get().addNotification({
            type: success ? 'success' : 'error',
            title: 'Analysis Completed',
            message: `${analysis.type} analysis ${success ? 'completed successfully' : 'failed'}`
          });
        }
      },


      // UI actions
      toggleDarkMode: () => {
        set((state) => ({
          ui: {
            ...state.ui,
            darkMode: !state.ui.darkMode
          }
        }));
      },

      toggleSidebar: () => {
        set((state) => ({
          ui: {
            ...state.ui,
            sidebarOpen: !state.ui.sidebarOpen
          }
        }));
      },

      setActiveView: (view: UIState['activeView']) => {
        set((state) => ({
          ui: {
            ...state.ui,
            activeView: view
          }
        }));
      },

      addNotification: (notification) => {
        const newNotification = {
          ...notification,
          id: `notification-${Date.now()}`,
          timestamp: new Date(),
          read: false
        };

        set((state) => ({
          ui: {
            ...state.ui,
            notifications: [newNotification, ...state.ui.notifications].slice(0, 100)
          }
        }));
      },

      markNotificationAsRead: (id: string) => {
        set((state) => ({
          ui: {
            ...state.ui,
            notifications: state.ui.notifications.map(n => 
              n.id === id ? { ...n, read: true } : n
            )
          }
        }));
      },

      clearNotifications: () => {
        set((state) => ({
          ui: {
            ...state.ui,
            notifications: []
          }
        }));
      },

      // Prompt management actions
      loadPrompts: () => {
        try {
          const storedPrompts = localStorage.getItem('ikas-prompts');
          let prompts: PromptTemplate[] = [];
          
          if (storedPrompts) {
            const parsed = JSON.parse(storedPrompts);
            prompts = parsed.map((p: any) => ({
              ...p,
              createdAt: new Date(p.createdAt),
              updatedAt: new Date(p.updatedAt),
              lastUsed: p.lastUsed ? new Date(p.lastUsed) : undefined
            }));
          } else {
            // Initialize with default prompts on first load
            prompts = DEFAULT_PROMPT_TEMPLATES.map((template, index) => ({
              ...template,
              id: `default-${index}`,
              createdAt: new Date(),
              updatedAt: new Date(),
              usageCount: 0
            }));
            
            // Save default prompts to localStorage
            localStorage.setItem('ikas-prompts', JSON.stringify(prompts));
          }
          
          set((state) => ({
            prompts: {
              ...state.prompts,
              prompts
            }
          }));
        } catch (error) {
          console.error('Failed to load prompts:', error);
        }
      },

      savePrompt: (promptData) => {
        const id = `prompt-${Date.now()}`;
        const newPrompt: PromptTemplate = {
          ...promptData,
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
          usageCount: 0
        };

        set((state) => {
          const updatedPrompts = [...state.prompts.prompts, newPrompt];
          
          // Save to localStorage
          localStorage.setItem('ikas-prompts', JSON.stringify(updatedPrompts));
          
          return {
            prompts: {
              ...state.prompts,
              prompts: updatedPrompts
            }
          };
        });

        get().addNotification({
          type: 'success',
          title: 'Prompt Saved',
          message: `"${promptData.title}" has been saved successfully`
        });

        return id;
      },

      updatePrompt: (id, updates) => {
        set((state) => {
          const updatedPrompts = state.prompts.prompts.map(prompt =>
            prompt.id === id 
              ? { ...prompt, ...updates, updatedAt: new Date() }
              : prompt
          );
          
          // Save to localStorage
          localStorage.setItem('ikas-prompts', JSON.stringify(updatedPrompts));
          
          return {
            prompts: {
              ...state.prompts,
              prompts: updatedPrompts
            }
          };
        });
      },

      deletePrompt: (id) => {
        set((state) => {
          const updatedPrompts = state.prompts.prompts.filter(p => p.id !== id);
          
          // Save to localStorage
          localStorage.setItem('ikas-prompts', JSON.stringify(updatedPrompts));
          
          return {
            prompts: {
              ...state.prompts,
              prompts: updatedPrompts,
              selectedPrompt: state.prompts.selectedPrompt?.id === id ? null : state.prompts.selectedPrompt
            }
          };
        });

        get().addNotification({
          type: 'info',
          title: 'Prompt Deleted',
          message: 'Prompt has been removed'
        });
      },

      toggleFavorite: (id) => {
        const { updatePrompt } = get();
        const prompt = get().prompts.prompts.find(p => p.id === id);
        
        if (prompt) {
          updatePrompt(id, { isFavorite: !prompt.isFavorite });
          
          get().addNotification({
            type: 'success',
            title: prompt.isFavorite ? 'Removed from Favorites' : 'Added to Favorites',
            message: `"${prompt.title}" ${prompt.isFavorite ? 'removed from' : 'added to'} favorites`
          });
        }
      },

      setFilter: (filter) => {
        set((state) => ({
          prompts: {
            ...state.prompts,
            filter: { ...state.prompts.filter, ...filter }
          }
        }));
      },

      setSearchQuery: (query) => {
        set((state) => ({
          prompts: {
            ...state.prompts,
            searchQuery: query
          }
        }));
      },

      selectPrompt: (prompt) => {
        set((state) => ({
          prompts: {
            ...state.prompts,
            selectedPrompt: prompt
          }
        }));
      },

      loadPromptToChat: (id, variables = {}) => {
        const prompt = get().prompts.prompts.find(p => p.id === id);
        if (!prompt) return;

        // Process template variables
        let content = prompt.content;
        Object.entries(variables).forEach(([key, value]) => {
          content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
        });

        // Update chat input with the processed content
        get().updateTextInput(content);

        // Update usage stats
        get().updatePrompt(id, {
          usageCount: prompt.usageCount + 1,
          lastUsed: new Date()
        });

        get().addNotification({
          type: 'success',
          title: 'Prompt Loaded',
          message: `"${prompt.title}" loaded to chat`
        });
      },

      executePrompt: async (id, variables = {}) => {
        const prompt = get().prompts.prompts.find(p => p.id === id);
        if (!prompt) return;

        // Process template variables
        let content = prompt.content;
        Object.entries(variables).forEach(([key, value]) => {
          content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
        });

        // Record execution start
        const executionId = `exec-${Date.now()}`;
        const execution: PromptExecution = {
          id: executionId,
          promptId: id,
          executedAt: new Date(),
          variables,
          success: false
        };

        set((state) => ({
          prompts: {
            ...state.prompts,
            executionHistory: [execution, ...state.prompts.executionHistory.slice(0, 49)]
          }
        }));

        try {
          // Execute the prompt through sendTextMessage
          await get().sendTextMessage(content);

          // Update execution record
          set((state) => ({
            prompts: {
              ...state.prompts,
              executionHistory: state.prompts.executionHistory.map(exec =>
                exec.id === executionId 
                  ? { ...exec, success: true, duration: Date.now() - exec.executedAt.getTime() }
                  : exec
              )
            }
          }));

          // Update usage stats
          get().updatePrompt(id, {
            usageCount: prompt.usageCount + 1,
            lastUsed: new Date()
          });

        } catch (error) {
          // Update execution record with error
          set((state) => ({
            prompts: {
              ...state.prompts,
              executionHistory: state.prompts.executionHistory.map(exec =>
                exec.id === executionId 
                  ? { 
                      ...exec, 
                      success: false, 
                      error: error instanceof Error ? error.message : 'Unknown error',
                      duration: Date.now() - exec.executedAt.getTime()
                    }
                  : exec
              )
            }
          }));
        }
      },

      togglePromptLibrary: () => {
        set((state) => ({
          prompts: {
            ...state.prompts,
            isLibraryOpen: !state.prompts.isLibraryOpen
          }
        }));
      },

      exportPrompts: () => {
        const prompts = get().prompts.prompts;
        const dataStr = JSON.stringify(prompts, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `ikas-prompts-${new Date().toISOString().split('T')[0]}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();

        get().addNotification({
          type: 'success',
          title: 'Prompts Exported',
          message: `${prompts.length} prompts exported successfully`
        });
      },

      importPrompts: (importedPrompts) => {
        set((state) => {
          // Add unique IDs to imported prompts and mark as imported
          const newPrompts = importedPrompts.map(prompt => ({
            ...prompt,
            id: `imported-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            usageCount: 0
          }));
          
          const allPrompts = [...state.prompts.prompts, ...newPrompts];
          
          // Save to localStorage
          localStorage.setItem('ikas-prompts', JSON.stringify(allPrompts));
          
          return {
            prompts: {
              ...state.prompts,
              prompts: allPrompts
            }
          };
        });

        get().addNotification({
          type: 'success',
          title: 'Prompts Imported',
          message: `${importedPrompts.length} prompts imported successfully`
        });
      },

      getFilteredPrompts: () => {
        const { prompts: promptsState } = get();
        const { prompts, filter, searchQuery } = promptsState;
        
        return prompts.filter(prompt => {
          // Search query filter
          if (searchQuery && !prompt.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
              !prompt.description?.toLowerCase().includes(searchQuery.toLowerCase()) &&
              !prompt.content.toLowerCase().includes(searchQuery.toLowerCase()) &&
              !prompt.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))) {
            return false;
          }
          
          // Category filter
          if (filter.category && prompt.category !== filter.category) {
            return false;
          }
          
          // Tags filter
          if (filter.tags && filter.tags.length > 0 && 
              !filter.tags.some(tag => prompt.tags.includes(tag))) {
            return false;
          }
          
          // Favorites filter
          if (filter.favoritesOnly && !prompt.isFavorite) {
            return false;
          }
          
          return true;
        }).sort((a, b) => {
          // Sort favorites first, then by usage, then by recent updates
          if (a.isFavorite !== b.isFavorite) {
            return a.isFavorite ? -1 : 1;
          }
          if (a.usageCount !== b.usageCount) {
            return b.usageCount - a.usageCount;
          }
          return b.updatedAt.getTime() - a.updatedAt.getTime();
        });
      },

      getFavoritePrompts: () => {
        return get().prompts.prompts
          .filter(prompt => prompt.isFavorite)
          .sort((a, b) => b.usageCount - a.usageCount)
          .slice(0, 6); // Limit to top 6 favorites for dashboard
      }
    })),
    { name: 'ikas-store' }
  )
);