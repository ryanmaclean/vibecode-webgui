/**
 * E2E Test Authentication Page
 * Simple authentication for E2E tests without external dependencies
 */

'use client'

import { useState } from 'react'

export default function E2ETestAuthPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  const handleTestLogin = () => {
    // E2E test authentication - no external dependencies
    const testEmail = 'developer@vibecode.dev'
    setUserEmail(testEmail)
    setIsAuthenticated(true)
    
    // Store test session in localStorage for E2E tests
    localStorage.setItem('e2e-test-auth', JSON.stringify({
      authenticated: true,
      user: {
        id: 'test-user-1',
        email: testEmail,
        name: 'Test Developer',
        role: 'developer'
      },
      expires: Date.now() + (1000 * 60 * 60) // 1 hour
    }))
    
    // Redirect to workspaces like real auth flow
    window.location.href = '/workspaces'
  }

  const handleTestLogout = () => {
    setIsAuthenticated(false)
    setUserEmail('')
    localStorage.removeItem('e2e-test-auth')
    window.location.href = '/auth/signin'
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            E2E Test Login
          </h1>

          {!isAuthenticated ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  data-testid="email-input"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value="developer@vibecode.dev"
                  readOnly
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password  
                </label>
                <input
                  type="password"
                  data-testid="password-input"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value="dev123"
                  readOnly
                />
              </div>

              <button
                onClick={handleTestLogin}
                data-testid="signin-button"
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Sign In (E2E Test)
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h2 className="text-lg font-semibold text-green-800 mb-2">Authenticated</h2>
                <p className="text-green-700">
                  <strong>Email:</strong> {userEmail}
                </p>
                <p className="text-green-700">
                  <strong>Mode:</strong> E2E Test (No External Dependencies)
                </p>
              </div>

              <button
                onClick={handleTestLogout}
                className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Sign Out
              </button>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              E2E Test Mode - No external authentication required
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}