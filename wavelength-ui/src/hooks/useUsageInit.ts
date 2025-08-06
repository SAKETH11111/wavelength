import { useEffect } from 'react';
import { useStore } from '@/lib/store';

/**
 * Hook to initialize usage tracking when the app loads
 */
export function useUsageInit() {
  const { auth } = useStore();

  useEffect(() => {
    // Auto-initialize usage quotas for authenticated users
    if (auth.user.sessionType === 'authenticated' && auth.user.id) {
      initializeUserUsage(auth.user.id, auth.user.tier);
    }
  }, [auth.user.sessionType, auth.user.id, auth.user.tier]);
}

async function initializeUserUsage(userId: string, tier: string = 'free') {
  try {
    // Check if user needs quota initialization
    const checkResponse = await fetch('/api/usage/init');
    const checkData = await checkResponse.json();
    
    if (checkData.success && checkData.data.needsInitialization) {
      console.log('Initializing usage quotas for user:', userId);
      
      // Initialize quotas
      const initResponse = await fetch('/api/usage/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      
      const initData = await initResponse.json();
      
      if (initData.success) {
        console.log('Usage quotas initialized successfully');
      } else {
        console.error('Failed to initialize usage quotas:', initData.error);
      }
    }
  } catch (error) {
    console.error('Failed to initialize usage tracking:', error);
  }
}