/**
 * Hook to initialize backend connection and health checking
 */

import { useEffect } from 'react';
import { useStore } from '../lib/store';

export function useBackendInit() {
  const { checkBackendHealth, backendMode } = useStore();

  useEffect(() => {
    // Check backend health on app startup
    const initBackend = async () => {
      if (backendMode !== 'standalone') {
        await checkBackendHealth();
        
        // Set up periodic health checks every 2 minutes
        const interval = setInterval(() => {
          checkBackendHealth();
        }, 120000);

        return () => clearInterval(interval);
      }
    };

    initBackend();
  }, [checkBackendHealth, backendMode]);

  // Re-check when backend mode changes
  useEffect(() => {
    if (backendMode !== 'standalone') {
      checkBackendHealth();
    }
  }, [backendMode, checkBackendHealth]);
}