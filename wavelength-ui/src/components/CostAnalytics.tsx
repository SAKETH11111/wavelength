import React from 'react';
import { useStore } from '@/lib/store';
import { UsageDisplay } from './UsageDisplay';

interface CostAnalyticsProps {
  className?: string;
  detailed?: boolean;
}

export function CostAnalytics({ className = '', detailed = false }: CostAnalyticsProps) {
  const { chats, config } = useStore();

  // Calculate overall statistics
  const stats = chats.reduce((acc, chat) => {
    const chatCost = chat.messages.reduce((sum, msg) => sum + (msg.cost || 0), 0);
    const chatTokens = chat.messages.reduce((sum, msg) => {
      if (msg.tokens) {
        return {
          input: sum.input + msg.tokens.input,
          reasoning: sum.reasoning + msg.tokens.reasoning,
          output: sum.output + msg.tokens.output,
        };
      }
      return sum;
    }, { input: 0, reasoning: 0, output: 0 });

    return {
      totalCost: acc.totalCost + chatCost,
      totalTokens: {
        input: acc.totalTokens.input + chatTokens.input,
        reasoning: acc.totalTokens.reasoning + chatTokens.reasoning,
        output: acc.totalTokens.output + chatTokens.output,
      },
      totalChats: acc.totalChats + (chat.messages.length > 0 ? 1 : 0),
      totalMessages: acc.totalMessages + chat.messages.filter(m => m.role === 'assistant').length,
    };
  }, {
    totalCost: 0,
    totalTokens: { input: 0, reasoning: 0, output: 0 },
    totalChats: 0,
    totalMessages: 0,
  });

  const totalTokenCount = stats.totalTokens.input + stats.totalTokens.reasoning + stats.totalTokens.output;

  // Calculate cost by model
  const costByModel = chats.reduce((acc, chat) => {
    if (chat.messages.length === 0) return acc;
    
    const model = chat.model;
    const chatCost = chat.messages.reduce((sum, msg) => sum + (msg.cost || 0), 0);
    const chatTokens = chat.messages.reduce((sum, msg) => {
      if (msg.tokens) {
        return sum + msg.tokens.input + msg.tokens.reasoning + msg.tokens.output;
      }
      return sum;
    }, 0);

    if (!acc[model]) {
      acc[model] = { cost: 0, tokens: 0, chats: 0 };
    }
    
    acc[model].cost += chatCost;
    acc[model].tokens += chatTokens;
    acc[model].chats += 1;
    
    return acc;
  }, {} as Record<string, { cost: number; tokens: number; chats: number }>);

  if (!config.showCosts && !config.showTokens) {
    return null;
  }

  if (stats.totalChats === 0) {
    return (
      <div className={`text-center text-muted-foreground ${className}`}>
        <div className="text-sm">No usage data yet</div>
        <div className="text-xs">Start a conversation to see cost and token analytics</div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Overall Statistics */}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-2">Overall Usage</h3>
        <UsageDisplay
          tokens={totalTokenCount > 0 ? stats.totalTokens : undefined}
          cost={stats.totalCost > 0 ? stats.totalCost : undefined}
          className="bg-background"
        />
        <div className="grid grid-cols-2 gap-4 mt-2 text-xs text-muted-foreground">
          <div>Total conversations: {stats.totalChats}</div>
          <div>AI responses: {stats.totalMessages}</div>
        </div>
      </div>

      {/* Model Breakdown */}
      {detailed && Object.keys(costByModel).length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Usage by Model</h3>
          <div className="space-y-2">
            {Object.entries(costByModel)
              .sort(([,a], [,b]) => b.cost - a.cost)
              .map(([model, data]) => (
                <div key={model} className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs">
                  <div className="font-mono text-foreground">
                    {model.split('/').pop() || model}
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    {data.tokens > 0 && (
                      <span>{data.tokens.toLocaleString()} tokens</span>
                    )}
                    {data.cost > 0 && (
                      <span className="font-medium">${data.cost.toFixed(4)}</span>
                    )}
                    <span>{data.chats} chats</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Cost Breakdown */}
      {detailed && stats.totalCost > 0 && (
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Cost Breakdown</h3>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Average per chat:</span>
              <span className="font-mono">${(stats.totalCost / stats.totalChats).toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Average per response:</span>
              <span className="font-mono">${(stats.totalCost / Math.max(stats.totalMessages, 1)).toFixed(4)}</span>
            </div>
            {totalTokenCount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cost per 1K tokens:</span>
                <span className="font-mono">${((stats.totalCost * 1000) / totalTokenCount).toFixed(4)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CostAnalytics;