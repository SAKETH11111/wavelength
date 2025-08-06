"use client";

import React from 'react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Menu, Settings, Moon, Sun, Server, Globe, Zap, User, LogOut } from 'lucide-react';
import { useStore } from '../lib/store';
import { useTheme } from './ThemeProvider';
// Temporarily disabled until auth is fully set up
// import { signOut } from 'next-auth/react';
import { AnonymousSessionManager } from '../lib/auth/anonymous-session';

interface HeaderProps {
  toggleSidebar: () => void;
}

export function Header({ toggleSidebar }: HeaderProps) {
  const { backendMode, backendAvailable, auth, setAuthModal } = useStore();
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
  
  const handleSignIn = () => {
    setAuthModal(true, 'data-sync');
  };
  
  const handleSignOut = async () => {
    // Demo implementation
    alert('Demo: Sign out would happen here.');
    // await signOut({ redirect: false });
    // The auth state will be reinitialized automatically
  };
  
  const remainingMessages = auth.user.sessionType === 'anonymous' 
    ? AnonymousSessionManager.getRemainingMessages()
    : auth.limits.dailyMessages - auth.limits.usedMessages;
    
  const timeUntilReset = auth.user.sessionType === 'anonymous'
    ? AnonymousSessionManager.getTimeUntilReset()
    : null;

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
      <div className="flex items-center gap-3">
        {/* Message limit indicator for anonymous users */}
        {auth.user.sessionType === 'anonymous' && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono">
              {auth.limits.usedMessages}/{auth.limits.dailyMessages} today
            </span>
            {remainingMessages <= 10 && (
              <Badge variant="outline" className="text-xs px-2 py-1">
                {remainingMessages} left
              </Badge>
            )}
          </div>
        )}
        
        {/* Backend mode indicator */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/50 text-xs text-muted-foreground">
          {getBackendModeIcon()}
          <span>{getBackendModeText()}</span>
        </div>
        
        {/* Authentication status */}
        {auth.user.sessionType === 'anonymous' ? (
          <Button 
            variant="outline"
            size="sm"
            onClick={handleSignIn}
            className="text-sm px-3 py-2"
          >
            Sign In
          </Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={auth.user.image} alt={auth.user.name || auth.user.email} />
                  <AvatarFallback className="bg-primary/10">
                    {auth.user.name?.charAt(0) || auth.user.email?.charAt(0) || <User className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{auth.user.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {auth.user.email}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {auth.user.tier === 'pro' ? 'Pro' : 'Free'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {remainingMessages} messages left
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
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