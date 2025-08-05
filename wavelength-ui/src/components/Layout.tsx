"use client";

import React, { useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ChatView } from './ChatView';
import { ChatInput } from './ChatInput';
import { SettingsPanel } from './SettingsPanel';
import { useStore } from '../lib/store';

export function Layout() {
  const {
    isSidebarOpen,
    isSettingsOpen,
    toggleSidebar,
    toggleSettings
  } = useStore();

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
          openSettings={toggleSettings}
        />
        
        {/* Chat Messages */}
        <ChatView />
        
        {/* Input Area */}
        <ChatInput />
      </div>
      
      {/* Settings Panel */}
      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={toggleSettings}
      />
      
    </div>
  );
}