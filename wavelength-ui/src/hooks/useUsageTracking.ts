import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/lib/store';
import { AnonymousSessionManager } from '@/lib/auth/anonymous-session';

export interface UsageStatus {
  userType: 'anonymous' | 'authenticated';
  userTier: 'anonymous' | 'free' | 'pro';
  dailyRequests: number;
  monthlyRequests: number;
  dailyCost: number;
  monthlyCost: number;
  quotaLimits: Array<{
    type: string;
    provider?: string;
    model?: string;
    requestLimit?: number;
    tokenLimit?: number;
    costLimit?: number;
    usedRequests: number;
    usedTokens: number;
    usedCost: number;
    resetAt: string;
  }>;
  anonymousLimits?: {
    dailyLimit: number;
    usedMessages: number;
    remainingMessages: number;
    resetTime: string;
    timeUntilReset: string;
    shouldShowUpgradePrompt: boolean;
  };
  anonymousId?: string;
}

export interface QuotaCheck {
  canProceed: boolean;
  reasons: string[];
  quotaStatus: {
    remainingRequests?: number;
    remainingTokens?: number;
    remainingCost?: number;
    resetTime?: string;
  };
  upgradeRequired: boolean;
}

export function useUsageTracking() {
  const { auth } = useStore();
  const [usageStatus, setUsageStatus] = useState<UsageStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load current usage status
   */
  const loadUsageStatus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (!auth.user.id) {
        params.set('anonymousId', auth.anonymousId);
      }

      const response = await fetch(`/api/usage/check?${params}`);
      const data = await response.json();

      if (data.success) {
        setUsageStatus(data.data);
      } else {
        setError(data.error || 'Failed to load usage status');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [auth.user.id, auth.anonymousId]);

  /**
   * Check if a request can proceed based on quotas
   */
  const checkQuota = useCallback(async (
    provider: string,
    model: string,
    estimatedTokens?: number,
    estimatedCost?: number
  ): Promise<QuotaCheck> => {
    try {
      const response = await fetch('/api/usage/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(auth.anonymousId && !auth.user.id && {
            'x-anonymous-id': auth.anonymousId,
          }),
        },
        body: JSON.stringify({
          provider,
          model,
          estimatedTokens,
          estimatedCost,
        }),
      });

      const data = await response.json();

      if (data.success) {
        return {
          canProceed: data.data.canProceed,
          reasons: data.data.reasons || [],
          quotaStatus: data.data.quotaStatus || {},
          upgradeRequired: data.data.userType === 'anonymous' && !data.data.canProceed,
        };
      } else {
        throw new Error(data.error || 'Quota check failed');
      }
    } catch (err) {
      console.error('Quota check failed:', err);
      // On error, allow the request but log the issue
      return {
        canProceed: true,
        reasons: [],
        quotaStatus: {},
        upgradeRequired: false,
      };
    }
  }, [auth.user.id, auth.anonymousId]);

  /**
   * Get usage statistics for display
   */
  const getUsageStats = useCallback(() => {
    if (!usageStatus) return null;

    if (usageStatus.userType === 'anonymous' && usageStatus.anonymousLimits) {
      return {
        dailyRequests: usageStatus.anonymousLimits.usedMessages,
        dailyLimit: usageStatus.anonymousLimits.dailyLimit,
        remainingRequests: usageStatus.anonymousLimits.remainingMessages,
        resetTime: usageStatus.anonymousLimits.resetTime,
        timeUntilReset: usageStatus.anonymousLimits.timeUntilReset,
        shouldShowUpgradePrompt: usageStatus.anonymousLimits.shouldShowUpgradePrompt,
        upgradeRequired: usageStatus.anonymousLimits.remainingMessages <= 0,
      };
    }

    // For authenticated users, get the most restrictive daily limit
    const dailyLimits = usageStatus.quotaLimits.filter(limit => limit.type === 'daily');
    const mostRestrictiveLimit = dailyLimits.reduce((most, current) => {
      if (!current.requestLimit) return most;
      if (!most || !most.requestLimit) return current;
      return (current.requestLimit - current.usedRequests) < (most.requestLimit - most.usedRequests) 
        ? current : most;
    }, dailyLimits[0] || null);

    return {
      dailyRequests: usageStatus.dailyRequests,
      monthlyRequests: usageStatus.monthlyRequests,
      dailyCost: usageStatus.dailyCost,
      monthlyCost: usageStatus.monthlyCost,
      dailyLimit: mostRestrictiveLimit?.requestLimit,
      remainingRequests: mostRestrictiveLimit?.requestLimit 
        ? mostRestrictiveLimit.requestLimit - mostRestrictiveLimit.usedRequests
        : undefined,
      resetTime: mostRestrictiveLimit?.resetAt,
      upgradeRequired: false,
    };
  }, [usageStatus]);

  /**
   * Refresh anonymous limits from local storage
   */
  const refreshAnonymousLimits = useCallback(() => {
    if (auth.user.sessionType === 'anonymous') {
      const limits = AnonymousSessionManager.getAnonymousLimits();
      const remaining = AnonymousSessionManager.getRemainingMessages();
      
      setUsageStatus(prev => prev ? {
        ...prev,
        anonymousLimits: {
          dailyLimit: 50,
          usedMessages: limits.usedMessages,
          remainingMessages: remaining,
          resetTime: limits.resetTime.toISOString(),
          timeUntilReset: AnonymousSessionManager.getTimeUntilReset(),
          shouldShowUpgradePrompt: AnonymousSessionManager.shouldShowUpgradePrompt(),
        },
      } : null);
    }
  }, [auth.user.sessionType]);

  // Load usage status on mount and when auth changes
  useEffect(() => {
    loadUsageStatus();
  }, [loadUsageStatus]);

  // Refresh usage status every 5 minutes
  useEffect(() => {
    const interval = setInterval(loadUsageStatus, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadUsageStatus]);

  // Refresh anonymous limits every minute
  useEffect(() => {
    if (auth.user.sessionType === 'anonymous') {
      refreshAnonymousLimits();
      const interval = setInterval(refreshAnonymousLimits, 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [auth.user.sessionType, refreshAnonymousLimits]);

  return {
    usageStatus,
    loading,
    error,
    loadUsageStatus,
    checkQuota,
    getUsageStats,
    refreshAnonymousLimits,
  };
}