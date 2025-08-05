"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Download, Upload, RefreshCw, Save } from 'lucide-react';
import { useStore } from '@/lib/store';
import { ProviderCard } from '@/components/ProviderCard';
import { ModelSelector } from '@/components/ModelSelector';
import { ProviderType } from '@/lib/providers/types';
import Link from 'next/link';

export default function SettingsPage() {
  const { 
    config, 
    updateConfig, 
    updateProviderConfig,
    testProviderConnection,
    refreshProviderModels,
    providerStatuses,
    availableModels,
    updateProviderStatus
  } = useStore();
  
  // Local state for form inputs
  const [localConfig, setLocalConfig] = useState(config);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync local state with store config when it changes
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleUpdateConfig = async () => {
    setSaving(true);
    try {
      updateConfig(localConfig);
      // Show success feedback briefly
      setTimeout(() => setSaving(false), 1000);
    } catch (error) {
      console.error('Error updating configuration:', error);
      setSaving(false);
    }
  };
  
  const handleProviderTest = async (provider: ProviderType) => {
    await testProviderConnection(provider);
  };
  
  const handleProviderToggle = (provider: ProviderType, enabled: boolean) => {
    updateProviderConfig(provider, { enabled });
    updateProviderStatus(provider, { enabled });
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
  };
  
  const handleRefreshModels = async () => {
    setRefreshing(true);
    try {
      await refreshProviderModels();
    } finally {
      setRefreshing(false);
    }
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
      } catch {
        console.error('Failed to import configuration. Invalid file format.');
      }
    };
    reader.readAsText(file);
  };

  const handleInputChange = (field: keyof typeof config, value: string | number | boolean) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Chat
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-semibold">Settings</h1>
                <p className="text-sm text-muted-foreground">Configure your AI providers and preferences</p>
              </div>
            </div>
            <Button 
              onClick={handleUpdateConfig}
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="providers" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="providers">Providers</TabsTrigger>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="display">Display</TabsTrigger>
            <TabsTrigger value="reasoning">Reasoning</TabsTrigger>
          </TabsList>

          <TabsContent value="providers" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>AI Providers</CardTitle>
                    <CardDescription>
                      Configure your API keys and manage provider connections
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshModels}
                      disabled={refreshing}
                      className="gap-2"
                    >
                      {refreshing ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportConfig} className="gap-2">
                      <Download className="w-4 h-4" />
                      Export
                    </Button>
                    <label>
                      <Button variant="outline" size="sm" asChild className="gap-2">
                        <span>
                          <Upload className="w-4 h-4" />
                          Import
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
              </CardHeader>
              <CardContent className="space-y-4">
                {providerStatuses.map((provider) => (
                  <ProviderCard
                    key={provider.id}
                    provider={provider}
                    onTest={handleProviderTest}
                    onToggle={handleProviderToggle}
                    onConfigUpdate={handleProviderConfigUpdate}
                  />
                ))}
                
                {availableModels.length > 0 && (
                  <Card className="bg-muted/50">
                    <CardHeader>
                      <CardTitle className="text-base">Available Models Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Total Models:</span>
                          <div className="font-mono text-xl font-semibold">{availableModels.length}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">With Reasoning:</span>
                          <div className="font-mono text-xl font-semibold">{availableModels.filter(m => m.supportsReasoning).length}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">With Streaming:</span>
                          <div className="font-mono text-xl font-semibold">{availableModels.filter(m => m.supportsStreaming).length}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Active Providers:</span>
                          <div className="font-mono text-xl font-semibold">{providerStatuses.filter(p => p.enabled && p.connected).length}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="general" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Configure default model and provider preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="defaultModel">Default Model</Label>
                  <ModelSelector
                    value={localConfig.defaultModel}
                    onChange={(value) => handleInputChange('defaultModel', value)}
                    placeholder="Select default model..."
                  />
                  <p className="text-xs text-muted-foreground">
                    This model will be used for new chats
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="defaultProvider">Default Provider Strategy</Label>
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
                  <p className="text-xs text-muted-foreground">
                    Fallback strategy when model is not available from primary provider
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="display" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Display Options</CardTitle>
                <CardDescription>Customize how information is displayed in the chat interface</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="showReasoning">Show reasoning process</Label>
                    <p className="text-xs text-muted-foreground">
                      Display the thinking process for reasoning-capable models
                    </p>
                  </div>
                  <Switch
                    id="showReasoning"
                    checked={localConfig.showReasoning}
                    onCheckedChange={(checked) => handleInputChange('showReasoning', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="showTokens">Show token counts</Label>
                    <p className="text-xs text-muted-foreground">
                      Display input/output token usage for each message
                    </p>
                  </div>
                  <Switch
                    id="showTokens"
                    checked={localConfig.showTokens}
                    onCheckedChange={(checked) => handleInputChange('showTokens', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="showCosts">Show cost estimates</Label>
                    <p className="text-xs text-muted-foreground">
                      Display estimated costs based on token usage
                    </p>
                  </div>
                  <Switch
                    id="showCosts"
                    checked={localConfig.showCosts}
                    onCheckedChange={(checked) => handleInputChange('showCosts', checked)}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="autoScroll">Auto-scroll to new messages</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically scroll down when new messages arrive
                    </p>
                  </div>
                  <Switch
                    id="autoScroll"
                    checked={localConfig.autoScroll}
                    onCheckedChange={(checked) => handleInputChange('autoScroll', checked)}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reasoning" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Reasoning Configuration</CardTitle>
                <CardDescription>Configure settings for reasoning-capable models</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="reasoningEffort">Reasoning Effort</Label>
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
                  <p className="text-xs text-muted-foreground">
                    Higher effort provides more thorough reasoning but may be slower and more expensive
                  </p>
                </div>
                
                <Card className="bg-muted/50">
                  <CardHeader>
                    <CardTitle className="text-base">
                      Reasoning Models ({availableModels.filter(m => m.supportsReasoning).length})
                    </CardTitle>
                    <CardDescription>
                      Models with advanced reasoning capabilities
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {availableModels
                        .filter(m => m.supportsReasoning)
                        .slice(0, 5)
                        .map((model) => (
                          <div key={model.id} className="flex items-center justify-between p-2 bg-background/50 rounded-md">
                            <div>
                              <span className="font-medium text-sm">{model.name}</span>
                              <p className="text-xs text-muted-foreground">{model.provider}</p>
                            </div>
                          </div>
                        ))}
                      {availableModels.filter(m => m.supportsReasoning).length > 5 && (
                        <div className="text-xs text-muted-foreground text-center py-2">
                          +{availableModels.filter(m => m.supportsReasoning).length - 5} more models
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}