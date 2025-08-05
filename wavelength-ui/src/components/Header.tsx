"use client";

import React from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Menu, Settings, Moon, Sun, Server, Globe, Zap } from 'lucide-react';
import { useStore } from '../lib/store';
import { useTheme } from './ThemeProvider';

interface HeaderProps {
  toggleSidebar: () => void;
}

export function Header({ toggleSidebar }: HeaderProps) {
  const { backendMode, backendAvailable } = useStore();
  const { theme, setTheme } = useTheme();
  const getBackendModeIcon = () => {
    if (backendMode === 'standalone') return <Globe className="w-3 h-3" />;
    if (backendMode === 'backend-only') return <Server className="w-3 h-3" />;
    return <Zap className="w-3 h-3" />; // auto mode
  };
  
  const getBackendModeText = () => {
    if (backendMode === 'standalone') return 'Standalone';
    if (backendMode === 'backend-only') return 'Backend Only';
    return backendAvailable ? 'Auto (Backend)' : 'Auto (Standalone)';
  };

  const toggleTheme = () => {
    if (setTheme) {
      setTheme(theme === 'dark' ? 'light' : 'dark');
    }
  };

  const handleSettingsClick = () => {
    alert('Settings panel coming soon! We\'re working on bringing you comprehensive configuration options.');
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
        {/* Backend mode indicator */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground">
          {getBackendModeIcon()}
          <span>{getBackendModeText()}</span>
        </div>
        
        <Button 
          variant="outline"
          size="sm"
          className="p-2"
          onClick={handleSettingsClick}
        >
          <Settings className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="p-2"
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}