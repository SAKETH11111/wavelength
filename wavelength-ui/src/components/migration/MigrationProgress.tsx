'use client'

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface MigrationProgressProps {
  isOpen: boolean;
  onClose: () => void;
  onRetry?: () => void;
}

export interface MigrationStatus {
  status: 'idle' | 'in_progress' | 'completed' | 'error';
  currentStep: string;
  progress: number;
  error?: string;
  result?: {
    migratedChats: number;
    migratedMessages: number;
    migratedApiKeys: number;
  };
}

export const MigrationProgress: React.FC<MigrationProgressProps & {
  migrationStatus: MigrationStatus;
}> = ({ isOpen, onClose, onRetry, migrationStatus }) => {
  const { status, currentStep, progress, error, result } = migrationStatus;

  const getStatusIcon = () => {
    switch (status) {
      case 'in_progress':
        return <Loader2 className="h-6 w-6 animate-spin text-blue-500" />;
      case 'completed':
        return <CheckCircle2 className="h-6 w-6 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-6 w-6 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case 'in_progress':
        return 'Setting up your account...';
      case 'completed':
        return 'Welcome to your account!';
      case 'error':
        return 'Migration Error';
      default:
        return 'Setting up your account...';
    }
  };

  const getStatusDescription = () => {
    switch (status) {
      case 'in_progress':
        return 'We\'re transferring your chats and preferences to your account. This will only take a moment.';
      case 'completed':
        return `Your data has been successfully transferred! ${
          result ? `${result.migratedChats} chats, ${result.migratedMessages} messages, and ${result.migratedApiKeys} API keys have been preserved.` : ''
        }`;
      case 'error':
        return 'There was an issue transferring your data. Don\'t worry - your local data is safe and we can try again.';
      default:
        return 'Preparing to transfer your data...';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={status !== 'in_progress' ? onClose : undefined}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {getStatusIcon()}
            {getStatusTitle()}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {getStatusDescription()}
          </p>

          {/* Progress bar - only show during migration */}
          {status === 'in_progress' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{currentStep}</span>
                <span className="text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Error details */}
          {status === 'error' && error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">
                <strong>Error:</strong> {error}
              </p>
            </div>
          )}

          {/* Success details */}
          {status === 'completed' && result && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="text-sm text-green-700 space-y-1">
                <div className="font-medium">Successfully transferred:</div>
                <ul className="list-disc list-inside space-y-0.5 ml-2">
                  {result.migratedChats > 0 && (
                    <li>{result.migratedChats} chat conversation{result.migratedChats !== 1 ? 's' : ''}</li>
                  )}
                  {result.migratedMessages > 0 && (
                    <li>{result.migratedMessages} message{result.migratedMessages !== 1 ? 's' : ''}</li>
                  )}
                  {result.migratedApiKeys > 0 && (
                    <li>{result.migratedApiKeys} API key{result.migratedApiKeys !== 1 ? 's' : ''}</li>
                  )}
                  <li>All your preferences and settings</li>
                </ul>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 justify-end">
            {status === 'error' && onRetry && (
              <Button onClick={onRetry} variant="outline">
                Try Again
              </Button>
            )}
            
            {(status === 'completed' || status === 'error') && (
              <Button onClick={onClose}>
                {status === 'completed' ? 'Continue' : 'Close'}
              </Button>
            )}
          </div>

          {/* Progress disclaimer */}
          {status === 'in_progress' && (
            <div className="text-xs text-center text-muted-foreground">
              Please don't close this window while we transfer your data.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Hook for managing migration state
 */
export const useMigrationProgress = () => {
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus>({
    status: 'idle',
    currentStep: '',
    progress: 0,
  });

  const updateProgress = (step: string, progress: number) => {
    setMigrationStatus(prev => ({
      ...prev,
      status: 'in_progress',
      currentStep: step,
      progress: Math.min(100, Math.max(0, progress)),
    }));
  };

  const setCompleted = (result: MigrationStatus['result']) => {
    setMigrationStatus(prev => ({
      ...prev,
      status: 'completed',
      currentStep: 'Migration complete!',
      progress: 100,
      result,
    }));
  };

  const setError = (error: string) => {
    setMigrationStatus(prev => ({
      ...prev,
      status: 'error',
      error,
      progress: 0,
    }));
  };

  const reset = () => {
    setMigrationStatus({
      status: 'idle',
      currentStep: '',
      progress: 0,
    });
  };

  return {
    migrationStatus,
    updateProgress,
    setCompleted,
    setError,
    reset,
  };
};