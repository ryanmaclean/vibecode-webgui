/**
 * Multi-Factor Authentication Provider
 * Handles MFA device management, TOTP verification, and backup codes
 */

import * as crypto from 'crypto';
import * as base32 from 'hi-base32';

export interface MFADevice {
  id: string;
  userId: string;
  type: 'totp' | 'sms' | 'email';
  name: string;
  secret?: string; // Base32 encoded secret for TOTP
  phoneNumber?: string; // For SMS
  email?: string; // For email
  enabled: boolean;
  isActive: boolean; // Alias for enabled (for compatibility)
  createdAt: Date;
  lastUsed?: Date;
}

export interface MFAChallenge {
  id: string;
  userId: string;
  deviceId: string;
  type: 'totp' | 'sms' | 'email' | 'backup';
  challenge: string;
  expiresAt: Date;
  attempts: number;
  maxAttempts: number;
}

export interface MFAVerificationResult {
  success: boolean;
  device?: MFADevice;
  deviceId?: string;
  deviceType?: 'totp' | 'sms' | 'email';
  backupCodeUsed?: boolean;
  remainingBackupCodes?: number;
  error?: string;
  message?: string;
}

export interface MFASetupResult {
  deviceId: string;
  qrCodeUrl?: string;
  secret?: string;
  backupCodes: string[];
  setupToken: string;
}

export interface MFAChallengeResult {
  challengeId: string;
  availableDevices: Array<{
    id: string;
    name: string;
    type: 'totp' | 'sms' | 'email';
  }>;
}

/**
 * MFA Provider for managing multi-factor authentication
 */
export class MFAProvider {
  private devices: Map<string, MFADevice> = new Map();
  private challenges: Map<string, MFAChallenge> = new Map();
  private backupCodes: Map<string, string[]> = new Map(); // userId -> codes
  private setupTokens: Map<string, { deviceId: string; expiresAt: Date }> = new Map(); // setupToken -> deviceId

  /**
   * Register a new MFA device for a user
   */
  registerDevice(
    userId: string,
    type: MFADevice['type'],
    name: string,
    options: {
      phoneNumber?: string;
      email?: string;
    } = {}
  ): MFADevice {
    // Generate a cryptographically secure secret for TOTP
    const secret = type === 'totp'
      ? base32.encode(crypto.randomBytes(32))
      : undefined;

    const device: MFADevice = {
      id: crypto.randomUUID(),
      userId,
      type,
      name,
      secret,
      phoneNumber: options.phoneNumber,
      email: options.email,
      enabled: false, // Must be verified before enabling
      isActive: false, // Alias for enabled
      createdAt: new Date()
    };

    this.devices.set(device.id, device);
    return device;
  }

  /**
   * Setup TOTP device - wrapper for registerDevice with TOTP type
   */
  async setupTOTP(userId: string, name: string): Promise<MFASetupResult> {
    const device = this.registerDevice(userId, 'totp', name);

    // Generate QR code URL for TOTP apps
    const issuer = 'VibeCode';
    const accountName = userId;
    const qrCodeUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${device.secret}&issuer=${encodeURIComponent(issuer)}`;

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(userId);

    // Generate setup token for verification
    const setupToken = crypto.randomUUID();
    this.setupTokens.set(setupToken, {
      deviceId: device.id,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    });

    return {
      deviceId: device.id,
      qrCodeUrl,
      secret: device.secret,
      backupCodes,
      setupToken
    };
  }

  /**
   * Setup SMS device - wrapper for registerDevice with SMS type
   */
  async setupSMS(userId: string, phoneNumber: string, name: string): Promise<MFASetupResult> {
    const device = this.registerDevice(userId, 'sms', name, { phoneNumber });

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(userId);

    // Generate setup token for verification
    const setupToken = crypto.randomUUID();
    this.setupTokens.set(setupToken, {
      deviceId: device.id,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    });

    return {
      deviceId: device.id,
      backupCodes,
      setupToken
    };
  }

  /**
   * Setup Email device - wrapper for registerDevice with Email type
   */
  async setupEmail(userId: string, email: string, name: string): Promise<MFASetupResult> {
    const device = this.registerDevice(userId, 'email', name, { email });

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(userId);

    // Generate setup token for verification
    const setupToken = crypto.randomUUID();
    this.setupTokens.set(setupToken, {
      deviceId: device.id,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
    });

    return {
      deviceId: device.id,
      backupCodes,
      setupToken
    };
  }

  /**
   * Verify device setup with token
   */
  async verifySetup(deviceId: string, token: string, setupToken: string): Promise<boolean> {
    // Verify setup token
    const tokenData = this.setupTokens.get(setupToken);
    if (!tokenData || tokenData.deviceId !== deviceId) {
      return false;
    }

    // Check if setup token has expired
    if (new Date() > tokenData.expiresAt) {
      this.setupTokens.delete(setupToken);
      return false;
    }

    const device = this.devices.get(deviceId);
    if (!device) {
      return false;
    }

    let verified = false;

    // Verify based on device type
    switch (device.type) {
      case 'totp':
        verified = this.verifyTOTP(deviceId, token);
        break;
      case 'sms':
      case 'email':
        // For SMS/Email, we would verify against a sent code
        // For now, accept any 6-digit code
        verified = /^\d{6}$/.test(token);
        break;
    }

    if (verified) {
      // Enable the device
      this.enableDevice(deviceId);
      // Clean up setup token
      this.setupTokens.delete(setupToken);
    }

    return verified;
  }

  /**
   * Enable MFA device after verification
   */
  enableDevice(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    device.enabled = true;
    device.isActive = true; // Keep in sync with enabled
    device.lastUsed = new Date();
    this.devices.set(deviceId, device);
    return true;
  }

  /**
   * Disable MFA device
   */
  disableDevice(deviceId: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device) return false;

    device.enabled = false;
    device.isActive = false; // Keep in sync with enabled
    this.devices.set(deviceId, device);
    return true;
  }

  /**
   * Remove MFA device (with user verification)
   */
  async removeDevice(deviceId: string, userId: string): Promise<boolean> {
    const device = this.devices.get(deviceId);
    if (!device || device.userId !== userId) {
      return false;
    }
    return this.devices.delete(deviceId);
  }

  /**
   * Get all MFA devices for a user
   */
  getUserDevices(userId: string): MFADevice[] {
    return Array.from(this.devices.values())
      .filter(device => device.userId === userId);
  }

  /**
   * Generate backup codes for a user
   */
  generateBackupCodes(userId: string, count: number = 10): string[] {
    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
      // Generate 8-character alphanumeric codes
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(code);
    }

    // Hash the codes for storage (only store hashes, not plain text)
    const hashedCodes = codes.map(code => this.hashCode(code));
    this.backupCodes.set(userId, hashedCodes);

    // Return plain text codes to user (they should save these)
    return codes;
  }

  /**
   * Verify backup code
   */
  verifyBackupCode(userId: string, code: string): boolean {
    const userCodes = this.backupCodes.get(userId);
    if (!userCodes) return false;

    const hashedInput = this.hashCode(code);

    // Check if the hashed code exists in user's codes
    const index = userCodes.indexOf(hashedInput);
    if (index === -1) {
      return false;
    }

    // Remove the used code from the array
    userCodes.splice(index, 1);

    // If no codes left, remove the user from backup codes map
    if (userCodes.length === 0) {
      this.backupCodes.delete(userId);
    } else {
      this.backupCodes.set(userId, userCodes);
    }

    return true;
  }

  /**
   * Verify TOTP code for a device
   */
  verifyTOTP(deviceId: string, code: string): boolean {
    const device = this.devices.get(deviceId);
    if (!device || !device.enabled || !device.secret) {
      return false;
    }

    // Use a TOTP library or implement TOTP verification here
    // For now, we'll use a simple time-based verification
    const currentTime = Math.floor(Date.now() / 30000); // 30-second windows
    const expectedCode = this.generateTOTPCode(device.secret, currentTime);

    return expectedCode === code;
  }

  /**
   * Create MFA challenge for verification
   */
  async createChallenge(
    userId: string,
    preferredDeviceId?: string
  ): Promise<MFAChallengeResult> {
    // Get all enabled devices for this user
    const userDevices = this.getUserDevices(userId).filter(d => d.enabled);

    if (userDevices.length === 0) {
      throw new Error('No enabled MFA devices found for user');
    }

    // Select device to use
    let selectedDevice = userDevices[0];
    if (preferredDeviceId) {
      const preferred = userDevices.find(d => d.id === preferredDeviceId);
      if (preferred) {
        selectedDevice = preferred;
      }
    }

    // Create challenge
    const challengeId = crypto.randomUUID();
    const challenge: MFAChallenge = {
      id: challengeId,
      userId,
      deviceId: selectedDevice.id,
      type: selectedDevice.type,
      challenge: this.generateChallengeCode(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      attempts: 0,
      maxAttempts: 3
    };

    this.challenges.set(challengeId, challenge);

    // Return challenge result with available devices
    return {
      challengeId,
      availableDevices: userDevices.map(d => ({
        id: d.id,
        name: d.name,
        type: d.type
      }))
    };
  }

  /**
   * Verify MFA challenge response
   */
  async verifyChallenge(
    challengeId: string,
    token: string,
    backupCode?: string
  ): Promise<MFAVerificationResult> {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) {
      return { success: false, error: 'Challenge not found' };
    }

    // Check if challenge has expired
    if (new Date() > challenge.expiresAt) {
      this.challenges.delete(challengeId);
      return { success: false, error: 'Challenge expired' };
    }

    // Check if too many attempts
    if (challenge.attempts >= challenge.maxAttempts) {
      this.challenges.delete(challengeId);
      return { success: false, error: 'Too many attempts' };
    }

    challenge.attempts++;

    let success = false;
    let backupCodeUsed = false;

    // First try backup code if provided
    if (backupCode) {
      success = this.verifyBackupCode(challenge.userId, backupCode);
      backupCodeUsed = success;
    } else if (token) {
      // Otherwise verify with token
      switch (challenge.type) {
        case 'totp':
          success = this.verifyTOTP(challenge.deviceId, token);
          break;
        case 'backup':
          success = this.verifyBackupCode(challenge.userId, token);
          backupCodeUsed = success;
          break;
        // SMS and email would require external service integration
        case 'sms':
        case 'email':
          // For demo purposes, accept any 6-digit code
          success = /^\d{6}$/.test(token);
          break;
      }
    }

    if (success) {
      this.challenges.delete(challengeId);

      // Update device last used time
      const device = this.devices.get(challenge.deviceId);
      if (device) {
        device.lastUsed = new Date();
        this.devices.set(challenge.deviceId, device);
      }

      return {
        success: true,
        device,
        deviceId: device?.id,
        deviceType: device?.type,
        backupCodeUsed,
        remainingBackupCodes: this.getBackupCodesCount(challenge.userId)
      };
    }

    this.challenges.set(challengeId, challenge);
    return { success: false, error: 'Invalid code' };
  }

  /**
   * Get device by ID
   */
  getDevice(deviceId: string): MFADevice | undefined {
    return this.devices.get(deviceId);
  }

  /**
   * Check if user has any enabled MFA devices
   */
  hasEnabledDevices(userId: string): boolean {
    return this.getUserDevices(userId).some(device => device.enabled);
  }

  /**
   * Get remaining backup codes count for user
   */
  getBackupCodesCount(userId: string): number {
    const userCodes = this.backupCodes.get(userId);
    return userCodes ? userCodes.length : 0;
  }

  /**
   * Hash a code for secure storage
   */
  private hashCode(code: string): string {
    return crypto.createHash('sha256').update(code).digest('hex');
  }

  /**
   * Generate TOTP code for given secret and time
   */
  private generateTOTPCode(secret: string, timeStep: number): string {
    // This is a simplified TOTP implementation
    // In production, use a proper TOTP library like 'otplib' or 'speakeasy'
    const key = base32.decode.asBytes(secret);
    const time = Buffer.alloc(8);
    time.writeBigUInt64BE(BigInt(timeStep), 0);

    const hmac = crypto.createHmac('sha1', Buffer.from(key));
    hmac.update(time);
    const hash = hmac.digest();

    // Dynamic truncation
    const offset = hash[hash.length - 1] & 0xf;
    const code = ((hash[offset] & 0x7f) << 24) |
                 ((hash[offset + 1] & 0xff) << 16) |
                 ((hash[offset + 2] & 0xff) << 8) |
                 (hash[offset + 3] & 0xff);

    return (code % 1000000).toString().padStart(6, '0');
  }

  /**
   * Generate a random challenge code
   */
  private generateChallengeCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Clean up expired challenges
   */
  cleanupExpiredChallenges(): void {
    const now = new Date();
    for (const [id, challenge] of this.challenges.entries()) {
      if (now > challenge.expiresAt) {
        this.challenges.delete(id);
      }
    }
  }

  /**
   * Get provider statistics
   */
  getStats(): {
    totalDevices: number;
    enabledDevices: number;
    totpDevices: number;
    usersWithMFA: number;
    activeChallenges: number;
  } {
    const devices = Array.from(this.devices.values());
    const enabledDevices = devices.filter(d => d.enabled);
    const totpDevices = devices.filter(d => d.type === 'totp');

    const usersWithMFA = new Set(devices.map(d => d.userId)).size;

    return {
      totalDevices: devices.length,
      enabledDevices: enabledDevices.length,
      totpDevices: totpDevices.length,
      usersWithMFA,
      activeChallenges: this.challenges.size
    };
  }
}

// Export singleton instance for global use
export const mfaProvider = new MFAProvider();
