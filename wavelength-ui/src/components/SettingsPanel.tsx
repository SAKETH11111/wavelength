"use client";

import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Separator } from './ui/separator';
import { X } from 'lucide-react';
import { useStore } from '../lib/store';

interface SettingsPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function SettingsPanel({ isOpen = false, onClose }: SettingsPanelProps) {
  const { config, updateConfig } = useStore();
  
  // Local state for form inputs
  const [localConfig, setLocalConfig] = useState(config);

  // Sync local state with store config when it changes
  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleUpdateConfig = async () => {
    try {
      updateConfig(localConfig);
      alert('Configuration updated successfully!');
      onClose?.();
    } catch (error) {
      console.error('Error updating configuration:', error);
      alert('Error updating configuration');
    }
  };

  const handleInputChange = (field: keyof typeof config, value: any) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div 
      className={`fixed right-0 top-0 w-80 h-screen bg-card border-l border-border transition-transform duration-300 ease-out z-50 flex flex-col ${
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
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* API Configuration */}
        <div className="mb-8">
          <h4 className="font-semibold mb-4 text-foreground">API Configuration</h4>
          
          <div className="mb-4">
            <label className="block text-sm text-muted-foreground mb-1">
              API Key
            </label>
            <Input
              type="password"
              placeholder="Enter your API key..."
              value={localConfig.apiKey}
              onChange={(e) => handleInputChange('apiKey', e.target.value)}
              className="w-full bg-input border border-border p-2 font-mono text-foreground"
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm text-muted-foreground mb-1">
              Base URL
            </label>
            <Input
              type="text"
              placeholder="http://localhost:8000"
              value={localConfig.baseUrl}
              onChange={(e) => handleInputChange('baseUrl', e.target.value)}
              className="w-full bg-input border border-border p-2 font-mono text-foreground"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm text-muted-foreground mb-1">
              Default Model
            </label>
            <Select 
              value={localConfig.defaultModel} 
              onValueChange={(value) => handleInputChange('defaultModel', value)}
            >
              <SelectTrigger className="w-full bg-input border border-border p-2 text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai/o3-pro">o3 Pro (Max)</SelectItem>
                <SelectItem value="openai/o3">o3 (Max)</SelectItem>
                <SelectItem value="x-ai/grok-4">Grok 4 (Max)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            onClick={handleUpdateConfig}
            className="w-full bg-primary text-primary-foreground"
          >
            Update Configuration
          </Button>
        </div>
        
        <Separator className="my-6" />
        
        {/* Display Options */}
        <div className="mb-8">
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
        
        <Separator className="my-6" />
        
        {/* Reasoning Configuration */}
        <div className="mb-8">
          <h4 className="font-semibold mb-4 text-foreground">Reasoning Configuration</h4>
          
          <div className="mb-4">
            <label className="block text-sm text-muted-foreground mb-1">
              Reasoning Effort
            </label>
            <Select 
              value={localConfig.reasoningEffort} 
              onValueChange={(value: 'low' | 'medium' | 'high') => handleInputChange('reasoningEffort', value)}
            >
              <SelectTrigger className="w-full bg-input border border-border p-2 text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High (Maximum)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}