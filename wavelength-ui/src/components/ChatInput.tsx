"use client";

import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Send } from 'lucide-react';
import { useStore, useActiveChat } from '../lib/store';
import { sendMessageToServer } from '../lib/api';
import { ModelSelector } from './ModelSelector';
import { MessageLimitWarning } from './auth/MessageLimitWarning';
import { UsageWarning } from './UsageWarning';
import { useUsageTracking } from '@/hooks/useUsageTracking';
import { AnonymousSessionManager } from '../lib/auth/anonymous-session';

export function ChatInput() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState('');
  const [quotaCheckInProgress, setQuotaCheckInProgress] = useState(false);
  
  const { 
    createNewChat, 
    activeChatId, 
    config, 
    updateConfig,
    auth,
    canAccessModel,
    shouldPromptForAuth,
    setAuthModal,
    incrementMessageCount
  } = useStore();
  
  const { checkQuota, loadUsageStatus } = useUsageTracking();
  const activeChat = useActiveChat();

  // Update selected model when active chat changes
  useEffect(() => {
    if (activeChat) {
      setSelectedModel(activeChat.model);
    } else {
      setSelectedModel(config.defaultModel);
    }
  }, [activeChat, config.defaultModel]);

  const handleModelChange = (newModel: string) => {
    setSelectedModel(newModel);
    
    if (activeChat) {
      // Update the model for the active chat
      const { chats } = useStore.getState();
      const updatedChats = chats.map(chat => 
        chat.id === activeChat.id 
          ? { ...chat, model: newModel, updatedAt: new Date() }
          : chat
      );
      useStore.setState({ chats: updatedChats });
    } else {
      // Update default model in config
      updateConfig({ defaultModel: newModel });
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading || quotaCheckInProgress) {
      return;
    }
    
    const modelToUse = selectedModel || activeChat?.model || config.defaultModel;
    const provider = modelToUse.includes('/') ? modelToUse.split('/')[0] : 'openrouter';
    
    // Check model access first
    if (!canAccessModel(modelToUse)) {
      if (shouldPromptForAuth(modelToUse)) {
        setAuthModal(true, 'premium-model');
        return;
      }
    }
    
    // Check quota limits before proceeding
    setQuotaCheckInProgress(true);
    try {
      const quotaCheck = await checkQuota(
        provider, 
        modelToUse, 
        Math.ceil(message.trim().length / 4), // Rough token estimate
        undefined // Let the backend estimate cost
      );
      
      if (!quotaCheck.canProceed) {
        console.warn('Message blocked by quota:', quotaCheck.reasons);
        
        if (quotaCheck.upgradeRequired) {
          setAuthModal(true, 'daily-limit');
        } else {
          // Show error with quota details
          setError(`Usage limit exceeded: ${quotaCheck.reasons.join(', ')}`);
        }
        return;
      }
    } catch (quotaError) {
      console.error('Quota check failed:', quotaError);
      // Continue with request if quota check fails
    } finally {
      setQuotaCheckInProgress(false);
    }
    
    const messageContent = message.trim();
    setMessage('');
    setIsLoading(true);

    try {
      // Clear any previous errors
      setError(null);
      
      // Create new chat if none exists
      let chatId = activeChatId;
      if (!chatId) {
        chatId = createNewChat(config.defaultModel);
      }

      // Increment message count for anonymous users
      const reachedLimit = incrementMessageCount();
      
      // Send message to server with anonymous ID header for tracking
      const { setChatStatus } = useStore.getState();
      await sendMessageToServer(messageContent, chatId, selectedModel || activeChat?.model || config.defaultModel, setChatStatus);
      
      console.log('Message sent successfully');
      
      // Refresh usage status after successful send
      try {
        await loadUsageStatus();
      } catch (refreshError) {
        console.error('Failed to refresh usage status:', refreshError);
      }
      
      // Check if user reached limit after sending
      if (reachedLimit) {
        // Show upgrade prompt after a delay to let the message complete
        setTimeout(() => {
          setAuthModal(true, 'daily-limit');
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Extract error message for display
      let errorMessage = 'Failed to send message';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Handle quota-specific errors
      if (errorMessage.includes('Quota limit exceeded') || errorMessage.includes('Usage limit exceeded')) {
        setError('Usage limit exceeded. Please wait for reset time or upgrade your plan.');
        // Refresh usage status to show current limits
        try {
          await loadUsageStatus();
        } catch (refreshError) {
          console.error('Failed to refresh usage status:', refreshError);
        }
      } else {
        // Set general error state for user feedback
        setError(errorMessage.includes('Server responded with status 500') 
          ? 'Server error occurred. Please try again.' 
          : errorMessage);
      }
      
      // Restore message on error
      setMessage(messageContent);
    } finally {
      setIsLoading(false);
    }
  };

  const adjustTextareaHeight = (element: HTMLTextAreaElement) => {
    element.style.height = 'auto';
    element.style.height = Math.min(element.scrollHeight, 200) + 'px';
  };

  const isDisabled = isLoading || quotaCheckInProgress || (
    auth.user.sessionType === 'anonymous' && AnonymousSessionManager.hasReachedLimit()
  );

  return (
    <div className="chat-input-area p-4 border-t border-border bg-background">
      {/* Usage warnings */}
      <MessageLimitWarning className="mb-3" />
      <UsageWarning />
      
      {error && (
        <div className="mb-2 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}
      
      {/* Model Selector */}
      <div className="mb-3">
        <ModelSelector
          value={selectedModel}
          onChange={handleModelChange}
          placeholder="Select model..."
          className="w-fit"
        />
      </div>
      
      <div className="flex gap-2 items-end">
        <Textarea
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            adjustTextareaHeight(e.target);
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            auth.user.sessionType === 'anonymous' && AnonymousSessionManager.hasReachedLimit()
              ? "Daily limit reached. Sign in to continue..."
              : activeChatId 
                ? "Type your message..." 
                : "Start a new conversation..."
          }
          className="flex-1 bg-input border border-border p-3 font-mono text-foreground resize-none min-h-[2.5rem] max-h-[200px] transition-colors focus:border-ring"
          rows={1}
          disabled={isDisabled}
        />
        <Button
          onClick={handleSendMessage}
          disabled={!message.trim() || isDisabled}
          className="bg-primary text-primary-foreground border-none p-3 cursor-pointer font-mono transition-all duration-100 flex items-center justify-center hover:scale-105 hover:opacity-90 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin"></div>
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
      
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>
          {auth.user.sessionType === 'anonymous' && AnonymousSessionManager.hasReachedLimit() ? (
            'Daily limit reached. Sign in for 500 messages/day + premium models'
          ) : activeChatId ? (
            <>
              Ready for parallel sessions • Using {selectedModel?.split('/')[1] || selectedModel || 'default'}
            </>
          ) : (
            `Create a new chat to get started • Default: ${selectedModel?.split('/')[1] || selectedModel || 'default'}`
          )}
        </span>
        <span>Press Enter to send, Shift+Enter for new line</span>
      </div>
    </div>
  );
}