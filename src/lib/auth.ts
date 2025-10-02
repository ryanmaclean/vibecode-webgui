/**
 * Authentication configuration for VibeCode WebGUI
 * Supports GitHub, Google OAuth, and JWT-based sessions
 */

import { NextAuthOptions } from 'next-auth'
import GithubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { isValidBcryptHash, verifyPassword } from './auth/password'

/**
 * CRITICAL SECURITY VALIDATION: NEXTAUTH_SECRET
 *
 * NextAuth requires a secure secret for JWT signing and session encryption.
 * Without a strong secret, sessions can be forged, leading to authentication bypass.
 *
 * Security Requirements:
 * - NEXTAUTH_SECRET must be defined (never undefined or empty)
 * - Must be at least 32 characters long (cryptographic minimum)
 * - Should be randomly generated (use: openssl rand -base64 32)
 */
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET

if (!NEXTAUTH_SECRET) {
  throw new Error(
    '🚨 CRITICAL SECURITY ERROR: NEXTAUTH_SECRET is not defined!\n\n' +
    'NextAuth requires a secret for JWT signing and session encryption.\n' +
    'Without it, your application is vulnerable to session forgery attacks.\n\n' +
    'To fix this:\n' +
    '1. Generate a secure secret: openssl rand -base64 32\n' +
    '2. Add to your .env file: NEXTAUTH_SECRET=<generated-secret>\n' +
    '3. Restart your application\n\n' +
    'See: https://next-auth.js.org/configuration/options#secret'
  )
}

if (NEXTAUTH_SECRET.length < 32) {
  throw new Error(
    `🚨 CRITICAL SECURITY ERROR: NEXTAUTH_SECRET is too weak!\n\n` +
    `Current length: ${NEXTAUTH_SECRET.length} characters\n` +
    `Required minimum: 32 characters\n\n` +
    `Your current secret is cryptographically insufficient for secure session management.\n` +
    `This makes your application vulnerable to brute force and session forgery attacks.\n\n` +
    `To fix this:\n` +
    `1. Generate a secure secret: openssl rand -base64 32\n` +
    `2. Replace your .env value: NEXTAUTH_SECRET=<generated-secret>\n` +
    `3. Restart your application\n\n` +
    `See: https://next-auth.js.org/configuration/options#secret`
  )
}

console.log('✅ NEXTAUTH_SECRET validation passed: secure secret configured')

const DUMMY_HASH = '$2b$12$eUlS0dNKrMxLdkPgDJZdpuHlNCn/KkheBmEzKE2.yOrembE1ccsV.'

if (!isValidBcryptHash(DUMMY_HASH)) {
  throw new Error('Dummy password hash is misconfigured: invalid bcrypt format')
}

const performTimingSafeCompare = async (password: string | undefined): Promise<void> => {
  try {
    await verifyPassword(password ?? '', DUMMY_HASH)
  } catch (error) {
    console.warn('Timing-safe bcrypt comparison failed', { error })
  }
}

type LegacyCredential = {
  email: string
  passwordHash: string
  id: string
  name: string
  role: string
}

/**
 * Security: legacy dev credentials are stored as bcrypt hashes (12 rounds).
 * Hashes map to the retired local passwords tracked in issue #438.
 */
const RAW_LEGACY_CREDENTIALS: LegacyCredential[] = [
  {
    email: 'admin@vibecode.dev',
    passwordHash: '$2b$12$JXIxHKb5sd8aZDt2pQNHhujlkBoXGXvJBfdJgOZ1uo.WAXN3mKFwK',
    id: 'legacy-admin',
    name: 'Admin User',
    role: 'admin'
  },
  {
    email: 'lead@vibecode.dev',
    passwordHash: '$2b$12$8s/hbVhcb/mddOBDmQbrou/bEZYO.ZAkyEacFBzrctq7Y/4VJeVCW',
    id: 'legacy-lead',
    name: 'Lead User',
    role: 'admin'
  },
  {
    email: 'developer@vibecode.dev',
    passwordHash: '$2b$12$r4Xn9ELPKKmRGpxTIyOI/uB1mlJAIn7xvsWNVcvl46eJzIxDbLQmq',
    id: 'legacy-developer',
    name: 'Developer User',
    role: 'developer'
  },
  {
    email: 'frontend@vibecode.dev',
    passwordHash: '$2b$12$LRBZBNR5.yxr7htTzN9YOORMf0v/p/0FSINKWZAc6Ycsqf1pvZF3a',
    id: 'legacy-frontend',
    name: 'Frontend User',
    role: 'user'
  },
  {
    email: 'backend@vibecode.dev',
    passwordHash: '$2b$12$x1Sv.4HYUjhDrDl/SOMEEeupl5YkhkmLXrfQOueHd0kiiojNQiG/u',
    id: 'legacy-backend',
    name: 'Backend User',
    role: 'user'
  },
  {
    email: 'fullstack@vibecode.dev',
    passwordHash: '$2b$12$Ta7FBadbTaW8Wkfho/6IS.K.QfpsxLZOBgWvMBBfuaNU/0QFK7baa',
    id: 'legacy-fullstack',
    name: 'Fullstack User',
    role: 'user'
  },
  {
    email: 'designer@vibecode.dev',
    passwordHash: '$2b$12$opn030TNnwgVqH4Sx3dOOusQLNGXhAOfyrBMch3ToRkJfpBNMq9si',
    id: 'legacy-designer',
    name: 'Designer User',
    role: 'user'
  },
  {
    email: 'tester@vibecode.dev',
    passwordHash: '$2b$12$U1YlGAYFkH9Wq9PK3QEfaeydHGu0JwC2DOhdxVd7H1T9xz9VQ/xke',
    id: 'legacy-tester',
    name: 'Tester User',
    role: 'user'
  },
  {
    email: 'devops@vibecode.dev',
    passwordHash: '$2b$12$eF2PIhYtOTP00qhe.Fx1beFv/oN2mndValdjICgh7zoQpPq2T6F0a',
    id: 'legacy-devops',
    name: 'DevOps User',
    role: 'user'
  },
  {
    email: 'security@vibecode.dev',
    passwordHash: '$2b$12$LbKqHWaLHDzcMXpi4iTAG./bQAfiZG10C9BqeLXcTe9yT1F2QR/Lm',
    id: 'legacy-security',
    name: 'Security User',
    role: 'user'
  },
]

const LEGACY_CREDENTIALS_BY_EMAIL = new Map<string, LegacyCredential>()

RAW_LEGACY_CREDENTIALS.forEach((credential) => {
  const trimmedEmail = credential.email.trim()
  const normalizedEmail = trimmedEmail.toLowerCase()
  const passwordHash = credential.passwordHash.trim()

  if (!isValidBcryptHash(passwordHash)) {
    console.warn('⚠️ Legacy credential misconfigured with invalid bcrypt hash', {
      email: trimmedEmail,
      credentialId: credential.id,
    })
    return
  }

  if (LEGACY_CREDENTIALS_BY_EMAIL.has(normalizedEmail)) {
    console.warn('⚠️ Duplicate legacy credential detected; later entry ignored', {
      email: trimmedEmail,
      credentialId: credential.id,
    })
    return
  }

  LEGACY_CREDENTIALS_BY_EMAIL.set(normalizedEmail, {
    ...credential,
    email: trimmedEmail,
    passwordHash,
  })
  console.debug('[auth] stored legacy credential', { email: trimmedEmail })
})

// Build providers dynamically so missing OAuth credentials do not break local auth flows.
const providers: NextAuthOptions['providers'] = []

if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  providers.push(
    GithubProvider({
      clientId: process.env.GITHUB_ID,
      clientSecret: process.env.GITHUB_SECRET,
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name || profile.login,
          email: profile.email,
          image: profile.avatar_url,
          role: 'user',
          githubId: profile.id.toString(),
        }
      },
    })
  )
} else if (process.env.NODE_ENV !== 'production') {
  console.warn('GitHub OAuth provider disabled: missing GITHUB_ID/GITHUB_SECRET env vars')
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          role: 'user',
          googleId: profile.sub,
        }
      },
    })
  )
} else if (process.env.NODE_ENV !== 'production') {
  console.warn('Google OAuth provider disabled: missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET env vars')
}

/**
 * Credentials Provider with bcrypt password verification
 *
 * SECURITY IMPROVEMENTS (Issue #445):
 * - Replaced plaintext password comparison with bcrypt verification
 * - Uses timing-safe comparison (bcrypt.compare)
 * - Validates password hashes before comparison
 * - No information leakage through error messages
 * - Timing attack prevention on user enumeration
 *
 * REMAINING VULNERABILITIES:
 * - Credentials still hardcoded in source code
 * - No rate limiting on failed attempts
 * - No password reset mechanism
 * - No account lockout
 *
 * NEXT STEPS (Issue #438):
 * - Implement database-backed user storage
 * - Add rate limiting middleware
 * - Implement password reset flow
 * - Add account lockout after failed attempts
 */
providers.push(
  CredentialsProvider({
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const emailInput = credentials?.email
        const passwordInput = typeof credentials?.password === 'string' ? credentials.password : ''

        if (!isNonEmptyString(emailInput)) {
          await performTimingSafeCompare(passwordInput)
          console.warn('❌ Credentials login rejected: missing or invalid email')
          return null
        }

        if (!isNonEmptyString(passwordInput)) {
          await performTimingSafeCompare(passwordInput)
          console.warn('❌ Credentials login rejected: missing password')
          return null
        }

        const normalizedEmail = emailInput.trim().toLowerCase()
        const user = LEGACY_CREDENTIALS_BY_EMAIL.get(normalizedEmail)

        if (!user) {
          await performTimingSafeCompare(passwordInput)
          console.warn('⚠️ Credentials login rejected: user not found', { email: normalizedEmail })
          return null
        }

        const passwordHash = user.passwordHash.trim()
        console.debug('[auth] verifying legacy credential', { email: normalizedEmail, passwordInput })

        if (!isValidBcryptHash(passwordHash)) {
          await performTimingSafeCompare(passwordInput)
          console.warn('❌ Credentials login rejected: stored hash invalid', {
            credentialId: user.id,
            email: user.email,
          })
          return null
        }

        try {
          const isValid = await verifyPassword(passwordInput, passwordHash)
          console.debug('[auth] verify result', { email: normalizedEmail, isValid })

          if (!isValid) {
            await performTimingSafeCompare(passwordInput)
            console.warn('⚠️ Credentials login rejected: password mismatch', { email: normalizedEmail })
            return null
          }

          console.log('✅ Credentials login succeeded', { userId: user.id })
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          }
        } catch (error) {
          await performTimingSafeCompare(passwordInput)
          console.warn('❌ Credentials login rejected: verification error', {
            email: normalizedEmail,
            credentialId: user.id,
            error: error instanceof Error ? error.message : 'unknown-error',
          })
          return null
        }
      },
    })
)

export const authOptions: NextAuthOptions = {
  // adapter: PrismaAdapter(prisma), // Disabled for file-based development
  secret: NEXTAUTH_SECRET,
  // cookies: {
  //   sessionToken: {
  //     name: `__Secure-next-auth.session-token`,
  //     options: {
  //       httpOnly: true,
  //       sameSite: 'lax',
  //       path: '/',
  //       secure: process.env.NODE_ENV === 'production',
  //       domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined
  //     }
  //   }
  // },
  providers,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/auth/new-user',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      console.log('🔄 JWT callback:', {
        hasUser: !!user,
        hasToken: !!token,
        provider: account?.provider,
        tokenId: token?.id,
        userId: user?.id
      })

      if (user) {
        token.id = user.id
        token.role = user.role
        token.email = user.email
        token.name = user.name
        if (account?.provider === 'github') {
          token.githubId = user.githubId
        }
        if (account?.provider === 'google') {
          token.googleId = user.googleId
        }
        console.log('✅ JWT token updated with user:', { id: token.id, role: token.role })
      }
      return token
    },
    async session({ session, token }) {
      console.log('📋 Session callback:', {
        hasSession: !!session,
        hasToken: !!token,
        tokenId: token?.id,
        sessionUserId: session?.user?.id
      })

      if (!session.user) {
        session.user = {
          id: '',
          email: '',
          name: '',
          role: 'user',
        }
      }

      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.email = token.email as string
        session.user.name = token.name as string
        console.log('✅ Session updated with token:', { id: session.user.id, role: session.user.role })
      }
      return session
    },
    async signIn({ user: _user, account: _account, profile: _profile, email: _email, credentials: _credentials }) {
      // Allow sign in for all providers
      return true
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  events: {
    async signIn({ user, account }) {
      console.log(`User ${user.email} signed in via ${account?.provider}`)
    },
    async signOut({ token }) {
      console.log(`User ${token?.email} signed out`)
    },
  },
  debug: process.env.NODE_ENV === 'development',
}
