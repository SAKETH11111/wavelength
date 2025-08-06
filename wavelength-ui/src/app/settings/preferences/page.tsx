"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Settings,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Monitor,
  MessageSquare,
  Cpu,
  DollarSign,
  Scroll,
  Brain
} from 'lucide-react';
import { useStore } from '@/lib/store';

export default function PreferencesPage() {
  const { 
    config, 
    updateConfig, 
    availableModels,
    auth 
  } = useStore();
  
  const [localConfig, setLocalConfig] = useState(config);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync local state with store config when it changes
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleUpdateConfig = async () => {
    setSaving(true);
    setMessage(null);
    
    try {
      updateConfig(localConfig);
      setMessage({ type: 'success', text: 'Preferences updated successfully' });
      // Show success feedback briefly
      setTimeout(() => setSaving(false), 1000);
    } catch (error) {
      console.error('Error updating preferences:', error);
      setMessage({ type: 'error', text: 'Failed to update preferences' });
      setSaving(false);
    }
  };

  const handleInputChange = (field: keyof typeof config, value: any) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
  };

  // const getModelName = (modelId: string) => {
  //   const model = availableModels.find(m => m.id === modelId);
  //   return model ? model.name : modelId;
  // };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            App Preferences
          </CardTitle>
          <CardDescription>
            Customize your Wavelength experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {message && (
            <Alert className={message.type === 'error' ? 'border-destructive' : 'border-green-200'}>
              {message.type === 'error' ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <CheckCircle className="h-4 w-4 text-green-600" />
              )}
              <AlertDescription className={message.type === 'success' ? 'text-green-700' : ''}>
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          {/* Model & Provider Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Model & Provider Settings
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="defaultModel">Default Model</Label>
                <Select
                  value={localConfig.defaultModel}
                  onValueChange={(value) => handleInputChange('defaultModel', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select default model" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.slice(0, 20).map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div>
                          <div className="font-medium">{model.name}</div>
                          <div className="text-xs text-muted-foreground">{model.provider}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  This model will be used for new conversations
                </p>
              </div>
              
              <div>
                <Label htmlFor="defaultProvider">Fallback Provider Strategy</Label>
                <Select
                  value={localConfig.defaultProvider}
                  onValueChange={(value) => handleInputChange('defaultProvider', value)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select strategy" />
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
                  When a model isn&apos;t available from the primary provider
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Display Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              Display Settings
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-muted-foreground" />
                    <Label htmlFor="showReasoning">Show reasoning process</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
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
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-muted-foreground" />
                    <Label htmlFor="showTokens">Show token counts</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
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
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-muted-foreground" />
                    <Label htmlFor="showCosts">Show cost estimates</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
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
                  <div className="flex items-center gap-2">
                    <Scroll className="w-4 h-4 text-muted-foreground" />
                    <Label htmlFor="autoScroll">Auto-scroll to new messages</Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Automatically scroll down when new messages arrive
                  </p>
                </div>
                <Switch
                  id="autoScroll"
                  checked={localConfig.autoScroll}
                  onCheckedChange={(checked) => handleInputChange('autoScroll', checked)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Reasoning Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Reasoning Configuration
            </h3>
            
            <div>
              <Label htmlFor="reasoningEffort">Reasoning Effort Level</Label>
              <Select
                value={localConfig.reasoningEffort}
                onValueChange={(value: 'low' | 'medium' | 'high') => handleInputChange('reasoningEffort', value)}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select effort level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">
                    <div>
                      <div className="font-medium">Low Effort</div>
                      <div className="text-xs text-muted-foreground">Quick responses, basic reasoning</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="medium">
                    <div>
                      <div className="font-medium">Medium Effort</div>
                      <div className="text-xs text-muted-foreground">Balanced reasoning and speed</div>
                    </div>
                  </SelectItem>
                  <SelectItem value="high">
                    <div>
                      <div className="font-medium">High Effort</div>
                      <div className="text-xs text-muted-foreground">Maximum reasoning (recommended)</div>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Higher effort provides more thorough reasoning but may be slower and more expensive
              </p>
            </div>
          </div>

          <Separator />

          {/* Save Button */}
          <div className="flex justify-end">
            <Button 
              onClick={handleUpdateConfig}
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saving ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reasoning Models Info */}
      {availableModels.some(m => m.supportsReasoning) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              Available Reasoning Models
            </CardTitle>
            <CardDescription>
              Models with advanced reasoning capabilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {availableModels
                .filter(m => m.supportsReasoning)
                .slice(0, 6)
                .map((model) => (
                  <div 
                    key={model.id} 
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                  >
                    <div>
                      <span className="font-medium text-sm">{model.name}</span>
                      <p className="text-xs text-muted-foreground">{model.provider}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {model.supportsStreaming && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          Streaming
                        </span>
                      )}
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                        Reasoning
                      </span>
                    </div>
                  </div>
                ))}
              {availableModels.filter(m => m.supportsReasoning).length > 6 && (
                <div className="text-xs text-muted-foreground text-center py-3 col-span-full">
                  +{availableModels.filter(m => m.supportsReasoning).length - 6} more reasoning models available
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Status for Anonymous Users */}
      {auth.user.sessionType === 'anonymous' && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <Alert>
              <MessageSquare className="h-4 w-4" />
              <AlertDescription>
                <strong>Anonymous Session:</strong> Your preferences are saved locally. 
                Sign in to sync preferences across devices and access additional features.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}
    </div>
  );
}