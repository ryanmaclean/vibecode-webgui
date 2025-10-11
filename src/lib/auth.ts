/**
 * Authentication configuration for VibeCode WebGUI
 * Supports GitHub, Google OAuth, and JWT-based sessions
 */

import { NextAuthOptions } from 'next-auth'
import GithubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'

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

<<<<<<< HEAD
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
=======
declare module 'next-auth/jwt' {
  interface JWT {
    id?: string | null;
    role?: string | null;
    githubId?: string;
    googleId?: string;
    email?: string | null;
    name?: string | null;
  }
>>>>>>> merge-conflict-cleanup
}

console.log('✅ NEXTAUTH_SECRET validation passed: secure secret configured')

<<<<<<< HEAD
/**
 * SECURITY FIX: Hardcoded credentials removed
 * 
 * Previous implementation had 10 hardcoded accounts with predictable passwords.
 * This was a CRITICAL security vulnerability (CWE-798).
 * 
 * Credentials provider disabled until proper database-backed authentication
 * with bcrypt password hashing is implemented.
 * 
 * See issue #438 for implementation plan.
 * Use OAuth providers (GitHub, Google) for authentication.
 */

// Build providers dynamically so missing OAuth credentials do not break local auth flows.
const providers: NextAuthOptions['providers'] = []

if (process.env.GITHUB_ID && process.env.GITHUB_SECRET) {
  providers.push(
=======
export const authOptions: NextAuthOptions = {
  // adapter: PrismaAdapter(prisma), // Disabled for file-based development
  secret: process.env.NEXTAUTH_SECRET,
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
  providers: [
>>>>>>> merge-conflict-cleanup
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
<<<<<<< HEAD
    })
  )
} else if (process.env.NODE_ENV !== 'production') {
  console.warn('Google OAuth provider disabled: missing GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET env vars')
}

/**
 * Credentials provider DISABLED for security
 * 
 * Previous implementation used hardcoded passwords (CRITICAL vulnerability).
 * 
 * TODO (#438): Implement database-backed authentication with:
 * - bcrypt/argon2 password hashing
 * - Proper user management
 * - Password reset flow
 * - Account lockout after failed attempts
 * 
 * Until then, use OAuth providers (GitHub, Google) for authentication.
 */

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
=======
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('🔐 NextAuth authorize called with:', credentials);
        if (!credentials) {
          console.log('❌ No credentials provided');
          return null;
        }

        // Simple validation for testing
        if (credentials.email === 'developer@vibecode.dev' && credentials.password === 'dev123') {
          console.log('✅ User authenticated successfully:', credentials.email);
          return { 
            id: '2', 
            name: 'Developer User', 
            email: 'developer@vibecode.dev', 
            role: 'developer' 
          }
        } else {
          console.log('❌ Authentication failed for:', credentials.email);
          return null
        }
      },
    }),
  ],
>>>>>>> merge-conflict-cleanup
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
