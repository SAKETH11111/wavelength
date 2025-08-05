"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Settings, Plug } from 'lucide-react';
import { useStore, ProviderStatus } from '../lib/store';
import { ProviderType } from '../lib/providers/types';

interface ProviderCardProps {
  provider: ProviderStatus;
  onTest?: (provider: ProviderType) => Promise<void>;
  onToggle?: (provider: ProviderType, enabled: boolean) => void;
  onConfigUpdate?: (provider: ProviderType, config: Partial<{ apiKey: string; baseUrl?: string }>) => void;
}

export function ProviderCard({ provider, onTest, onToggle, onConfigUpdate }: ProviderCardProps) {
  const { config } = useStore();
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  
  // Defensive check with default values to prevent undefined access
  const providerConfig = config?.providers?.[provider.id] || {
    apiKey: '',
    baseUrl: '',
    enabled: false,
    priority: 1
  };
  
  const [localApiKey, setLocalApiKey] = useState(providerConfig.apiKey || '');
  const [localBaseUrl, setLocalBaseUrl] = useState(providerConfig.baseUrl || '');

  // Sync local state when provider config updates (e.g., after store hydration)
  useEffect(() => {
    if (config?.providers?.[provider.id]) {
      const updatedConfig = config.providers[provider.id];
      setLocalApiKey(updatedConfig.apiKey || '');
      setLocalBaseUrl(updatedConfig.baseUrl || '');
    }
  }, [config?.providers?.[provider.id]?.apiKey, config?.providers?.[provider.id]?.baseUrl, provider.id]);

  const handleTest = async () => {
    if (!onTest) return;
    setTesting(true);
    try {
      await onTest(provider.id);
    } finally {
      setTesting(false);
    }
  };

  const handleSaveConfig = () => {
    if (!onConfigUpdate) return;
    onConfigUpdate(provider.id, {
      apiKey: localApiKey,
      baseUrl: localBaseUrl || undefined,
    });
  };

  const getStatusIcon = () => {
    if (testing) return <Loader2 className="w-4 h-4 animate-spin" />;
    if (!provider.enabled) return <XCircle className="w-4 h-4 text-muted-foreground" />;
    if (provider.connected) return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    if (provider.error) return <XCircle className="w-4 h-4 text-red-500" />;
    return <Plug className="w-4 h-4 text-muted-foreground" />;
  };

  const getStatusText = () => {
    if (testing) return 'Testing...';
    if (!provider.enabled) return 'Disabled';
    if (provider.connected) return 'Connected';
    if (provider.error) return 'Error';
    return 'Not tested';
  };

  const getStatusColor = () => {
    if (!provider.enabled) return 'secondary';
    if (provider.connected) return 'default';
    if (provider.error) return 'destructive';
    return 'secondary';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <CardTitle className="text-lg">{provider.name}</CardTitle>
            </div>
            <Badge variant={getStatusColor() as 'secondary' | 'default' | 'destructive'} className="text-xs">
              {getStatusText()}
            </Badge>
          </div>
          <CardAction>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpanded(!expanded)}
              >
                <Settings className="w-4 h-4" />
              </Button>
              <Switch
                checked={provider.enabled}
                onCheckedChange={(checked) => onToggle?.(provider.id, checked)}
              />
            </div>
          </CardAction>
        </div>
        
        <CardDescription className="flex items-center justify-between">
          <span>{provider.models.length} models available</span>
          {provider.lastTested && (
            <span className="text-xs text-muted-foreground">
              Tested {new Date(provider.lastTested).toLocaleTimeString()}
            </span>
          )}
        </CardDescription>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <Separator className="mb-4" />
          
          <div className="space-y-4">
            {/* API Key Configuration */}
            <div>
              <label className="block text-sm font-medium mb-2">
                API Key
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    placeholder={`Enter ${provider.name} API key...`}
                    value={localApiKey}
                    onChange={(e) => setLocalApiKey(e.target.value)}
                    className="pr-10"
                    disabled={!provider.enabled}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Base URL Configuration (optional) */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Base URL (Optional)
              </label>
              <Input
                type="text"
                placeholder={`Custom base URL for ${provider.name}...`}
                value={localBaseUrl}
                onChange={(e) => setLocalBaseUrl(e.target.value)}
                disabled={!provider.enabled}
              />
            </div>

            {/* Error Display */}
            {provider.error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{provider.error}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSaveConfig}
                disabled={!provider.enabled}
                className="flex-1"
              >
                Save Configuration
              </Button>
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={testing || !provider.enabled || !localApiKey}
                className="flex-1"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
            </div>

            {/* Model Information */}
            {provider.models.length > 0 && (
              <div>
                <Separator className="my-4" />
                <h4 className="text-sm font-medium mb-2">Available Models ({provider.models.length})</h4>
                <div className="grid grid-cols-1 gap-1 max-h-32 overflow-y-auto">
                  {provider.models.slice(0, 5).map((model) => (
                    <div key={model.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm">
                      <span className="font-mono text-muted-foreground flex-1">{model.id}</span>
                      <div className="flex gap-1">
                        {model.supportsReasoning && (
                          <Badge variant="outline" className="text-xs h-4">R</Badge>
                        )}
                        {model.supportsStreaming && (
                          <Badge variant="outline" className="text-xs h-4">S</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {provider.models.length > 5 && (
                    <div className="text-xs text-muted-foreground text-center py-1">
                      +{provider.models.length - 5} more models
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}