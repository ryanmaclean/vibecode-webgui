// Mock auth configuration for testing
// NOTE: For unit tests of auth.ts itself, use jest.unmock('@/lib/auth') in your test file
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
        // SECURITY: Credentials provider disabled in production (see src/lib/auth.ts)
        // This mock is for testing OAuth flows only - credentials auth returns null
        // Previously contained legacy plaintext passwords which were removed for security
        console.warn('Mock credentials provider called - credentials auth is disabled')
        return null
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