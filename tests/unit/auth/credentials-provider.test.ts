describe('Credentials Provider authorize', () => {
  let authorize!: (credentials: Record<string, string>) => Promise<any>;
  const originalSecret = process.env.NEXTAUTH_SECRET;

  beforeAll(async () => {
    if (!originalSecret || originalSecret.length < 32) {
      process.env.NEXTAUTH_SECRET = 'unit-test-secret-value-that-is-very-long-123456';
    }

    jest.resetModules();
    const { authOptions } = await import('@/lib/auth');

    const credentialsProvider = authOptions.providers.find(
      (provider: any) => provider.id === 'credentials'
    ) as { options?: { authorize?: (credentials: Record<string, string>) => Promise<any> } };

    if (!credentialsProvider?.options?.authorize) {
      throw new Error('Credentials provider is not configured');
    }

    authorize = credentialsProvider.options.authorize;
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

  it('returns null when email does not match legacy list', async () => {
    const user = await authorize({
      email: 'unknown@vibecode.dev',
      password: 'admin123',
    });

    expect(user).toBeNull();
  });
});
