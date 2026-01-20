// Mock auth configuration for testing
// NOTE: For unit tests of auth.ts itself, use jest.unmock('@/lib/auth') in your test file

/**
 * SECURITY FIX: Removed hardcoded plaintext passwords
 *
 * Tests should now use environment-based auth configuration.
 * Set AUTH_TEST_USERS in your test environment or use mocked credentials.
 *
 * Example test setup:
 *   process.env.AUTH_TEST_USERS = JSON.stringify([
 *     { id: 'test-admin', email: 'admin@example.test',
 *       passwordHash: '...', name: 'Admin', role: 'admin' }
 *   ]);
 */

export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET || 'test-secret',
  providers: [
    {
      id: 'github',
      name: 'GitHub',
      type: 'oauth',
      profile: (profile: any) => ({
        id: profile.id.toString(),
        name: profile.name || profile.login,
        email: profile.email,
        image: profile.avatar_url,
        role: 'user',
        githubId: profile.id.toString(),
      }),
    },
    {
      id: 'google',
      name: 'Google',
      type: 'oauth',
      profile: (profile: any) => ({
        id: profile.sub,
        name: profile.name,
        email: profile.email,
        image: profile.picture,
        role: 'user',
        googleId: profile.sub,
      }),
    },
    {
      id: 'credentials',
      name: 'Credentials',
      type: 'credentials',
      authorize: async (credentials: Record<string, string>) => {
        if (!credentials?.email || !credentials?.password) return null

        // For unit/integration tests, mock successful authentication
        // Real tests should use AUTH_TEST_USERS environment variable
        // or mock the entire auth module

        // Simple test user for mocked scenarios
        if (credentials.email === 'test@example.test' && credentials.password === 'test-password') {
          return {
            id: 'test-user-id',
            name: 'Test User',
            email: 'test@example.test',
            role: 'user'
          };
        }

        return null;
      },
    },
  ],
  session: { strategy: 'jwt' as const },
  pages: {
    signIn: '/auth/signin',
    signOut: '/auth/signout',
    error: '/auth/error',
    verifyRequest: '/auth/verify-request',
    newUser: '/auth/new-user',
  },
  callbacks: {
    async jwt({ token, user, account }: any) {
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
    async session({ session, token }: any) {
      if (token) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.email = token.email as string
        session.user.name = token.name as string
      }
      return session
    },
    async signIn() {
      return true
    },
    async redirect({ url, baseUrl }: any) {
      if (url.startsWith('/')) return `${baseUrl}${url}`
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  events: {
    async signIn({ user, account }: any) {
      console.log(`User ${user.email} signed in via ${account?.provider}`)
    },
    async signOut({ token }: any) {
      console.log(`User ${token?.email} signed out`)
    },
  },
  debug: process.env.NODE_ENV === 'development',
}