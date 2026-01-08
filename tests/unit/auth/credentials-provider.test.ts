// NOTE: We don't use jest.mock() here because we want to test the real implementation
import { authOptions } from '@/lib/auth';

describe('Credentials Provider authorize', () => {
  let credentialsProvider: any;
  let authorize: (credentials: Record<string, string>) => Promise<any>;

  beforeAll(() => {
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
