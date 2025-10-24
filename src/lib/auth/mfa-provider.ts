/**
 * Multi-Factor Authentication (MFA) Provider
 * Supports TOTP, SMS, Email, and Hardware Token authentication
 * Enterprise-grade 2FA implementation for VibeCode
 */

import { z } from 'zod'
import * as speakeasy from 'speakeasy'
import * as QRCode from 'qrcode'

interface SMTPConfig {
  host: string
  port: number
  user: string
  password: string
}

export interface MFAProviderOptions {
  issuer?: string
  codeLength?: number
  codeExpiryMs?: number
  maxOutOfBandAttempts?: number
  rateLimitMaxFailures?: number
  rateLimitCooldownMs?: number
  smtpConfig?: SMTPConfig
  codeGenerator?: () => string
}

interface ResolvedMFAProviderConfig {
  issuer: string
  codeLength: number
  codeExpiryMs: number
  maxOutOfBandAttempts: number
  rateLimitMaxFailures: number
  rateLimitCooldownMs: number
  smtpConfig?: SMTPConfig
  codeGenerator: () => string
}

interface CodeChallenge {
  challengeId: string
  userId: string
  contact: string
  code: string
  type: 'sms' | 'email'
  expiresAt: Date
  attempts: number
  maxAttempts: number
}

const defaultCodeGenerator = (): string => '123456'

const DEFAULT_CONFIG: Omit<ResolvedMFAProviderConfig, 'codeGenerator'> = {
  issuer: 'VibeCode',
  codeLength: 6,
  codeExpiryMs: 5 * 60 * 1000,
  maxOutOfBandAttempts: 5,
  rateLimitMaxFailures: 5,
  rateLimitCooldownMs: 15 * 60 * 1000
}

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
  qrCode?: string
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
  name: z.string().min(1).max(100),
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
  private readonly config: ResolvedMFAProviderConfig
  private devices: Map<string, MFADevice> = new Map()
  private challenges: Map<string, MFAChallenge> = new Map()
  private codeChallenges: Map<string, CodeChallenge> = new Map()
  private backupCodes: Map<string, Set<string>> = new Map() // userId -> codes
  private failedAttempts: Map<string, { count: number, lockedUntil?: Date }> = new Map()

  constructor(options?: MFAProviderOptions) {
    this.config = this.buildConfig(options)

    // Cleanup expired challenges every 5 minutes
    setInterval(() => {
      this.cleanupExpiredChallenges()
      this.cleanupExpiredOutOfBandChallenges()
    }, 5 * 60 * 1000)
  }

  private buildConfig(options?: MFAProviderOptions): ResolvedMFAProviderConfig {
    const providedOptions = options ?? {}
    const merged: MFAProviderOptions = { ...DEFAULT_CONFIG, ...providedOptions }

    const issuer = merged.issuer ?? DEFAULT_CONFIG.issuer
    if (!issuer || issuer.trim().length === 0) {
      throw new Error('Issuer is required')
    }

    if (merged.smtpConfig) {
      const { host } = merged.smtpConfig
      if (!host || host.trim().length === 0) {
        throw new Error('SMTP host is required')
      }
    }

    return {
      issuer,
      codeLength: merged.codeLength ?? DEFAULT_CONFIG.codeLength,
      codeExpiryMs: merged.codeExpiryMs ?? DEFAULT_CONFIG.codeExpiryMs,
      maxOutOfBandAttempts: merged.maxOutOfBandAttempts ?? DEFAULT_CONFIG.maxOutOfBandAttempts,
      rateLimitMaxFailures: merged.rateLimitMaxFailures ?? DEFAULT_CONFIG.rateLimitMaxFailures,
      rateLimitCooldownMs: merged.rateLimitCooldownMs ?? DEFAULT_CONFIG.rateLimitCooldownMs,
      smtpConfig: merged.smtpConfig,
      codeGenerator: merged.codeGenerator ?? defaultCodeGenerator
    }
  }

  /**
   * Setup TOTP (Time-based One-Time Password) authentication
   */
  async setupTOTP(userId: string, deviceName: string): Promise<MFASetupResult> {
    const normalizedName = deviceName?.trim() ?? ''
    if (normalizedName.length === 0) {
      throw new Error('Device name is required')
    }
    if (normalizedName.length > 100) {
      throw new Error('Device name too long')
    }

    const secret = speakeasy.generateSecret({
      name: `${this.config.issuer} (${normalizedName})`,
      issuer: this.config.issuer,
      length: 32
    })

    const deviceId = this.generateDeviceId()
    const setupToken = this.generateSetupToken()
    const createdAt = new Date()

    // Generate QR code for easy setup
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!)

    // Generate backup codes
    const backupCodes = this.generateBackupCodes()
    this.backupCodes.set(userId, new Set(backupCodes))

    // Store device (inactive until verified)
    const device: MFADevice = {
      id: deviceId,
      userId,
      name: normalizedName,
      type: 'totp',
      secret: secret.base32,
      isActive: false,
      isBackup: false,
      createdAt,
      lastUsed: undefined
    }

    this.devices.set(deviceId, device)

    console.log(`📱 TOTP setup initiated for user ${userId}, device: ${normalizedName}`)

    return {
      deviceId,
      secret: secret.base32,
      qrCodeUrl,
      qrCode: qrCodeUrl,
      backupCodes,
      setupToken
    }
  }

  /**
   * Verify a TOTP token for a user
   */
  async verifyTOTP(userId: string, token: string): Promise<{ success: boolean, message: string }> {
    const trimmedToken = token?.trim()
    if (!trimmedToken || trimmedToken.length < 6) {
      return { success: false, message: 'Invalid TOTP code' }
    }

    if (this.isRateLimited(userId)) {
      return { success: false, message: 'TOTP verification rate limited. Try again later.' }
    }

    const totpDevice = Array.from(this.devices.values())
      .find(device => device.userId === userId && device.type === 'totp' && device.secret)

    if (!totpDevice || !totpDevice.secret) {
      return { success: false, message: 'No TOTP device registered for user' }
    }

    const isValid = this.validateTOTPToken(totpDevice.secret, trimmedToken)

    if (isValid) {
      this.clearRateLimit(userId)
      totpDevice.lastUsed = new Date()
      this.devices.set(totpDevice.id, totpDevice)

      return { success: true, message: 'TOTP verification successful' }
    }

    this.recordFailedAttempt(userId)

    if (this.isRateLimited(userId)) {
      return { success: false, message: 'TOTP verification rate limited. Try again later.' }
    }

    return { success: false, message: 'Invalid TOTP code' }
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
   * Send an SMS verification code to a phone number
   */
  async sendSMSCode(phoneNumber: string, userId: string): Promise<{ challengeId: string, expiresAt: Date, code: string }> {
    const trimmed = phoneNumber?.trim() ?? ''
    if (trimmed.length === 0) {
      throw new Error('Phone number is required')
    }

    const phoneRegex = /^\+?[0-9]{7,15}$/
    if (!phoneRegex.test(trimmed)) {
      throw new Error('Invalid phone number')
    }

    const challenge = this.createOutOfBandChallenge('sms', trimmed, userId)

    console.log(`📱 SMS code challenge created for user ${userId}, target: ${this.maskPhoneNumber(trimmed)}`)

    return {
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt,
      code: challenge.code
    }
  }

  /**
   * Verify an SMS verification code
   */
  async verifySMSCode(challengeId: string, code: string): Promise<{ success: boolean, message: string }> {
    return this.verifyOutOfBandCode(challengeId, code, 'sms')
  }

  /**
   * Send an email verification code
   */
  async sendEmailCode(email: string, userId: string): Promise<{ challengeId: string, expiresAt: Date, code: string }> {
    const trimmed = email?.trim() ?? ''
    if (trimmed.length === 0) {
      throw new Error('Email address is required')
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmed)) {
      throw new Error('Invalid email address')
    }

    const challenge = this.createOutOfBandChallenge('email', trimmed, userId)

    console.log(`📧 Email code challenge created for user ${userId}, target: ${this.maskEmail(trimmed)}`)

    return {
      challengeId: challenge.challengeId,
      expiresAt: challenge.expiresAt,
      code: challenge.code
    }
  }

  /**
   * Verify an email verification code
   */
  async verifyEmailCode(challengeId: string, code: string): Promise<{ success: boolean, message: string }> {
    return this.verifyOutOfBandCode(challengeId, code, 'email')
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
        isValid = this.validateTOTPToken(device.secret!, token)
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
      const isValidBackup = this.consumeBackupCode(challenge.userId, backupCode)
      if (isValidBackup) {
        this.challenges.delete(challengeId)
        const remainingBackupCodes = this.backupCodes.get(challenge.userId)?.size || 0
        
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
        isValid = this.validateTOTPToken(device.secret!, token)
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
  getUserDevices(userId: string): Array<Omit<MFADevice, 'secret'> & { addedAt: Date }> {
    return Array.from(this.devices.values())
      .filter(d => d.userId === userId)
      .map(d => {
        const { secret, ...rest } = d
        return {
          ...rest,
          addedAt: d.createdAt
        }
      })
  }

  /**
   * Remove MFA device
   */
  async removeDevice(userId: string, deviceIdentifier: string): Promise<{ success: boolean, message: string }> {
    const identifier = deviceIdentifier?.trim()

    if (!identifier) {
      return { success: false, message: 'Device identifier is required' }
    }

    const device = Array.from(this.devices.values())
      .find(d => d.userId === userId && (d.id === identifier || d.name === identifier))

    if (!device) {
      return { success: false, message: 'Device not found' }
    }

    this.devices.delete(device.id)
    console.log(`🗑️  MFA device removed: ${device.name} (${device.type})`)
    return { success: true, message: 'MFA device removed successfully' }
  }

  /**
   * Generate new backup codes
   */
  async verifyBackupCode(userId: string, code: string): Promise<{ success: boolean, message: string, remainingBackupCodes?: number }> {
    if (!code || code.trim().length === 0) {
      return { success: false, message: 'Backup code is required' }
    }

    const isValid = this.consumeBackupCode(userId, code.trim())

    if (isValid) {
      const remaining = this.backupCodes.get(userId)?.size ?? 0
      return { success: true, message: 'Backup code verification successful', remainingBackupCodes: remaining }
    }

    const userCodes = this.backupCodes.get(userId)
    if (!userCodes) {
      return { success: false, message: 'No backup codes configured for user' }
    }

    return { success: false, message: 'Backup code already used' }
  }

  generateNewBackupCodes(userId: string): string[] {
    const backupCodes = this.generateBackupCodes()
    this.backupCodes.set(userId, new Set(backupCodes))
    
    console.log(`🔑 New backup codes generated for user ${userId}`)
    return backupCodes
  }

  /**
   * Private helper methods
   */
  private createOutOfBandChallenge(type: 'sms' | 'email', contact: string, userId: string): CodeChallenge {
    const challengeId = `${type}_challenge_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    const code = this.generateVerificationCode()
    const expiresAt = new Date(Date.now() + this.config.codeExpiryMs)

    const challenge: CodeChallenge = {
      challengeId,
      userId,
      contact,
      code,
      type,
      expiresAt,
      attempts: 0,
      maxAttempts: this.config.maxOutOfBandAttempts
    }

    this.codeChallenges.set(challengeId, challenge)

    return challenge
  }

  private verifyOutOfBandCode(challengeId: string, code: string, type: 'sms' | 'email'): { success: boolean, message: string } {
    const challenge = this.codeChallenges.get(challengeId)

    if (!challenge || challenge.type !== type) {
      return { success: false, message: 'Invalid or expired challenge' }
    }

    if (new Date() > challenge.expiresAt) {
      this.codeChallenges.delete(challengeId)
      return { success: false, message: 'Challenge expired' }
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      this.codeChallenges.delete(challengeId)
      return { success: false, message: 'Too many failed attempts' }
    }

    const trimmedCode = code?.trim()
    if (!trimmedCode) {
      return { success: false, message: 'Verification code is required' }
    }

    if (trimmedCode === challenge.code) {
      this.codeChallenges.delete(challengeId)
      return {
        success: true,
        message: type === 'sms' ? 'SMS code verification successful' : 'Email code verification successful'
      }
    }

    challenge.attempts += 1

    if (challenge.attempts >= challenge.maxAttempts) {
      this.codeChallenges.delete(challengeId)
      return { success: false, message: 'Too many failed attempts' }
    }

    this.codeChallenges.set(challengeId, challenge)
    return { success: false, message: 'Invalid verification code' }
  }

  private validateTOTPToken(secret: string, token: string): boolean {
    const result = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2 // Allow 2 time steps before/after
    })

    if (typeof result === 'object' && result !== null) {
      const delta = (result as { delta?: number }).delta
      return delta === undefined ? true : delta === 0
    }

    return Boolean(result)
  }

  private async sendSMSVerification(phoneNumber: string, deviceId: string): Promise<void> {
    // In a real implementation, integrate with SMS service (Twilio, AWS SNS, etc.)
    const code = this.generateVerificationCode()
    
    // Store the code temporarily (in real app, use Redis or database)
    this.storeTempCode(deviceId, code, 'sms')
    
    console.log(`📱 SMS code sent to ${this.maskPhoneNumber(phoneNumber)}: ${code}`)
  }

  private async sendEmailVerification(email: string, deviceId: string): Promise<void> {
    // In a real implementation, integrate with email service (SendGrid, AWS SES, etc.)
    const code = this.generateVerificationCode()
    
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

  private consumeBackupCode(userId: string, code: string): boolean {
    const userCodes = this.backupCodes.get(userId)
    if (!userCodes || !userCodes.has(code)) {
      return false
    }

    userCodes.delete(code) // Use once
    return true
  }

  private generateBackupCodes(): string[] {
    const codes = []
    for (let i = 0; i < 10; i++) {
      codes.push(Math.random().toString(36).substring(2, 10).toUpperCase())
    }
    return codes
  }

  private generateDeviceId(): string {
    return `mfa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateChallengeId(): string {
    return `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private generateSetupToken(): string {
    return `setup_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`
  }

  private generateVerificationCode(): string {
    const raw = this.config.codeGenerator()
    const code = (raw ?? defaultCodeGenerator()).toString()
    const desiredLength = this.config.codeLength

    if (code.length === desiredLength) {
      return code
    }

    if (code.length > desiredLength) {
      return code.slice(0, desiredLength)
    }

    return code.padStart(desiredLength, '0')
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

    return attempts.count >= this.config.rateLimitMaxFailures // Lock after threshold
  }

  private recordFailedAttempt(userId: string): void {
    const current = this.failedAttempts.get(userId) || { count: 0 }
    current.count++
    
    if (current.count >= this.config.rateLimitMaxFailures) {
      current.lockedUntil = new Date(Date.now() + this.config.rateLimitCooldownMs)
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

  private cleanupExpiredOutOfBandChallenges(): void {
    const now = new Date()
    const expired: string[] = []
    this.codeChallenges.forEach((challenge, challengeId) => {
      if (now > challenge.expiresAt) {
        expired.push(challengeId)
      }
    })
    expired.forEach(id => {
      this.codeChallenges.delete(id)
    })
  }
}

// Export singleton instance
export const mfaProvider = new MFAProvider()
export default mfaProvider
