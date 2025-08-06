'use client'

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useMigration } from '@/lib/hooks/useMigration';
import { MigrationProgress } from '@/components/migration/MigrationProgress';
import { useStore } from '@/lib/store';

/**
 * Handles authentication-triggered data migration
 * This component detects when users sign in and automatically migrates their localStorage data
 */
export const AuthMigrationHandler: React.FC = () => {
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { auth } = useStore();
  const [showMigrationDialog, setShowMigrationDialog] = useState(false);
  const [hasClearedUrl, setHasClearedUrl] = useState(false);
  
  const {
    isMigrating,
    migrationStatus,
    shouldMigrate,
    performMigration,
    retryMigration,
  } = useMigration();

  // Track if user was previously anonymous
  const [wasAnonymous] = useState(() => {
    return auth.user.sessionType === 'anonymous';
  });

  useEffect(() => {
    // Only trigger migration for newly authenticated users
    if (
      status === 'authenticated' && 
      session?.user &&
      wasAnonymous &&
      !isMigrating &&
      migrationStatus.status === 'idle'
    ) {
      const migrationNeeded = searchParams && searchParams.get('migration') === 'needed';
      const shouldPerformMigration = shouldMigrate();

      if (migrationNeeded || shouldPerformMigration) {
        // Clear the URL parameter to avoid triggering again
        if (migrationNeeded && !hasClearedUrl) {
          try {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('migration');
            router.replace(newUrl.pathname + newUrl.search, { scroll: false });
            setHasClearedUrl(true);
          } catch (error) {
            console.warn('Failed to clear migration URL parameter:', error);
            setHasClearedUrl(true); // Prevent infinite retries
          }
        }

        // Show migration dialog and start migration
        setShowMigrationDialog(true);
        performMigration(session);
      }
    }
  }, [
    status,
    session,
    wasAnonymous,
    isMigrating,
    migrationStatus.status,
    shouldMigrate,
    performMigration,
    searchParams,
    router,
    hasClearedUrl,
  ]);

  // Handle migration completion
  useEffect(() => {
    if (migrationStatus.status === 'completed') {
      // Keep dialog open for a moment to show success, then auto-close
      const timer = setTimeout(() => {
        setShowMigrationDialog(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [migrationStatus.status]);

  const handleRetryMigration = () => {
    if (session) {
      retryMigration(session);
    }
  };

  const handleCloseMigration = () => {
    setShowMigrationDialog(false);
  };

  return (
    <MigrationProgress
      isOpen={showMigrationDialog}
      onClose={handleCloseMigration}
      onRetry={session ? handleRetryMigration : undefined}
      migrationStatus={migrationStatus}
    />
  );
};