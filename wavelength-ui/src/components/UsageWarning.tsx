'use client';

import { useEffect, useState } from 'react';
import { useUsageTracking } from '@/hooks/useUsageTracking';
import { useStore } from '@/lib/store';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Clock, Zap, TrendingUp } from 'lucide-react';

export function UsageWarning() {
  const { auth, setAuthModal } = useStore();
  const { usageStatus, getUsageStats } = useUsageTracking();
  const [showWarning, setShowWarning] = useState(false);
  const stats = getUsageStats();

  useEffect(() => {
    if (!stats) return;

    // Show warning if approaching limits or limits exceeded
    const shouldShow = stats.upgradeRequired || 
                      stats.shouldShowUpgradePrompt ||
                      (stats.remainingRequests !== undefined && stats.remainingRequests <= 5);
    
    setShowWarning(shouldShow);
  }, [stats]);

  if (!showWarning || !stats) return null;

  const isAnonymous = auth.user.sessionType === 'anonymous';
  const isLimitExceeded = stats.upgradeRequired || (stats.remainingRequests === 0);
  const isApproachingLimit = stats.shouldShowUpgradePrompt || 
                            (stats.remainingRequests !== undefined && stats.remainingRequests <= 5 && stats.remainingRequests > 0);

  const getProgressValue = () => {
    if (!stats.dailyLimit || !stats.dailyRequests) return 0;
    return Math.min((stats.dailyRequests / stats.dailyLimit) * 100, 100);
  };

  const getProgressColor = () => {
    const progress = getProgressValue();
    if (progress >= 100) return 'bg-destructive';
    if (progress >= 80) return 'bg-orange-500';
    if (progress >= 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (isLimitExceeded) {
    return (
      <Alert className="border-destructive bg-destructive/10 mb-4">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <AlertDescription className="space-y-3">
          <div>
            <strong className="text-destructive">
              {isAnonymous ? 'Daily message limit reached!' : 'Usage quota exceeded!'}
            </strong>
            <p className="text-sm text-muted-foreground mt-1">
              {isAnonymous 
                ? 'You\'ve reached your daily limit of 50 messages. Sign in to unlock higher limits.'
                : 'You\'ve exceeded your current usage limits. Please upgrade your plan or wait for the next reset period.'
              }
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Daily usage:</span>
              <span className="font-medium">{stats.dailyRequests}{stats.dailyLimit && ` / ${stats.dailyLimit}`}</span>
            </div>
            
            {stats.dailyLimit && (
              <Progress 
                value={getProgressValue()} 
                className="h-2"
              />
            )}

            {stats.resetTime && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Clock className="h-3 w-3 mr-1" />
                <span>
                  Resets {isAnonymous ? stats.timeUntilReset : 'at midnight'}
                </span>
              </div>
            )}
          </div>

          {isAnonymous && (
            <div className="flex gap-2">
              <Button 
                size="sm" 
                onClick={() => setAuthModal(true, 'daily-limit')}
                className="flex-1"
              >
                Sign In for More
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setShowWarning(false)}
              >
                Dismiss
              </Button>
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  if (isApproachingLimit) {
    return (
      <Alert className="border-orange-500/50 bg-orange-500/10 mb-4">
        <TrendingUp className="h-4 w-4 text-orange-500" />
        <AlertDescription className="space-y-3">
          <div>
            <strong className="text-orange-600 dark:text-orange-400">
              Approaching usage limit
            </strong>
            <p className="text-sm text-muted-foreground mt-1">
              {isAnonymous 
                ? `You have ${stats.remainingRequests} messages remaining today. Sign in to unlock higher limits.`
                : `You have ${stats.remainingRequests} requests remaining in your current quota.`
              }
            </p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Daily usage:</span>
              <span className="font-medium">{stats.dailyRequests}{stats.dailyLimit && ` / ${stats.dailyLimit}`}</span>
            </div>
            
            {stats.dailyLimit && (
              <div className="space-y-1">
                <Progress 
                  value={getProgressValue()} 
                  className="h-2"
                />
                <div 
                  className={`h-2 rounded-full ${getProgressColor()}`}
                  style={{ width: `${getProgressValue()}%` }}
                />
              </div>
            )}

            {stats.dailyCost !== undefined && stats.dailyCost > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span>Daily cost:</span>
                <span className="font-medium">${stats.dailyCost.toFixed(4)}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {isAnonymous && (
              <Button 
                size="sm" 
                onClick={() => setAuthModal(true, 'daily-limit')}
              >
                <Zap className="h-3 w-3 mr-1" />
                Unlock More Messages
              </Button>
            )}
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setShowWarning(false)}
            >
              Dismiss
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

export default UsageWarning;