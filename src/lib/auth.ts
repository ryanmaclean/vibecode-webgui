/**
 * Authentication configuration for VibeCode WebGUI
 * Supports GitHub, Google OAuth, and JWT-based sessions
 */

import { NextAuthOptions } from 'next-auth'
import GithubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'

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

providers.push(
  CredentialsProvider({
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials) {
          console.log('❌ No credentials provided');
          return null;
        }

        const match = LEGACY_CREDENTIALS.find(
          (cred) => cred.email === credentials.email && cred.password === credentials.password,
        )

        if (!match) {
          console.log('❌ Authentication failed for legacy credential:', credentials.email)
          return null
        }

        console.log('✅ Legacy credential authenticated:', match.email)
        return {
          id: match.id,
          name: match.name,
          email: match.email,
          role: match.role,
        }
      },
    })
)

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
