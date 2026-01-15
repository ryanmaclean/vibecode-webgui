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
        if (!credentials) return null

        // Mock user database for testing
        const users = [
          { id: 'legacy-admin', email: 'admin@vibecode.dev', password: 'admin123', name: 'Admin User', role: 'admin' },
          { id: 'legacy-developer', email: 'developer@vibecode.dev', password: 'dev123', name: 'Developer User', role: 'developer' },
          { id: 'legacy-lead', email: 'lead@vibecode.dev', password: 'lead123', name: 'Lead User', role: 'lead' },
          { id: 'legacy-frontend', email: 'frontend@vibecode.dev', password: 'frontend123', name: 'Frontend Developer', role: 'developer' },
          { id: 'legacy-backend', email: 'backend@vibecode.dev', password: 'backend123', name: 'Backend Developer', role: 'developer' },
          { id: 'legacy-fullstack', email: 'fullstack@vibecode.dev', password: 'fullstack123', name: 'Fullstack Developer', role: 'developer' },
          { id: 'legacy-designer', email: 'designer@vibecode.dev', password: 'design123', name: 'Designer', role: 'designer' },
          { id: 'legacy-tester', email: 'tester@vibecode.dev', password: 'test123', name: 'QA Tester', role: 'tester' },
          { id: 'legacy-devops', email: 'devops@vibecode.dev', password: 'devops123', name: 'DevOps Engineer', role: 'devops' },
          { id: 'legacy-intern', email: 'intern@vibecode.dev', password: 'intern123', name: 'Intern', role: 'intern' },
          { id: 'legacy-security', email: 'security@vibecode.dev', password: 'security123', name: 'Security Engineer', role: 'security' },
        ]

        const user = users.find(u => u.email === credentials.email)

        if (user && user.password === credentials.password) {
          return { id: user.id, name: user.name, email: user.email, role: user.role }
        } else {
          return null
        }
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