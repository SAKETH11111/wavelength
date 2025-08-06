'use client'

import { useEffect } from 'react'
import { useStore } from '@/lib/store'

export const AuthInitializer: React.FC = () => {
  const { initializeAuth } = useStore()

  useEffect(() => {
    // Initialize auth state for anonymous users on client mount
    // This ensures we have consistent anonymous session state
    initializeAuth(null)
  }, [initializeAuth])

  return null // This component doesn't render anything
}

export default AuthInitializer