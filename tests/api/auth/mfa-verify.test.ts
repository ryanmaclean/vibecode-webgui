/**
 * MFA Verification API Tests
 * Issue #953: Improve API route test coverage
 *
 * Tests the /api/auth/mfa/verify endpoint for multi-factor authentication verification
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
    createChallenge: jest.fn().mockResolvedValue({
      challengeId: 'challenge-abc123',
      availableDevices: [
        { id: 'device-1', name: 'My Phone', type: 'totp' },
        { id: 'device-2', name: 'Backup Email', type: 'email' },
      ],
    }),
    verifyChallenge: jest.fn().mockResolvedValue({
      success: true,
      deviceId: 'device-1',
      deviceType: 'totp',
      remainingBackupCodes: 8,
    }),
    getUserDevices: jest.fn().mockReturnValue([
      {
        id: 'device-1',
        name: 'My Phone',
        type: 'totp',
        isActive: true,
        lastUsed: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      {
        id: 'device-2',
        name: 'Work Email',
        type: 'email',
        isActive: true,
        lastUsed: null,
        createdAt: new Date().toISOString(),
        email: 'user@company.com',
      },
      {
        id: 'device-3',
        name: 'Personal Phone',
        type: 'sms',
        isActive: false,
        lastUsed: null,
        createdAt: new Date().toISOString(),
        phoneNumber: '+14155551234',
      },
    ]),
    removeDevice: jest.fn().mockResolvedValue(true),
  },
}));

describe('/api/auth/mfa/verify - MFA Verification API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/mfa/verify - Create MFA challenge', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const { POST } = await import('@/app/api/auth/mfa/verify/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should create MFA challenge successfully', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'user@example.com' },
      });

      const { POST } = await import('@/app/api/auth/mfa/verify/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.data.challengeId).toBe('challenge-abc123');
      expect(data.data.availableDevices).toHaveLength(2);
      expect(data.message).toBe('MFA challenge created');
    });

    it('should accept preferred device ID', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'user@example.com' },
      });

      const { POST } = await import('@/app/api/auth/mfa/verify/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({ preferredDeviceId: 'device-1' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
    });
  });

  describe('PUT /api/auth/mfa/verify - Verify MFA challenge', () => {
    it('should verify challenge with token successfully', async () => {
      const { PUT } = await import('@/app/api/auth/mfa/verify/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/verify', {
        method: 'PUT',
        body: JSON.stringify({
          challengeId: 'challenge-abc123',
          token: '123456',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.data.deviceId).toBe('device-1');
      expect(data.data.deviceType).toBe('totp');
      expect(data.data.remainingBackupCodes).toBe(8);
      expect(data.message).toBe('MFA verification successful');
    });

    it('should verify challenge with backup code', async () => {
      const { PUT } = await import('@/app/api/auth/mfa/verify/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/verify', {
        method: 'PUT',
        body: JSON.stringify({
          challengeId: 'challenge-abc123',
          backupCode: '12345678',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
    });

    it('should return 400 when neither token nor backup code provided', async () => {
      const { PUT } = await import('@/app/api/auth/mfa/verify/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/verify', {
        method: 'PUT',
        body: JSON.stringify({
          challengeId: 'challenge-abc123',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid request parameters');
    });

    it('should return 400 for failed verification', async () => {
      const { mfaProvider } = await import('@/lib/auth/mfa-provider');
      (mfaProvider.verifyChallenge as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'Invalid token',
      });

      const { PUT } = await import('@/app/api/auth/mfa/verify/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/verify', {
        method: 'PUT',
        body: JSON.stringify({
          challengeId: 'challenge-abc123',
          token: '000000',
        }),
      });

      const response = await PUT(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid token');
    });
  });

  describe('GET /api/auth/mfa/verify - Get user MFA devices', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const { GET } = await import('@/app/api/auth/mfa/verify/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/verify');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return user devices with masked sensitive data', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'user@example.com' },
      });

      const { GET } = await import('@/app/api/auth/mfa/verify/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/verify');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.data.devices).toHaveLength(3);

      // Verify TOTP device
      const totpDevice = data.data.devices.find((d: { type: string }) => d.type === 'totp');
      expect(totpDevice.id).toBe('device-1');
      expect(totpDevice.name).toBe('My Phone');
      expect(totpDevice.isActive).toBe(true);

      // Verify email is masked
      const emailDevice = data.data.devices.find((d: { type: string }) => d.type === 'email');
      expect(emailDevice.email).toContain('***');

      // Verify phone number is masked
      const smsDevice = data.data.devices.find((d: { type: string }) => d.type === 'sms');
      expect(smsDevice.phoneNumber).toContain('***');
    });

    it('should include device metadata', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'user@example.com' },
      });

      const { GET } = await import('@/app/api/auth/mfa/verify/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/verify');

      const response = await GET(request);
      const data = await response.json();

      data.data.devices.forEach((device: { id: string; name: string; type: string; isActive: boolean; createdAt: string }) => {
        expect(device).toHaveProperty('id');
        expect(device).toHaveProperty('name');
        expect(device).toHaveProperty('type');
        expect(device).toHaveProperty('isActive');
        expect(device).toHaveProperty('createdAt');
      });
    });
  });

  describe('DELETE /api/auth/mfa/verify - Remove MFA device', () => {
    it('should return 401 when user is not authenticated', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce(null);

      const { DELETE } = await import('@/app/api/auth/mfa/verify/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/verify?deviceId=device-1');

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should remove device successfully', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'user@example.com' },
      });

      const { DELETE } = await import('@/app/api/auth/mfa/verify/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/verify?deviceId=device-1');

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('success');
      expect(data.message).toBe('MFA device removed');
    });

    it('should return 400 when device ID is missing', async () => {
      const { getServerSession } = await import('next-auth');
      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'user@example.com' },
      });

      const { DELETE } = await import('@/app/api/auth/mfa/verify/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/verify');

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Device ID required');
    });

    it('should return 404 when device not found', async () => {
      const { getServerSession } = await import('next-auth');
      const { mfaProvider } = await import('@/lib/auth/mfa-provider');

      (getServerSession as jest.Mock).mockResolvedValueOnce({
        user: { id: 'user-123', email: 'user@example.com' },
      });
      (mfaProvider.removeDevice as jest.Mock).mockResolvedValueOnce(false);

      const { DELETE } = await import('@/app/api/auth/mfa/verify/route');
      const request = new NextRequest('http://localhost:3000/api/auth/mfa/verify?deviceId=nonexistent');

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Device not found or access denied');
    });
  });
});
