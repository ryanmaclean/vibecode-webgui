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

// Security: fallback hash keeps response timing consistent when user lookup fails.
const DUMMY_PASSWORD_HASH = '$2b$12$eUlS0dNKrMxLdkPgDJZdpuHlNCn/KkheBmEzKE2.yOrembE1ccsV.'

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
const LEGACY_CREDENTIALS: LegacyCredential[] = [
  {
    email: 'admin@vibecode.dev',
    passwordHash: '$2b$12$XQVqieAtGtyshHHNkMyjVuZN2Ryo5OSWhkjSiRscvH0hQxKqm78ka',
    id: '1',
    name: 'Admin User',
    role: 'admin'
  },
  {
    email: 'developer@vibecode.dev',
    passwordHash: '$2b$12$7U3IFWS6gBro/c1AVV3hKuycK9lcXNc16N4PN2dhBZLgE2XmWzLFu',
    id: '2',
    name: 'Developer User',
    role: 'developer'
  },
  {
    email: 'lead@vibecode.dev',
    passwordHash: '$2b$12$AWfR.dTD2OdYCUbWocQ5Xed9.rXSojJRQpCXrR1/1w4tc9.n56RHG',
    id: '3',
    name: 'Lead User',
    role: 'lead'
  },
  {
    email: 'frontend@vibecode.dev',
    passwordHash: '$2b$12$hMTw2xxpzGmgFib7BD6DUOX.7y7OlWlDceDFb4o1b9JVSxSd2UTO6',
    id: '4',
    name: 'Frontend Developer',
    role: 'developer'
  },
  {
    email: 'backend@vibecode.dev',
    passwordHash: '$2b$12$SP8DIkk9QouLEt4ysbsKjOx4cTYoERvcGeQ3Zt//a.zZoxX1QJA2K',
    id: '5',
    name: 'Backend Developer',
    role: 'developer'
  },
  {
    email: 'fullstack@vibecode.dev',
    passwordHash: '$2b$12$vrs7dYCxm..vwpB.lnRMBuACJ.M8XaoEG6Uz0nd2By8/wp6iL.pS6',
    id: '6',
    name: 'Fullstack Developer',
    role: 'developer'
  },
  {
    email: 'designer@vibecode.dev',
    passwordHash: '$2b$12$KchCCE2nphp8GD/rtsB/r.irc0L2KzULvENTODIfxcEvdTAAliIWm',
    id: '7',
    name: 'Designer',
    role: 'designer'
  },
  {
    email: 'tester@vibecode.dev',
    passwordHash: '$2b$12$M8w5POxpAdaQcZJzu07GBeRJTAIsVvQ1dgALg8PP37xHp3dDz3BA6',
    id: '8',
    name: 'QA Tester',
    role: 'tester'
  },
  {
    email: 'devops@vibecode.dev',
    passwordHash: '$2b$12$eqzP5iAcsHDlAzG4VtZfse6q.5YGsiYJ3.D9QUueMTx4wK8AhVT7G',
    id: '9',
    name: 'DevOps Engineer',
    role: 'devops'
  },
  {
    email: 'intern@vibecode.dev',
    passwordHash: '$2b$12$sZbkPe/6wTkwHKjmlpL4LeBJMRl.Zu/qCSNVjocTjv.6A69Jla4Qi',
    id: '10',
    name: 'Intern',
    role: 'intern'
  },
]

for (const credential of LEGACY_CREDENTIALS) {
  if (!isValidBcryptHash(credential.passwordHash)) {
    throw new Error(`Invalid bcrypt hash configured for legacy credential: ${credential.email}`)
  }
}

LEGACY_CREDENTIALS.forEach((credential) => {
  if (!isValidBcryptHash(credential.passwordHash)) {
    console.warn('⚠️ Legacy credential misconfigured with invalid bcrypt hash', {
      email: credential.email,
      credentialId: credential.id,
    })
  }
})

const LEGACY_CREDENTIALS_BY_EMAIL = new Map<string, LegacyCredential>(
  LEGACY_CREDENTIALS.map((credential) => [credential.email.toLowerCase(), credential])
)

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
 * - Bcrypt verification enforces timing-safe comparison
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
        if (!credentials?.email || !credentials?.password) {
          console.warn('❌ Credentials login rejected: missing parameters')
          return null
        }

        const user = LEGACY_CREDENTIALS.find((cred) => cred.email === credentials.email)

        if (!user) {
          await verifyPassword(credentials.password, DUMMY_PASSWORD_HASH) // Timing-safe fallback when user lookup fails
          console.warn('⚠️ Credentials login rejected')
          return null
        }

        const isValid = await verifyPassword(credentials.password, user.passwordHash)

        if (!isValid) {
          console.warn('⚠️ Credentials login rejected')
          return null
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
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
