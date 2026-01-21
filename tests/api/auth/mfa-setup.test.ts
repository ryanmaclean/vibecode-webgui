/**
 * MFA Setup API Tests
 * Issue #953: Improve API route test coverage
 *
 * Tests the /api/auth/mfa/setup endpoint for multi-factor authentication setup
 */

import { NextRequest } from 'next/server';

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock auth options
jest.mock('@/lib/auth', () => ({
  authOptions: {},
}));

// Mock MFA provider
jest.mock('@/lib/auth/mfa-provider', () => ({
  mfaProvider: {
    setupTOTP: jest.fn().mockResolvedValue({
      deviceId: 'device-123',
      qrCodeUrl: 'otpauth://totp/TestApp:user@example.com?secret=JBSWY3DPEHPK3PXP',
      backupCodes: ['12345678', '23456789', '34567890'],
      setupToken: 'setup-token-xyz',
    }),
    setupSMS: jest.fn().mockResolvedValue({
      deviceId: 'device-456',
      qrCodeUrl: null,
      backupCodes: ['87654321', '98765432', '09876543'],
      setupToken: 'setup-token-sms',
    }),
    setupEmail: jest.fn().mockResolvedValue({
      deviceId: 'device-789',
      qrCodeUrl: null,
      backupCodes: ['11111111', '22222222', '33333333'],
      setupToken: 'setup-token-email',
    }),
    verifySetup: jest.fn().mockResolvedValue(true),
  },
}));

describe('/api/auth/mfa/setup - MFA Setup API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/mfa/setup - Setup new MFA device', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const { POST } = await import('@/app/api/auth/mfa/setup/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/setup', {
        method: 'POST',
        body: JSON.stringify({ type: 'totp', name: 'My Phone' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should setup TOTP device successfully', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'user@example.com' },
      });

      const { POST } = await import('@/app/api/auth/mfa/setup/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/setup', {
        method: 'POST',
        body: JSON.stringify({ type: 'totp', name: 'My Authenticator' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.data.deviceId).toBeDefined();
      expect(data.data.qrCodeUrl).toContain('otpauth://totp/');
      expect(data.data.backupCodes).toHaveLength(3);
      expect(data.data.setupToken).toBeDefined();
      expect(data.message).toContain('TOTP');
    });

    it('should setup SMS device with phone number', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'user@example.com' },
      });

      const { POST } = await import('@/app/api/auth/mfa/setup/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/setup', {
        method: 'POST',
        body: JSON.stringify({
          type: 'sms',
          name: 'My Phone',
          phoneNumber: '+14155551234',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.message).toContain('SMS');
    });

    it('should return 400 when SMS setup is missing phone number', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'user@example.com' },
      });

      const { POST } = await import('@/app/api/auth/mfa/setup/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/setup', {
        method: 'POST',
        body: JSON.stringify({ type: 'sms', name: 'My Phone' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Phone number required for SMS setup');
    });

    it('should setup email device with email address', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'user@example.com' },
      });

      const { POST } = await import('@/app/api/auth/mfa/setup/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/setup', {
        method: 'POST',
        body: JSON.stringify({
          type: 'email',
          name: 'My Email',
          email: 'user@example.com',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.message).toContain('EMAIL');
    });

    it('should return 400 when email setup is missing email', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'user@example.com' },
      });

      const { POST } = await import('@/app/api/auth/mfa/setup/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/setup', {
        method: 'POST',
        body: JSON.stringify({ type: 'email', name: 'My Email' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Email required for email setup');
    });

    it('should validate phone number format (E.164)', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'user@example.com' },
      });

      const { POST } = await import('@/app/api/auth/mfa/setup/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/setup', {
        method: 'POST',
        body: JSON.stringify({
          type: 'sms',
          name: 'My Phone',
          phoneNumber: 'invalid-phone',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request parameters');
    });

    it('should reject invalid MFA type', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'user@example.com' },
      });

      const { POST } = await import('@/app/api/auth/mfa/setup/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/setup', {
        method: 'POST',
        body: JSON.stringify({ type: 'invalid', name: 'Test' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request parameters');
    });

    it('should validate name length (max 50 characters)', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'user@example.com' },
      });

      const { POST } = await import('@/app/api/auth/mfa/setup/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/setup', {
        method: 'POST',
        body: JSON.stringify({
          type: 'totp',
          name: 'A'.repeat(51), // 51 characters
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request parameters');
    });
  });

  describe('PUT /api/auth/mfa/setup - Verify MFA device setup', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const { PUT } = await import('@/app/api/auth/mfa/setup/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/setup', {
        method: 'PUT',
        body: JSON.stringify({
          deviceId: 'device-123',
          token: '123456',
          setupToken: 'setup-token-xyz',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should verify setup successfully with valid token', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'user@example.com' },
      });

      const { PUT } = await import('@/app/api/auth/mfa/setup/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/setup', {
        method: 'PUT',
        body: JSON.stringify({
          deviceId: 'device-123',
          token: '123456',
          setupToken: 'setup-token-xyz',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.message).toBe('MFA device verified and activated');
    });

    it('should return 400 for invalid verification code', async () => {
      const { getServerSession } = await import('next-auth');
      const { mfaProvider } = await import('@/lib/auth/mfa-provider');

      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'user@example.com' },
      });
      (mfaProvider.verifySetup as jest.Mock).mockResolvedValueOnce(false);

      const { PUT } = await import('@/app/api/auth/mfa/setup/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/setup', {
        method: 'PUT',
        body: JSON.stringify({
          deviceId: 'device-123',
          token: '000000',
          setupToken: 'setup-token-xyz',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid verification code');
    });

    it('should validate token format (6-8 digits)', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'user@example.com' },
      });

      const { PUT } = await import('@/app/api/auth/mfa/setup/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/setup', {
        method: 'PUT',
        body: JSON.stringify({
          deviceId: 'device-123',
          token: 'abc', // Not digits
          setupToken: 'setup-token-xyz',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request parameters');
    });
  });
});
