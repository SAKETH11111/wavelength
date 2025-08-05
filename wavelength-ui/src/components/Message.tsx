"use client";

import React from 'react';
import { Card } from './ui/card';

interface MessageProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date | string;
  model?: string;
  reasoning?: string;
  tokens?: {
    input: number;
    reasoning: number;
    output: number;
  };
  cost?: number;
  duration?: number;
}

export function Message({ role, content, timestamp, model, reasoning, tokens, cost, duration }: MessageProps) {
  const isUser = role === 'user';
  
  const formatTime = (date: Date | string) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div
      className={`message animate-in fade-in-0 slide-in-from-bottom-2 duration-300 max-w-[85%] ${
        isUser
          ? 'user self-end bg-accent text-accent-foreground p-3 ml-8'
          : 'ai self-start bg-card border border-border p-3 mr-8'
      }`}
    >
      <div className="whitespace-pre-wrap">
        {content}
      </div>
      
      {/* Reasoning display for AI messages */}
      {!isUser && reasoning && (
        <div className="text-xs font-mono text-muted-foreground mt-2 bg-muted p-2 rounded max-h-[200px] overflow-y-auto">
          <div className="font-semibold mb-1">Reasoning:</div>
          <div className="whitespace-pre-wrap">{reasoning}</div>
        </div>
      )}

      {/* Token information for AI messages */}
      {!isUser && tokens && (
        <div className="text-xs font-mono text-muted-foreground mt-2 bg-muted p-2 rounded">
          Input: {tokens.input} •
          Reasoning: {tokens.reasoning} •
          Output: {tokens.output}
        </div>
      )}
      
      {/* Metadata */}
      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2" suppressHydrationWarning>
        <span>{formatTime(timestamp)}</span>
        {model && <span>• {model}</span>}
        {cost && <span>• ${cost.toFixed(4)}</span>}
        {duration && <span>• {duration.toFixed(1)}s</span>}
      </div>
    </div>
  );
}

// Reasoning Box Component for active reasoning display
export function ReasoningBox({ taskId }: { taskId: string }) {
  return (
    <div className="message self-start bg-card border border-border p-3 mr-8">
      <div className="bg-muted border border-primary p-4 relative overflow-hidden animate-pulse">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <span className="text-sm font-medium">Reasoning...</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="timer font-mono font-variant-numeric-tabular" id={`timer-${taskId}`}>00:00</span>
            <button 
              className="bg-destructive text-destructive-foreground text-xs px-2 py-1 hover:opacity-80"
              onClick={() => {/* cancelTask(taskId) */}}
            >
              Cancel
            </button>
          </div>
        </div>
        <div 
          className="max-h-[200px] overflow-y-auto text-sm leading-relaxed text-muted-foreground font-mono"
          id={`reasoning-content-${taskId}`}
        >
          <div className="text-muted-foreground">Initializing deep reasoning...</div>
        </div>
        <div 
          className="text-xs font-mono text-muted-foreground mt-2"
          id={`reasoning-tokens-${taskId}`}
        >
          Reasoning tokens: 0
        </div>
      </div>
    </div>
  );
}