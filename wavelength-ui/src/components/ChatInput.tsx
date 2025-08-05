"use client";

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Send } from 'lucide-react';
import { useStore, useActiveChat } from '../lib/store';
import { sendMessageToServer } from '../lib/api';

export function ChatInput() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const { 
    createNewChat, 
    activeChatId, 
    config 
  } = useStore();
  const activeChat = useActiveChat();

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) {
      return;
    }
    
    const messageContent = message.trim();
    setMessage('');
    setIsLoading(true);

    try {
      // Create new chat if none exists
      let chatId = activeChatId;
      if (!chatId) {
        chatId = createNewChat(config.defaultModel);
      }

      // Send message to server
      const { setChatStatus } = useStore.getState();
      await sendMessageToServer(messageContent, chatId, activeChat?.model || config.defaultModel, setChatStatus);
    } catch (error) {
      console.warn('Failed to send message:', error);
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

  return (
    <div className="chat-input-area p-4 border-t border-border bg-background">
      <div className="flex gap-2 items-end">
        <Textarea
          value={message}
          onChange={(e) => {
            setMessage(e.target.value);
            adjustTextareaHeight(e.target);
          }}
          onKeyDown={handleKeyDown}
          placeholder={activeChatId ? "Type your message..." : "Start a new conversation..."}
          className="flex-1 bg-input border border-border p-3 font-mono text-foreground resize-none min-h-[2.5rem] max-h-[200px] transition-colors focus:border-ring"
          rows={1}
          disabled={isLoading}
        />
        <Button
          onClick={handleSendMessage}
          disabled={!message.trim() || isLoading}
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
          {activeChatId ? 'Ready for parallel sessions' : 'Create a new chat to get started'}
        </span>
        <span>Press Enter to send, Shift+Enter for new line</span>
      </div>
    </div>
  );
}