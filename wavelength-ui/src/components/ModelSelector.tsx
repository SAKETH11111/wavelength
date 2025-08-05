"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Search, Filter, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { ModelInfo } from '../lib/providers/types';

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  className?: string;
  placeholder?: string;
}

export function ModelSelector({ value, onChange, className, placeholder = "Select model..." }: ModelSelectorProps) {
  const { availableModels, providerStatuses, refreshProviderModels, backendMode, backendAvailable } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);

  // Refresh models on component mount
  useEffect(() => {
    if (availableModels.length === 0) {
      refreshProviderModels();
    }
  }, [availableModels.length, refreshProviderModels]);

  // Filter and group models
  const filteredModels = useMemo(() => {
    let filtered = availableModels;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(model => 
        model.id.toLowerCase().includes(query) ||
        model.name.toLowerCase().includes(query) ||
        model.provider.toLowerCase().includes(query)
      );
    }

    // Filter by selected providers
    if (selectedProviders.length > 0) {
      filtered = filtered.filter(model => selectedProviders.includes(model.provider));
    }

    // Filter by capabilities
    if (selectedCapabilities.includes('reasoning')) {
      filtered = filtered.filter(model => model.supportsReasoning);
    }
    if (selectedCapabilities.includes('streaming')) {
      filtered = filtered.filter(model => model.supportsStreaming);
    }

    // Group by provider
    const grouped: Record<string, ModelInfo[]> = {};
    filtered.forEach(model => {
      if (!grouped[model.provider]) {
        grouped[model.provider] = [];
      }
      grouped[model.provider].push(model);
    });

    // Sort models within each provider by name
    Object.values(grouped).forEach(models => {
      models.sort((a, b) => a.name.localeCompare(b.name));
    });

    return grouped;
  }, [availableModels, searchQuery, selectedProviders, selectedCapabilities]);

  const enabledProviders = providerStatuses.filter(p => p.enabled).map(p => p.id);

  const toggleProvider = (provider: string) => {
    setSelectedProviders(prev => 
      prev.includes(provider) 
        ? prev.filter(p => p !== provider)
        : [...prev, provider]
    );
  };

  const toggleCapability = (capability: string) => {
    setSelectedCapabilities(prev => 
      prev.includes(capability) 
        ? prev.filter(c => c !== capability)
        : [...prev, capability]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedProviders([]);
    setSelectedCapabilities([]);
  };

  const hasActiveFilters = searchQuery || selectedProviders.length > 0 || selectedCapabilities.length > 0;

  return (
    <div className={className}>
      <div className="space-y-2">
        {/* Main selector */}
        <div className="flex gap-2">
          <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {Object.keys(filteredModels).length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <p>No models found</p>
                  {hasActiveFilters && (
                    <Button variant="link" size="sm" onClick={clearFilters} className="mt-2">
                      Clear filters
                    </Button>
                  )}
                </div>
              ) : (
                Object.entries(filteredModels).map(([provider, models]) => (
                  <div key={provider}>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider border-b flex items-center justify-between">
                      <span>{provider} ({models.length})</span>
                      {backendMode !== 'standalone' && backendAvailable && (
                        <Badge variant="outline" className="text-xs">Backend</Badge>
                      )}
                    </div>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id} className="pl-4">
                        <div className="flex items-center justify-between w-full">
                          <div>
                            <div className="font-mono text-sm">{model.name}</div>
                            <div className="flex gap-1 mt-1">
                              {model.supportsReasoning && (
                                <Badge variant="secondary" className="text-xs">Reasoning</Badge>
                              )}
                              {model.supportsStreaming && (
                                <Badge variant="secondary" className="text-xs">Streaming</Badge>
                              )}
                            </div>
                          </div>
                          {model.inputCostPer1M && (
                            <div className="text-xs text-muted-foreground ml-2">
                              ${model.inputCostPer1M.toFixed(2)}/1M
                            </div>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))
              )}
            </SelectContent>
          </Select>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="px-3"
          >
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="p-4 border rounded-lg bg-muted/50 space-y-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium mb-2">Search Models</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or provider..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Provider Filter */}
            <div>
              <label className="block text-sm font-medium mb-2">Providers</label>
              <div className="flex flex-wrap gap-2">
                {enabledProviders.map((provider) => (
                  <Button
                    key={provider}
                    variant={selectedProviders.includes(provider) ? "default" : "outline"}
                    size="sm"
                    onClick={() => toggleProvider(provider)}
                    className="text-xs"
                  >
                    {provider}
                  </Button>
                ))}
              </div>
            </div>

            {/* Capability Filter */}
            <div>
              <label className="block text-sm font-medium mb-2">Capabilities</label>
              <div className="flex gap-2">
                <Button
                  variant={selectedCapabilities.includes('reasoning') ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleCapability('reasoning')}
                  className="text-xs"
                >
                  Reasoning
                </Button>
                <Button
                  variant={selectedCapabilities.includes('streaming') ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleCapability('streaming')}
                  className="text-xs"
                >
                  Streaming
                </Button>
              </div>
            </div>

            {/* Clear filters */}
            {hasActiveFilters && (
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm text-muted-foreground">
                  {Object.values(filteredModels).flat().length} models match your filters
                </span>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-1" />
                  Clear filters
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}