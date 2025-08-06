"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

const settingsTabs = [
  {
    id: 'profile',
    label: 'Profile',
    href: '/settings/profile',
  },
  {
    id: 'api-keys',
    label: 'API Keys',
    href: '/settings/api-keys',
  },
  {
    id: 'usage',
    label: 'Usage & Billing',
    href: '/settings/usage',
  },
  {
    id: 'preferences',
    label: 'Preferences',
    href: '/settings/preferences',
  },
];

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="outline" size="sm" className="gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Chat
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-semibold">Settings</h1>
                <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-full lg:w-64">
            <nav className="space-y-1">
              {settingsTabs.map((tab) => {
                const isActive = pathname === tab.href || 
                  (pathname === '/settings' && tab.id === 'profile');
                
                return (
                  <Link key={tab.id} href={tab.href}>
                    <Button
                      variant={isActive ? 'secondary' : 'ghost'}
                      className={cn(
                        'w-full justify-start',
                        isActive && 'bg-muted font-medium'
                      )}
                    >
                      {tab.label}
                    </Button>
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 max-w-4xl">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}