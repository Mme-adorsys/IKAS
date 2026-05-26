import { create } from 'zustand';
import { subscribeWithSelector, devtools } from 'zustand/middleware';
import { IKASEvent, EventType } from '@/types/events';
import { PromptTemplate, PromptCategory, PromptFilter, PromptExecution, DEFAULT_PROMPT_TEMPLATES } from '@/types/prompts';
import { websocketService } from '@/services/websocket';
import { Finding, Scan, ScanScope, CheckCategory, Severity, FindingStatus, LiveLoginEvent } from '@/types/security';

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
  activeView: 'dashboard' | 'users' | 'compliance' | 'analysis' | 'chat' | 'prompts' | 'security' | 'fixes';
  notifications: Array<{
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
  }>;
}

// Security state
interface SecurityState {
  activeScan: Scan | null;
  findings: Finding[];
  filter: { category?: CheckCategory; severity?: Severity; status?: FindingStatus };
  isLoading: boolean;
  lastError: string | null;
  liveEvents: LiveLoginEvent[];        // ring buffer, cap 200, newest first
  identityGraph: IdentityGraphData | null;
  // Epoch ms of the last completed scan. Used by panel useEffects to gate the
  // auto-scan: re-running only when older than SECURITY_SCAN_TTL_MS.
  lastScanAt: number | null;
}

// Auto-rescan interval used by panel auto-effects. Reasonable default for the
// demo: stays fresh within a 5-minute talk, doesn't re-run on every tab switch.
export const SECURITY_SCAN_TTL_MS = 5 * 60 * 1000;

/**
 * True when the last security scan is older than the TTL (or never ran).
 * Use from panel `useEffect` to decide whether to trigger an auto-scan.
 */
export function isSecurityScanStale(lastScanAt: number | null, ttlMs = SECURITY_SCAN_TTL_MS): boolean {
  if (lastScanAt === null) return true;
  return Date.now() - lastScanAt > ttlMs;
}

export interface IdentityGraphNode {
  id: string;
  label: string;
  type: 'realm' | 'user' | 'client' | 'group' | 'role' | 'finding';
  affected: boolean;
  // User-only stammdaten passed through from the backend projection (for click-drill-down).
  username?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  enabled?: boolean;
  emailVerified?: boolean;
  realm?: string;
  createdAt?: string;
  // Group-only / Role-only
  groupName?: string;
  roleName?: string;
  description?: string;
}

export interface AdminEvent {
  id: string;
  time: string;
  operation: 'ASSIGN_ROLE' | 'JOIN_GROUP' | 'CREATE_USER' | string;
  actor: string;
  targetType: string;
  targetUsername?: string;
  details?: string;
}

export interface IdentityGraphData {
  realm: string;
  nodes: IdentityGraphNode[];
  links: Array<{ source: string; target: string; type: string }>;
  // Adjacency lists for UserDetailModal's "roles & privileges" section. The graph above is
  // for visualisation; these maps are the ergonomic API for "which roles does this user have?"
  membershipByUser?: Record<string, string[]>;       // userId -> groupId[]
  rolesByGroup?: Record<string, string[]>;           // groupId -> roleId[]
  directRolesByUser?: Record<string, string[]>;      // userId -> roleId[]
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
  model: ModelState;
  chat: ChatState;
  events: EventState;
  analysis: AnalysisState;
  data: DataState;
  ui: UIState;
  prompts: PromptState;
  security: SecurityState;

  // Actions
  initializeServices: () => Promise<void>;
  connectWebSocket: (userId?: string, realm?: string) => Promise<void>;
  disconnectWebSocket: () => Promise<void>;
  reconnectWebSocket: (userId?: string, realm?: string) => Promise<void>;
  checkServiceHealth: () => Promise<void>;

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
  loadKeycloakUsers: () => Promise<void>;
  updateKeycloakUser: (realm: string, id: string, fields: { firstName?: string; lastName?: string; email?: string; emailVerified?: boolean; enabled?: boolean }) => Promise<boolean>;
  toggleKeycloakUserEnabled: (realm: string, id: string, enabled: boolean) => Promise<boolean>;
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

  // Security actions
  runSecurityScan: (realm: string, scope?: ScanScope) => Promise<void>;
  loadSecurityFindings: () => Promise<void>;
  dismissSecurityFinding: (id: string) => Promise<void>;
  enrichSecurityFinding: (id: string) => Promise<void>;
  setSecurityFilter: (filter: Partial<SecurityState['filter']>) => void;
  loadLiveEvents: () => Promise<void>;
  appendLiveEvent: (event: LiveLoginEvent) => void;
  loadIdentityGraph: (realm: string) => Promise<void>;
  triggerDemoScenario: (scenario: 'brute-force' | 'stuffing' | 'impossible-travel' | 'calm' | 'mixed') => Promise<void>;
  loadAdminEventsForUser: (userId: string) => Promise<AdminEvent[]>;
  syncRealmNow: () => Promise<{ added: number; updated: number; removed: number; realms: string[]; durationMs: number; errors: string[] } | null>;
  applyAutoFix: (findingId: string) => Promise<{ summary: string } | null>;
  resetDemo: () => Promise<{ durationMs: number; summary: any } | null>;
  autoFixableRules: string[];
  loadAutoFixableRules: () => Promise<void>;

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

      security: {
        activeScan: null,
        findings: [],
        filter: {},
        isLoading: false,
        lastError: null,
        liveEvents: [],
        identityGraph: null,
        lastScanAt: null
      },

      // Service initialization
      initializeServices: async () => {
        const { loadAvailableModels, loadPrompts } = get();

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

          // Register analysis with server-assigned UUID when confirmed
          websocketService.on('analysisStarted', (data: { analysisId: string; type: string; timestamp: string }) => {
            const activeAnalyses = new Map(get().analysis.activeAnalyses);
            activeAnalyses.set(data.analysisId, {
              id: data.analysisId,
              type: data.type,
              progress: 0,
              status: 'started',
              startTime: new Date(data.timestamp)
            });
            set((state) => ({
              analysis: { ...state.analysis, activeAnalyses }
            }));
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
              // Backend accepts {modelId} (full id like "anthropic-haiku-4.5") or {provider}
              // (e.g. "anthropic"). We send the id since that's what the UI tracks.
              modelId,
              // Backend zod schema rejects null sessionId — only include if it's a real string.
              ...(get().chat.sessionId ? { sessionId: get().chat.sessionId } : {})
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
          case EventType.ANALYSIS_STARTED: {
            // Fallback: create entry if the direct 'analysisStarted' socket event was missed
            const payload = event.payload as any;
            const activeAnalyses = new Map(get().analysis.activeAnalyses);
            if (!activeAnalyses.has(payload.analysisId)) {
              activeAnalyses.set(payload.analysisId, {
                id: payload.analysisId,
                type: payload.analysisType,
                progress: 0,
                status: 'started',
                startTime: new Date(event.timestamp)
              });
              set((state) => ({
                analysis: { ...state.analysis, activeAnalyses }
              }));
            }
            break;
          }

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

          case EventType.DATA_UPDATE: {
            // Handle data updates from backend
            const { dataType, data } = event.payload;

            // Live login events from the demo simulator. Push directly into the security
            // slice's ring buffer; widgets subscribe to security.liveEvents.
            if (dataType === 'liveLogin') {
              get().appendLiveEvent(data as LiveLoginEvent);
              break;
            }

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
          }

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
      // Update a Keycloak user via the new /api/users PUT. Returns true on success and refreshes
      // the local cache so the UI reflects the change.
      updateKeycloakUser: async (realm, id, fields) => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
        try {
          const res = await fetch(`${apiUrl}/api/users/${encodeURIComponent(realm)}/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(fields)
          });
          if (!res.ok) throw new Error(`Update failed: ${res.status}`);
          // Optimistic local update so the UI changes immediately, then refresh from server.
          set((state) => ({
            data: {
              ...state.data,
              users: state.data.users.map(u => u.id === id ? { ...u, ...fields } as typeof u : u)
            }
          }));
          void get().loadKeycloakUsers();
          return true;
        } catch (err) {
          get().addNotification({
            type: 'error', title: 'User-Update fehlgeschlagen',
            message: err instanceof Error ? err.message : 'Unknown error'
          });
          return false;
        }
      },

      // PATCH the enabled flag — same logic as updateKeycloakUser but narrower.
      toggleKeycloakUserEnabled: async (realm, id, enabled) => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
        try {
          const res = await fetch(`${apiUrl}/api/users/${encodeURIComponent(realm)}/${encodeURIComponent(id)}/enabled`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled })
          });
          if (!res.ok) throw new Error(`Toggle failed: ${res.status}`);
          set((state) => ({
            data: {
              ...state.data,
              users: state.data.users.map(u => u.id === id ? { ...u, enabled } : u)
            }
          }));
          return true;
        } catch (err) {
          get().addNotification({
            type: 'error', title: 'User-Status-Änderung fehlgeschlagen',
            message: err instanceof Error ? err.message : 'Unknown error'
          });
          return false;
        }
      },

      // Aggregated keycloak user list, served by /api/users (proxies keycloak-mcp list-users
       // across every realm). Used by the Benutzer-Tab + Analyse `duplicate-users` type.
      loadKeycloakUsers: async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
        try {
          const res = await fetch(`${apiUrl}/api/users`);
          if (!res.ok) throw new Error(`Failed to load users: ${res.status}`);
          const json = await res.json();
          set((state) => ({
            data: {
              ...state.data,
              users: (json.users ?? []).map((u: any) => ({
                id: u.id,
                username: u.username,
                email: u.email ?? '',
                firstName: u.firstName,
                lastName: u.lastName,
                enabled: u.enabled !== false,
                realm: u.realm
              }))
            }
          }));
        } catch (err) {
          console.warn('loadKeycloakUsers failed:', err);
        }
      },

      // Runs an analysis "for real" against the existing APIs and pushes a structured result
      // into analysisHistory. The original websocket-based flow rarely delivered a usable
      // result payload, so AnalysisPanel's "Ergebnisse anzeigen" was always empty.
      startAnalysis: async (type: string, parameters: Record<string, any> = {}) => {
        const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const startTime = Date.now();
        const realm: string = parameters.realm && parameters.realm !== 'all' ? parameters.realm : 'corporate';

        const finish = (success: boolean, result: any) => {
          const completedAt = new Date();
          set((state) => ({
            analysis: {
              ...state.analysis,
              analysisHistory: [
                { id, type, completedAt, duration: Math.max(1, Math.round((Date.now() - startTime) / 1000)), success, result },
                ...state.analysis.analysisHistory
              ].slice(0, 50)
            }
          }));
        };

        try {
          if (type === 'compliance-check' || type === 'security-audit' || type === 'role-analysis') {
            const scope = type === 'compliance-check' ? 'compliance'
              : type === 'role-analysis' ? 'fraud'   // privilege checks live under fraud
              : 'all';
            // Trigger the real scan and read the resulting findings out of the store after it
            // finishes. runSecurityScan polls until completion before resolving.
            await get().runSecurityScan(realm, scope as any);
            const activeScan = get().security.activeScan;
            const findings = activeScan?.findings ?? [];
            const filteredFindings = type === 'role-analysis'
              ? findings.filter(f => ['USER_GOD_MODE', 'REDUNDANT_GROUP', 'ORPHAN_ROLE', 'EXCESSIVE_PRIVILEGE'].includes(f.rule))
              : findings;
            const patterns = filteredFindings.slice(0, 20).map(f => ({
              severity: f.severity,
              rule: f.rule,
              title: f.title,
              affected: f.affected.map(a => `${a.type}:${a.name}`).join(', ')
            }));
            finish(true, {
              summary: `Scan in '${realm}' abgeschlossen — ${filteredFindings.length} Findings.`,
              patterns,
              realm,
              totalFindings: filteredFindings.length
            });
          } else if (type === 'duplicate-users') {
            await get().loadKeycloakUsers();
            const users = get().data.users;
            // Group by lowercase email — duplicates have ≥2 users with the same address.
            const byEmail: Record<string, typeof users> = {};
            for (const u of users) {
              if (!u.email) continue;
              const key = u.email.toLowerCase();
              (byEmail[key] ??= []).push(u);
            }
            const duplicates = Object.entries(byEmail)
              .filter(([, list]) => list.length > 1)
              .map(([email, list]) => ({
                severity: 'warning',
                rule: 'DUPLICATE_EMAIL',
                title: `${list.length} Accounts mit Email "${email}"`,
                affected: list.map(u => `user:${u.username} (${u.realm})`).join(', ')
              }));
            finish(true, {
              summary: duplicates.length === 0
                ? `Keine doppelten Email-Adressen in ${users.length} Accounts gefunden.`
                : `${duplicates.length} doppelte Email-Adressen gefunden.`,
              patterns: duplicates,
              totalFindings: duplicates.length
            });
          } else if (type === 'inactive-users' || type === 'usage-patterns') {
            // Both require Keycloak admin-events which are disabled in the demo realm.
            finish(false, {
              summary: 'Diese Analyse benötigt Keycloak Admin-Events (aktuell deaktiviert im Demo-Realm).',
              patterns: [],
              totalFindings: 0
            });
          } else {
            finish(false, {
              summary: `Analyse-Typ "${type}" wird (noch) nicht unterstützt.`,
              patterns: [],
              totalFindings: 0
            });
          }
        } catch (error) {
          finish(false, {
            summary: error instanceof Error ? error.message : 'Unknown error',
            patterns: [],
            totalFindings: 0
          });
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


      // Security actions
      runSecurityScan: async (realm: string, scope: ScanScope = 'all') => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';

        set((state) => ({
          security: { ...state.security, isLoading: true, lastError: null, activeScan: null }
        }));

        try {
          const startRes = await fetch(`${apiUrl}/api/security/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ realm, scope })
          });
          if (!startRes.ok) throw new Error(`Failed to start scan: ${startRes.status}`);
          const { scanId } = await startRes.json();

          // Poll scan status until completed/failed.
          while (true) {
            await new Promise(r => setTimeout(r, 1500));
            const statusRes = await fetch(`${apiUrl}/api/security/scan/${scanId}`);
            if (!statusRes.ok) throw new Error(`Failed to poll scan: ${statusRes.status}`);
            const scan: Scan = await statusRes.json();
            set((state) => ({ security: { ...state.security, activeScan: scan } }));
            if (scan.state === 'completed' || scan.state === 'failed') {
              set((state) => ({
                security: {
                  ...state.security,
                  activeScan: scan,
                  findings: scan.findings,
                  isLoading: false,
                  lastScanAt: scan.state === 'completed' ? Date.now() : state.security.lastScanAt
                }
              }));
              get().addNotification({
                type: scan.state === 'completed' ? 'success' : 'error',
                title: scan.state === 'completed' ? 'Sicherheitsscan abgeschlossen' : 'Sicherheitsscan fehlgeschlagen',
                message: scan.state === 'completed'
                  ? `${scan.findings.length} Findings gefunden`
                  : (scan.error || 'Unbekannter Fehler')
              });
              return;
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          set((state) => ({ security: { ...state.security, isLoading: false, lastError: msg } }));
          get().addNotification({ type: 'error', title: 'Sicherheitsscan-Fehler', message: msg });
        }
      },

      loadSecurityFindings: async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
        try {
          const res = await fetch(`${apiUrl}/api/security/findings`);
          if (!res.ok) throw new Error(`Failed to load findings: ${res.status}`);
          const { findings } = await res.json();
          set((state) => ({ security: { ...state.security, findings } }));
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          set((state) => ({ security: { ...state.security, lastError: msg } }));
        }
      },

      dismissSecurityFinding: async (id: string) => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
        try {
          const res = await fetch(`${apiUrl}/api/security/findings/${id}/dismiss`, { method: 'POST' });
          if (!res.ok) throw new Error(`Failed to dismiss finding: ${res.status}`);
          set((state) => ({
            security: {
              ...state.security,
              findings: state.security.findings.map(f => f.id === id ? { ...f, status: 'dismissed' } : f)
            }
          }));
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          get().addNotification({ type: 'error', title: 'Fehler beim Verwerfen', message: msg });
        }
      },

      setSecurityFilter: (filter) => {
        set((state) => ({
          security: { ...state.security, filter: { ...state.security.filter, ...filter } }
        }));
      },

      enrichSecurityFinding: async (id: string) => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
        try {
          const res = await fetch(`${apiUrl}/api/security/findings/${id}/enrich`, { method: 'POST' });
          if (!res.ok) throw new Error(`Failed to enrich: ${res.status}`);
          const finding: Finding = await res.json();
          set((state) => ({
            security: {
              ...state.security,
              findings: state.security.findings.map(f => f.id === id ? finding : f)
            }
          }));
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          get().addNotification({ type: 'error', title: 'AI-Analyse fehlgeschlagen', message: msg });
        }
      },

      loadLiveEvents: async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
        try {
          const since = new Date(Date.now() - 24 * 3600_000).toISOString();
          const res = await fetch(`${apiUrl}/api/security/live-events?since=${encodeURIComponent(since)}&limit=500`);
          if (!res.ok) throw new Error(`Failed to load live events: ${res.status}`);
          const { events } = await res.json();
          set((state) => ({
            security: { ...state.security, liveEvents: events.slice(0, 200) }
          }));
        } catch (err) {
          console.warn('loadLiveEvents failed:', err);
        }
      },

      appendLiveEvent: (event: LiveLoginEvent) => {
        set((state) => ({
          security: {
            ...state.security,
            liveEvents: [event, ...state.security.liveEvents].slice(0, 200)
          }
        }));
      },

      loadIdentityGraph: async (realm: string) => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
        try {
          const res = await fetch(`${apiUrl}/api/security/graph?realm=${encodeURIComponent(realm)}&maxNodes=60`);
          if (!res.ok) throw new Error(`Failed to load graph: ${res.status}`);
          const json = await res.json();
          // Backend returns { realm, data: [{ realm, users, clients, groups, findings }] }
          const projection = (json.data || [])[0];
          if (!projection) {
            set((state) => ({ security: { ...state.security, identityGraph: null } }));
            return;
          }
          const affectedIds = new Set((projection.findings || []).map((f: any) => f.targetId));
          const realmNode = projection.realm;
          const nodes = [
            { id: realmNode.id ?? realmNode.name, label: realmNode.name ?? 'realm', type: 'realm' as const, affected: affectedIds.has(realmNode.id) },
            // Pass user stammdaten through so the UserDetailDrawer can render them on click.
            ...(projection.users || []).map((u: any) => ({
              id: u.id,
              label: u.username ?? u.id,
              type: 'user' as const,
              affected: affectedIds.has(u.id),
              username: u.username,
              email: u.email,
              firstName: u.firstName,
              lastName: u.lastName,
              enabled: u.enabled,
              emailVerified: u.emailVerified,
              realm: u.realm,
              createdAt: u.createdAt
            })),
            ...(projection.clients || []).map((c: any) => ({ id: c.id, label: c.clientId ?? c.name ?? c.id, type: 'client' as const, affected: affectedIds.has(c.id) })),
            ...(projection.groups || []).map((g: any) => ({
              id: g.id,
              label: g.name ?? g.id,
              type: 'group' as const,
              affected: affectedIds.has(g.id),
              groupName: g.name,
              realm: g.realm
            })),
            ...(projection.roles || []).map((r: any) => ({
              id: r.id,
              label: r.name ?? r.id,
              type: 'role' as const,
              affected: affectedIds.has(r.id),
              roleName: r.name,
              description: r.description,
              realm: r.realm
            }))
          ];
          const realmId = realmNode.id ?? realmNode.name;
          // Memberships / grants / direct role assignments come as flat pair-lists from the
          // backend; turn them into graph edges and adjacency maps.
          const memberships = (projection.memberships || []) as Array<{ userId: string; groupId: string }>;
          const grants = (projection.grants || []) as Array<{ groupId: string; roleId: string }>;
          const directRoles = (projection.directRoles || []) as Array<{ userId: string; roleId: string }>;

          const membershipByUser: Record<string, string[]> = {};
          for (const m of memberships) {
            if (!m.userId || !m.groupId) continue;
            (membershipByUser[m.userId] ??= []).push(m.groupId);
          }
          const rolesByGroup: Record<string, string[]> = {};
          for (const g of grants) {
            if (!g.groupId || !g.roleId) continue;
            (rolesByGroup[g.groupId] ??= []).push(g.roleId);
          }
          const directRolesByUser: Record<string, string[]> = {};
          for (const d of directRoles) {
            if (!d.userId || !d.roleId) continue;
            (directRolesByUser[d.userId] ??= []).push(d.roleId);
          }

          const links = [
            ...(projection.users || []).map((u: any) => ({ source: u.id, target: realmId, type: 'BELONGS_TO' })),
            ...(projection.clients || []).map((c: any) => ({ source: c.id, target: realmId, type: 'IN_REALM' })),
            ...(projection.groups || []).map((g: any) => ({ source: g.id, target: realmId, type: 'IN_REALM' })),
            ...(projection.roles || []).map((r: any) => ({ source: r.id, target: realmId, type: 'IN_REALM' })),
            ...memberships.filter(m => m.userId && m.groupId).map(m => ({ source: m.userId, target: m.groupId, type: 'MEMBER_OF' })),
            ...grants.filter(g => g.groupId && g.roleId).map(g => ({ source: g.groupId, target: g.roleId, type: 'GRANTS_ROLE' })),
            ...directRoles.filter(d => d.userId && d.roleId).map(d => ({ source: d.userId, target: d.roleId, type: 'HAS_ROLE' }))
          ];
          set((state) => ({
            security: {
              ...state.security,
              identityGraph: { realm, nodes, links, membershipByUser, rolesByGroup, directRolesByUser }
            }
          }));
        } catch (err) {
          console.warn('loadIdentityGraph failed:', err);
        }
      },

      triggerDemoScenario: async (scenario) => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
        try {
          await fetch(`${apiUrl}/api/security/demo/scenario`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scenario })
          });
        } catch (err) {
          console.warn('triggerDemoScenario failed:', err);
        }
      },

      // Lifecycle timeline for the UserDetailModal — pulls synthetic AdminEvent rows from
      // the AI gateway (which reads them from Neo4j). Caller decides what to do with them.
      loadAdminEventsForUser: async (userId: string): Promise<AdminEvent[]> => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
        try {
          const res = await fetch(`${apiUrl}/api/security/admin-events?userId=${encodeURIComponent(userId)}`);
          if (!res.ok) throw new Error(`Failed to load admin events: ${res.status}`);
          const { events } = await res.json();
          return events ?? [];
        } catch (err) {
          console.warn('loadAdminEventsForUser failed:', err);
          return [];
        }
      },

      autoFixableRules: [] as string[],

      loadAutoFixableRules: async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
        try {
          const res = await fetch(`${apiUrl}/api/security/auto-fix/availability`);
          if (!res.ok) return;
          const { rules } = await res.json();
          set({ autoFixableRules: Array.isArray(rules) ? rules : [] } as any);
        } catch (err) {
          console.warn('loadAutoFixableRules failed:', err);
        }
      },

      applyAutoFix: async (findingId: string) => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
        try {
          const res = await fetch(`${apiUrl}/api/security/findings/${findingId}/apply-fix`, { method: 'POST' });
          if (!res.ok) {
            const detail = await res.json().catch(() => ({}));
            throw new Error(detail.message || detail.error || `Auto-Fix fehlgeschlagen (${res.status})`);
          }
          const { finding, fix } = await res.json();
          // Reflect the resolved status + any field updates in the store so the panel updates.
          if (finding) {
            set((state) => ({
              security: {
                ...state.security,
                findings: state.security.findings.map(f => f.id === findingId ? finding : f)
              }
            }));
          }
          get().addNotification({
            type: 'success',
            title: 'Auto-Fix angewendet',
            message: fix?.summary ?? 'Finding wurde behoben.'
          });
          // Also refresh the identity graph since most fixes mutate it visibly.
          await get().loadIdentityGraph('corporate').catch(() => {});
          return fix;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          get().addNotification({ type: 'error', title: 'Auto-Fix fehlgeschlagen', message: msg });
          return null;
        }
      },

      resetDemo: async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
        try {
          const res = await fetch(`${apiUrl}/api/security/reset`, { method: 'POST' });
          if (!res.ok) throw new Error(`Reset fehlgeschlagen (${res.status})`);
          const body = await res.json();
          // Wipe local caches so the next scan starts clean.
          set((state) => ({
            security: {
              ...state.security,
              findings: [],
              activeScan: null,
              lastScanAt: null,
              identityGraph: null
            }
          }));
          get().addNotification({
            type: 'success',
            title: 'Demo zurückgesetzt',
            message: `Graph in ${body.durationMs}ms neu geseedet.`
          });
          // Re-run a scan so the panel immediately shows the restored findings.
          await get().runSecurityScan('corporate', 'all').catch(() => {});
          await get().loadIdentityGraph('corporate').catch(() => {});
          return { durationMs: body.durationMs, summary: body.summary };
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          get().addNotification({ type: 'error', title: 'Reset fehlgeschlagen', message: msg });
          return null;
        }
      },

      // Manually triggers the realm-to-graph sync. Reloads identityGraph + findings on success.
      syncRealmNow: async () => {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8005';
        try {
          const res = await fetch(`${apiUrl}/api/security/sync`, { method: 'POST' });
          if (!res.ok) throw new Error(`Sync failed: ${res.status}`);
          const delta = await res.json();
          // Refresh anything that depends on user counts so the UI shows the delta immediately.
          if (delta.added > 0 || delta.updated > 0 || delta.removed > 0) {
            await get().loadIdentityGraph('corporate').catch(() => {});
            await get().loadKeycloakUsers().catch(() => {});
          }
          return delta;
        } catch (err) {
          console.warn('syncRealmNow failed:', err);
          return null;
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