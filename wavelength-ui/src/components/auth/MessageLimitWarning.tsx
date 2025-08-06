'use client'

import React from 'react'
import { useStore } from '@/lib/store'
import { AnonymousSessionManager } from '@/lib/auth/anonymous-session'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Zap, Clock } from 'lucide-react'

interface MessageLimitWarningProps {
  className?: string
}

export const MessageLimitWarning: React.FC<MessageLimitWarningProps> = ({ className }) => {
  const { auth, setAuthModal } = useStore()
  
  if (auth.user.sessionType !== 'anonymous') {
    return null // Only show for anonymous users
  }

  const remainingMessages = AnonymousSessionManager.getRemainingMessages()
  const timeUntilReset = AnonymousSessionManager.getTimeUntilReset()
  const hasReachedLimit = AnonymousSessionManager.hasReachedLimit()
  const shouldShowUpgrade = AnonymousSessionManager.shouldShowUpgradePrompt()

  // Don't show warning if user has plenty of messages left
  if (remainingMessages > 10 && !hasReachedLimit) {
    return null
  }

  const handleUpgrade = () => {
    setAuthModal(true, hasReachedLimit ? 'daily-limit' : 'premium-model')
  }

  if (hasReachedLimit) {
    return (
      <Alert className={`border-destructive/50 ${className}`}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <div>
            <p className="font-medium">Daily limit reached</p>
            <p className="text-sm text-muted-foreground">
              Resets in {timeUntilReset} • Sign in for 10x more messages
            </p>
          </div>
          <Button onClick={handleUpgrade} size="sm" className="ml-4">
            <Zap className="w-4 h-4 mr-1" />
            Sign In
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (shouldShowUpgrade) {
    return (
      <Alert className={`border-yellow-500/50 ${className}`}>
        <Clock className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <div>
            <p className="font-medium">{remainingMessages} messages left today</p>
            <p className="text-sm text-muted-foreground">
              Sign in to get 500 messages/day + premium models
            </p>
          </div>
          <Button onClick={handleUpgrade} variant="outline" size="sm" className="ml-4">
            Sign In
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return null
}

export default MessageLimitWarning