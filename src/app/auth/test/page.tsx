/**
 * Authentication Test Page
 * For testing authentication flow and session handling
 */

'use client'

import { useSession } from 'next-auth/react'
import { useAuth } from '@/hooks/useAuth'
import { useState } from 'react'

export default function AuthTestPage() {
  const { data: session, status } = useSession()
  const { loginWithCredentials, logout, isLoading } = useAuth()
  const [testResult, setTestResult] = useState<string>('')

  const testAdminLogin = async () => {
    setTestResult('Testing admin login...')
    
    try {
      const result = await loginWithCredentials({
        email: 'admin@vibecode.dev',
        password: 'admin123'
      })
      
      if (result.success) {
        setTestResult('✅ Admin login successful!')
      } else {
        setTestResult(`❌ Admin login failed: ${result.error}`)
      }
    } catch (error) {
      setTestResult(`❌ Admin login error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const testLogout = async () => {
    setTestResult('Testing logout...')
    try {
      await logout()
      setTestResult('✅ Logout successful!')
    } catch (error) {
      setTestResult(`❌ Logout error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Authentication Test Page</h1>
          
          {/* Session Status */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Session Status</h2>
            <div className="bg-gray-100 rounded-lg p-4">
              <p><strong>Status:</strong> {status}</p>
              <p><strong>Authenticated:</strong> {session ? 'Yes' : 'No'}</p>
              {session && (
                <div className="mt-4">
                  <p><strong>User ID:</strong> {session.user.id}</p>
                  <p><strong>Email:</strong> {session.user.email}</p>
                  <p><strong>Name:</strong> {session.user.name}</p>
                  <p><strong>Role:</strong> {session.user.role}</p>
                </div>
              )}
            </div>
          </div>

          {/* Test Actions */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Test Actions</h2>
            <div className="flex gap-4 mb-4">
              <button
                onClick={testAdminLogin}
                disabled={!!session}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Test Admin Login
              </button>
              
              <button
                onClick={testLogout}
                disabled={!session}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Test Logout
              </button>
            </div>
            
            {testResult && (
              <div className="bg-gray-100 rounded-lg p-4">
                <p className="font-mono text-sm">{testResult}</p>
              </div>
            )}
          </div>

          {/* Available Test Users */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Available Test Users</h2>
            <div className="bg-gray-100 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="font-semibold text-blue-600">Admin Users:</div>
                  <div className="font-mono">admin@vibecode.dev / admin123</div>
                  <div className="font-mono">lead@vibecode.dev / lead123</div>
                  
                  <div className="font-semibold text-green-600 mt-4">Developers:</div>
                  <div className="font-mono">developer@vibecode.dev / dev123</div>
                  <div className="font-mono">frontend@vibecode.dev / frontend123</div>
                  <div className="font-mono">backend@vibecode.dev / backend123</div>
                </div>
                <div className="space-y-2">
                  <div className="font-semibold text-purple-600">Team Members:</div>
                  <div className="font-mono">fullstack@vibecode.dev / fullstack123</div>
                  <div className="font-mono">designer@vibecode.dev / design123</div>
                  <div className="font-mono">tester@vibecode.dev / test123</div>
                  <div className="font-mono">devops@vibecode.dev / devops123</div>
                  <div className="font-mono">intern@vibecode.dev / intern123</div>
                </div>
              </div>
              <div className="mt-4 text-xs text-gray-600">
                <strong>Note:</strong> These credentials are for development only and will be disabled in production.
              </div>
            </div>
          </div>

          {/* Environment Variables Check */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
            <div className="bg-gray-100 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p><strong>NEXTAUTH_URL:</strong> {process.env.NEXTAUTH_URL ? '✅ Set' : '❌ Missing'}</p>
                  <p><strong>NEXTAUTH_SECRET:</strong> {process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ Missing'}</p>
                </div>
                <div>
                  <p><strong>NODE_ENV:</strong> {process.env.NODE_ENV}</p>
                  <p><strong>Current URL:</strong> {typeof window !== 'undefined' ? window.location.origin : 'N/A'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* API Test */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">API Health Check</h2>
            <div className="bg-gray-100 rounded-lg p-4">
              <p className="text-sm">
                <a 
                  href="/api/health/simple" 
                  target="_blank" 
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  Test API Health Endpoint
                </a>
              </p>
            </div>
          </div>

          {/* Go to Sign In */}
          <div>
            <a 
              href="/auth/signin"
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 inline-block"
            >
              Go to Sign In Page
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}