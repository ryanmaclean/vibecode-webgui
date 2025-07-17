/**
 * Authentication hook for VibeCode WebGUI
 * Provides authentication state and methods
 */

'use client'

import { useSession, signIn, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect } from 'react'
import { AuthState, LoginCredentials, OAuthProvider } from '@/types/auth'

const OAUTH_PROVIDERS: OAuthProvider[] = [
  {
    id: 'github',
    name: 'GitHub',
    icon: 'github',
    color: 'bg-gray-900 hover:bg-gray-800',
  },
  {
    id: 'google',
    name: 'Google',
    icon: 'google',
    color: 'bg-blue-600 hover:bg-blue-700',
  },
]

export function useAuth() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const authState: AuthState = {
    isLoading: status === 'loading',
    isAuthenticated: !!session,
    user: session?.user ? {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      avatar_url: session.user.image,
      role: session.user.role as 'admin' | 'user',
      created_at: new Date(), // This would come from the database
      updated_at: new Date(),
      login_count: 0,
      is_active: true,
    } : null,
    session: null, // This would be populated with active coding session
    error: null,
  }

  const loginWithCredentials = useCallback(async (credentials: LoginCredentials) => {
    try {
      const result = await signIn('credentials', {
        email: credentials.email,
        password: credentials.password,
        redirect: false,
      })

      if (result?.error) {
        throw new Error(result.error)
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed'
      }
    }
  }, [])

  const loginWithOAuth = useCallback(async (provider: OAuthProvider['id']) => {
    try {
      await signIn(provider, {
        callbackUrl: '/'
      })
    } catch (error) {
      console.error(`OAuth login failed for ${provider}:`, error)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await signOut({
        callbackUrl: '/auth/signin',
        redirect: true
      })
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }, [])

  const redirectToLogin = useCallback(() => {
    router.push('/auth/signin')
  }, [router])

  const redirectToDashboard = useCallback(() => {
    router.push('/')
  }, [router])

  // Auto-redirect logic
  useEffect(() => {
    if (status === 'loading') return

    const pathname = window.location.pathname
    const isAuthPage = pathname.startsWith('/auth/')

    if (!session && !isAuthPage) {
      // Not authenticated and not on auth page - redirect to login
      redirectToLogin()
    } else if (session && isAuthPage) {
      // Authenticated but on auth page - redirect to dashboard
      redirectToDashboard()
    }
  }, [session, status, redirectToLogin, redirectToDashboard])

  return {
    ...authState,
    providers: OAUTH_PROVIDERS,
    loginWithCredentials,
    loginWithOAuth,
    logout,
    redirectToLogin,
    redirectToDashboard,
  }
}
