"use client";

import React, { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ChatView } from './ChatView';
import { ChatInput } from './ChatInput';
import { useStore } from '../lib/store';
import { useBackendInit } from '../hooks/useBackendInit';

export function Layout() {
  const {
    isSidebarOpen,
    toggleSidebar
  } = useStore();
  
  // Initialize backend connection and health checking
  useBackendInit();

  // Set connection status on mount
  useEffect(() => {
    const { setConnectionStatus } = useStore.getState();
    setConnectionStatus(true);
  }, []);

  return (
    <div className="h-screen w-full flex overflow-hidden bg-background text-foreground">
      {/* Sidebar */}
      <div className={`${!isSidebarOpen ? 'sidebar collapsed -translate-x-full -mr-[280px]' : ''}`}>
        <Sidebar />
      </div>
      
      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-background">
        {/* Chat Header */}
        <div className="flex-shrink-0">
          <Header
            toggleSidebar={toggleSidebar}
          />
        </div>
        
        {/* Chat Messages */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <ChatView />
        </div>
        
        {/* Input Area */}
        <div className="flex-shrink-0">
          <ChatInput />
        </div>
      </div>
      
    </div>
  );
}