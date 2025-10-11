/**
 * Unit tests for Multi-Factor Authentication provider
 */

// Mock speakeasy for TOTP generation
jest.mock('speakeasy', () => ({
  generateSecret: jest.fn(() => ({
    base32: 'MOCKBASE32SECRET',
    otpauth_url: 'otpauth://totp/TestApp:user@example.com?secret=MOCKBASE32SECRET&issuer=TestApp'
  })),
  totp: {
    verify: jest.fn(() => ({ delta: 0 }))
  }
}))

// Mock qrcode for QR generation  
jest.mock('qrcode', () => ({
  toDataURL: jest.fn(() => Promise.resolve('data:image/png;base64,mockqrcode'))
}))

import { MFAProvider } from '@/lib/auth/mfa-provider'

describe('MFA Authentication Provider', () => {
  let mfaProvider: MFAProvider

  beforeEach(() => {
    mfaProvider = new MFAProvider({
      issuer: 'TestApp',
      smtpConfig: {
        host: 'smtp.test.com',
        port: 587,
        user: 'test@test.com',
        password: 'testpass'
      }
    })
  })

  describe('TOTP Setup', () => {
    it('should setup TOTP for user', async () => {
      const result = await mfaProvider.setupTOTP('user123', 'My Phone')

      expect(result).toHaveProperty('secret')
      expect(result).toHaveProperty('qrCode')
      expect(result).toHaveProperty('backupCodes')
      expect(result.secret).toBe('MOCKBASE32SECRET')
      expect(result.qrCode).toBe('data:image/png;base64,mockqrcode')
      expect(result.backupCodes).toHaveLength(10)
    })

    it('should generate unique backup codes', async () => {
      const result1 = await mfaProvider.setupTOTP('user1', 'Device1')
      const result2 = await mfaProvider.setupTOTP('user2', 'Device2')

      expect(result1.backupCodes).not.toEqual(result2.backupCodes)
    })

    it('should validate device name', async () => {
      await expect(mfaProvider.setupTOTP('user123', '')).rejects.toThrow('Device name is required')
      await expect(mfaProvider.setupTOTP('user123', 'a'.repeat(101))).rejects.toThrow('Device name too long')
    })
  })

  describe('TOTP Verification', () => {
    beforeEach(async () => {
      await mfaProvider.setupTOTP('user123', 'Test Device')
    })

    it('should verify valid TOTP code', async () => {
      const speakeasy = require('speakeasy')
      speakeasy.totp.verify.mockReturnValue({ delta: 0 })

      const result = await mfaProvider.verifyTOTP('user123', '123456')

      expect(result.success).toBe(true)
      expect(result.message).toBe('TOTP verification successful')
    })

    it('should reject invalid TOTP code', async () => {
      const speakeasy = require('speakeasy')
      speakeasy.totp.verify.mockReturnValue(false)

      const result = await mfaProvider.verifyTOTP('user123', '000000')

      expect(result.success).toBe(false)
      expect(result.message).toBe('Invalid TOTP code')
    })

    it('should handle rate limiting', async () => {
      const speakeasy = require('speakeasy')
      // Simulate multiple failed attempts
      speakeasy.totp.verify.mockReturnValue(false)

      for (let i = 0; i < 5; i++) {
        await mfaProvider.verifyTOTP('user123', '000000')
      }

      const result = await mfaProvider.verifyTOTP('user123', '123456')
      expect(result.success).toBe(false)
      expect(result.message).toContain('rate limited')
    })
  })

  describe('SMS Verification', () => {
    it('should send SMS verification code', async () => {
      const result = await mfaProvider.sendSMSCode('+1234567890', 'user123')

      expect(result).toHaveProperty('challengeId')
      expect(result).toHaveProperty('expiresAt')
      expect(result.challengeId).toBeTruthy()
    })

    it('should validate phone number format', async () => {
      await expect(mfaProvider.sendSMSCode('invalid-phone', 'user123')).rejects.toThrow('Invalid phone number')
      await expect(mfaProvider.sendSMSCode('', 'user123')).rejects.toThrow('Phone number is required')
    })

    it('should verify SMS code', async () => {
      const smsResult = await mfaProvider.sendSMSCode('+1234567890', 'user123')
      
      // Mock correct code verification
      const result = await mfaProvider.verifySMSCode(smsResult.challengeId, '123456')

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('message')
    })
  })

  describe('Email Verification', () => {
    it('should send email verification code', async () => {
      const result = await mfaProvider.sendEmailCode('user@example.com', 'user123')

      expect(result).toHaveProperty('challengeId')
      expect(result).toHaveProperty('expiresAt')
      expect(result.challengeId).toBeTruthy()
    })

    it('should validate email format', async () => {
      await expect(mfaProvider.sendEmailCode('invalid-email', 'user123')).rejects.toThrow('Invalid email address')
      await expect(mfaProvider.sendEmailCode('', 'user123')).rejects.toThrow('Email address is required')
    })

    it('should verify email code', async () => {
      const emailResult = await mfaProvider.sendEmailCode('user@example.com', 'user123')
      
      const result = await mfaProvider.verifyEmailCode(emailResult.challengeId, '123456')

      expect(result).toHaveProperty('success')
      expect(result).toHaveProperty('message')
    })
  })

  describe('Backup Codes', () => {
    it('should verify backup code', async () => {
      const setupResult = await mfaProvider.setupTOTP('user123', 'Test Device')
      const backupCode = setupResult.backupCodes[0]

      const result = await mfaProvider.verifyBackupCode('user123', backupCode)

      expect(result.success).toBe(true)
      expect(result.message).toBe('Backup code verification successful')
    })

    it('should invalidate used backup code', async () => {
      const setupResult = await mfaProvider.setupTOTP('user123', 'Test Device')
      const backupCode = setupResult.backupCodes[0]

      await mfaProvider.verifyBackupCode('user123', backupCode)
      const result = await mfaProvider.verifyBackupCode('user123', backupCode)

      expect(result.success).toBe(false)
      expect(result.message).toBe('Backup code already used')
    })

    it('should generate new backup codes', async () => {
      await mfaProvider.setupTOTP('user123', 'Test Device')
      
      const newCodes = await mfaProvider.generateNewBackupCodes('user123')

      expect(newCodes).toHaveLength(10)
      expect(newCodes.every(code => code.length === 8)).toBe(true)
    })
  })

  describe('Device Management', () => {
    it('should list user devices', async () => {
      await mfaProvider.setupTOTP('user123', 'Device 1')
      await mfaProvider.setupTOTP('user123', 'Device 2')

      const devices = await mfaProvider.getUserDevices('user123')

      expect(devices).toHaveLength(2)
      expect(devices[0]).toHaveProperty('name')
      expect(devices[0]).toHaveProperty('addedAt')
      expect(devices[0]).toHaveProperty('lastUsed')
    })

    it('should remove user device', async () => {
      const setupResult = await mfaProvider.setupTOTP('user123', 'Test Device')
      
      const result = await mfaProvider.removeDevice('user123', 'Test Device')

      expect(result.success).toBe(true)
      
      const devices = await mfaProvider.getUserDevices('user123')
      expect(devices).toHaveLength(0)
    })
  })

  describe('Configuration', () => {
    it('should validate SMTP configuration', () => {
      expect(() => new MFAProvider({
        issuer: 'TestApp',
        smtpConfig: {
          host: '',
          port: 587,
          user: 'test@test.com',
          password: 'pass'
        }
      })).toThrow('SMTP host is required')
    })

    it('should use default configuration when not provided', () => {
      const provider = new MFAProvider({ issuer: 'TestApp' })
      expect(provider).toBeDefined()
    })
  })
})