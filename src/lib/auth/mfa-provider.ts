/**
 * Multi-Factor Authentication (MFA) Provider
 * Supports TOTP, SMS, Email, and Hardware Token authentication
 * Enterprise-grade 2FA implementation for VibeCode
 */

import { z } from 'zod'
import * as speakeasy from 'speakeasy'
import * as QRCode from 'qrcode'

export interface MFADevice {
  id: string
  userId: string
  name: string
  type: 'totp' | 'sms' | 'email' | 'hardware' | 'backup'
  secret?: string
  phoneNumber?: string
  email?: string
  isActive: boolean
  isBackup: boolean
  createdAt: Date
  lastUsed?: Date
  counter?: number // For hardware tokens
}

export interface MFASetupResult {
  deviceId: string
  secret: string
  qrCodeUrl?: string
  backupCodes?: string[]
  setupToken: string
}

export interface MFAVerificationResult {
  success: boolean
  deviceId?: string
  deviceType?: string
  error?: string
  remainingBackupCodes?: number
}

export interface MFAChallenge {
  challengeId: string
  userId: string
  deviceId: string
  challengeType: 'totp' | 'sms' | 'email' | 'push'
  expiresAt: Date
  attempts: number
  maxAttempts: number
  metadata?: Record<string, any>
}

const mfaDeviceSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum(['totp', 'sms', 'email', 'hardware', 'backup']),
  phoneNumber: z.string().optional(),
  email: z.string().email().optional(),
})

const verificationSchema = z.object({
  token: z.string().min(6).max(8),
  deviceId: z.string().optional(),
  challengeId: z.string().optional(),
  backupCode: z.string().optional()
})

export class MFAProvider {
  private devices: Map<string, MFADevice> = new Map()
  private challenges: Map<string, MFAChallenge> = new Map()
  private backupCodes: Map<string, string[]> = new Map() // userId -> codes
  private failedAttempts: Map<string, { count: number, lockedUntil?: Date }> = new Map()

  constructor() {
    // Cleanup expired challenges every 5 minutes
    setInterval(() => {
      this.cleanupExpiredChallenges()
    }, 5 * 60 * 1000)
  }

  /**
   * Setup TOTP (Time-based One-Time Password) authentication
   */
  async setupTOTP(userId: string, deviceName: string): Promise<MFASetupResult> {
    const secret = speakeasy.generateSecret({
      name: `VibeCode (${deviceName})`,
      issuer: 'VibeCode Platform',
      length: 32
    })

    const deviceId = this.generateDeviceId()
    const setupToken = this.generateSetupToken()

    // Generate QR code for easy setup
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!)

    // Generate backup codes
    const backupCodes = this.generateBackupCodes()
    this.backupCodes.set(userId, backupCodes)

    // Store device (inactive until verified)
    const device: MFADevice = {
      id: deviceId,
      userId,
      name: deviceName,
      type: 'totp',
      secret: secret.base32,
      isActive: false,
      isBackup: false,
      createdAt: new Date()
    }

    this.devices.set(deviceId, device)

    console.log(`📱 TOTP setup initiated for user ${userId}, device: ${deviceName}`)

    return {
      deviceId,
      secret: secret.base32,
      qrCodeUrl,
      backupCodes,
      setupToken
    }
  }

  /**
   * Setup SMS-based MFA
   */
  async setupSMS(userId: string, phoneNumber: string, deviceName: string): Promise<MFASetupResult> {
    const deviceId = this.generateDeviceId()
    const setupToken = this.generateSetupToken()

    // Store device (inactive until verified)
    const device: MFADevice = {
      id: deviceId,
      userId,
      name: deviceName,
      type: 'sms',
      phoneNumber,
      isActive: false,
      isBackup: false,
      createdAt: new Date()
    }

    this.devices.set(deviceId, device)

    // Send verification SMS
    await this.sendSMSVerification(phoneNumber, deviceId)

    console.log(`📞 SMS MFA setup initiated for user ${userId}, phone: ${phoneNumber.replace(/\d(?=\d{4})/g, '*')}`)

    return {
      deviceId,
      secret: '', // No secret for SMS
      setupToken
    }
  }

  /**
   * Setup Email-based MFA
   */
  async setupEmail(userId: string, email: string, deviceName: string): Promise<MFASetupResult> {
    const deviceId = this.generateDeviceId()
    const setupToken = this.generateSetupToken()

    // Store device (inactive until verified)
    const device: MFADevice = {
      id: deviceId,
      userId,
      name: deviceName,
      type: 'email',
      email,
      isActive: false,
      isBackup: false,
      createdAt: new Date()
    }

    this.devices.set(deviceId, device)

    // Send verification email
    await this.sendEmailVerification(email, deviceId)

    console.log(`📧 Email MFA setup initiated for user ${userId}, email: ${email.replace(/(.{2}).*@/, '$1***@')}`)

    return {
      deviceId,
      secret: '', // No secret for email
      setupToken
    }
  }

  /**
   * Verify MFA setup with initial token
   */
  async verifySetup(deviceId: string, token: string, setupToken: string): Promise<boolean> {
    const device = this.devices.get(deviceId)
    if (!device) {
      throw new Error('Device not found')
    }

    if (device.isActive) {
      throw new Error('Device already activated')
    }

    // Verify the setup token (simple validation)
    if (!this.validateSetupToken(setupToken)) {
      throw new Error('Invalid setup token')
    }

    let isValid = false

    switch (device.type) {
      case 'totp':
        isValid = this.verifyTOTP(device.secret!, token)
        break
      case 'sms':
        isValid = await this.verifySMSToken(deviceId, token)
        break
      case 'email':
        isValid = await this.verifyEmailToken(deviceId, token)
        break
    }

    if (isValid) {
      device.isActive = true
      device.lastUsed = new Date()
      this.devices.set(deviceId, device)
      
      console.log(`✅ MFA device activated: ${device.name} (${device.type})`)
      return true
    }

    console.log(`❌ MFA setup verification failed for device: ${device.name}`)
    return false
  }

  /**
   * Challenge user with MFA
   */
  async createChallenge(userId: string, preferredDeviceId?: string): Promise<{
    challengeId: string
    availableDevices: Array<{
      deviceId: string
      name: string
      type: string
      masked?: string
    }>
  }> {
    const userDevices = Array.from(this.devices.values())
      .filter(d => d.userId === userId && d.isActive)

    if (userDevices.length === 0) {
      throw new Error('No active MFA devices found')
    }

    // Select device for challenge
    const selectedDevice = userDevices.find(d => d.id === preferredDeviceId) || userDevices[0]
    
    const challengeId = this.generateChallengeId()
    const challenge: MFAChallenge = {
      challengeId,
      userId,
      deviceId: selectedDevice.id,
      challengeType: selectedDevice.type as any,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      attempts: 0,
      maxAttempts: 3
    }

    this.challenges.set(challengeId, challenge)

    // Send challenge based on device type
    if (selectedDevice.type === 'sms') {
      await this.sendSMSVerification(selectedDevice.phoneNumber!, selectedDevice.id)
    } else if (selectedDevice.type === 'email') {
      await this.sendEmailVerification(selectedDevice.email!, selectedDevice.id)
    }

    const availableDevices = userDevices.map(d => ({
      deviceId: d.id,
      name: d.name,
      type: d.type,
      masked: d.phoneNumber ? this.maskPhoneNumber(d.phoneNumber) :
              d.email ? this.maskEmail(d.email) : undefined
    }))

    console.log(`🔐 MFA challenge created for user ${userId}, challengeId: ${challengeId}`)

    return {
      challengeId,
      availableDevices
    }
  }

  /**
   * Verify MFA challenge response
   */
  async verifyChallenge(challengeId: string, token: string, backupCode?: string): Promise<MFAVerificationResult> {
    const challenge = this.challenges.get(challengeId)
    if (!challenge) {
      return { success: false, error: 'Invalid or expired challenge' }
    }

    if (new Date() > challenge.expiresAt) {
      this.challenges.delete(challengeId)
      return { success: false, error: 'Challenge expired' }
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      this.challenges.delete(challengeId)
      return { success: false, error: 'Too many failed attempts' }
    }

    challenge.attempts++

    // Check rate limiting
    if (this.isRateLimited(challenge.userId)) {
      return { success: false, error: 'Account temporarily locked due to failed attempts' }
    }

    // Try backup code first if provided
    if (backupCode) {
      const isValidBackup = this.verifyBackupCode(challenge.userId, backupCode)
      if (isValidBackup) {
        this.challenges.delete(challengeId)
        const remainingBackupCodes = this.backupCodes.get(challenge.userId)?.length || 0
        
        console.log(`✅ MFA verification successful with backup code for user ${challenge.userId}`)
        
        return {
          success: true,
          deviceId: challenge.deviceId,
          deviceType: 'backup',
          remainingBackupCodes
        }
      }
    }

    // Verify with device
    const device = this.devices.get(challenge.deviceId)
    if (!device) {
      return { success: false, error: 'Device not found' }
    }

    let isValid = false

    switch (device.type) {
      case 'totp':
        isValid = this.verifyTOTP(device.secret!, token)
        break
      case 'sms':
        isValid = await this.verifySMSToken(device.id, token)
        break
      case 'email':
        isValid = await this.verifyEmailToken(device.id, token)
        break
    }

    if (isValid) {
      device.lastUsed = new Date()
      this.devices.set(device.id, device)
      this.challenges.delete(challengeId)
      this.clearRateLimit(challenge.userId)
      
      console.log(`✅ MFA verification successful for user ${challenge.userId} using ${device.type}`)
      
      return {
        success: true,
        deviceId: device.id,
        deviceType: device.type
      }
    } else {
      this.recordFailedAttempt(challenge.userId)
      
      console.log(`❌ MFA verification failed for user ${challenge.userId}, attempts: ${challenge.attempts}/${challenge.maxAttempts}`)
      
      return {
        success: false,
        error: `Invalid verification code. ${challenge.maxAttempts - challenge.attempts} attempts remaining.`
      }
    }
  }

  /**
   * Get user's MFA devices
   */
  getUserDevices(userId: string): Array<Omit<MFADevice, 'secret'>> {
    return Array.from(this.devices.values())
      .filter(d => d.userId === userId)
      .map(d => ({
        ...d,
        secret: undefined // Don't expose secret
      }))
  }

  /**
   * Remove MFA device
   */
  async removeDevice(deviceId: string, userId: string): Promise<boolean> {
    const device = this.devices.get(deviceId)
    if (!device || device.userId !== userId) {
      return false
    }

    this.devices.delete(deviceId)
    console.log(`🗑️  MFA device removed: ${device.name} (${device.type})`)
    return true
  }

  /**
   * Generate new backup codes
   */
  generateNewBackupCodes(userId: string): string[] {
    const backupCodes = this.generateBackupCodes()
    this.backupCodes.set(userId, backupCodes)
    
    console.log(`🔑 New backup codes generated for user ${userId}`)
    return backupCodes
  }

  /**
   * Private helper methods
   */
  private verifyTOTP(secret: string, token: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2 // Allow 2 time steps before/after
    })
  }

  private async sendSMSVerification(phoneNumber: string, deviceId: string): Promise<void> {
    // In a real implementation, integrate with SMS service (Twilio, AWS SNS, etc.)
    const code = this.generateSMSCode()
    
    // Store the code temporarily (in real app, use Redis or database)
    this.storeTempCode(deviceId, code, 'sms')
    
    console.log(`📱 SMS code sent to ${this.maskPhoneNumber(phoneNumber)}: ${code}`)
  }

  private async sendEmailVerification(email: string, deviceId: string): Promise<void> {
    // In a real implementation, integrate with email service (SendGrid, AWS SES, etc.)
    const code = this.generateSMSCode()
    
    // Store the code temporarily
    this.storeTempCode(deviceId, code, 'email')
    
    console.log(`📧 Email code sent to ${this.maskEmail(email)}: ${code}`)
  }

  private async verifySMSToken(deviceId: string, token: string): Promise<boolean> {
    return this.verifyTempCode(deviceId, token, 'sms')
  }

  private async verifyEmailToken(deviceId: string, token: string): Promise<boolean> {
    return this.verifyTempCode(deviceId, token, 'email')
  }

  private tempCodes: Map<string, { code: string, type: string, expiresAt: Date }> = new Map()

  private storeTempCode(deviceId: string, code: string, type: string): void {
    this.tempCodes.set(deviceId, {
      code,
      type,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    })
  }

  private verifyTempCode(deviceId: string, code: string, type: string): boolean {
    const stored = this.tempCodes.get(deviceId)
    if (!stored || stored.type !== type || new Date() > stored.expiresAt) {
      return false
    }

    const isValid = stored.code === code
    if (isValid) {
      this.tempCodes.delete(deviceId) // Use once
    }
    
    return isValid
  }

  private verifyBackupCode(userId: string, code: string): boolean {
    const userCodes = this.backupCodes.get(userId)
    if (!userCodes || !userCodes.includes(code)) {
      return false
    }

    // Remove the used code from the array
    const index = userCodes.indexOf(code)
    userCodes.splice(index, 1)
    return true
  }

  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      codes.push(Math.random().toString(36).substring(2, 10).toUpperCase());
    }
    return codes;
  }

  private generateDeviceId(): string {
    return `mfa_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }

  private generateChallengeId(): string {
    return `challenge_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
  }

  private generateSetupToken(): string {
    return `setup_${Date.now()}_${Math.random().toString(36).slice(2, 18)}`
  }

  private generateSMSCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  private validateSetupToken(token: string): boolean {
    // Basic validation - in real app, verify signature/encryption
    return token.startsWith('setup_') && token.length > 20
  }

  private maskPhoneNumber(phone: string): string {
    return phone.replace(/(\d{3})\d{3}(\d{4})/, '$1***$2')
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@')
    return `${local.charAt(0)}***${local.charAt(local.length - 1)}@${domain}`
  }

  private isRateLimited(userId: string): boolean {
    const attempts = this.failedAttempts.get(userId)
    if (!attempts) return false
    
    if (attempts.lockedUntil && new Date() < attempts.lockedUntil) {
      return true
    }

    return attempts.count >= 5 // Lock after 5 failed attempts
  }

  private recordFailedAttempt(userId: string): void {
    const current = this.failedAttempts.get(userId) || { count: 0 }
    current.count++
    
    if (current.count >= 5) {
      current.lockedUntil = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    }
    
    this.failedAttempts.set(userId, current)
  }

  private clearRateLimit(userId: string): void {
    this.failedAttempts.delete(userId)
  }

  private cleanupExpiredChallenges(): void {
    const now = new Date()
    const challengesToDelete: string[] = [];
    this.challenges.forEach((challenge, challengeId) => {
      if (now > challenge.expiresAt) {
        challengesToDelete.push(challengeId);
      }
    });
    challengesToDelete.forEach(challengeId => {
      this.challenges.delete(challengeId);
    });
  }
}

// Export singleton instance
export const mfaProvider = new MFAProvider()
export default mfaProvider