/**
 * Debug page to test authentication step by step
 */

'use client'

import { useState } from 'react'
import { signIn, getSession } from 'next-auth/react'

export default function AuthDebugPage() {
  const [email, setEmail] = useState('developer@vibecode.dev')
  const [password, setPassword] = useState('dev123')
  const [result, setResult] = useState<string>('')
  const [session, setSession] = useState<unknown>(null)

  const handleTestAuth = async () => {
    setResult('Testing authentication...')
    
    try {
      // Step 1: Try to sign in
      const signInResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })
      
      setResult(`Sign in result: ${JSON.stringify(signInResult, null, 2)}`)
      
      // Step 2: Check session
      const sessionResult = await getSession()
      setSession(sessionResult)
      
      setResult(prev => prev + `\n\nSession result: ${JSON.stringify(sessionResult, null, 2)}`)
      
    } catch (error) {
      setResult(`Error: ${error}`)
    }
  }

  const handleCheckSession = async () => {
    const sessionResult = await getSession()
    setSession(sessionResult)
    setResult(`Current session: ${JSON.stringify(sessionResult, null, 2)}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Authentication Debug</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Test Credentials</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div className="space-x-4">
              <button
                onClick={handleTestAuth}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Test Authentication
              </button>
              
              <button
                onClick={handleCheckSession}
                className="px-4 py-2 bg-green-700 text-white rounded-md hover:bg-green-800"
              >
                Check Session
              </button>
            </div>
          </div>
        </div>
        
        {result && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Result</h2>
            <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto text-sm">
              {result}
            </pre>
          </div>
        )}
        
        {session && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Current Session</h2>
            <pre className="bg-gray-100 p-4 rounded-md overflow-x-auto text-sm">
              {JSON.stringify(session, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}