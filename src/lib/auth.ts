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

        // In a real app, you'd look up the user from a database
        // This is a mock implementation for development
        const users = [
          { id: '1', email: 'admin@vibecode.dev', password: 'admin123', name: 'Admin User', role: 'admin' },
          { id: '2', email: 'developer@vibecode.dev', password: 'dev123', name: 'Developer User', role: 'developer' },
          { id: '3', email: 'lead@vibecode.dev', password: 'lead123', name: 'Lead User', role: 'lead' },
          { id: '4', email: 'frontend@vibecode.dev', password: 'frontend123', name: 'Frontend Developer', role: 'developer' },
          { id: '5', email: 'backend@vibecode.dev', password: 'backend123', name: 'Backend Developer', role: 'developer' },
          { id: '6', email: 'fullstack@vibecode.dev', password: 'fullstack123', name: 'Fullstack Developer', role: 'developer' },
          { id: '7', email: 'designer@vibecode.dev', password: 'design123', name: 'Designer', role: 'designer' },
          { id: '8', email: 'tester@vibecode.dev', password: 'test123', name: 'QA Tester', role: 'tester' },
          { id: '9', email: 'devops@vibecode.dev', password: 'devops123', name: 'DevOps Engineer', role: 'devops' },
          { id: '10', email: 'intern@vibecode.dev', password: 'intern123', name: 'Intern', role: 'intern' },
        ]

        const user = users.find(u => u.email === credentials.email)

        if (user && user.password === credentials.password) {
          return { id: user.id, name: user.name, email: user.email, role: user.role }
        } else {
          return null
        }
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
        session.user.id = token.id
        session.user.role = token.role
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
