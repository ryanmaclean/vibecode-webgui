/**
 * Main dashboard page for VibeCode WebGUI
 * Beautiful AI-powered development interface with magic-code-gen inspired UI
 */

'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'

import { useAuth } from '@/hooks/useAuth'

const PromptInterface = dynamic(
  () => import('@/components/PromptInterface'),
  {
    // Keep SSR output but let hydration happen once the bundle loads.
    ssr: true,
    loading: () => (
      <div className="h-full w-full flex items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Loading workspace…</p>
        </div>
      </div>
    ),
  }
)

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
      <div className="min-h-screen bg-background">
        {/* LCP Hero Element - Large, visible above-the-fold content for Lighthouse */}
        <div className="w-full bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 py-24">
          <div className="container mx-auto px-6 text-center">
            <div className="mx-auto h-20 w-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-8 shadow-2xl">
              <svg
                className="h-12 w-12 text-white"
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
            <h1 className="text-6xl font-bold text-white mb-6 tracking-tight">
              Welcome to VibeCode
            </h1>
            <p className="text-2xl text-white/90 mb-12 max-w-2xl mx-auto">
              AI-powered development environment for the modern era
            </p>
            <div className="flex gap-4 justify-center">
              <Link
                href="/auth/login"
                className="bg-white text-purple-700 font-semibold py-3 px-8 rounded-lg hover:bg-white/90 transition-all shadow-xl hover:shadow-2xl transform hover:scale-105"
              >
                Sign In
              </Link>
              <Link
                href="/auth/register"
                className="border-2 border-white text-white font-semibold py-3 px-8 rounded-lg hover:bg-white/10 transition-all backdrop-blur-sm"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>

        {/* Additional content below the fold */}
        <div className="container mx-auto px-6 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-foreground mb-6">
              Build Faster with AI
            </h2>
            <p className="text-lg text-muted-foreground mb-12">
              Experience the next generation of development tools powered by artificial intelligence.
              Write code, debug, and deploy with unprecedented speed and accuracy.
            </p>

            <div className="grid md:grid-cols-3 gap-8 mt-12">
              <div className="p-6 rounded-lg border border-border bg-card">
                <div className="h-12 w-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Lightning Fast</h3>
                <p className="text-muted-foreground">Optimized performance for instant feedback and rapid development</p>
              </div>

              <div className="p-6 rounded-lg border border-border bg-card">
                <div className="h-12 w-12 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">AI-Powered</h3>
                <p className="text-muted-foreground">Intelligent code suggestions and automated workflows</p>
              </div>

              <div className="p-6 rounded-lg border border-border bg-card">
                <div className="h-12 w-12 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-lg flex items-center justify-center mb-4 mx-auto">
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">Secure</h3>
                <p className="text-muted-foreground">Enterprise-grade security for your code and data</p>
              </div>
            </div>
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
              <Link
                href="/marketplace"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Template Marketplace
              </Link>
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
          <Suspense
            fallback={
              <div className="h-full w-full flex items-center justify-center bg-background">
                <div className="space-y-4 text-center">
                  <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-muted border-t-primary" />
                  <p className="text-sm text-muted-foreground">Preparing the AI workspace…</p>
                </div>
              </div>
            }
          >
            <PromptInterface />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
