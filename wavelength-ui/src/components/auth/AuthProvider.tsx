'use client'

import React, { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useStore } from '@/lib/store'
import AuthModal from './AuthModal'
import { AuthMigrationHandler } from './AuthMigrationHandler'

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { data: session, status } = useSession()
  const { initializeAuth } = useStore()

  // Initialize auth state based on session
  useEffect(() => {
    if (status !== 'loading') {
      initializeAuth(session)
    }
  }, [session, status, initializeAuth])

  return (
    <>
      {children}
      <AuthModal />
      <AuthMigrationHandler />
    </>
  )
}

export default AuthProvider