"use client";

import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { X, Download, Upload, RefreshCw, Settings2, Server, Globe, Zap } from 'lucide-react';
import { useStore } from '../lib/store';
import { ProviderCard } from './ProviderCard';
import { ModelSelector } from './ModelSelector';
import { CostAnalytics } from './CostAnalytics';
import { ProviderType } from '../lib/providers/types';

interface SettingsPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function SettingsPanel({ isOpen = false, onClose }: SettingsPanelProps) {
  const { 
    config, 
    updateConfig, 
    updateProviderConfig,
    testProviderConnection,
    refreshProviderModels,
    providerStatuses,
    availableModels,
    updateProviderStatus,
    backendMode,
    backendHealth,
    backendAvailable,
    setBackendMode,
    checkBackendHealth,
    forceBackendCheck
  } = useStore();
  
  // Local state for form inputs
  const [localConfig, setLocalConfig] = useState(config);
  const [activeTab, setActiveTab] = useState<'providers' | 'general' | 'display' | 'reasoning' | 'backend'>('providers');
  const [refreshing, setRefreshing] = useState(false);
  const [checkingBackend, setCheckingBackend] = useState(false);

  // Sync local state with store config when it changes
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleUpdateConfig = async () => {
    try {
      // Config is already saved via handleInputChange, this is just for explicit save feedback
      alert('Configuration saved successfully!');
      onClose?.();
    } catch (error) {
      console.error('Error updating configuration:', error);
      alert('Error updating configuration');
    }
  };
  
  const handleProviderTest = async (provider: ProviderType) => {
    await testProviderConnection(provider);
  };
  
  const handleProviderToggle = (provider: ProviderType, enabled: boolean) => {
    updateProviderConfig(provider, { enabled });
    updateProviderStatus(provider, { enabled });
    // Immediately update local config to keep UI in sync
    setLocalConfig(prev => ({
      ...prev,
      providers: {
        ...prev.providers,
        [provider]: {
          ...prev.providers[provider],
          enabled
        }
      }
    }));
  };
  
  const handleProviderConfigUpdate = (provider: ProviderType, providerConfig: Partial<{ apiKey: string; baseUrl?: string }>) => {
    updateProviderConfig(provider, providerConfig);
    // Also update legacy config for backward compatibility
    if (provider === 'openrouter') {
      updateConfig({ 
        apiKey: providerConfig.apiKey || '',
        baseUrl: providerConfig.baseUrl || ''
      });
    }
    // Update local config to keep UI in sync
    setLocalConfig(prev => ({
      ...prev,
      providers: {
        ...prev.providers,
        [provider]: {
          ...prev.providers[provider],
          ...providerConfig
        }
      }
    }));
  };
  
  const handleRefreshModels = async () => {
    setRefreshing(true);
    try {
      await refreshProviderModels();
      // Also check backend health when refreshing models
      await checkBackendHealth();
    } finally {
      setRefreshing(false);
    }
  };
  
  const handleBackendCheck = async () => {
    setCheckingBackend(true);
    try {
      forceBackendCheck();
      await checkBackendHealth();
    } finally {
      setCheckingBackend(false);
    }
  };
  
  const getBackendStatusIcon = () => {
    if (checkingBackend) return <RefreshCw className="w-4 h-4 animate-spin" />;
    if (backendMode === 'standalone') return <Globe className="w-4 h-4" />;
    if (backendAvailable) return <Server className="w-4 h-4 text-green-500" />;
    return <Server className="w-4 h-4 text-red-500" />;
  };
  
  const getBackendStatusText = () => {
    if (checkingBackend) return 'Checking...';
    if (backendMode === 'standalone') return 'Standalone Mode';
    if (backendAvailable) return 'Backend Connected';
    return 'Backend Unavailable';
  };
  
  const handleExportConfig = () => {
    const exportData = {
      config,
      providerStatuses,
      timestamp: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wavelength-config-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleImportConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target?.result as string);
        if (importData.config) {
          updateConfig(importData.config);
          setLocalConfig(importData.config);
        }
        alert('Configuration imported successfully!');
      } catch {
        alert('Failed to import configuration. Invalid file format.');
      }
    };
    reader.readAsText(file);
  };

  // Handle clicking outside to close (config is already saved via handleInputChange)
  const handleClose = () => {
    onClose?.();
  };

  const handleInputChange = (field: keyof typeof config, value: string | number | boolean) => {
    const newConfig = { ...localConfig, [field]: value };
    setLocalConfig(newConfig);
    // Immediately persist to store for better UX
    updateConfig(newConfig);
  };

  return (
    <div 
      className={`fixed right-0 top-0 w-96 max-w-[90vw] h-screen bg-card border-l border-border transition-transform duration-300 ease-out z-50 flex flex-col ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Settings</h3>
          <Button 
            variant="outline"
            size="sm"
            className="p-2"
            onClick={handleClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Navigation Tabs */}
        <div className="border-b border-border px-4 pt-4">
          <div className="flex gap-1 overflow-x-auto">
            {[
              { id: 'providers' as const, label: 'Providers', count: providerStatuses.filter(p => p.enabled).length },
              { id: 'backend' as const, label: 'Backend', icon: getBackendStatusIcon() },
              { id: 'general' as const, label: 'General' },
              { id: 'display' as const, label: 'Display' },
              { id: 'reasoning' as const, label: 'Reasoning' },
            ].map((tab: any) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-sm font-medium rounded-t-lg transition-colors flex items-center gap-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-background text-foreground border-b-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.icon && tab.icon}
                {tab.label}
                {tab.count !== undefined && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {tab.count}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </div>
        
        <div className="p-4">
          {/* Backend Tab */}
          {activeTab === 'backend' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-foreground">Backend Integration</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure how Wavelength connects to the backend service
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {getBackendStatusIcon()}
                  <span className="text-sm">{getBackendStatusText()}</span>
                </div>
              </div>
              
              {/* Backend Mode Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Operation Mode
                </label>
                <Select value={backendMode} onValueChange={(value: typeof backendMode) => setBackendMode(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Auto - Use backend when available, fallback to standalone
                      </div>
                    </SelectItem>
                    <SelectItem value="standalone">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        Standalone - Use frontend provider system only
                      </div>
                    </SelectItem>
                    <SelectItem value="backend-only">
                      <div className="flex items-center gap-2">
                        <Server className="w-4 h-4" />
                        Backend Only - Require backend connection
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {backendMode === 'auto' && 'Automatically detects and uses the best available option'}
                  {backendMode === 'standalone' && 'All processing happens in the browser'}
                  {backendMode === 'backend-only' && 'Requires FastAPI backend to be running'}
                </p>
              </div>
              
              {/* Backend Status */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-medium">Backend Status</h5>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBackendCheck}
                    disabled={checkingBackend}
                  >
                    {checkingBackend ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Overall Status:</span>
                    <Badge variant={backendHealth.status === 'healthy' ? 'default' : 
                                   backendHealth.status === 'degraded' ? 'secondary' : 'destructive'}>
                      {backendHealth.status}
                    </Badge>
                  </div>
                  
                  {backendHealth.providers && backendHealth.providers.length > 0 && (
                    <div>
                      <span className="text-muted-foreground">Backend Providers:</span>
                      <div className="mt-1 space-y-1">
                        {backendHealth.providers.map((provider) => (
                          <div key={provider.id} className="flex justify-between items-center">
                            <span className="font-mono text-xs">{provider.id}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{provider.models} models</span>
                              <Badge variant={provider.enabled ? 'default' : 'secondary'} className="text-xs">
                                {provider.status}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {backendHealth.timestamp && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Check:</span>
                      <span className="text-xs">
                        {new Date(backendHealth.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  )}
                </div>
                
                {backendMode === 'backend-only' && !backendAvailable && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">
                      Backend-only mode is selected but the backend is not available. 
                      Please start the FastAPI backend or switch to auto mode.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Providers Tab */}
          {activeTab === 'providers' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-foreground">AI Providers</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure your API keys and manage provider connections
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshModels}
                    disabled={refreshing}
                  >
                    {refreshing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportConfig}>
                    <Download className="w-4 h-4" />
                  </Button>
                  <label>
                    <Button variant="outline" size="sm" asChild>
                      <span>
                        <Upload className="w-4 h-4" />
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleImportConfig}
                    />
                  </label>
                </div>
              </div>
              
              <div className="grid gap-3">
                {providerStatuses.map((provider) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    onTest={handleProviderTest}
                    onToggle={handleProviderToggle}
                    onConfigUpdate={handleProviderConfigUpdate}
                  />
                ))}
              </div>
              
              {availableModels.length > 0 && (
                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <h5 className="font-medium mb-3">Available Models Summary</h5>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Total Models:</span>
                      <div className="font-mono text-lg">{availableModels.length}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">With Reasoning:</span>
                      <div className="font-mono text-lg">{availableModels.filter(m => m.supportsReasoning).length}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">With Streaming:</span>
                      <div className="font-mono text-lg">{availableModels.filter(m => m.supportsStreaming).length}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Active Providers:</span>
                      <div className="font-mono text-lg">{providerStatuses.filter(p => p.enabled && p.connected).length}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold mb-4 text-foreground">General Settings</h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Default Model
                    </label>
                    <ModelSelector
                      value={localConfig.defaultModel}
                      onChange={(value) => handleInputChange('defaultModel', value)}
                      placeholder="Select default model..."
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Default Provider Strategy
                    </label>
                    <Select 
                      value={localConfig.defaultProvider} 
                      onValueChange={(value) => handleInputChange('defaultProvider', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (Best Available)</SelectItem>
                        <SelectItem value="openrouter">OpenRouter</SelectItem>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="google">Google AI</SelectItem>
                        <SelectItem value="xai">XAI</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Fallback strategy when model is not available from primary provider
                    </p>
                  </div>
                  
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="flex items-start gap-2">
                      <Server className="w-4 h-4 text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-800">Backend Integration</p>
                        <p className="text-xs text-blue-600 mt-1">
                          Current mode: <strong>{backendMode}</strong>
                          {backendAvailable ? ' (Backend available)' : ' (Backend unavailable)'}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          Go to the Backend tab to configure integration settings.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Display Tab */}
          {activeTab === 'display' && (
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold mb-4 text-foreground">Display Options</h4>
                
                <div className="space-y-3">
                  <label className="flex items-center">
                    <input 
                      type="checkbox" 
                      checked={localConfig.showReasoning}
                      onChange={(e) => handleInputChange('showReasoning', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm">Show reasoning process</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input 
                      type="checkbox" 
                      checked={localConfig.showTokens}
                      onChange={(e) => handleInputChange('showTokens', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm">Show token counts</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input 
                      type="checkbox" 
                      checked={localConfig.showCosts}
                      onChange={(e) => handleInputChange('showCosts', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm">Show cost estimates</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input 
                      type="checkbox" 
                      checked={localConfig.autoScroll}
                      onChange={(e) => handleInputChange('autoScroll', e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm">Auto-scroll to new messages</span>
                  </label>
                </div>
              </div>
              
              {/* Usage Analytics */}
              {(localConfig.showCosts || localConfig.showTokens) && (
                <div>
                  <h4 className="font-semibold mb-4 text-foreground">Usage Analytics</h4>
                  <CostAnalytics detailed={true} />
                </div>
              )}
            </div>
          )}
          
          {/* Reasoning Tab */}
          {activeTab === 'reasoning' && (
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold mb-4 text-foreground">Reasoning Configuration</h4>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Reasoning Effort
                    </label>
                    <Select 
                      value={localConfig.reasoningEffort} 
                      onValueChange={(value: 'low' | 'medium' | 'high') => handleInputChange('reasoningEffort', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low - Quick responses</SelectItem>
                        <SelectItem value="medium">Medium - Balanced reasoning</SelectItem>
                        <SelectItem value="high">High - Maximum reasoning (recommended)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Higher effort provides more thorough reasoning but may be slower and more expensive
                    </p>
                  </div>
                  
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h5 className="font-medium mb-2">Reasoning Models ({availableModels.filter(m => m.supportsReasoning).length})</h5>
                    <p className="text-sm text-muted-foreground mb-3">
                      Models with advanced reasoning capabilities:
                    </p>
                    <div className="space-y-1">
                      {availableModels
                        .filter(m => m.supportsReasoning)
                        .slice(0, 5)
                        .map((model) => (
                          <div key={model.id} className="flex items-center justify-between text-sm p-2 bg-background/50 rounded">
                            <span className="font-mono text-muted-foreground">{model.id}</span>
                            <div className="flex gap-1">
                              <Badge variant="outline" className="text-xs h-4">R</Badge>
                              {model.supportsStreaming && (
                                <Badge variant="outline" className="text-xs h-4">S</Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      {availableModels.filter(m => m.supportsReasoning).length > 5 && (
                        <div className="text-xs text-muted-foreground text-center py-1">
                          +{availableModels.filter(m => m.supportsReasoning).length - 5} more models
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Save Button */}
          <div className="mt-6 pt-4 border-t border-border">
            <Button 
              onClick={handleUpdateConfig}
              className="w-full"
              size="lg"
            >
              <Settings2 className="w-4 h-4 mr-2" />
              Save Configuration
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}