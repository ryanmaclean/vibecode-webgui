const actualPasswordModule = jest.requireActual<typeof import('@/lib/auth/password')>('@/lib/auth/password');

jest.mock('@/lib/auth/password', () => {
  const actual = jest.requireActual<typeof import('@/lib/auth/password')>('@/lib/auth/password');
  return {
    ...actual,
    verifyPassword: jest.fn((...args) => actual.verifyPassword(...args)),
    isValidBcryptHash: jest.fn((...args) => actual.isValidBcryptHash(...args)),
  };
});

import { authOptions } from '@/lib/auth';
import { verifyPassword, isValidBcryptHash } from '@/lib/auth/password';

describe('Credentials Provider authorize', () => {
  const credentialsProvider = authOptions.providers.find(
    (provider: any) => provider.id === 'credentials'
  ) as { authorize?: (credentials: Record<string, string>) => Promise<any> };

  if (!credentialsProvider?.authorize) {
    throw new Error('Credentials provider is not configured');
  }

  const authorize = credentialsProvider.authorize;

  beforeEach(() => {
    (verifyPassword as jest.Mock).mockImplementation((...args) => actualPasswordModule.verifyPassword(...args));
    (verifyPassword as jest.Mock).mockClear();
    (isValidBcryptHash as jest.Mock).mockImplementation((...args) => actualPasswordModule.isValidBcryptHash(...args));
    (isValidBcryptHash as jest.Mock).mockClear();
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

  it('performs timing-safe compare when user email is not found', async () => {
    const user = await authorize({
      email: 'ghost@vibecode.dev',
      password: 'ghostpass123',
    });

    expect(user).toBeNull();
    expect(verifyPassword).toHaveBeenCalledWith(
      'ghostpass123',
      '$2b$12$eUlS0dNKrMxLdkPgDJZdpuHlNCn/KkheBmEzKE2.yOrembE1ccsV.'
    );
    expect(verifyPassword).toHaveBeenCalledTimes(1);
  });

  it('rejects login when stored hash is invalid', async () => {
    (isValidBcryptHash as jest.Mock).mockImplementationOnce(() => false);

    const user = await authorize({
      email: 'admin@vibecode.dev',
      password: 'admin123',
    });

    expect(user).toBeNull();
    expect(isValidBcryptHash).toHaveBeenCalled();
    expect(verifyPassword).not.toHaveBeenCalled();
  });

  it('handles verification errors gracefully', async () => {
    (verifyPassword as jest.Mock).mockImplementationOnce(() => {
      throw new Error('bcrypt boom');
    });

    const user = await authorize({
      email: 'admin@vibecode.dev',
      password: 'admin123',
    });

    expect(user).toBeNull();
    expect(verifyPassword).toHaveBeenCalledTimes(1);
  });
});
