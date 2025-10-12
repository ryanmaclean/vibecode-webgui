/**
 * Simple Sign In Form Component
 * Working directly with NextAuth without complex hooks
 */

'use client'

import { useState, useEffect } from 'react'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function SimpleSignInForm() {
  const [email, setEmail] = useState('developer@vibecode.dev')
  const [password, setPassword] = useState('dev123')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [csrfToken, setCsrfToken] = useState('')
  const router = useRouter()

  // Debug: Verify component is mounted and form is ready
  useEffect(() => {
    console.log('🔧 SimpleSignInForm mounted');
    const form = document.querySelector('form');
    if (form) {
      console.log('📋 Form found:', form.outerHTML.substring(0, 100));
    } else {
      console.log('❌ Form not found');
    }
  }, []);

  // Fetch CSRF token for traditional form submission
  useEffect(() => {
    const fetchCsrfToken = async () => {
      try {
        const response = await fetch('/api/auth/csrf')
        const data = await response.json()
        console.log('🔐 CSRF token fetched:', data.csrfToken)
        setCsrfToken(data.csrfToken)
      } catch (err) {
        console.error('Failed to fetch CSRF token:', err)
      }
    }
    fetchCsrfToken()
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    console.log('🚀 Form submitted with:', { email, password })
    setError(null)
    setIsSubmitting(true)

    try {
      // Use redirect: false to handle the response manually
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: '/'
      })

      console.log('🔐 SignIn result:', result)

      if (result?.error) {
        console.log('❌ Authentication failed:', result.error)
        if (result.error === 'CredentialsSignin') {
          setError('Invalid credentials')
        } else {
          setError('Authentication failed')
        }
        setIsSubmitting(false)
      } else if (result?.ok) {
        console.log('✅ Authentication successful')
        // Redirect manually after successful login
        window.location.href = '/'
      } else {
        console.log('❌ Unexpected result:', result)
        setError('An unexpected error occurred')
        setIsSubmitting(false)
      }
    } catch (err) {
      console.log('❌ Unexpected error:', err)
      setError('An unexpected error occurred')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          {/* Heading for E2E compatibility */}
          <h1 className="text-2xl font-bold text-center text-gray-900">Sign In</h1>
          <div className="mx-auto h-12 w-12 bg-blue-600 rounded-lg flex items-center justify-center">
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
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            VibeCode Dev Login
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Simple sign-in for development environment
          </p>
        </div>
        <form 
          className="mt-8 space-y-6" 
          onSubmit={handleSubmit}
        >
          {error && (
<<<<<<< HEAD
            <div
              id="simple-signin-error"
              className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative"
              role="alert"
              aria-live="polite"
              data-testid="error-message"
            >
=======
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert" data-testid="error-message">
>>>>>>> merge-conflict-cleanup
              <strong className="font-bold">Error: </strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          <input type="hidden" name="remember" defaultValue="true" />
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                data-testid="email-input"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? "simple-signin-error" : undefined}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="password-input"
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? "simple-signin-error" : undefined}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="signin-button"
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                'Sign in'
              )}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              <strong>Development Test Users:</strong>
            </p>
            <div className="bg-gray-100 rounded-lg p-4 text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                <div className="space-y-1">
                  <p><strong>Admin Users:</strong></p>
                  <p>admin@vibecode.dev / admin123</p>
                  <p>lead@vibecode.dev / lead123</p>
                  <br />
                  <p><strong>Developers:</strong></p>
                  <p>developer@vibecode.dev / dev123</p>
                  <p>frontend@vibecode.dev / frontend123</p>
                  <p>backend@vibecode.dev / backend123</p>
                </div>
                <div className="space-y-1">
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
        </form>
      </div>
    </div>
  )
}
