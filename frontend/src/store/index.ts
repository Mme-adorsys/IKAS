import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { IKASEvent, EventType, VoiceCommand } from '@/types/events';
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
  activeView: 'dashboard' | 'users' | 'compliance' | 'analysis' | 'voice';
  notifications: Array<{
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
  }>;
}

// Combined store interface
interface IKASStore {
  // State
  system: SystemStatus;
  voice: VoiceState;
  events: EventState;
  analysis: AnalysisState;
  data: DataState;
  ui: UIState;

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

  // Data sync actions
  requestInitialDataSync: () => Promise<void>;

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

      voiceService: null,

      // Service initialization
      initializeServices: async () => {
        const { initializeVoice } = get();
        initializeVoice();
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

          // Request initial data sync after connection
          setTimeout(() => {
            get().requestInitialDataSync();
          }, 1000);

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

      // Data sync actions
      requestInitialDataSync: async () => {
        try {
          // Send voice command to sync initial data in background
          await websocketService.sendVoiceCommand({
            command: 'sync initial system data',
            transcript: 'Load system data on startup',
            confidence: 1.0,
            language: 'en-US',
            timestamp: new Date().toISOString()
          });

          get().addNotification({
            type: 'info',
            title: 'Data Sync',
            message: 'Loading system data in background...'
          });

        } catch (error) {
          console.warn('Failed to request initial data sync:', error);
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
      }
    })),
    { name: 'ikas-store' }
  )
);