/**
 * Database Type Definitions
 * 
 * TypeScript types for database models and operations.
 * These complement the Prisma generated types with additional utilities.
 */

import type { Prisma } from '@prisma/client';

// User related types
export type UserWithProfile = Prisma.UserGetPayload<{
  include: {
    profile: true;
    apiKeys: {
      select: {
        id: true;
        provider: true;
        keyName: true;
        isActive: true;
        lastUsed: true;
        isValid: true;
        validationError: true;
      };
    };
    _count: {
      select: {
        chats: true;
        messages: true;
      };
    };
  };
}>;

export type UserApiKeyWithoutSecrets = Prisma.UserApiKeyGetPayload<{
  select: {
    id: true;
    provider: true;
    keyName: true;
    isActive: true;
    dailyLimit: true;
    monthlyLimit: true;
    usedToday: true;
    usedThisMonth: true;
    lastUsed: true;
    lastValidated: true;
    isValid: true;
    validationError: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

// Chat related types
export type ChatWithMessages = Prisma.ChatGetPayload<{
  include: {
    messages: {
      orderBy: {
        createdAt: 'asc';
      };
    };
  };
}>;

export type ChatWithMessageCount = Prisma.ChatGetPayload<{
  include: {
    _count: {
      select: {
        messages: true;
      };
    };
  };
}>;

// Usage analytics types
export type UsageBreakdown = {
  provider: string;
  requests: number;
  tokens: number;
  cost: number;
};

export type ModelBreakdown = {
  model: string;
  requests: number;
  tokens: number;
  cost: number;
};

export type DailyUsage = {
  date: Date;
  requests: number;
  tokens: number;
  cost: number;
};

export type UsageAnalytics = {
  period: 'today' | 'week' | 'month' | 'all';
  dateRange: {
    start: Date;
    end: Date;
  };
  totals: {
    requests: number;
    tokens: {
      total: number;
      input: number;
      output: number;
      reasoning: number;
    };
    cost: number;
  };
  breakdown: {
    providers: UsageBreakdown[];
    models: ModelBreakdown[];
  };
  dailyUsage: DailyUsage[];
  quotaLimits: Prisma.UserQuotaLimitGetPayload<{
    select: {
      type: true;
      provider: true;
      model: true;
      requestLimit: true;
      tokenLimit: true;
      costLimit: true;
      usedRequests: true;
      usedTokens: true;
      usedCost: true;
      resetAt: true;
    };
  }>[];
};

// API response types
export type ApiResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: any;
};

export type PaginatedResponse<T = any> = ApiResponse<{
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}>;

// Provider types
export type ProviderType = 'openrouter' | 'openai' | 'anthropic' | 'google' | 'xai';

export type ProviderConfig = {
  apiKey: string;
  baseUrl?: string;
  enabled: boolean;
  priority: number;
};

// Migration types
export interface LocalStorageChat {
  id: string;
  title: string;
  model: string;
  messages: LocalStorageMessage[];
  createdAt: Date;
  updatedAt: Date;
  totalCost: number;
  totalTokens: number;
  status: 'idle' | 'processing' | 'error';
  userId?: string;
  anonymousId?: string;
  isAnonymous: boolean;
}

export interface LocalStorageMessage {
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

export interface MigrationData {
  chats: LocalStorageChat[];
  config: {
    providers: Record<ProviderType, ProviderConfig>;
    defaultModel: string;
    defaultProvider: string;
    showReasoning: boolean;
    showTokens: boolean;
    showCosts: boolean;
    autoScroll: boolean;
    reasoningEffort: 'low' | 'medium' | 'high';
  };
  anonymousId: string;
}

export interface MigrationResult {
  success: boolean;
  migratedChats: number;
  migratedMessages: number;
  migratedApiKeys: number;
  errors: string[];
}

// Database operation types
export type DatabaseError = {
  code: string;
  message: string;
  details?: any;
};

export type TransactionResult<T = any> = {
  success: boolean;
  data?: T;
  error?: DatabaseError;
};

// Quota and limits types
export type QuotaType = 'daily' | 'monthly' | 'provider' | 'model';

export type QuotaLimit = {
  type: QuotaType;
  provider?: string;
  model?: string;
  requestLimit?: number;
  tokenLimit?: number;
  costLimit?: number;
  usedRequests: number;
  usedTokens: number;
  usedCost: number;
  resetAt: Date;
  lastReset: Date;
  isActive: boolean;
};

// Analytics types
export type SystemMetric = 
  | 'total_users' 
  | 'active_users' 
  | 'total_messages' 
  | 'total_cost' 
  | 'total_tokens';

export type AnalyticsData = {
  metric: SystemMetric;
  value: number;
  metadata: Record<string, any>;
  date: Date;
  hour?: number;
};

// Validation types
export type ValidationResult = {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
};

// Export utility types
export type CreateInput<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateInput<T> = Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>;

// Prisma utility types
export type PrismaTransactionClient = Prisma.TransactionClient;
export type PrismaDelegate<T> = T extends keyof PrismaTransactionClient 
  ? PrismaTransactionClient[T]
  : never;