/**
 * Simple Sign In Form Component
 * Working directly with NextAuth without complex hooks
 */

'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { signIn, getSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { z } from '@/lib/zod-compat'

const credentialsSchema = z.object({
  email: z.string().trim().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
})

export default function SimpleSignInForm() {
  const t = useTranslations()
  const [email, setEmail] = useState('developer@vibecode.dev')
  const [password, setPassword] = useState('dev123')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const validation = credentialsSchema.safeParse({ email, password })
    if (!validation.success) {
      const [issue] = validation.error.issues
      setError(issue?.message ?? 'Invalid credentials')
      setIsSubmitting(false)
      return
    }

    const { email: sanitizedEmail, password: sanitizedPassword } = validation.data
    setEmail(sanitizedEmail)
    setPassword(sanitizedPassword)

    try {
      const result = await signIn('credentials', {
        email: sanitizedEmail,
        password: sanitizedPassword,
        redirect: false,
      })

      if (result?.error) {
        setError(result.error)
      } else if (result?.ok) {
        // Check if we have a session
        const session = await getSession()
        if (session) {
          router.push('/')
        } else {
          setError(t('auth.errors.authFailed'))
        }
      }
    } catch (_err) {
      setError(t('auth.errors.unexpectedError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
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
            {t('auth.signInTitle')}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t('auth.signInSubtitle')}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <strong className="font-bold">{t('auth.errorPrefix')}</strong>
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          <input type="hidden" name="remember" defaultValue="true" />
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email-address" className="sr-only">
                {t('auth.emailLabel')}
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder={t('auth.emailPlaceholder')}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                {t('auth.passwordLabel')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder={t('auth.passwordPlaceholder')}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                t('auth.signInButton')
              )}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600 mb-4">
              <strong>{t('auth.testUsersHeading')}</strong>
            </p>
            <div className="bg-gray-100 rounded-lg p-4 text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                <div className="space-y-1">
                  <p><strong>{t('auth.adminUsersLabel')}</strong></p>
                  <p>admin@vibecode.dev / admin123</p>
                  <p>lead@vibecode.dev / lead123</p>
                  <br />
                  <p><strong>{t('auth.developersLabel')}</strong></p>
                  <p>developer@vibecode.dev / dev123</p>
                  <p>frontend@vibecode.dev / frontend123</p>
                  <p>backend@vibecode.dev / backend123</p>
                </div>
                <div className="space-y-1">
                  <p><strong>{t('auth.teamMembersLabel')}</strong></p>
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
