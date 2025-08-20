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

          // Subscribe to all event types
          await websocketService.subscribe({
            eventTypes: Object.values(EventType),
            room: 'global'
          });

          set((state) => ({
            system: {
              ...state.system,
              websocketConnected: true,
              sessionId: websocketService.getSessionId()
            }
          }));

          get().addNotification({
            type: 'success',
            title: 'Connected',
            message: 'Connected to IKAS system successfully'
          });

        } catch (error) {
          console.error('Failed to connect WebSocket:', error);
          get().addNotification({
            type: 'error',
            title: 'Connection Failed',
            message: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      },

      disconnectWebSocket: async () => {
        await websocketService.disconnect();
        set((state) => ({
          system: {
            ...state.system,
            websocketConnected: false,
            sessionId: null
          }
        }));
      },

      // Voice actions
      initializeVoice: () => {
        if (typeof window === 'undefined') return;

        const voiceService = new VoiceService(
          {
            language: 'de-DE',
            continuous: false,
            interimResults: true,
            hotwordEnabled: true,
            hotwords: ['hey keycloak', 'hallo keycloak']
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
      }
    })),
    { name: 'ikas-store' }
  )
);