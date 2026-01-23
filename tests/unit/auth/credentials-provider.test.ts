// NOTE: We don't use jest.mock() here because we want to test the real implementation
import { authOptions, hashPassword } from '@/lib/auth';

describe('Credentials Provider authorize', () => {
  let credentialsProvider: any;
  let authorize: (credentials: Record<string, string>) => Promise<any>;
  let originalNodeEnv: string | undefined;
  let originalTestUsers: string | undefined;

  beforeAll(async () => {
    // Save original env vars
    originalNodeEnv = process.env.NODE_ENV;
    originalTestUsers = process.env.AUTH_TEST_USERS;

    // Set up test environment - the auth module only loads test users in development mode
    process.env.NODE_ENV = 'development';

    // Create a hashed password for the test user
    const passwordHash = await hashPassword('admin123');

    // Set up test users as JSON (this is how the real auth module expects them)
    process.env.AUTH_TEST_USERS = JSON.stringify([
      {
        id: 'legacy-admin',
        name: 'Admin User',
        email: 'admin@vibecode.dev',
        role: 'admin',
        passwordHash: passwordHash,
      },
    ]);
    // Get the credentials provider from the auth options
    credentialsProvider = authOptions.providers.find(
      (provider: any) => provider.id === 'credentials'
    );

    if (!credentialsProvider) {
      throw new Error('Credentials provider not found in authOptions');
    }

    // Extract the authorize function
    // In NextAuth, CredentialsProvider wraps the authorize function in provider.options
    if (credentialsProvider.options && credentialsProvider.options.authorize) {
      authorize = credentialsProvider.options.authorize.bind(credentialsProvider.options);
    } else if (credentialsProvider.authorize) {
      authorize = credentialsProvider.authorize.bind(credentialsProvider);
    } else {
      throw new Error('Credentials provider does not have an authorize function');
    }
  });

  afterAll(() => {
    // Restore original env vars
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
    if (originalTestUsers !== undefined) {
      process.env.AUTH_TEST_USERS = originalTestUsers;
    } else {
      delete process.env.AUTH_TEST_USERS;
    }
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
