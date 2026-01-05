// Mock auth configuration for testing
export const authOptions = {
  providers: [
    {
      id: 'credentials',
      name: 'Credentials',
      type: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials: Record<string, string>) {
        if (!credentials) return null;

        // Mock users for testing
        const users = [
          { id: '1', email: 'admin@vibecode.dev', password: 'admin123', name: 'Admin User', role: 'admin' },
          { id: '2', email: 'developer@vibecode.dev', password: 'dev123', name: 'Developer User', role: 'developer' },
          { id: '3', email: 'lead@vibecode.dev', password: 'lead123', name: 'Lead User', role: 'lead' },
        ];

        const user = users.find(u => u.email === credentials.email);

        if (user && user.password === credentials.password) {
          return { id: user.id, name: user.name, email: user.email, role: user.role };
        } else {
          return null;
        }
      },
    },
    {
      id: 'github',
      name: 'GitHub',
      type: 'oauth',
    },
    {
      id: 'google',
      name: 'Google',
      type: 'oauth',
    },
  ],
  session: { strategy: 'jwt' },
  jwt: { secret: 'test-secret' },
}