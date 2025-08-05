"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { UsageDisplay } from './UsageDisplay';
import { useStore } from '@/lib/store';

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
  const { config } = useStore();
  
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
      <div className={isUser ? "whitespace-pre-wrap" : ""}>
        {isUser ? (
          content
        ) : (
          <ReactMarkdown
            className="markdown-content max-w-none"
            components={{
              code: ({ node, inline, className, children, ...props }: any) => {
                const match = /language-(\w+)/.exec(className || '');
                return !inline && match ? (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    className="rounded-md overflow-x-auto !bg-gray-900 !p-4 !mb-4 !text-sm"
                    {...props}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                ) : (
                  <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground" {...props}>
                    {children}
                  </code>
                );
              },
              pre: ({ children }: any) => (
                <div className="overflow-x-auto mb-4 rounded-md bg-gray-900 p-4">{children}</div>
              ),
              h1: ({ children }: any) => (
                <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0 text-foreground border-b border-border pb-2">{children}</h1>
              ),
              h2: ({ children }: any) => (
                <h2 className="text-xl font-bold mb-3 mt-5 first:mt-0 text-foreground">{children}</h2>
              ),
              h3: ({ children }: any) => (
                <h3 className="text-lg font-bold mb-2 mt-4 first:mt-0 text-foreground">{children}</h3>
              ),
              h4: ({ children }: any) => (
                <h4 className="text-md font-semibold mb-2 mt-3 first:mt-0 text-foreground">{children}</h4>
              ),
              h5: ({ children }: any) => (
                <h5 className="text-sm font-semibold mb-1 mt-2 first:mt-0 text-foreground">{children}</h5>
              ),
              h6: ({ children }: any) => (
                <h6 className="text-sm font-medium mb-1 mt-2 first:mt-0 text-muted-foreground">{children}</h6>
              ),
              p: ({ children }: any) => (
                <p className="mb-4 last:mb-0 leading-relaxed text-foreground">{children}</p>
              ),
              ul: ({ children }: any) => (
                <ul className="list-disc pl-6 mb-4 space-y-2">{children}</ul>
              ),
              ol: ({ children }: any) => (
                <ol className="list-decimal pl-6 mb-4 space-y-2">{children}</ol>
              ),
              li: ({ children }: any) => (
                <li className="leading-relaxed text-foreground">{children}</li>
              ),
              blockquote: ({ children }: any) => (
                <blockquote className="border-l-4 border-primary/50 pl-4 py-2 mb-4 bg-muted/50 rounded-r-md">
                  <div className="text-muted-foreground italic">{children}</div>
                </blockquote>
              ),
              strong: ({ children }: any) => (
                <strong className="font-semibold text-foreground">{children}</strong>
              ),
              em: ({ children }: any) => (
                <em className="italic text-foreground">{children}</em>
              ),
              a: ({ children, href, ...props }: any) => (
                <a
                  href={href}
                  className="text-primary hover:text-primary/80 underline underline-offset-2"
                  target="_blank"
                  rel="noopener noreferrer"
                  {...props}
                >
                  {children}
                </a>
              ),
              table: ({ children }: any) => (
                <div className="overflow-x-auto mb-4">
                  <table className="min-w-full border-collapse border border-border rounded-md">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }: any) => (
                <thead className="bg-muted">{children}</thead>
              ),
              tbody: ({ children }: any) => (
                <tbody>{children}</tbody>
              ),
              tr: ({ children }: any) => (
                <tr className="border-b border-border hover:bg-muted/50">{children}</tr>
              ),
              th: ({ children }: any) => (
                <th className="border border-border px-4 py-2 text-left font-semibold text-foreground bg-muted/70">
                  {children}
                </th>
              ),
              td: ({ children }: any) => (
                <td className="border border-border px-4 py-2 text-foreground">
                  {children}
                </td>
              ),
              hr: () => (
                <hr className="border-border my-6" />
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        )}
      </div>
      
      {/* Reasoning display for AI messages */}
      {!isUser && reasoning && (
        <div className="text-xs font-mono text-muted-foreground mt-2 bg-muted p-2 rounded max-h-[200px] overflow-y-auto">
          <div className="font-semibold mb-1">Reasoning:</div>
          <div className="whitespace-pre-wrap">{reasoning}</div>
        </div>
      )}

      {/* Usage information for AI messages */}
      {!isUser && (config.showTokens || config.showCosts) && (tokens || cost !== undefined || duration) && (
        <div className="mt-2">
          <UsageDisplay
            tokens={tokens}
            cost={cost}
            duration={duration}
            model={model}
            timestamp={typeof timestamp === 'string' ? new Date(timestamp) : timestamp}
            compact={true}
          />
        </div>
      )}
      
      {/* Metadata */}
      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2" suppressHydrationWarning>
        <span>{formatTime(timestamp)}</span>
        {model && !config.showTokens && <span>• {model}</span>}
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