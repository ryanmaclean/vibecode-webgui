/**
 * Mock for next-auth module
 */

export const mockSession = {
  user: {
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    image: 'https://example.com/avatar.jpg',
  },
  expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
};

export const mockUseSession = jest.fn(() => ({
  data: mockSession,
  status: 'authenticated',
  update: jest.fn(),
}));

export const mockSignIn = jest.fn(() => Promise.resolve({ ok: true, error: null }));
export const mockSignOut = jest.fn(() => Promise.resolve());
export const mockGetSession = jest.fn(() => Promise.resolve(mockSession));
export const mockGetServerSession = jest.fn(() => Promise.resolve(mockSession));

// Export mock module
export default {
  useSession: mockUseSession,
  signIn: mockSignIn,
  signOut: mockSignOut,
  getSession: mockGetSession,
  getServerSession: mockGetServerSession,
};
