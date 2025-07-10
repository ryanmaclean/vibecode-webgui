/**
 * Main dashboard page for VibeCode WebGUI
 * Handles authentication and displays the main development interface
 */

'use client'

import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'

export default function Home() {
  const { isAuthenticated, isLoading, user, logout } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center mb-6">
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome to VibeCode WebGUI
          </h1>
          <p className="text-gray-600 mb-8">
            AI-powered development environment in your browser
          </p>
          <Link
            href="/auth/signin"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Get Started
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
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
                <h1 className="ml-3 text-xl font-bold text-gray-900">
                  VibeCode WebGUI
                </h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">Welcome, {user?.name}</span>
                <button
                  onClick={logout}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg h-96 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Development Environment Coming Soon
              </h2>
              <p className="text-gray-600 mb-6">
                Code-server integration and terminal are being implemented
              </p>
              <div className="space-y-2 text-sm text-gray-500">
                <p>✅ Authentication System</p>
                <p>🚧 Code-server Integration</p>
                <p>🚧 Terminal Interface</p>
                <p>🚧 Real-time Collaboration</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
