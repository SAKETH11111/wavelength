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

interface ModelSelectorProps {
  value: string;
  onChange: (model: string) => void;
  className?: string;
  placeholder?: string;
}

export function ModelSelector({
  value,
  onChange,
  className,
  placeholder = "Select model...",
}: ModelSelectorProps) {
  const { availableModels, refreshProviderModels } = useStore();
  const [searchQuery, setSearchQuery] = useState("");

  // Refresh models on component mount
  useEffect(() => {
    if (availableModels.length === 0) {
      refreshProviderModels();
    }
  }, [availableModels.length, refreshProviderModels]);

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

  // Filter and sort models - only show gpt-oss models for deployment
  const filteredModels = useMemo(() => {
    // First filter for LLM models (exclude image/video generation)
    let llmModels = availableModels.filter((model) => {
      const modelId = model.id.toLowerCase();
      const isLLM =
        !modelId.includes("dall-e") &&
        !modelId.includes("midjourney") &&
        !modelId.includes("stable-diffusion") &&
        !modelId.includes("imagen") &&
        !modelId.includes("video");
      return isLLM;
    });

    // Filter for gpt-oss models only for deployment
    let gptOssModels = llmModels.filter((model) => {
      const modelId = model.id.toLowerCase();
      const modelName = model.name.toLowerCase();
      return modelId.includes("gpt-oss") || modelName.includes("gpt-oss");
    });

    // Apply search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      gptOssModels = gptOssModels.filter(
        (model) =>
          model.id.toLowerCase().includes(query) ||
          model.name.toLowerCase().includes(query) ||
          model.provider.toLowerCase().includes(query),
      );
    }

    // Sort gpt-oss models alphabetically
    const sortedGptOssModels = gptOssModels.sort((a, b) => a.name.localeCompare(b.name));

    // Add "Coming soon" placeholders if no search query
    if (!searchQuery) {
      const comingSoonModels = [
        {
          id: "coming-soon-claude",
          name: "Claude Models (Coming Soon)",
          provider: "Anthropic",
          disabled: true,
        },
        {
          id: "coming-soon-gpt",
          name: "GPT Models (Coming Soon)", 
          provider: "OpenAI",
          disabled: true,
        },
        {
          id: "coming-soon-gemini",
          name: "Gemini Models (Coming Soon)",
          provider: "Google",
          disabled: true,
        },
      ];
      return [...sortedGptOssModels, ...comingSoonModels];
    }

    return sortedGptOssModels;
  }, [availableModels, searchQuery]);

  return (
    <div className={className}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger style={{ width: `${dynamicWidth}px` }}>
          <SelectValue placeholder={placeholder}>
            {value &&
              (() => {
                const selectedModel = availableModels.find(
                  (m) => m.id === value,
                );
                return selectedModel ? (
                  <div className="flex items-center justify-between w-full">
                    <span className="font-medium">{selectedModel.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {selectedModel.provider}
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
              filteredModels.map((model) => (
                <SelectItem 
                  key={model.id} 
                  value={model.id}
                  disabled={(model as any).disabled}
                >
                  <div className="flex items-center justify-between w-full min-w-0">
                    <div className="flex flex-col items-start min-w-0 flex-1 pr-2">
                      <span className={`font-medium text-sm text-left break-words ${
                        (model as any).disabled ? 'text-muted-foreground' : ''
                      }`}>
                        {model.name}
                      </span>
                      <span className="text-xs text-muted-foreground text-left break-words">
                        {model.provider}
                      </span>
                    </div>
                  </div>
                </SelectItem>
              ))
            )}
          </div>
        </SelectContent>
      </Select>
    </div>
  );
}
