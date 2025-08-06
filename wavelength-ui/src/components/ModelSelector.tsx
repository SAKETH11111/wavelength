"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Input } from "./ui/input";
import { Search } from "lucide-react";
import { useStore } from "../lib/store";
import { ModelAccessControl, updateModelAccessRules, modelAccessRules } from "../lib/auth/model-access";
import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  className?: string;
  placeholder?: string;
}

interface ModelForDisplay {
  id: string;
  name: string;
  provider: string;
  tier: 'free' | 'premium';
  requiresAuth: boolean;
  description?: string;
  canAccess: boolean;
}

export function ModelSelector({
  value,
  onChange,
  className,
  placeholder = "Select model...",
}: ModelSelectorProps) {
  const { 
    availableModels, 
    refreshProviderModels, 
    auth, 
    canAccessModel, 
    shouldPromptForAuth,
    setAuthModal 
  } = useStore();
  const [searchQuery, setSearchQuery] = useState("");

  // Refresh models on component mount and update access rules
  useEffect(() => {
    const fetchAndUpdateModels = async () => {
      if (availableModels.length === 0) {
        await refreshProviderModels();
      }
      // Update model access rules with fetched models
      if (availableModels.length > 0) {
        updateModelAccessRules(availableModels);
      }
    };
    
    fetchAndUpdateModels();
  }, [availableModels.length, refreshProviderModels, availableModels]);

  // Calculate dynamic width based on model names
  const dynamicWidth = useMemo(() => {
    if (availableModels.length === 0) return 220; // fallback width
    
    // Find the longest model name (including provider)
    const longestModelName = availableModels.reduce((longest, model) => {
      const displayLength = model.name.length + model.provider.length + 3; // +3 for spacing
      return displayLength > longest ? displayLength : longest;
    }, 0);
    
    // Calculate width: approximate 8px per character, with min 200px and max 400px
    const calculatedWidth = Math.max(200, Math.min(400, longestModelName * 8 + 40));
    return calculatedWidth;
  }, [availableModels]);

  // Filter and organize models based on authentication status
  const filteredModels = useMemo(() => {
    // Get models from our access rules and deduplicate by ID
    const uniqueModels = new Map<string, ModelForDisplay>();
    
    modelAccessRules.forEach(rule => {
      // Only add if not already present (first occurrence wins)
      if (!uniqueModels.has(rule.id)) {
        uniqueModels.set(rule.id, {
          id: rule.id,
          name: rule.name,
          provider: rule.provider,
          tier: rule.tier,
          requiresAuth: rule.requiresAuth,
          description: rule.description,
          canAccess: canAccessModel(rule.id),
        });
      }
    });
    
    let modelsToShow: ModelForDisplay[] = Array.from(uniqueModels.values());

    // Apply search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      modelsToShow = modelsToShow.filter(
        (model) =>
          model.id.toLowerCase().includes(query) ||
          model.name.toLowerCase().includes(query) ||
          model.provider.toLowerCase().includes(query),
      );
    }

    // Sort: accessible models first, then by name
    return modelsToShow.sort((a, b) => {
      if (a.canAccess !== b.canAccess) {
        return a.canAccess ? -1 : 1; // Accessible models first
      }
      if (a.tier !== b.tier) {
        return a.tier === 'free' ? -1 : 1; // Free models first within same access level
      }
      return a.name.localeCompare(b.name);
    });
  }, [availableModels, searchQuery, canAccessModel, auth.user.tier]);

  return (
    <TooltipProvider>
      <div className={className}>
        <Select value={value} onValueChange={(newValue) => {
          // Check if user can access this model
          const hasAccess = canAccessModel(newValue);
          const needsAuth = shouldPromptForAuth(newValue);
          
          console.log('Model selection:', { newValue, hasAccess, needsAuth });
          
          if (!hasAccess && needsAuth) {
            // Show auth modal for premium models
            console.log('Showing auth modal for premium model:', newValue);
            setAuthModal(true, 'premium-model');
            return;
          }
          
          // Allow selection if user has access
          onChange(newValue);
        }}>
        <SelectTrigger style={{ width: `${dynamicWidth}px` }}>
          <SelectValue placeholder={placeholder}>
            {value &&
              (() => {
                const accessRules = ModelAccessControl.getAllRules();
                const selectedModel = accessRules.find(
                  (m) => m.id === value,
                ) || availableModels.find(m => m.id === value);
                return selectedModel ? (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{selectedModel.name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground ml-2">
                      {typeof selectedModel.provider === 'string' ? selectedModel.provider : selectedModel.provider}
                    </span>
                  </div>
                ) : (
                  value
                );
              })()}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-80" style={{ width: `${dynamicWidth}px` }}>
          {/* Search input inside dropdown */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-8"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Model list */}
          <div className="max-h-60 overflow-auto">
            {filteredModels.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <p>No models found</p>
                {searchQuery && (
                  <p className="text-xs mt-1">
                    Try adjusting your search terms
                  </p>
                )}
              </div>
            ) : (
              filteredModels.map((model) => {
                const isLocked = !model.canAccess;
                const ModelItem = (
                  <SelectItem 
                    key={model.id} 
                    value={model.id}
                    disabled={isLocked}
                    className={isLocked ? 'opacity-60' : ''}
                  >
                    <div className="flex items-center justify-between w-full min-w-0">
                      <div className="flex flex-col items-start min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2 w-full">
                          <span className={`font-medium text-sm text-left break-words ${
                            isLocked ? 'text-muted-foreground' : ''
                          }`}>
                            {model.name}
                          </span>
                          {isLocked && (
                            <Lock className="w-3 h-3 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs text-muted-foreground text-left break-words">
                            {model.provider}
                          </span>
                          {model.description && (
                            <span className="text-xs text-muted-foreground text-right truncate ml-2">
                              {model.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </SelectItem>
                );

                // Wrap locked premium models with tooltip
                if (isLocked && model.requiresAuth) {
                  return (
                    <Tooltip key={model.id}>
                      <TooltipTrigger asChild className="w-full">
                        <div onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Premium model clicked:', model.id);
                          setAuthModal(true, 'premium-model');
                        }}>
                          {ModelItem}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs">
                        <p className="text-sm font-medium">Login and use all premium models for free!</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {model.description || `Access ${model.name} and other premium models.`}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return ModelItem;
              })
            )}
          </div>
        </SelectContent>
        </Select>
      </div>
    </TooltipProvider>
  );
}
