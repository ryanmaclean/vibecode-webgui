/**
 * Authentication configuration for VibeCode WebGUI
 * Supports GitHub, Google OAuth, and JWT-based sessions
 */

import { NextAuthOptions } from 'next-auth'
import GithubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
// // // import { logger } from '@/lib/logger'
import { loadSecret } from '@/lib/security/macos-keychain-server'
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

// Load secrets from Keychain with fallback to environment variables
async function loadAuthSecrets() {
  return {
    nextAuthSecret: await loadSecret('NEXTAUTH_SECRET') || process.env.NEXTAUTH_SECRET,
    githubId: await loadSecret('GITHUB_ID') || process.env.GITHUB_ID,
    githubSecret: await loadSecret('GITHUB_SECRET') || process.env.GITHUB_SECRET,
    googleClientId: await loadSecret('GOOGLE_CLIENT_ID') || process.env.GOOGLE_CLIENT_ID,
    googleClientSecret: await loadSecret('GOOGLE_CLIENT_SECRET') || process.env.GOOGLE_CLIENT_SECRET,
    cookieDomain: process.env.COOKIE_DOMAIN,
    nodeEnv: process.env.NODE_ENV
  }
}

// Create auth options with async secret loading
export async function createAuthOptions(): Promise<NextAuthOptions> {
  const secrets = await loadAuthSecrets()
  
  return {
    // adapter: PrismaAdapter(prisma), // Disabled for file-based development
    secret: secrets.nextAuthSecret,
    cookies: {
      sessionToken: {
        name: `__Secure-next-auth.session-token`,
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: secrets.nodeEnv === 'production',
          domain: secrets.nodeEnv === 'production' ? secrets.cookieDomain : undefined
        }
      }
    },
    providers: [
      GithubProvider({
        clientId: secrets.githubId!,
        clientSecret: secrets.githubSecret!,
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
        clientId: secrets.googleClientId!,
        clientSecret: secrets.googleClientSecret!,
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
      // SECURITY NOTE: CredentialsProvider disabled to prevent hardcoded credential vulnerabilities
      // Use GitHub or Google OAuth for secure authentication
      ...(process.env.NODE_ENV === 'development' && process.env.ENABLE_CREDENTIALS_AUTH === 'true' ? [CredentialsProvider({
        name: 'Credentials',
        credentials: {
          email: { label: 'Email', type: 'text' },
          password: { label: 'Password', type: 'password' },
        },
        async authorize(credentials) {
          if (!credentials) return null

          // SECURITY: Hardcoded credentials removed for production security
          // This provider should only be used with proper database authentication
          // Credentials authentication disabled for security reasons
          console.warn('🚨 SECURITY: Credentials provider disabled - hardcoded users removed')
          return null
        },
      })] : []),
    ],
    session: {
      strategy: 'jwt',
      maxAge: secrets.nodeEnv === 'production' ? 60 * 60 * 2 : 60 * 60 * 24, // 2 hours in prod, 24 hours in dev
      updateAge: 60 * 60 // Update session every hour
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
        console.info('🔄 JWT callback:', {
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
        console.info('✅ JWT token updated with user:', { id: token.id, role: token.role })
      }
      return token
    },
    async session({ session, token }) {
      console.info('📋 Session callback:', {
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
        console.info('✅ Session updated with token:', { id: session.user.id, role: session.user.role })
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
      console.info(`User ${user.email} signed in via ${account?.provider}`)
    },
    async signOut({ token }) {
      console.info(`User ${token?.email} signed out`)
    },
  },
  debug: process.env.NODE_ENV === 'development',
}
}

// For backward compatibility, create a synchronous version that loads secrets at startup
let cachedAuthOptions: NextAuthOptions | null = null

export const authOptions: NextAuthOptions = {
  // This will be replaced by the async version when the module loads
  secret: process.env.NEXTAUTH_SECRET || 'fallback-secret',
  providers: [],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt() { return {} },
    async session() { return { user: { id: '', email: '', name: '', role: '' } } },
  },
}

// Initialize auth options asynchronously
createAuthOptions().then(options => {
  cachedAuthOptions = options
  console.info('✅ Auth options loaded with Keychain secrets')
}).catch(error => {
  console.error('❌ Failed to load auth options with Keychain secrets', { error })
})
