'use client'

import React from 'react'
// Temporarily disabled until auth is fully set up
// import { signIn } from 'next-auth/react'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const authTriggerMessages = {
  'premium-model': {
    title: 'Login and use all premium models for free!',
    description: 'Sign in to access Claude 3.5 Sonnet, GPT-4, OpenAI o3, and other cutting-edge models at no cost',
    benefits: [
      'Access to Claude 3.5 Sonnet, GPT-4, and OpenAI o3',
      'Higher daily message limits (500/day)',
      'Advanced reasoning capabilities',
      'Early access to new models and features'
    ]
  },
  'daily-limit': {
    title: 'Continue the Conversation',
    description: 'You\'ve reached your daily limit of 50 messages. Sign in to get 500 messages per day.',
    benefits: [
      '10x higher daily limits (500 messages/day)',
      'Access to premium models',
      'Enhanced web features (coming soon)',
      'Priority support and updates'
    ]
  },
  'advanced-features': {
    title: 'Unlock Advanced Features',
    description: 'Sign in to access enhanced web features and premium model capabilities.',
    benefits: [
      'Advanced web interface features (coming soon)',
      'Premium model access',
      'Enhanced conversation management',
      'Priority access to new capabilities'
    ]
  },
  'data-sync': {
    title: 'Enhanced Account Features',
    description: 'Sign in to unlock premium models and enhanced web features.',
    benefits: [
      'Access to premium AI models',
      'Enhanced web interface (coming soon)',
      'Conversation history management',
      'Priority access to new features'
    ]
  }
}

export const AuthModal: React.FC = () => {
  const { auth, setAuthModal } = useStore()
  const trigger = auth.authTrigger || 'premium-model'
  const config = authTriggerMessages[trigger]

  const handleSignIn = async (provider: 'google' | 'github' | 'email') => {
    try {
      // Demo implementation - show alert for now
      alert(`Demo: ${provider} sign-in would happen here. Full authentication will be implemented in the next phase.`)
      // Temporarily close modal for demo
      handleClose()
      // await signIn(provider, {
      //   callbackUrl: window.location.href,
      //   redirect: false
      // })
    } catch (error) {
      console.error('Sign in error:', error)
    }
  }

  const handleClose = () => {
    setAuthModal(false)
  }

  if (!auth.showAuthModal) return null

  return (
    <Dialog open={auth.showAuthModal} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {config.description}
          </p>

          {/* Benefits List */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">What you&apos;ll get:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              {config.benefits.map((benefit, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  {benefit}
                </li>
              ))}
            </ul>
          </div>

          {/* Sign-in Options */}
          <div className="space-y-3">
            <Button 
              onClick={() => handleSignIn('google')} 
              className="w-full flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </Button>
            
            <Button 
              onClick={() => handleSignIn('github')} 
              variant="outline" 
              className="w-full flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              Continue with GitHub
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with email
                </span>
              </div>
            </div>

            <Button 
              onClick={() => handleSignIn('email')} 
              variant="ghost" 
              className="w-full"
            >
              Continue with Email
            </Button>
          </div>

          <div className="text-xs text-center text-muted-foreground">
            Your anonymous chats will be preserved when you sign in.
            <br />
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default AuthModal