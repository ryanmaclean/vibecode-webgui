// NOTE: We don't use jest.mock() here because we want to test the real implementation
import { authOptions } from '@/lib/auth';

describe('Credentials Provider authorize', () => {
<<<<<<< HEAD
  let authorize: (credentials: Record<string, string>) => Promise<any>;

  beforeAll(() => {
    const credentialsProvider = authOptions.providers.find(
      (provider: any) => {
        // Check multiple conditions for matching credentials provider
        return provider.type === 'credentials' ||
               provider.id === 'credentials' ||
               provider.name === 'Credentials';
      }
    ) as { authorize?: (credentials: Record<string, string>) => Promise<any>; options?: { authorize?: (credentials: Record<string, string>) => Promise<any> } };

    if (!credentialsProvider) {
      throw new Error('Credentials provider is not found in authOptions');
    }
=======
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
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)

    // Handle both NextAuth v4 and v5 patterns - authorize can be in options or top-level
    const authorizeFn = credentialsProvider.options?.authorize || credentialsProvider.authorize;

    if (!authorizeFn) {
      throw new Error('Credentials provider authorize function is not configured');
    }

    authorize = authorizeFn;
  });

  it('returns user for valid credentials', async () => {
    const user = await authorize({
      email: 'admin@vibecode.dev',
      password: 'admin123',
    });

    expect(user).toEqual({
      id: '1',
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
