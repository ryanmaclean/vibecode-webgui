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
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: false, // Set to false for localhost development
        domain: undefined // Remove domain for localhost
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
          role: 'user',
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
          role: 'user',
          googleId: profile.sub,
        }
      },
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Development-only credential check (disabled in production)
        const isDevelopment = process.env.NODE_ENV === 'development'
        
        if (!isDevelopment) {
          return null
        }

        // Development test users - all 10 accounts
        const testUsers = [
          {
            id: '1',
            email: 'admin@vibecode.dev',
            password: 'admin123',
            name: 'VibeCode Admin',
            role: 'admin',
          },
          {
            id: '2',
            email: 'developer@vibecode.dev',
            password: 'dev123',
            name: 'Sarah Johnson',
            role: 'user',
          },
          {
            id: '3',
            email: 'frontend@vibecode.dev',
            password: 'frontend123',
            name: 'Michael Chen',
            role: 'user',
          },
          {
            id: '4',
            email: 'backend@vibecode.dev',
            password: 'backend123',
            name: 'Emily Rodriguez',
            role: 'user',
          },
          {
            id: '5',
            email: 'fullstack@vibecode.dev',
            password: 'fullstack123',
            name: 'David Kim',
            role: 'user',
          },
          {
            id: '6',
            email: 'designer@vibecode.dev',
            password: 'design123',
            name: 'Jessica Taylor',
            role: 'user',
          },
          {
            id: '7',
            email: 'tester@vibecode.dev',
            password: 'test123',
            name: 'Robert Wilson',
            role: 'user',
          },
          {
            id: '8',
            email: 'devops@vibecode.dev',
            password: 'devops123',
            name: 'Amanda Garcia',
            role: 'user',
          },
          {
            id: '9',
            email: 'intern@vibecode.dev',
            password: 'intern123',
            name: 'James Martinez',
            role: 'user',
          },
          {
            id: '10',
            email: 'lead@vibecode.dev',
            password: 'lead123',
            name: 'Lisa Thompson',
            role: 'admin',
          },
        ]

        // Find matching user
        const user = testUsers.find(u => 
          u.email === credentials.email && u.password === credentials.password
        )

        if (user) {
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          }
        }

        return null
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
  },
  callbacks: {
    async jwt({ token, user, account }) {
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
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.email = token.email
        session.user.name = token.name
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
