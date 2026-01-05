import { authOptions } from '@/lib/auth';

describe('Credentials Provider authorize', () => {
  let authorize: (credentials: Record<string, string>) => Promise<any>;

  beforeAll(() => {
    const credentialsProvider = authOptions.providers.find(
      (provider: any) => provider.id === 'credentials'
    ) as { authorize?: (credentials: Record<string, string>) => Promise<any>; options?: { authorize?: (credentials: Record<string, string>) => Promise<any> } };

    if (!credentialsProvider) {
      throw new Error('Credentials provider is not found in authOptions');
    }

    // Handle both NextAuth v4 and v5 patterns - authorize can be in options or top-level
    const authorizeFn = credentialsProvider.options?.authorize || credentialsProvider.authorize;

    if (!authorizeFn) {
      throw new Error('Credentials provider authorize function is not configured');
    }

    authorize = authorizeFn;
  });

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
