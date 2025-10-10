/**
 * Authentication configuration for VibeCode WebGUI
 * Supports GitHub, Google OAuth, and JWT-based sessions
 */

import { NextAuthOptions } from 'next-auth'
import GithubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { verifyPassword } from './auth/password'

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

/**
 * SECURITY IMPROVEMENT: Bcrypt-hashed credentials for development
 *
 * Legacy plaintext passwords have been hashed using bcrypt (12 salt rounds).
 * Original plaintext passwords are documented in issue #445 for migration reference.
 *
 * Migration Path:
 * - Development: Use these hashed credentials for local testing
 * - Production: MUST implement database-backed user management
 * - Future: Remove these hardcoded credentials entirely
 *
 * Security Notes:
 * - Hashes generated using src/lib/auth/password.ts (bcrypt 12 rounds)
 * - Timing-safe comparison via bcrypt.compare()
 * - These are STILL hardcoded and should be replaced with DB storage
 *
 * Original plaintext passwords (for migration reference only):
 * - admin@vibecode.dev: admin123
 * - lead@vibecode.dev: lead123
 * - developer@vibecode.dev: dev123
 * - frontend@vibecode.dev: frontend123
 * - backend@vibecode.dev: backend123
 * - fullstack@vibecode.dev: fullstack123
 * - designer@vibecode.dev: design123
 * - tester@vibecode.dev: test123
 * - devops@vibecode.dev: devops123
 * - security@vibecode.dev: security123
 */
type LegacyCredential = {
  email: string
  passwordHash: string
  id: string
  name: string
  role: string
}

const LEGACY_CREDENTIALS: LegacyCredential[] = [
  {
    email: 'admin@vibecode.dev',
    passwordHash: '$2b$12$o3B3dDy4Xds5v8c3owyIb.EnDMPjc8sydwS40suH1S7euPPxkHBoS',
    id: 'legacy-admin',
    name: 'Admin User',
    role: 'admin'
  },
  {
    email: 'lead@vibecode.dev',
    passwordHash: '$2b$12$iPNAY2yVPCIUWw8FLDgWCelt9n9kZrrhM4I1Mya./k5Mdo.7BLdC6',
    id: 'legacy-lead',
    name: 'Lead User',
    role: 'admin'
  },
  {
    email: 'developer@vibecode.dev',
    passwordHash: '$2b$12$oIVjoIKrKwE2wMxdGmrecestrxoBxh4/D3UWu0Do.1u203N.IBukq',
    id: 'legacy-developer',
    name: 'Developer User',
    role: 'developer'
  },
  {
    email: 'frontend@vibecode.dev',
    passwordHash: '$2b$12$cqdZqepcIGazw3NtKwGrxug32c04IRFNMMmM1PEP6xmp1eADK4Pva',
    id: 'legacy-frontend',
    name: 'Frontend User',
    role: 'user'
  },
  {
    email: 'backend@vibecode.dev',
    passwordHash: '$2b$12$0yRkkwkUofkSYqIq424RYOb2S2gdFVKvmjxFvpWUWiQ6Jg6MGEp0C',
    id: 'legacy-backend',
    name: 'Backend User',
    role: 'user'
  },
  {
    email: 'fullstack@vibecode.dev',
    passwordHash: '$2b$12$/zsHmzLXke7H8EIxwiBlYObu4Us.EyK0y1xSOEYdR7F0g76eWd6Ey',
    id: 'legacy-fullstack',
    name: 'Fullstack User',
    role: 'user'
  },
  {
    email: 'designer@vibecode.dev',
    passwordHash: '$2b$12$8OIF710dgfo0sG6d/aAP9.P8qTbZAmFl1LjtDc6P.XjfKG4pj5aKi',
    id: 'legacy-designer',
    name: 'Designer User',
    role: 'user'
  },
  {
    email: 'tester@vibecode.dev',
    passwordHash: '$2b$12$zSBhK7H9FGJCefVZx62GGe8UD8ytQBALoY3B8SAmwiLXRTwTroIrS',
    id: 'legacy-tester',
    name: 'Tester User',
    role: 'user'
  },
  {
    email: 'devops@vibecode.dev',
    passwordHash: '$2b$12$wLRDGU2RgBDC.3NUTZZJOOl1lFCmc22BEnIQJuFp2gaV4Ck7aOLi2',
    id: 'legacy-devops',
    name: 'DevOps User',
    role: 'user'
  },
  {
    email: 'security@vibecode.dev',
    passwordHash: '$2b$12$jeNrJuVKoFwCvyeofzlJT.aS73tz6.PPJfHoem8aL2An.GVlRJD5e',
    id: 'legacy-security',
    name: 'Security User',
    role: 'user'
  },
]

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
        if (!credentials?.email || !credentials?.password) {
          console.log('❌ Authentication failed: missing credentials');
          return null;
        }

        // Find user by email
        const user = LEGACY_CREDENTIALS.find(
          (cred) => cred.email === credentials.email
        )

        if (!user) {
          console.log('❌ Authentication failed: user not found:', credentials.email)
          // Perform dummy hash comparison to prevent timing attacks
          await verifyPassword(credentials.password, '$2b$12$dummy.hash.to.prevent.timing.attack.on.user.enumeration')
          return null
        }

        // Verify password using bcrypt
        const isValid = await verifyPassword(credentials.password, user.passwordHash)

        if (!isValid) {
          console.log('❌ Authentication failed: invalid password for:', credentials.email)
          return null
        }

        console.log('✅ Credential authenticated with bcrypt:', user.email)
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
