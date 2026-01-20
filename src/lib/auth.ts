/**
 * Authentication configuration for VibeCode WebGUI
 * Supports GitHub, Google OAuth, and JWT-based sessions
 */

import { NextAuthOptions } from 'next-auth'
import GithubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { logger } from '@/lib/logger';
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
    id: string
    role: string
    githubId?: string
    googleId?: string
  }
}

// NextAuth configuration is properly loaded

export const authOptions: NextAuthOptions = {
  // adapter: PrismaAdapter(prisma), // Disabled for file-based development
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined
      }
    }
  },
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: profile.name || profile.login,
          email: profile.email,
          image: profile.avatar_url,
          role: 'user', // Default role
          githubId: profile.id.toString(),
        }
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          role: 'user', // Default role
          googleId: profile.sub,
        }
      },
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials) return null

        // SECURITY WARNING: This credential provider is disabled for security reasons.
        // Previously contained hardcoded plaintext passwords which is a critical security vulnerability.
        //
        // To enable credential-based authentication:
        // 1. Set up a proper database with Prisma adapter (uncomment PrismaAdapter above)
        // 2. Use bcrypt/argon2 for password hashing
        // 3. Implement proper user registration and password reset flows
        // 4. Never store plaintext passwords
        //
        // For development, use GitHub or Google OAuth providers instead.

        logger.warn('Credentials provider called but is disabled for security. Use OAuth providers instead.')
        return null
      },
    }),
  ],
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
      logger.info('🔄 JWT callback:', {
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
        logger.info('✅ JWT token updated with user:', { id: token.id, role: token.role })
      }
      return token
    },
    async session({ session, token }) {
      logger.info('📋 Session callback:', {
        hasSession: !!session,
        hasToken: !!token,
        tokenId: token?.id,
        sessionUserId: session?.user?.id
      })

      if (token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.email = token.email as string
        session.user.name = token.name as string
        logger.info('✅ Session updated with token:', { id: session.user.id, role: session.user.role })
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
      logger.info(`User ${user.email} signed in via ${account?.provider}`)
    },
    async signOut({ token }) {
      logger.info(`User ${token?.email} signed out`)
    },
  },
  debug: process.env.NODE_ENV === 'development',
}
