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
    id?: string | null;
    role?: string | null;
    githubId?: string;
    googleId?: string;
    email?: string | null;
    name?: string | null;
  }
}

// Build providers array conditionally
const providers: any[] = [];

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
    })
  );
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
    })
  );
}

// Credentials Provider (for testing)
providers.push(
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
        return null;
      }
    },
  })
);

// NextAuth configuration
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
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
