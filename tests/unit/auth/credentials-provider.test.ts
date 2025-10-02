import type { NextAuthOptions } from 'next-auth';

describe('Credentials Provider authorize', () => {
  let authorize!: (credentials: Record<string, string>) => Promise<any>;
  const originalSecret = process.env.NEXTAUTH_SECRET;

  beforeAll(async () => {
    if (!originalSecret || originalSecret.length < 32) {
      process.env.NEXTAUTH_SECRET = 'unit-test-secret-value-that-is-very-long-1234567890';
    }

    const mod = (await import('@/lib/auth')) as { authOptions?: NextAuthOptions } & { default?: { authOptions?: NextAuthOptions } };
    const authOptions = mod.authOptions ?? mod.default?.authOptions;

    if (!authOptions) {
      throw new Error('Failed to load auth options');
    }

    const credentialsProvider = authOptions.providers.find((provider: any) => provider.id === 'credentials') as {
      options?: { authorize?: (credentials: Record<string, string>) => Promise<any> };
      authorize?: (credentials: Record<string, string>) => Promise<any>;
    };

    const authorizeFn = credentialsProvider?.options?.authorize ?? credentialsProvider?.authorize;

    if (!authorizeFn) {
      throw new Error('Credentials provider is not configured');
    }

    authorize = authorizeFn;
  });

  afterAll(() => {
    process.env.NEXTAUTH_SECRET = originalSecret;
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

  it('returns null when the email does not match a legacy account', async () => {
    const user = await authorize({
      email: 'unknown@vibecode.dev',
      password: 'admin123',
    });

    expect(user).toBeNull();
  });
});
