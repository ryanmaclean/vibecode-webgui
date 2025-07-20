/**
 * Main dashboard page for VibeCode WebGUI
 * Beautiful AI-powered development interface with magic-code-gen inspired UI
 */

'use client'

import { useAuth } from '@/hooks/useAuth'
import PromptInterface from '@/components/PromptInterface'
import Link from 'next/link'

export default function Home() {
  const { isAuthenticated, isLoading, user, logout } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto h-12 w-12 bg-gradient-primary rounded-lg flex items-center justify-center mb-6">
            <svg
              className="h-8 w-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Welcome to VibeCode</h1>
          <p className="text-muted-foreground mb-8">
            AI-powered development environment for the modern era
          </p>
          <div className="space-y-4">
            <Link
              href="/auth/login"
              className="w-full bg-gradient-primary text-white py-2 px-4 rounded-lg hover:opacity-90 transition-opacity inline-block"
            >
              Sign In
            </Link>
            <Link
              href="/auth/register"
              className="w-full border border-border text-foreground py-2 px-4 rounded-lg hover:bg-muted transition-colors inline-block"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dark">
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <svg
                  className="h-5 w-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">VibeCode</h1>
                <p className="text-xs text-muted-foreground">AI Development Assistant</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                Welcome, {user?.name || user?.email}
              </span>
              <button
                onClick={logout}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </header>

        {/* Main Interface */}
        <div className="h-[calc(100vh-73px)]">
          <PromptInterface />
        </div>
      </div>
    </div>
  )
}
