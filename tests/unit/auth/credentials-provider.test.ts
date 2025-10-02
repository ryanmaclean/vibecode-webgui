import { authOptions } from '@/lib/auth';

describe('Credentials Provider authorize', () => {
  const credentialsProvider = authOptions.providers.find(
    (provider: any) => provider.id === 'credentials'
  ) as { authorize?: (credentials: Record<string, string>) => Promise<any> };

  if (!credentialsProvider?.authorize) {
    throw new Error('Credentials provider is not configured');
  }

  const authorize = credentialsProvider.authorize;

  it('returns legacy user for valid credentials', async () => {
    const user = await authorize({
      email: 'admin@vibecode.dev',
      password: 'admin123',
    });

    expect(user).toEqual({
      id: 'legacy-admin',
      name: 'Admin User',
      email: 'admin@vibecode.dev',
      role: 'admin',
    });
  });

  it('returns null for invalid password', async () => {
    const user = await authorize({
      email: 'admin@vibecode.dev',
      password: 'wrong-password',
    });

    expect(user).toBeNull();
  });
});
