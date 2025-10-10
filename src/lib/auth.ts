/**
 * Authentication configuration for VibeCode WebGUI
 * Supports GitHub, Google OAuth, and JWT-based sessions
 */

import { NextAuthOptions } from 'next-auth'
import GithubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
// import { PrismaAdapter } from '@next-auth/prisma-adapter'
// import { prisma } from './prisma'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string
      role: string
    }
  }

  interface User {
    id: string
    email: string
    name: string
    image?: string
    role: string
    githubId?: string
    googleId?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string | null
    role?: string | null
    githubId?: string
    googleId?: string
    email?: string | null
    name?: string | null
  }
}

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
      'See: https://next-auth.js.org/configuration/options#secret',
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
      `See: https://next-auth.js.org/configuration/options#secret`,
  )
}

console.log('✅ NEXTAUTH_SECRET validation passed: secure secret configured')

/**
 * ⚠️ CRITICAL SECURITY WARNING: LEGACY CREDENTIALS REMOVED
 *
 * Hardcoded credentials have been permanently disabled due to critical security vulnerability (CWE-798).
 *
 * SECURITY IMPACT:
 * - 10 accounts with predictable passwords were exposed in source code
 * - Complete authentication bypass was possible with trivial credentials
 * - Admin-level access was available to anyone with source code access
 * - Credentials were visible in git history and could be compromised
 *
 * MIGRATION REQUIRED:
 * This application now requires proper database-backed authentication.
 *
 * To restore authentication functionality:
 * 1. Set up a database (PostgreSQL, MySQL, or MongoDB)
 * 2. Install bcrypt for password hashing: npm install bcrypt @types/bcrypt
 * 3. Implement user model with hashed passwords
 * 4. Update CredentialsProvider to query database and verify hashed passwords
 * 5. Use OAuth providers (GitHub/Google) as configured above
 *
 * Example secure implementation:
 * ```typescript
 * import bcrypt from 'bcrypt'
 * import { getUserByEmail } from '@/lib/db'
 *
 * async authorize(credentials) {
 *   if (!credentials?.email || !credentials?.password) return null
 *
 *   const user = await getUserByEmail(credentials.email)
 *   if (!user || !user.hashedPassword) return null
 *
 *   const isValid = await bcrypt.compare(credentials.password, user.hashedPassword)
 *   if (!isValid) return null
 *
 *   return { id: user.id, email: user.email, name: user.name, role: user.role }
 * }
 * ```
 *
 * DO NOT re-enable hardcoded credentials. This is a critical security vulnerability.
 */

// SECURITY: Legacy credentials array commented out - DO NOT UNCOMMENT
// This was a critical vulnerability (CWE-798: Use of Hard-coded Credentials)
/*
type LegacyCredential = {
  email: string
  password: string
  id: string
  name: string
  role: string
}

const LEGACY_CREDENTIALS: LegacyCredential[] = [
  { email: 'admin@vibecode.dev', password: 'admin123', id: 'legacy-admin', name: 'Admin User', role: 'admin' },
  { email: 'lead@vibecode.dev', password: 'lead123', id: 'legacy-lead', name: 'Lead User', role: 'admin' },
  { email: 'developer@vibecode.dev', password: 'dev123', id: 'legacy-developer', name: 'Developer User', role: 'developer' },
  { email: 'frontend@vibecode.dev', password: 'frontend123', id: 'legacy-frontend', name: 'Frontend User', role: 'user' },
  { email: 'backend@vibecode.dev', password: 'backend123', id: 'legacy-backend', name: 'Backend User', role: 'user' },
  { email: 'fullstack@vibecode.dev', password: 'fullstack123', id: 'legacy-fullstack', name: 'Fullstack User', role: 'user' },
  { email: 'designer@vibecode.dev', password: 'design123', id: 'legacy-designer', name: 'Designer User', role: 'user' },
  { email: 'tester@vibecode.dev', password: 'test123', id: 'legacy-tester', name: 'Tester User', role: 'user' },
  { email: 'devops@vibecode.dev', password: 'devops123', id: 'legacy-devops', name: 'DevOps User', role: 'user' },
  { email: 'security@vibecode.dev', password: 'security123', id: 'legacy-security', name: 'Security User', role: 'user' },
]
*/

// Build providers dynamically so missing OAuth credentials do not break local auth flows.
const providers: NextAuthOptions['providers'] = []

// GitHub Provider
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
    }),
  )
} else if (process.env.NODE_ENV !== 'production') {
  console.warn('GitHub OAuth provider disabled: missing GITHUB_ID/GITHUB_SECRET env vars');
}

// Google Provider
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
    }),
  )
} else if (process.env.NODE_ENV !== 'production') {
  console.warn('Google OAuth provider disabled: missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET env vars')
}

// Credentials provider - requires database implementation
providers.push(
  CredentialsProvider({
    name: 'Credentials',
>>>>>>> Stashed changes
    credentials: {
      email: { label: 'Email', type: 'text' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) {
        console.error('❌ Authentication failed: Missing email or password')
        return null
      }

      // SECURITY: Hardcoded credentials have been removed
      // This provider now requires database-backed authentication
      console.error(
        '🚨 AUTHENTICATION ERROR: Credentials provider not implemented\n\n' +
          'Hardcoded credentials have been removed for security reasons (CWE-798).\n\n' +
          'To enable password-based authentication:\n' +
          '1. Set up a database with user table\n' +
          '2. Install bcrypt: npm install bcrypt @types/bcrypt\n' +
          '3. Implement getUserByEmail() to query database\n' +
          '4. Use bcrypt.compare() to verify hashed passwords\n' +
          '5. Return user object with id, email, name, and role\n\n' +
          'Alternatively, use OAuth providers (GitHub/Google) which are already configured.\n\n' +
          'For immediate access, configure GITHUB_ID/GITHUB_SECRET or GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET.',
      )

      return null
    },
  }),
)

export const authOptions: NextAuthOptions = {
  secret: NEXTAUTH_SECRET,
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
        userId: user?.id,
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
        sessionUserId: session?.user?.id,
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
