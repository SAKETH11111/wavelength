"use client";

import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Menu, Settings, Moon } from 'lucide-react';
import { useStore, useActiveChat } from '../lib/store';

interface HeaderProps {
  toggleSidebar: () => void;
  openSettings: () => void;
}

export function Header({ toggleSidebar, openSettings }: HeaderProps) {
  const { config, updateConfig } = useStore();
  const activeChat = useActiveChat();
  const [selectedModel, setSelectedModel] = useState(config.defaultModel);

  // Update selected model when active chat changes
  useEffect(() => {
    if (activeChat) {
      setSelectedModel(activeChat.model);
    } else {
      setSelectedModel(config.defaultModel);
    }
  }, [activeChat, config.defaultModel]);

  const handleModelChange = (newModel: string) => {
    setSelectedModel(newModel);
    
    if (activeChat) {
      // Update the model for the active chat
      const { chats } = useStore.getState();
      const updatedChats = chats.map(chat => 
        chat.id === activeChat.id 
          ? { ...chat, model: newModel, updatedAt: new Date() }
          : chat
      );
      useStore.setState({ chats: updatedChats });
    } else {
      // Update default model in config
      updateConfig({ defaultModel: newModel });
    }
  };

  return (
    <div className="chat-header p-4 border-b border-border flex items-center justify-between bg-background">
      {/* Left side controls */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline"
          size="sm"
          className="p-2"
          onClick={toggleSidebar}
        >
          <Menu className="w-4 h-4" />
        </Button>
        
        <Select value={selectedModel} onValueChange={handleModelChange}>
          <SelectTrigger className="w-[200px] bg-background border border-border p-2 font-mono text-foreground cursor-pointer transition-colors hover:border-ring">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="openai/o3-pro">o3 Pro (Max)</SelectItem>
            <SelectItem value="openai/o3">o3 (Max)</SelectItem>
            <SelectItem value="x-ai/grok-4">Grok 4 (Max)</SelectItem>
          </SelectContent>
        </Select>
        
        <div className="flex items-center gap-2">
          <Badge 
            id="active-tasks-indicator" 
            className="text-xs px-2 py-1 bg-accent hidden"
          >
            <span id="active-tasks-count">0</span> active
          </Badge>
          <div 
            id="global-timer" 
            className="timer text-xs font-mono text-muted-foreground hidden"
          >
            Timer: <span id="global-timer-value">00:00</span>
          </div>
        </div>
      </div>
      
      {/* Right side controls */}
      <div className="flex items-center gap-2">
        <Button 
          variant="outline"
          size="sm"
          className="p-2"
          onClick={openSettings}
        >
          <Settings className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="p-2"
          onClick={() => {/* TODO: Implement theme toggle */}}
        >
          <Moon className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}