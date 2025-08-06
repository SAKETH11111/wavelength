'use client'

import React, { useEffect } from 'react'
// Temporarily disabled until auth is fully set up
// import { useSession } from 'next-auth/react'
import { useStore } from '@/lib/store'
import AuthModal from './AuthModal'

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Demo implementation - no actual session for now
  // const { data: session, status } = useSession()
  const { initializeAuth, auth } = useStore()

  // Initialize auth state for anonymous users
  useEffect(() => {
    // For demo, always initialize as anonymous user
    initializeAuth(null)
  }, [initializeAuth])

  return (
    <>
      {children}
      <AuthModal />
    </>
  )
}

export default AuthProvider