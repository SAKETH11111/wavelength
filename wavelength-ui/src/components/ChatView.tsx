"use client";

import React, { useEffect, useRef } from 'react';
import { Message } from './Message';
import { UsageDisplay } from './UsageDisplay';
import { useActiveChat, useChatMessages, useStore } from '../lib/store';

export function ChatView() {
  const activeChat = useActiveChat();
  const messages = useChatMessages();
  const { config } = useStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (config.autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, config.autoScroll]);

  if (!activeChat) {
    return (
      <div className="chat-messages flex-1 overflow-y-auto p-6 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="text-lg mb-2 font-mono">AI</div>
          <p className="font-semibold mb-1">Minimal AI Chat Interface</p>
          <p className="text-sm">True parallel processing with o3 Pro, o3, and Grok 4</p>
          <p className="text-xs mt-2">Create a new chat to get started</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="chat-messages flex-1 overflow-y-auto p-6 flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <div className="text-lg mb-2">Start a conversation</div>
          <div className="text-sm">Type your message below to begin</div>
        </div>
      </div>
    );
  }

  // Calculate total usage for the chat
  const totalTokens = messages.reduce((sum, msg) => {
    if (msg.tokens) {
      return sum + msg.tokens.input + msg.tokens.reasoning + msg.tokens.output;
    }
    return sum;
  }, 0);

  const totalCost = messages.reduce((sum, msg) => sum + (msg.cost || 0), 0);

  return (
    <div className="flex-1 flex flex-col">
      {/* Chat summary header */}
      {(config.showCosts || config.showTokens) && messages.length > 0 && totalTokens > 0 && (
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-foreground">
              Chat Summary • {activeChat.model}
            </div>
            <UsageDisplay
              tokens={totalTokens > 0 ? {
                input: messages.reduce((sum, msg) => sum + (msg.tokens?.input || 0), 0),
                reasoning: messages.reduce((sum, msg) => sum + (msg.tokens?.reasoning || 0), 0),
                output: messages.reduce((sum, msg) => sum + (msg.tokens?.output || 0), 0)
              } : undefined}
              cost={totalCost > 0 ? totalCost : undefined}
              compact={true}
              className="text-muted-foreground"
            />
          </div>
        </div>
      )}
      
      {/* Messages */}
      <div
        id="chat-messages"
        className="chat-messages flex-1 overflow-y-auto p-6 flex flex-col gap-4"
      >
        {messages.map((message) => (
          <Message
            key={message.id}
            role={message.role}
            content={message.content}
            timestamp={message.timestamp}
            model={message.model}
            cost={config.showCosts ? message.cost : undefined}
            duration={message.duration}
            reasoning={config.showReasoning ? message.reasoning : undefined}
            tokens={config.showTokens ? message.tokens : undefined}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}