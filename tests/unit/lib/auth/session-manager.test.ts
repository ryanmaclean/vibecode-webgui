/**
 * Unit tests for auth session management
 * Tests NextAuth session callbacks, JWT handling, and session configuration
 */

import { authOptions, hashPassword } from '@/lib/auth'

// Type definitions for NextAuth callbacks
type JWTCallback = (params: {
  token: Record<string, unknown>;
  user?: Record<string, unknown>;
  account?: Record<string, unknown>;
}) => Promise<Record<string, unknown>>;

type SessionCallback = (params: {
  session: Record<string, unknown>;
  token?: Record<string, unknown>;
  user: Record<string, unknown>;
}) => Promise<Record<string, unknown>>;

type EventCallback = (params: Record<string, unknown>) => Promise<void>;

// Mock environment variables
const originalEnv = process.env

// Store hashed passwords for test users (computed once)
let developerPasswordHash: string;
let testUsersJson: string;

describe('Auth Session Management', () => {
  beforeAll(async () => {
    // Pre-compute the password hash for the test user
    developerPasswordHash = await hashPassword('dev123');
    testUsersJson = JSON.stringify([
      {
        id: 'legacy-developer',
        name: 'Developer User',
        email: 'developer@vibecode.dev',
        role: 'developer',
        passwordHash: developerPasswordHash,
      },
    ]);
  });

  beforeEach(() => {
    jest.resetModules()
    process.env = {
      ...originalEnv,
      NEXTAUTH_SECRET: 'test-secret',
      GITHUB_ID: 'test-github-id',
      GITHUB_SECRET: 'test-github-secret',
      GOOGLE_CLIENT_ID: 'test-google-id',
      GOOGLE_CLIENT_SECRET: 'test-google-secret',
      NODE_ENV: 'test',
    }

    // Clear the module cache to ensure fresh import
    try {
      delete require.cache[require.resolve('@/lib/auth')]
    } catch (e) {
      // Ignore if module not in cache
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Session Configuration', () => {
    it('should use JWT session strategy', () => {
      expect(authOptions.session?.strategy).toBe('jwt')
    })

    it('should have session token cookie configured', () => {
      expect(authOptions.cookies?.sessionToken).toBeDefined()
      expect(authOptions.cookies?.sessionToken?.name).toBe('__Secure-next-auth.session-token')
    })

    it('should have secure cookie options in production', () => {
      process.env.NODE_ENV = 'production'

      // Re-import to get updated config
      jest.resetModules()
      const { authOptions: prodAuthOptions } = require('@/lib/auth')

      expect(prodAuthOptions.cookies?.sessionToken?.options?.secure).toBe(true)
      expect(prodAuthOptions.cookies?.sessionToken?.options?.httpOnly).toBe(true)
      expect(prodAuthOptions.cookies?.sessionToken?.options?.sameSite).toBe('lax')
    })

    it('should not require secure cookies in development', () => {
      process.env.NODE_ENV = 'development'

      jest.resetModules()
      const { authOptions: devAuthOptions } = require('@/lib/auth')

      expect(devAuthOptions.cookies?.sessionToken?.options?.secure).toBe(false)
    })

    it('should set cookie domain in production when COOKIE_DOMAIN is set', () => {
      process.env.NODE_ENV = 'production'
      process.env.COOKIE_DOMAIN = '.vibecode.dev'

      jest.resetModules()
      const { authOptions: prodAuthOptions } = require('@/lib/auth')

      expect(prodAuthOptions.cookies?.sessionToken?.options?.domain).toBe('.vibecode.dev')
    })

    it('should not set cookie domain in development', () => {
      process.env.NODE_ENV = 'development'
      process.env.COOKIE_DOMAIN = '.vibecode.dev'

      jest.resetModules()
      const { authOptions: devAuthOptions } = require('@/lib/auth')

      expect(devAuthOptions.cookies?.sessionToken?.options?.domain).toBeUndefined()
    })

    it('should set cookie path to root', () => {
      expect(authOptions.cookies?.sessionToken?.options?.path).toBe('/')
    })

    it('should have httpOnly cookie to prevent XSS', () => {
      expect(authOptions.cookies?.sessionToken?.options?.httpOnly).toBe(true)
    })

    it('should use lax sameSite policy for CSRF protection', () => {
      expect(authOptions.cookies?.sessionToken?.options?.sameSite).toBe('lax')
    })
  })

  describe('JWT Callback', () => {
    it('should populate token with user data on sign in', async () => {
      const jwtCallback = authOptions.callbacks?.jwt as JWTCallback
      expect(jwtCallback).toBeDefined()

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'developer',
      }

      const mockAccount = {
        provider: 'credentials',
      }

      const token = await jwtCallback({
        token: {},
        user: mockUser,
        account: mockAccount,
      })

      expect(token.id).toBe('user-123')
      expect(token.email).toBe('test@example.com')
      expect(token.name).toBe('Test User')
      expect(token.role).toBe('developer')
    })

    it('should preserve existing token when user is not provided', async () => {
      const jwtCallback = authOptions.callbacks?.jwt as JWTCallback

      const existingToken = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'developer',
      }

      const token = await jwtCallback({
        token: existingToken,
      })

      expect(token).toEqual(existingToken)
    })

    it('should add githubId to token for GitHub provider', async () => {
      const jwtCallback = authOptions.callbacks?.jwt as JWTCallback

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        githubId: 'github-123',
      }

      const mockAccount = {
        provider: 'github',
      }

      const token = await jwtCallback({
        token: {},
        user: mockUser,
        account: mockAccount,
      })

      expect(token.githubId).toBe('github-123')
    })

    it('should add googleId to token for Google provider', async () => {
      const jwtCallback = authOptions.callbacks?.jwt as JWTCallback

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        googleId: 'google-123',
      }

      const mockAccount = {
        provider: 'google',
      }

      const token = await jwtCallback({
        token: {},
        user: mockUser,
        account: mockAccount,
      })

      expect(token.googleId).toBe('google-123')
    })

    it('should not add provider IDs for credentials provider', async () => {
      const jwtCallback = authOptions.callbacks?.jwt as JWTCallback

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'developer',
      }

      const mockAccount = {
        provider: 'credentials',
      }

      const token = await jwtCallback({
        token: {},
        user: mockUser,
        account: mockAccount,
      })

      expect(token.githubId).toBeUndefined()
      expect(token.googleId).toBeUndefined()
    })

    it('should handle missing account provider gracefully', async () => {
      const jwtCallback = authOptions.callbacks?.jwt as JWTCallback

      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      }

      const token = await jwtCallback({
        token: {},
        user: mockUser,
      })

      expect(token.id).toBe('user-123')
      expect(token.email).toBe('test@example.com')
    })
  })

  describe('Session Callback', () => {
    it('should populate session with token data', async () => {
      const sessionCallback = authOptions.callbacks?.session as SessionCallback
      expect(sessionCallback).toBeDefined()

      const mockToken = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'developer',
      }

      const mockSession = {
        user: {
          id: '',
          email: '',
          name: '',
          role: '',
        },
        expires: '2024-12-31',
      }

      const session = await sessionCallback({
        session: mockSession,
        token: mockToken,
        user: {},
      })

      expect(session.user.id).toBe('user-123')
      expect(session.user.email).toBe('test@example.com')
      expect(session.user.name).toBe('Test User')
      expect(session.user.role).toBe('developer')
    })

    it('should default role to user when not provided in token', async () => {
      const sessionCallback = authOptions.callbacks?.session as SessionCallback

      const mockToken = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
      }

      const mockSession = {
        user: {
          id: '',
          email: '',
          name: '',
          role: '',
        },
        expires: '2024-12-31',
      }

      const session = await sessionCallback({
        session: mockSession,
        token: mockToken,
        user: {},
      })

      expect(session.user.role).toBe('user')
    })

    it('should default empty strings when token values are missing', async () => {
      const sessionCallback = authOptions.callbacks?.session as SessionCallback

      const mockToken = {}

      const mockSession = {
        user: {
          id: '',
          email: '',
          name: '',
          role: '',
        },
        expires: '2024-12-31',
      }

      const session = await sessionCallback({
        session: mockSession,
        token: mockToken,
        user: {},
      })

      expect(session.user.id).toBe('')
      expect(session.user.email).toBe('')
      expect(session.user.name).toBe('')
      expect(session.user.role).toBe('user')
    })

    it('should preserve other session properties', async () => {
      const sessionCallback = authOptions.callbacks?.session as SessionCallback

      const mockToken = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'developer',
      }

      const mockSession = {
        user: {
          id: '',
          email: '',
          name: '',
          role: '',
        },
        expires: '2024-12-31',
        customProperty: 'custom-value',
      }

      const session = await sessionCallback({
        session: mockSession,
        token: mockToken,
        user: {},
      })

      expect(session.expires).toBe('2024-12-31')
      expect((session as any).customProperty).toBe('custom-value')
    })

    it('should handle null token gracefully', async () => {
      const sessionCallback = authOptions.callbacks?.session as SessionCallback

      const mockSession = {
        user: {
          id: '',
          email: '',
          name: '',
          role: '',
        },
        expires: '2024-12-31',
      }

      const session = await sessionCallback({
        session: mockSession,
        token: undefined,
        user: {},
      })

      expect(session.user.id).toBe('')
      expect(session.user.email).toBe('')
      expect(session.user.name).toBe('')
      expect(session.user.role).toBe('user')
    })
  })

  describe('Session Events', () => {
    it('should have signIn event handler', () => {
      expect(authOptions.events?.signIn).toBeDefined()
      expect(typeof authOptions.events?.signIn).toBe('function')
    })

    it('should have signOut event handler', () => {
      expect(authOptions.events?.signOut).toBeDefined()
      expect(typeof authOptions.events?.signOut).toBe('function')
    })

    it('should execute signIn event without errors', async () => {
      const signInEvent = authOptions.events?.signIn as EventCallback

      const mockParams = {
        user: {
          email: 'test@example.com',
          id: 'user-123',
        },
        account: {
          provider: 'github',
        },
      }

      await expect(signInEvent(mockParams)).resolves.toBeUndefined()
    })

    it('should execute signOut event without errors', async () => {
      const signOutEvent = authOptions.events?.signOut as EventCallback

      const mockParams = {
        token: {
          email: 'test@example.com',
        },
      }

      await expect(signOutEvent(mockParams)).resolves.toBeUndefined()
    })
  })

  describe('Session Integration', () => {
    it('should create complete session from user through JWT and session callbacks', async () => {
      const jwtCallback = authOptions.callbacks?.jwt as JWTCallback
      const sessionCallback = authOptions.callbacks?.session as SessionCallback

      // Step 1: User signs in, JWT callback creates token
      const mockUser = {
        id: 'user-123',
        email: 'developer@example.com',
        name: 'Developer User',
        role: 'developer',
      }

      const mockAccount = {
        provider: 'credentials',
      }

      const token = await jwtCallback({
        token: {},
        user: mockUser,
        account: mockAccount,
      })

      // Step 2: Session callback creates session from token
      const mockSession = {
        user: {
          id: '',
          email: '',
          name: '',
          role: '',
        },
        expires: '2024-12-31',
      }

      const session = await sessionCallback({
        session: mockSession,
        token: token,
        user: {},
      })

      // Verify complete session
      expect(session.user.id).toBe('user-123')
      expect(session.user.email).toBe('developer@example.com')
      expect(session.user.name).toBe('Developer User')
      expect(session.user.role).toBe('developer')
    })

    it('should maintain session across multiple session callback invocations', async () => {
      const jwtCallback = authOptions.callbacks?.jwt as JWTCallback
      const sessionCallback = authOptions.callbacks?.session as SessionCallback

      // Create initial token
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
      }

      const token = await jwtCallback({
        token: {},
        user: mockUser,
      })

      // First session callback
      const mockSession1 = {
        user: {
          id: '',
          email: '',
          name: '',
          role: '',
        },
        expires: '2024-12-31',
      }

      const session1 = await sessionCallback({
        session: mockSession1,
        token: token,
        user: {},
      })

      // Second session callback (token refresh scenario)
      const mockSession2 = {
        user: {
          id: '',
          email: '',
          name: '',
          role: '',
        },
        expires: '2024-12-31',
      }

      const session2 = await sessionCallback({
        session: mockSession2,
        token: token,
        user: {},
      })

      // Both sessions should have same data
      expect(session1.user).toEqual(session2.user)
    })

    it('should handle GitHub OAuth session flow', async () => {
      const jwtCallback = authOptions.callbacks?.jwt as JWTCallback
      const sessionCallback = authOptions.callbacks?.session as SessionCallback

      const mockGitHubUser = {
        id: 'user-github-123',
        email: 'github@example.com',
        name: 'GitHub User',
        role: 'user',
        githubId: 'gh-123456',
      }

      const mockAccount = {
        provider: 'github',
      }

      // JWT callback
      const token = await jwtCallback({
        token: {},
        user: mockGitHubUser,
        account: mockAccount,
      })

      expect(token.githubId).toBe('gh-123456')

      // Session callback
      const mockSession = {
        user: {
          id: '',
          email: '',
          name: '',
          role: '',
        },
        expires: '2024-12-31',
      }

      const session = await sessionCallback({
        session: mockSession,
        token: token,
        user: {},
      })

      expect(session.user.email).toBe('github@example.com')
      expect(session.user.name).toBe('GitHub User')
    })

    it('should handle Google OAuth session flow', async () => {
      const jwtCallback = authOptions.callbacks?.jwt as JWTCallback
      const sessionCallback = authOptions.callbacks?.session as SessionCallback

      const mockGoogleUser = {
        id: 'user-google-123',
        email: 'google@example.com',
        name: 'Google User',
        role: 'user',
        googleId: 'google-123456',
      }

      const mockAccount = {
        provider: 'google',
      }

      // JWT callback
      const token = await jwtCallback({
        token: {},
        user: mockGoogleUser,
        account: mockAccount,
      })

      expect(token.googleId).toBe('google-123456')

      // Session callback
      const mockSession = {
        user: {
          id: '',
          email: '',
          name: '',
          role: '',
        },
        expires: '2024-12-31',
      }

      const session = await sessionCallback({
        session: mockSession,
        token: token,
        user: {},
      })

      expect(session.user.email).toBe('google@example.com')
      expect(session.user.name).toBe('Google User')
    })
  })

  describe('Session Security', () => {
    it('should have secret configured for signing session tokens', () => {
      expect(authOptions.secret).toBeDefined()
      expect(authOptions.secret).toBe('test-secret')
    })

    it('should require httpOnly cookies to prevent client-side access', () => {
      const cookieOptions = authOptions.cookies?.sessionToken?.options
      expect(cookieOptions?.httpOnly).toBe(true)
    })

    it('should use sameSite lax for CSRF protection', () => {
      const cookieOptions = authOptions.cookies?.sessionToken?.options
      expect(cookieOptions?.sameSite).toBe('lax')
    })

    it('should use secure cookies in production', () => {
      process.env.NODE_ENV = 'production'

      jest.resetModules()
      const { authOptions: prodAuthOptions } = require('@/lib/auth')

      const cookieOptions = prodAuthOptions.cookies?.sessionToken?.options
      expect(cookieOptions?.secure).toBe(true)
    })

    it('should use JWT strategy to avoid server-side session storage', () => {
      expect(authOptions.session?.strategy).toBe('jwt')
    })
  })
})
