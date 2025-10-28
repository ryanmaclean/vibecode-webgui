/**
 * Unit tests for auth.ts configuration
 * Tests NextAuth configuration and providers
 */

import { authOptions } from '@/lib/auth'

// Type definitions for NextAuth providers and callbacks
type CredentialsProvider = {
  id: string;
  name: string;
  options?: {
    authorize?: (credentials: unknown) => Promise<unknown>;
  };
  authorize?: (credentials: unknown) => Promise<unknown>;
};

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

type SignInCallback = (params: {
  user: Record<string, unknown>;
  account: Record<string, unknown>;
  profile?: Record<string, unknown>;
  email?: Record<string, unknown>;
  credentials?: Record<string, unknown>;
}) => Promise<boolean>;

type EventCallback = (params: Record<string, unknown>) => Promise<void>;

// Mock environment variables
const originalEnv = process.env

describe('auth.ts Configuration', () => {
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
    delete require.cache[require.resolve('../auth')]
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('Configuration Structure', () => {
    it('should export authOptions object', () => {
      expect(authOptions).toBeDefined()
      expect(typeof authOptions).toBe('object')
    })

    it('should have required configuration properties', () => {
      expect(authOptions).toHaveProperty('providers')
      expect(authOptions).toHaveProperty('session')
      expect(authOptions).toHaveProperty('pages')
      expect(authOptions).toHaveProperty('callbacks')
      expect(authOptions).toHaveProperty('events')
      expect(authOptions).toHaveProperty('debug')
    })

    it('should have JWT session strategy', () => {
      expect(authOptions.session?.strategy).toBe('jwt')
    })

    it('should have correct page configurations', () => {
      expect(authOptions.pages?.signIn).toBe('/auth/signin')
      expect(authOptions.pages?.signOut).toBe('/auth/signout')
      expect(authOptions.pages?.error).toBe('/auth/error')
      expect(authOptions.pages?.verifyRequest).toBe('/auth/verify-request')
      expect(authOptions.pages?.newUser).toBe('/auth/new-user')
    })

    it('should have debug enabled in development', () => {
      expect(authOptions.debug).toBe(false) // NODE_ENV is 'test'
    })
  })

  describe('Providers Configuration', () => {
    it('should have three providers configured', () => {
      expect(authOptions.providers).toHaveLength(3)
    })

    it('should have GitHub provider configured', () => {
      const githubProvider = authOptions.providers?.find(
        provider => provider.id === 'github'
      )
      expect(githubProvider).toBeDefined()
      expect(githubProvider?.name).toBe('GitHub')
    })

    it('should have Google provider configured', () => {
      const googleProvider = authOptions.providers?.find(
        provider => provider.id === 'google'
      )
      expect(googleProvider).toBeDefined()
      expect(googleProvider?.name).toBe('Google')
    })

    it('should have Credentials provider configured', () => {
      const credentialsProvider = authOptions.providers?.find(
        provider => provider.id === 'credentials'
      )
      expect(credentialsProvider).toBeDefined()
      expect(credentialsProvider?.name).toBe('Credentials')
    })
  })

  describe('Credentials Provider Authorization', () => {
    it('should authorize valid credentials', async () => {
      const credentialsProvider = authOptions.providers?.find(
        provider => provider.id === 'credentials'
      ) as any

      const credentials = {
        email: 'developer@vibecode.dev',
        password: 'dev123',
      }

      // Access the authorize function from the provider options
      const authorizeFunction = credentialsProvider.options?.authorize || credentialsProvider.authorize
      const result = await authorizeFunction(credentials)

      expect(result).toEqual({
        id: '2',
        name: 'Developer User',
        email: 'developer@vibecode.dev',
        role: 'developer',
      })
    })

    it('should reject invalid credentials', async () => {
      const credentialsProvider = authOptions.providers?.find(
        provider => provider.id === 'credentials'
      ) as any

      const credentials = {
        email: 'invalid@example.com',
        password: 'wrongpassword',
      }

      const authorizeFunction = credentialsProvider.options?.authorize || credentialsProvider.authorize
      const result = await authorizeFunction(credentials)

      expect(result).toBeNull()
    })

    it('should handle missing credentials', async () => {
      const credentialsProvider = authOptions.providers?.find(
        provider => provider.id === 'credentials'
      ) as any

      const authorizeFunction = credentialsProvider.options?.authorize || credentialsProvider.authorize
      const result = await authorizeFunction(null)

      expect(result).toBeNull()
    })

    it('should handle undefined credentials', async () => {
      const credentialsProvider = authOptions.providers?.find(
        provider => provider.id === 'credentials'
      ) as any

      const authorizeFunction = credentialsProvider.options?.authorize || credentialsProvider.authorize
      const result = await authorizeFunction(undefined)

      expect(result).toBeNull()
    })
  })

  describe('JWT Callback', () => {
    it('should update token with user data on first login', async () => {
      const jwtCallback = authOptions.callbacks?.jwt

      const mockToken = {
        id: '',
        role: '',
      }
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        githubId: 'github-123',
      }
      const mockAccount = {
        provider: 'github',
        type: 'oauth' as const,
        providerAccountId: 'provider-account-id',
        access_token: 'access-token',
      }

      const result = await (jwtCallback as any)!({
        token: mockToken,
        user: mockUser,
        account: mockAccount,
      })

      expect(result).toEqual({
        id: 'user-123',
        role: 'user',
        email: 'test@example.com',
        name: 'Test User',
        githubId: 'github-123',
      })
    })

    it('should preserve existing token data on subsequent calls', async () => {
      const jwtCallback = authOptions.callbacks?.jwt

      const mockToken = {
        id: 'user-123',
        role: 'user',
        email: 'test@example.com',
        name: 'Test User',
      }

      const result = await (jwtCallback as any)!({
        token: mockToken,
        user: undefined,
        account: undefined,
      })

      expect(result).toEqual(mockToken)
    })

    it('should handle Google OAuth provider', async () => {
      const jwtCallback = authOptions.callbacks?.jwt

      const mockToken = { id: '', role: '' }
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        googleId: 'google-123',
      }
      const mockAccount = {
        provider: 'google',
        type: 'oauth' as const,
        providerAccountId: 'provider-account-id',
        access_token: 'access-token',
      }

      const result = await (jwtCallback as any)!({
        token: mockToken,
        user: mockUser,
        account: mockAccount,
      })

      expect(result).toEqual({
        id: 'user-123',
        role: 'user',
        email: 'test@example.com',
        name: 'Test User',
        googleId: 'google-123',
      })
    })
  })

  describe('Session Callback', () => {
    it('should update session with token data', async () => {
      const sessionCallback = authOptions.callbacks?.session

      const mockSession = {
        user: {
          id: '',
          email: '',
          name: '',
          image: '',
          role: '',
        },
        expires: '2024-12-31T23:59:59.999Z',
      }
      const mockToken = {
        id: 'user-123',
        role: 'user',
        email: 'test@example.com',
        name: 'Test User',
      }

      const result = await (sessionCallback as any)!({
        session: mockSession,
        token: mockToken,
        user: { id: 'user-123', email: 'test@example.com', name: 'Test User', role: 'user', emailVerified: null },
      })

      expect(result.user).toEqual({
        id: 'user-123',
        role: 'user',
        email: 'test@example.com',
        name: 'Test User',
        image: '',
      })
    })

    it('should preserve session data when no token', async () => {
      const sessionCallback = authOptions.callbacks?.session

      const mockSession = {
        user: {
          id: 'existing-id',
          email: 'existing@example.com',
          name: 'Existing User',
          image: 'existing-image.jpg',
          role: 'existing-role',
        },
        expires: '2024-12-31T23:59:59.999Z',
      }

      const result = await (sessionCallback as any)!({
        session: mockSession,
        token: undefined,
        user: { id: 'existing-id', email: 'existing@example.com', name: 'Existing User', role: 'existing-role', emailVerified: null },
      })

      expect(result).toEqual(mockSession)
    })
  })

  describe('SignIn Callback', () => {
    it('should allow all sign-ins', async () => {
      const signInCallback = authOptions.callbacks?.signIn

      const result = await (signInCallback as any)!({
        user: { id: 'user-123', email: 'test@example.com', name: 'Test User', role: 'user' },
        account: { provider: 'github', type: 'oauth', providerAccountId: 'id' },
        profile: { name: 'Test User' },
        email: { verificationRequest: false },
        credentials: { password: 'x' },
      })

      expect(result).toBe(true)
    })
  })

  describe('Redirect Callback', () => {
    it('should handle relative URLs', async () => {
      const redirectCallback = authOptions.callbacks?.redirect

      const result = await redirectCallback!({
        url: '/dashboard',
        baseUrl: 'http://localhost:3000',
      })

      expect(result).toBe('http://localhost:3000/dashboard')
    })

    it('should handle same-origin URLs', async () => {
      const redirectCallback = authOptions.callbacks?.redirect

      const result = await redirectCallback!({
        url: 'http://localhost:3000/profile',
        baseUrl: 'http://localhost:3000',
      })

      expect(result).toBe('http://localhost:3000/profile')
    })

    it('should fallback to baseUrl for external URLs', async () => {
      const redirectCallback = authOptions.callbacks?.redirect

      const result = await redirectCallback!({
        url: 'https://malicious.com/steal',
        baseUrl: 'http://localhost:3000',
      })

      expect(result).toBe('http://localhost:3000')
    })
  })

  describe('Events', () => {
    it('should have signIn event handler', () => {
      expect(authOptions.events?.signIn).toBeDefined()
      expect(typeof authOptions.events?.signIn).toBe('function')
    })

    it('should have signOut event handler', () => {
      expect(authOptions.events?.signOut).toBeDefined()
      expect(typeof authOptions.events?.signOut).toBe('function')
    })

    it('should log signIn events', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      const signInEvent = authOptions.events?.signIn
      if (signInEvent) {
        await (signInEvent as any)({
          user: { email: 'test@example.com' },
          account: { provider: 'github' },
          isNewUser: false,
        })
      }

      expect(consoleSpy).toHaveBeenCalledWith('User test@example.com signed in via github')
      consoleSpy.mockRestore()
    })

    it('should log signOut events', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()
      
      const signOutEvent = authOptions.events?.signOut
      if (signOutEvent) {
        await (signOutEvent as any)({
          token: { email: 'test@example.com' },
        })
      }

      expect(consoleSpy).toHaveBeenCalledWith('User test@example.com signed out')
      consoleSpy.mockRestore()
    })
  })

  describe('Type Safety', () => {
    it('should have proper provider types', () => {
      authOptions.providers?.forEach(provider => {
        expect(provider).toHaveProperty('id')
        expect(provider).toHaveProperty('name')
        expect(typeof provider.id).toBe('string')
        expect(typeof provider.name).toBe('string')
      })
    })

    it('should have correct callback types', () => {
      expect(typeof authOptions.callbacks?.jwt).toBe('function')
      expect(typeof authOptions.callbacks?.session).toBe('function')
      expect(typeof authOptions.callbacks?.signIn).toBe('function')
      expect(typeof authOptions.callbacks?.redirect).toBe('function')
    })
  })
})
