"use client";

import React from 'react';
import { Button } from './ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { useStore } from '../lib/store';

export function Sidebar() {
  const {
    chats,
    activeChatId,
    createNewChat,
    selectChat,
    deleteChat,
    clearAllChats,
    toggleSettings,
    config
  } = useStore();

  const handleNewChat = () => {
    // Smart new chat creation: don't create a new chat if current chat is empty
    const activeChat = chats.find(chat => chat.id === activeChatId);
    
    // If there's no active chat, or the active chat has messages, create a new chat
    if (!activeChat || activeChat.messages.length > 0) {
      createNewChat(config.defaultModel);
    }
    // If the active chat is empty, just focus on it (no action needed)
  };

  const handleChatSelect = (chatId: string) => {
    selectChat(chatId);
  };

  const handleDeleteChat = (chatId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    deleteChat(chatId);
  };
  return (
    <div className="w-[280px] h-full bg-[var(--sidebar)] border-r border-border flex flex-col transition-transform duration-300 ease-out">
      {/* New Chat Button */}
      <Button
        className="bg-primary text-primary-foreground border-none p-3 m-4 cursor-pointer font-mono font-medium transition-all duration-150 flex items-center justify-center gap-2 hover:scale-105 hover:opacity-90 active:scale-95"
        onClick={handleNewChat}
      >
        <Plus className="w-4 h-4" />
        New Chat
      </Button>
      
      {/* Active Chats Header */}
      <div className="px-4 py-2">
        <div className="text-sm font-medium mb-2">
          Active Chats ({chats.length})
        </div>
      </div>
      
      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            No chats yet. Create a new chat to get started!
          </div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              className={`chat-item p-3 mx-2 my-2 border cursor-pointer transition-all duration-200 relative overflow-hidden hover:bg-accent hover:translate-x-0.5 ${
                chat.id === activeChatId ? 'border-primary bg-accent' : 'border-border'
              }`}
              onClick={() => handleChatSelect(chat.id)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium truncate pr-2">{chat.title}</span>
                <button
                  className="opacity-50 hover:opacity-100 flex-shrink-0"
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full inline-block ${
                    chat.status === 'processing' ? 'bg-yellow-500' :
                    chat.status === 'error' ? 'bg-red-500' : 'bg-green-500'
                  }`}></span>
                  <span className="text-muted-foreground">
                    {chat.status === 'processing' ? 'Processing...' :
                     chat.status === 'error' ? 'Error' : 'Ready'}
                  </span>
                </div>
                <span className="text-xs font-mono text-muted-foreground bg-muted px-1 rounded">
                  {chat.model.split('/')[1] || chat.model}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {chat.totalTokens} tokens • ${chat.totalCost.toFixed(4)}
              </div>
            </div>
          ))
        )}
      </div>
      
      {/* Bottom Controls */}
      <div className="p-4 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="text-xs px-2 py-1 mr-2"
          onClick={clearAllChats}
          disabled={chats.length === 0}
        >
          Clear All
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs px-2 py-1"
          onClick={toggleSettings}
        >
          Settings
        </Button>
      </div>
    </div>
  );
}