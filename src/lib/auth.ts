/**
 * Authentication configuration for VibeCode WebGUI
 * Supports GitHub, Google OAuth, and JWT-based sessions
 */

import { NextAuthOptions } from 'next-auth'
import GithubProvider from 'next-auth/providers/github'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { logger } from '@/lib/logger';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
// import { PrismaAdapter } from '@next-auth/prisma-adapter'
// import { prisma } from './prisma'

const scryptAsync = promisify(scrypt);

/**
 * Hash a password using scrypt
 * @param password - Plain text password
 * @returns Hashed password in format: salt.hash
 */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}.${derivedKey.toString('hex')}`;
}

/**
 * Verify a password against a hash
 * @param password - Plain text password
 * @param hash - Stored hash in format: salt.hash
 * @returns True if password matches
 */
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, key] = hash.split('.');
  const keyBuffer = Buffer.from(key, 'hex');
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return timingSafeEqual(keyBuffer, derivedKey);
}

/**
 * Load test users from environment variables (development only)
 * Format: JSON array of { email, passwordHash, name, role, id }
 */
function getTestUsers() {
  if (process.env.NODE_ENV !== 'development') {
    return [];
  }

  try {
    const testUsersJson = process.env.AUTH_TEST_USERS;
    if (!testUsersJson) {
      logger.warn('AUTH_TEST_USERS not configured - credentials auth disabled');
      return [];
    }
    return JSON.parse(testUsersJson);
  } catch (error) {
    logger.error('Failed to parse AUTH_TEST_USERS:', { error: error instanceof Error ? error.message : String(error) });
    return [];
  }
}

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
        if (!credentials?.email || !credentials?.password) {
          logger.warn('Missing email or password');
          return null;
        }

        // Load test users from environment (development only)
        const testUsers = getTestUsers();

        // Find user by email
        const user = testUsers.find((u: any) => u.email === credentials.email);

        if (!user) {
          logger.warn(`User not found: ${credentials.email}`);
          return null;
        }

        // Verify password using secure hash comparison
        try {
          const isValid = await verifyPassword(credentials.password, user.passwordHash);

          if (isValid) {
            logger.info(`Authentication successful: ${user.email}`);
            return {
              id: user.id,
              name: user.name,
              email: user.email,
              role: user.role
            };
          } else {
            logger.warn(`Invalid password for: ${credentials.email}`);
            return null;
          }
        } catch (error) {
          logger.error('Password verification error:', { error: error instanceof Error ? error.message : String(error) });
          return null;
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
      logger.info('JWT callback:', {
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
        logger.info('JWT token updated with user:', { id: token.id, role: token.role })
      }
      return token
    },
    async session({ session, token }) {
      logger.info('Session callback:', {
        hasSession: !!session,
        hasToken: !!token,
        tokenId: token?.id,
        sessionUserId: session?.user?.id
      })

      if (token) {
        session.user.id = (token.id as string) ?? ''
        session.user.role = (token.role as string) ?? 'user'
        session.user.email = (token.email as string) ?? ''
        session.user.name = (token.name as string) ?? ''
        logger.info('Session updated with token:', { id: session.user.id, role: session.user.role })
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

// Export password utilities for generating hashes (dev/test setup only)
export { hashPassword, verifyPassword };
