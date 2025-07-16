/**
 * Simple Authentication Test Page
 * Tests authentication without complex hooks
 */

'use client'

import { useSession, signIn, signOut } from 'next-auth/react'

export default function SimpleAuthTestPage() {
  const { data: session, status } = useSession()

  const testLogin = async () => {
    const result = await signIn('credentials', {
      email: 'developer@vibecode.dev',
      password: 'dev123',
      redirect: false,
    })
    
    if (result?.error) {
      alert('Login failed: ' + result.error)
    } else if (result?.ok) {
      alert('Login successful!')
      window.location.reload()
    }
  }

  const testLogout = async () => {
    await signOut({ redirect: false })
    alert('Logged out!')
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Simple Authentication Test</h1>
          
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

          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Test Actions</h2>
            <div className="flex gap-4">
              <button
                onClick={testLogin}
                disabled={!!session}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Test Login (developer@vibecode.dev)
              </button>
              
              <button
                onClick={testLogout}
                disabled={!session}
                className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Test Logout
              </button>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-4">Test All Credentials</h2>
            <div className="bg-gray-100 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p><strong>Admin Users:</strong></p>
                  <p>admin@vibecode.dev / admin123</p>
                  <p>lead@vibecode.dev / lead123</p>
                  <br />
                  <p><strong>Developers:</strong></p>
                  <p>developer@vibecode.dev / dev123</p>
                  <p>frontend@vibecode.dev / frontend123</p>
                  <p>backend@vibecode.dev / backend123</p>
                </div>
                <div>
                  <p><strong>Team Members:</strong></p>
                  <p>fullstack@vibecode.dev / fullstack123</p>
                  <p>designer@vibecode.dev / design123</p>
                  <p>tester@vibecode.dev / test123</p>
                  <p>devops@vibecode.dev / devops123</p>
                  <p>intern@vibecode.dev / intern123</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Links</h2>
            <div className="flex gap-4">
              <a 
                href="/auth/signin"
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
              >
                Go to Sign In Page
              </a>
              <a 
                href="/api/auth/session"
                target="_blank"
                className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
              >
                Check API Session
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}