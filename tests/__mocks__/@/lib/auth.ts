// Mock auth configuration for testing
export const authOptions = {
  providers: [
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
  session: { strategy: 'jwt' },
  jwt: { secret: 'test-secret' },
}