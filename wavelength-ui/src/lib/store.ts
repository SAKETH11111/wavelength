import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ModelInfo, ProviderType } from './providers/types';
import { backendClient, BackendHealth } from './backend-client';
import type { Session } from 'next-auth';
import { AnonymousSessionManager } from './auth/anonymous-session';
import { ModelAccessControl, updateModelAccessRules } from './auth/model-access';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  cost?: number;
  duration?: number;
  reasoning?: string;
  model?: string;
  tokens?: {
    input: number;
    reasoning: number;
    output: number;
  };
}

export interface Chat {
  id: string;
  title: string;
  model: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  totalCost: number;
  totalTokens: number;
  status: 'idle' | 'processing' | 'error';
  userId?: string;
  anonymousId?: string;
  isAnonymous: boolean;
}

export interface ProviderStatus {
  id: ProviderType;
  name: string;
  enabled: boolean;
  connected: boolean;
  lastTested?: Date;
  error?: string;
  models: ModelInfo[];
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
  priority: number; // For fallback ordering
}

export interface AuthUser {
  id: string | null;
  email?: string;
  name?: string;
  image?: string;
  provider?: 'google' | 'github' | 'email';
  tier: 'anonymous' | 'free' | 'pro';
  sessionType: 'anonymous' | 'authenticated';
}

export interface UserProfile {
  displayName?: string | null;
  bio?: string | null;
  timezone?: string | null;
  language?: string | null;
  theme?: 'light' | 'dark' | 'auto' | null;
  preferences?: Record<string, any>;
}

export interface ApiKey {
  id: string;
  provider: string;
  keyName: string | null;
  isActive: boolean;
  dailyLimit: number | null;
  monthlyLimit: number | null;
  usedToday: number;
  usedThisMonth: number;
  lastUsed: string | null;
  lastValidated: string | null;
  isValid: boolean;
  validationError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  dailyUsage: Array<{
    date: string;
    requests: number;
    tokens: number;
    cost: number;
  }>;
  providerBreakdown: Array<{
    provider: string;
    requests: number;
    tokens: number;
    cost: number;
  }>;
}

export interface UserLimits {
  dailyMessages: number;
  usedMessages: number;
  resetTime: Date;
  availableModels: string[];
}

export interface AuthState {
  user: AuthUser;
  session: Session | null;
  anonymousId: string;
  limits: UserLimits;
  showAuthModal: boolean;
  authTrigger?: 'premium-model' | 'daily-limit' | 'advanced-features' | 'data-sync';
}

export interface ProfileState {
  profile: UserProfile | null;
  apiKeys: ApiKey[];
  usageStats: UsageStats | null;
  quotaLimits: any[];
  loading: {
    profile: boolean;
    apiKeys: boolean;
    usage: boolean;
  };
}

export interface AppState {
  // Authentication state
  auth: AuthState;
  
  // Profile management
  profile: ProfileState;
  
  // Chat management
  chats: Chat[];
  activeChatId: string | null;
  
  // UI state
  isSidebarOpen: boolean;
  isSettingsOpen: boolean;
  
  // Backend integration
  backendMode: 'auto' | 'standalone' | 'backend-only';
  backendHealth: BackendHealth;
  lastBackendCheck: number;
  
  // Configuration
  config: {
    // Legacy OpenRouter settings (maintained for compatibility)
    apiKey: string;
    baseUrl: string;
    
    // Provider-specific configurations
    providers: {
      openrouter: ProviderConfig;
      openai: ProviderConfig;
      anthropic: ProviderConfig;
      google: ProviderConfig;
      xai: ProviderConfig;
    };
    
    // General settings
    defaultModel: string;
    defaultProvider: 'auto' | 'openrouter' | 'openai' | 'anthropic' | 'google' | 'xai';
    showReasoning: boolean;
    showTokens: boolean;
    showCosts: boolean;
    autoScroll: boolean;
    reasoningEffort: 'low' | 'medium' | 'high';
  };
  
  // Provider management
  providerStatuses: ProviderStatus[];
  availableModels: ModelInfo[];
  
  // Connection status
  isConnected: boolean;
  processingCount: number;
  queueCount: number;
  
  // Backend status
  backendAvailable: boolean;
}

export interface AppActions {
  // Chat actions
  createNewChat: (model?: string) => string;
  selectChat: (chatId: string) => void;
  deleteChat: (chatId: string) => void;
  clearAllChats: () => void;
  updateChatTitle: (chatId: string, title: string) => void;
  
  // Message actions
  addMessage: (chatId: string, message: Omit<Message, 'id' | 'timestamp'>) => Message;
  updateMessage: (chatId: string, messageId: string, updates: Partial<Message>) => void;
  
  // Authentication actions
  initializeAuth: (session?: Session | null) => void;
  setAuthModal: (show: boolean, trigger?: AuthState['authTrigger']) => void;
  updateAuthState: (updates: Partial<AuthState>) => void;
  incrementMessageCount: () => boolean; // Returns true if limit reached
  canAccessModel: (modelId: string) => boolean;
  shouldPromptForAuth: (modelId: string) => boolean;
  
  // Profile actions
  loadProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  loadApiKeys: () => Promise<void>;
  addApiKey: (keyData: { provider: string; apiKey: string; keyName?: string; dailyLimit?: number; monthlyLimit?: number }) => Promise<void>;
  updateApiKey: (keyId: string, updates: Partial<ApiKey>) => Promise<void>;
  deleteApiKey: (keyId: string) => Promise<void>;
  loadUsageStats: (period?: string, provider?: string) => Promise<void>;
  setProfileLoading: (type: keyof ProfileState['loading'], loading: boolean) => void;
  
  // UI actions
  toggleSidebar: () => void;
  toggleSettings: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  
  // Configuration actions
  updateConfig: (config: Partial<AppState['config']>) => void;
  updateProviderConfig: (provider: ProviderType, config: Partial<ProviderConfig>) => void;
  testProviderConnection: (provider: ProviderType) => Promise<boolean>;
  refreshProviderModels: (provider?: ProviderType) => Promise<void>;
  
  // Provider status actions
  updateProviderStatus: (provider: ProviderType, status: Partial<ProviderStatus>) => void;
  setAvailableModels: (models: ModelInfo[]) => void;
  
  // Connection actions
  setConnectionStatus: (connected: boolean) => void;
  setProcessingCount: (count: number) => void;
  setQueueCount: (count: number) => void;
  
  // Chat status actions
  setChatStatus: (chatId: string, status: Chat['status']) => void;
  
  // Backend actions
  setBackendMode: (mode: 'auto' | 'standalone' | 'backend-only') => void;
  checkBackendHealth: () => Promise<void>;
  forceBackendCheck: () => void;
  setBackendAvailable: (available: boolean) => void;
}

type Store = AppState & AppActions;

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      // Initial authentication state
      auth: {
        user: {
          id: null,
          tier: 'anonymous',
          sessionType: 'anonymous',
        },
        session: null,
        anonymousId: '',
        limits: {
          dailyMessages: 50,
          usedMessages: 0,
          resetTime: new Date(),
          availableModels: [],
        },
        showAuthModal: false,
      },
      
      // Initial profile state
      profile: {
        profile: null,
        apiKeys: [],
        usageStats: null,
        quotaLimits: [],
        loading: {
          profile: false,
          apiKeys: false,
          usage: false,
        },
      },
      
      // Initial state
      chats: [],
      activeChatId: null,
      isSidebarOpen: true,
      isSettingsOpen: false,
      config: {
        // Legacy settings (maintained for compatibility)
        apiKey: '',
        baseUrl: '',
        
        // Provider-specific configurations
        providers: {
          openrouter: { apiKey: '', enabled: true, priority: 1 },
          openai: { apiKey: '', enabled: false, priority: 2 },
          anthropic: { apiKey: '', enabled: false, priority: 3 },
          google: { apiKey: '', enabled: false, priority: 4 },
          xai: { apiKey: '', enabled: false, priority: 5 },
        },
        
        // General settings
        defaultModel: 'openai/gpt-4.1-mini',
        defaultProvider: 'auto' as const,
        showReasoning: true,
        showTokens: true,
        showCosts: true,
        autoScroll: true,
        reasoningEffort: 'high',
      },
      providerStatuses: [
        { id: 'openrouter', name: 'OpenRouter', enabled: true, connected: false, models: [] },
        { id: 'openai', name: 'OpenAI', enabled: false, connected: false, models: [] },
        { id: 'anthropic', name: 'Anthropic', enabled: false, connected: false, models: [] },
        { id: 'google', name: 'Google AI', enabled: false, connected: false, models: [] },
        { id: 'xai', name: 'XAI', enabled: false, connected: false, models: [] },
      ],
      availableModels: [],
      isConnected: false,
      processingCount: 0,
      queueCount: 0,
      
      // Backend state
      backendMode: 'auto',
      backendHealth: { status: 'unavailable' },
      lastBackendCheck: 0,
      backendAvailable: false,

      // Chat actions
      createNewChat: (model) => {
        // Use a more predictable ID generation to avoid hydration mismatches
        const timestamp = typeof window !== 'undefined' ? Date.now() : 1;
        const random = typeof window !== 'undefined' ? Math.random().toString(36).substr(2, 9) : 'initial';
        const { auth } = get();
        const newChat: Chat = {
          id: `chat-${timestamp}-${random}`,
          title: 'New Chat',
          model: model || get().config.defaultModel,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          totalCost: 0,
          totalTokens: 0,
          status: 'idle',
          userId: auth.user.sessionType === 'authenticated' ? auth.user.id || undefined : undefined,
          anonymousId: auth.user.sessionType === 'anonymous' ? auth.anonymousId : undefined,
          isAnonymous: auth.user.sessionType === 'anonymous',
        };

        set((state) => ({
          chats: [newChat, ...state.chats],
          activeChatId: newChat.id,
        }));

        return newChat.id;
      },

      selectChat: (chatId) => {
        set({ activeChatId: chatId });
      },

      deleteChat: (chatId) => {
        set((state) => {
          const newChats = state.chats.filter(chat => chat.id !== chatId);
          const newActiveChatId = state.activeChatId === chatId 
            ? (newChats.length > 0 ? newChats[0].id : null)
            : state.activeChatId;
          
          return {
            chats: newChats,
            activeChatId: newActiveChatId,
          };
        });
      },

      clearAllChats: () => {
        set({ chats: [], activeChatId: null });
      },

      updateChatTitle: (chatId, title) => {
        set((state) => ({
          chats: state.chats.map(chat =>
            chat.id === chatId
              ? { ...chat, title, updatedAt: new Date() }
              : chat
          ),
        }));
      },

      // Message actions
      addMessage: (chatId, message) => {
        // Use a more predictable ID generation to avoid hydration mismatches
        const timestamp = typeof window !== 'undefined' ? Date.now() : 1;
        const random = typeof window !== 'undefined' ? Math.random().toString(36).substr(2, 9) : 'initial';
        const newMessage: Message = {
          ...message,
          id: `msg-${timestamp}-${random}`,
          timestamp: new Date(),
        };

        set((state) => {
          const newChats = state.chats.map(chat =>
            chat.id === chatId
              ? {
                  ...chat,
                  messages: [...chat.messages, newMessage],
                  updatedAt: new Date(),
                  totalCost: chat.totalCost + (message.cost || 0),
                  totalTokens: chat.totalTokens + ((message.tokens?.input || 0) + (message.tokens?.reasoning || 0) + (message.tokens?.output || 0)),
                  // Auto-generate title from first user message
                  title: chat.messages.length === 0 && message.role === 'user'
                    ? message.content.slice(0, 50) + (message.content.length > 50 ? '...' : '')
                    : chat.title,
                }
              : chat
          );
          return { chats: newChats };
        });
        return newMessage;
      },

      updateMessage: (chatId, messageId, updates) => {
        set((state) => {
          const newChats = state.chats.map(chat => {
            if (chat.id === chatId) {
              const updatedMessages = chat.messages.map(msg =>
                msg.id === messageId ? { ...msg, ...updates } : msg
              );
              
              // Recalculate totals when message is updated
              const totalCost = updatedMessages.reduce((sum, msg) => sum + (msg.cost || 0), 0);
              const totalTokens = updatedMessages.reduce((sum, msg) => {
                if (msg.tokens) {
                  return sum + msg.tokens.input + msg.tokens.reasoning + msg.tokens.output;
                }
                return sum;
              }, 0);
              
              return {
                ...chat,
                messages: updatedMessages,
                updatedAt: new Date(),
                totalCost,
                totalTokens,
              };
            }
            return chat;
          });
          
          return { chats: newChats };
        });
      },

      // UI actions
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
      setSidebarOpen: (open) => set({ isSidebarOpen: open }),
      setSettingsOpen: (open) => set({ isSettingsOpen: open }),

      // Configuration actions
      updateConfig: (newConfig) => {
        set((state) => ({
          config: { ...state.config, ...newConfig },
        }));
      },
      
      updateProviderConfig: (provider, providerConfig) => {
        set((state) => ({
          config: {
            ...state.config,
            providers: {
              ...state.config.providers,
              [provider]: {
                ...state.config.providers[provider],
                ...providerConfig,
              },
            },
          },
        }));
      },
      
      testProviderConnection: async (provider) => {
        try {
          const response = await fetch('/api/providers/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider }),
          });
          
          const result = await response.json();
          const connected = response.ok && result.connected;
          
          get().updateProviderStatus(provider, {
            connected,
            lastTested: new Date(),
            error: connected ? undefined : result.error || 'Connection failed',
          });
          
          return connected;
        } catch (error) {
          get().updateProviderStatus(provider, {
            connected: false,
            lastTested: new Date(),
            error: error instanceof Error ? error.message : 'Connection failed',
          });
          return false;
        }
      },
      
      refreshProviderModels: async (provider) => {
        try {
          // Use the new models API endpoint
          const url = provider 
            ? `/api/models?provider=${provider}`
            : '/api/models';
          const response = await fetch(url, {
            cache: 'no-store' // Always fetch fresh models
          });
          const data = await response.json();
          
          if (response.ok && data.success) {
            get().setAvailableModels(data.models || []);
            
            // Update provider statuses with their models
            if (provider) {
              const providerModels = data.models?.filter((m: ModelInfo) => 
                m.provider.toLowerCase() === provider.toLowerCase()
              ) || [];
              get().updateProviderStatus(provider, { 
                models: providerModels,
                connected: providerModels.length > 0
              });
            } else {
              // Update all provider statuses
              const { providerStatuses } = get();
              providerStatuses.forEach((status) => {
                const providerModels = data.models?.filter((m: ModelInfo) => 
                  m.provider.toLowerCase().includes(status.id.toLowerCase()) ||
                  status.id.toLowerCase().includes(m.provider.toLowerCase())
                ) || [];
                get().updateProviderStatus(status.id, { 
                  models: providerModels,
                  connected: providerModels.length > 0
                });
              });
            }
          }
        } catch (error) {
          console.error('Failed to refresh provider models:', error);
        }
      },
      
      // Provider status actions
      updateProviderStatus: (provider, statusUpdate) => {
        set((state) => ({
          providerStatuses: state.providerStatuses.map((status) =>
            status.id === provider
              ? { ...status, ...statusUpdate }
              : status
          ),
        }));
      },
      
      setAvailableModels: (models) => {
        set({ availableModels: models });
        // Update model access rules whenever models are set
        updateModelAccessRules(models);
      },

      // Connection actions
      setConnectionStatus: (connected) => set({ isConnected: connected }),
      setProcessingCount: (count) => set({ processingCount: count }),
      setQueueCount: (count) => set({ queueCount: count }),

      // Chat status actions
      setChatStatus: (chatId, status) => {
        set((state) => ({
          chats: state.chats.map(chat =>
            chat.id === chatId ? { ...chat, status } : chat
          ),
        }));
      },
      
      // Backend actions
      setBackendMode: (mode) => {
        set({ backendMode: mode });
        // Force a backend check when mode changes
        get().forceBackendCheck();
      },
      
      checkBackendHealth: async () => {
        const now = Date.now();
        const { lastBackendCheck, backendMode } = get();
        
        // Skip check if in standalone mode or recently checked (within 30 seconds)
        if (backendMode === 'standalone' || now - lastBackendCheck < 30000) {
          return;
        }
        
        try {
          const health = await backendClient.getHealth();
          const available = health.status !== 'unavailable';
          
          set({
            backendHealth: health,
            backendAvailable: available,
            lastBackendCheck: now,
            isConnected: available || get().isConnected // Keep existing connection if backend fails
          });
          
          // If we're in backend-only mode and backend is unavailable, show warning
          if (backendMode === 'backend-only' && !available) {
            console.warn('Backend-only mode selected but backend is unavailable');
          }
          
        } catch (error) {
          console.error('Backend health check failed:', error);
          set({
            backendHealth: { status: 'unavailable' },
            backendAvailable: false,
            lastBackendCheck: now
          });
        }
      },
      
      forceBackendCheck: () => {
        backendClient.forceHealthCheck();
        set({ lastBackendCheck: 0 });
        get().checkBackendHealth();
      },
      
      setBackendAvailable: (available) => {
        set({ backendAvailable: available });
      },
      
      // Authentication actions
      initializeAuth: (session) => {
        const anonymousId = AnonymousSessionManager.getAnonymousId();
        const anonymousLimits = AnonymousSessionManager.getAnonymousLimits();
        
        if (session?.user) {
          // Authenticated user
          set((state) => ({
            auth: {
              ...state.auth,
              user: {
                id: session.user.id,
                email: session.user.email || undefined,
                name: session.user.name || undefined,
                image: session.user.image || undefined,
                tier: session.user.tier || 'free',
                sessionType: 'authenticated',
              },
              session,
              anonymousId,
              limits: {
                dailyMessages: session.user.tier === 'pro' ? 5000 : 500,
                usedMessages: 0, // TODO: Fetch from server
                resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
                availableModels: ModelAccessControl.getAccessibleModels(true, session.user.tier || 'free').map(r => r.id),
              },
            },
          }));
          
          // Initialize usage quotas for new authenticated users
          setTimeout(async () => {
            try {
              const response = await fetch('/api/usage/init');
              const data = await response.json();
              
              if (data.success && data.data.needsInitialization) {
                console.log('Initializing usage quotas for new user');
                await fetch('/api/usage/init', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ tier: session.user.tier || 'free' }),
                });
              }
            } catch (error) {
              console.error('Failed to initialize usage quotas:', error);
            }
          }, 0);
        } else {
          // Anonymous user
          set((state) => ({
            auth: {
              ...state.auth,
              user: {
                id: null,
                tier: 'anonymous',
                sessionType: 'anonymous',
              },
              session: null,
              anonymousId,
              limits: {
                dailyMessages: 50,
                usedMessages: anonymousLimits.usedMessages,
                resetTime: anonymousLimits.resetTime,
                availableModels: ModelAccessControl.getAccessibleModels(false, 'anonymous').map(r => r.id),
              },
            },
          }));
        }
      },
      
      setAuthModal: (show, trigger) => {
        set((state) => ({
          auth: {
            ...state.auth,
            showAuthModal: show,
            authTrigger: trigger,
          },
        }));
      },
      
      updateAuthState: (updates) => {
        set((state) => ({
          auth: { ...state.auth, ...updates },
        }));
      },
      
      incrementMessageCount: () => {
        const { auth } = get();
        
        if (auth.user.sessionType === 'anonymous') {
          const newCount = AnonymousSessionManager.incrementUsedMessages();
          const hasReachedLimit = AnonymousSessionManager.hasReachedLimit();
          
          set((state) => ({
            auth: {
              ...state.auth,
              limits: {
                ...state.auth.limits,
                usedMessages: newCount,
              },
            },
          }));
          
          return hasReachedLimit;
        }
        
        // TODO: Track authenticated user message counts
        return false;
      },
      
      canAccessModel: (modelId) => {
        const { auth } = get();
        return ModelAccessControl.canAccessModel(
          modelId,
          auth.user.sessionType === 'authenticated',
          auth.user.tier
        );
      },
      
      shouldPromptForAuth: (modelId) => {
        const { auth } = get();
        return ModelAccessControl.shouldPromptAuth(
          modelId,
          auth.user.sessionType === 'authenticated'
        );
      },
      
      // Profile actions
      loadProfile: async () => {
        const { auth } = get();
        if (auth.user.sessionType !== 'authenticated') return;
        
        get().setProfileLoading('profile', true);
        try {
          const response = await fetch('/api/profile');
          const data = await response.json();
          
          if (data.success) {
            set((state) => ({
              profile: {
                ...state.profile,
                profile: data.data.profile,
              },
            }));
          }
        } catch (error) {
          console.error('Failed to load profile:', error);
        } finally {
          get().setProfileLoading('profile', false);
        }
      },
      
      updateProfile: async (updates) => {
        const { auth } = get();
        if (auth.user.sessionType !== 'authenticated') return;
        
        try {
          const response = await fetch('/api/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
          });
          
          const data = await response.json();
          
          if (data.success) {
            set((state) => ({
              profile: {
                ...state.profile,
                profile: { ...state.profile.profile, ...updates },
              },
            }));
          }
        } catch (error) {
          console.error('Failed to update profile:', error);
          throw error;
        }
      },
      
      loadApiKeys: async () => {
        const { auth } = get();
        if (auth.user.sessionType !== 'authenticated') return;
        
        get().setProfileLoading('apiKeys', true);
        try {
          const response = await fetch('/api/profile/api-keys');
          const data = await response.json();
          
          if (data.success) {
            set((state) => ({
              profile: {
                ...state.profile,
                apiKeys: data.data,
              },
            }));
          }
        } catch (error) {
          console.error('Failed to load API keys:', error);
        } finally {
          get().setProfileLoading('apiKeys', false);
        }
      },
      
      addApiKey: async (keyData) => {
        const { auth } = get();
        if (auth.user.sessionType !== 'authenticated') return;
        
        try {
          const response = await fetch('/api/profile/api-keys', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(keyData),
          });
          
          const data = await response.json();
          
          if (data.success) {
            set((state) => ({
              profile: {
                ...state.profile,
                apiKeys: [data.data, ...state.profile.apiKeys],
              },
            }));
          } else {
            throw new Error(data.error);
          }
        } catch (error) {
          console.error('Failed to add API key:', error);
          throw error;
        }
      },
      
      updateApiKey: async (keyId, updates) => {
        const { auth } = get();
        if (auth.user.sessionType !== 'authenticated') return;
        
        try {
          const response = await fetch(`/api/profile/api-keys/${keyId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updates),
          });
          
          const data = await response.json();
          
          if (data.success) {
            set((state) => ({
              profile: {
                ...state.profile,
                apiKeys: state.profile.apiKeys.map((key) => 
                  key.id === keyId ? { ...key, ...updates } : key
                ),
              },
            }));
          } else {
            throw new Error(data.error);
          }
        } catch (error) {
          console.error('Failed to update API key:', error);
          throw error;
        }
      },
      
      deleteApiKey: async (keyId) => {
        const { auth } = get();
        if (auth.user.sessionType !== 'authenticated') return;
        
        try {
          const response = await fetch(`/api/profile/api-keys/${keyId}`, {
            method: 'DELETE',
          });
          
          const data = await response.json();
          
          if (data.success) {
            set((state) => ({
              profile: {
                ...state.profile,
                apiKeys: state.profile.apiKeys.filter((key) => key.id !== keyId),
              },
            }));
          } else {
            throw new Error(data.error);
          }
        } catch (error) {
          console.error('Failed to delete API key:', error);
          throw error;
        }
      },
      
      loadUsageStats: async (period = 'month', provider) => {
        const { auth } = get();
        if (auth.user.sessionType !== 'authenticated') return;
        
        get().setProfileLoading('usage', true);
        try {
          let url = `/api/profile/usage?period=${period}`;
          if (provider) {
            url += `&provider=${provider}`;
          }
          
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.success) {
            set((state) => ({
              profile: {
                ...state.profile,
                usageStats: {
                  totalRequests: data.data.totals.requests,
                  totalTokens: data.data.totals.tokens.total,
                  totalCost: data.data.totals.cost,
                  dailyUsage: data.data.dailyUsage,
                  providerBreakdown: data.data.breakdown.providers,
                },
                quotaLimits: data.data.quotaLimits,
              },
            }));
          }
        } catch (error) {
          console.error('Failed to load usage stats:', error);
        } finally {
          get().setProfileLoading('usage', false);
        }
      },
      
      setProfileLoading: (type, loading) => {
        set((state) => ({
          profile: {
            ...state.profile,
            loading: {
              ...state.profile.loading,
              [type]: loading,
            },
          },
        }));
      },
    }),
    {
      name: 'wavelength-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        chats: state.chats,
        activeChatId: state.activeChatId,
        config: state.config,
        isSidebarOpen: state.isSidebarOpen,
        providerStatuses: state.providerStatuses,
        backendMode: state.backendMode,
        // Profile data is not persisted as it's loaded from server
      }),
    }
  )
);

// Selectors
export const useActiveChat = () => {
  const { chats, activeChatId } = useStore();
  return chats.find(chat => chat.id === activeChatId) || null;
};

export const useChatMessages = (chatId?: string) => {
  const { chats, activeChatId } = useStore();
  const targetChatId = chatId || activeChatId;
  const chat = chats.find(chat => chat.id === targetChatId);
  return chat?.messages || [];
};