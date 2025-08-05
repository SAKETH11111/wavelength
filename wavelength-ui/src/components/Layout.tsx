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
    <div className="chat-container h-screen flex overflow-hidden">
      {/* Sidebar */}
      <div className={`sidebar w-[280px] h-full bg-background border-r border-border flex flex-col transition-transform duration-300 ease-out ${!isSidebarOpen ? 'collapsed -translate-x-full -mr-[280px]' : ''}`}>
        <Sidebar />
      </div>
      
      {/* Main Area */}
      <div className="main-area flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <Header
          toggleSidebar={toggleSidebar}
        />
        
        {/* Chat Messages */}
        <ChatView />
        
        {/* Input Area */}
        <ChatInput />
      </div>
      
    </div>
  );
}