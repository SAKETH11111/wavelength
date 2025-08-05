import React from 'react';
import { formatDistanceToNow } from 'date-fns';

interface UsageDisplayProps {
  tokens?: {
    input: number;
    reasoning: number;
    output: number;
  };
  cost?: number;
  duration?: number;
  model?: string;
  timestamp?: Date;
  compact?: boolean;
  className?: string;
}

export function UsageDisplay({
  tokens,
  cost,
  duration,
  model,
  timestamp,
  compact = false,
  className = ''
}: UsageDisplayProps) {
  if (!tokens && !cost && !duration) {
    return null;
  }

  const totalTokens = tokens ? tokens.input + tokens.reasoning + tokens.output : 0;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 text-xs text-gray-500 ${className}`}>
        {tokens && (
          <span className="flex items-center gap-1">
            <span>🎯</span>
            <span>{totalTokens.toLocaleString()}</span>
          </span>
        )}
        {cost !== undefined && cost > 0 && (
          <span className="flex items-center gap-1">
            <span>💰</span>
            <span>${cost.toFixed(4)}</span>
          </span>
        )}
        {duration && (
          <span className="flex items-center gap-1">
            <span>⏱️</span>
            <span>{duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`}</span>
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={`border rounded-lg p-3 bg-gray-50 dark:bg-gray-800 ${className}`}>
      <div className="grid grid-cols-2 gap-4 text-sm">
        {tokens && (
          <div>
            <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">Token Usage</div>
            <div className="space-y-1 text-gray-600 dark:text-gray-400">
              <div className="flex justify-between">
                <span>Input:</span>
                <span className="font-mono">{tokens.input.toLocaleString()}</span>
              </div>
              {tokens.reasoning > 0 && (
                <div className="flex justify-between">
                  <span>Reasoning:</span>
                  <span className="font-mono">{tokens.reasoning.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>Output:</span>
                <span className="font-mono">{tokens.output.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-700">
                <span className="font-medium">Total:</span>
                <span className="font-mono font-medium">{totalTokens.toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        <div>
          {(cost !== undefined && cost > 0) && (
            <div className="mb-3">
              <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">Cost</div>
              <div className="text-lg font-mono text-green-600 dark:text-green-400">
                ${cost.toFixed(4)}
              </div>
            </div>
          )}

          {(duration || model || timestamp) && (
            <div className="space-y-1 text-xs text-gray-500">
              {duration && (
                <div>
                  Duration: {duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(1)}s`}
                </div>
              )}
              {model && (
                <div>
                  Model: {model}
                </div>
              )}
              {timestamp && (
                <div>
                  {formatDistanceToNow(timestamp, { addSuffix: true })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default UsageDisplay;