/**
 * Basic authentication functionality tests
 */

import { SAMLProvider } from '@/lib/auth/saml-provider'
import { MFAProvider } from '@/lib/auth/mfa-provider'

// Use real implementations for better test coverage
// Mocks are only needed if external dependencies are unavailable

describe('Authentication Features', () => {
  describe('SAML Provider', () => {
    let samlProvider: SAMLProvider

    beforeEach(() => {
      samlProvider = new SAMLProvider({
        entityId: 'https://test-idp.com',
        singleSignOnUrl: 'https://test-idp.com/sso',
        x509Certificate: 'LS0tLS1CRUdJTi0tLS0t',
        attributeMapping: {
          email: 'email',
          firstName: 'firstName',
          lastName: 'lastName'
        }
      }, {
        entityId: 'https://app.com',
        assertionConsumerServiceUrl: 'https://app.com/saml/acs'
      })
    })

    it('should create SAML provider successfully', () => {
      expect(samlProvider).toBeDefined()
    })

    it('should generate SAML auth request', () => {
      const result = samlProvider.generateAuthRequest({
        assertionConsumerServiceURL: 'https://app.com/saml/acs',
        destination: 'https://test-idp.com/sso'
      })

      expect(result).toHaveProperty('url')
      expect(result).toHaveProperty('samlRequest')
      expect(result.url).toContain('SAMLRequest=')
    })

    it('should generate service provider metadata', () => {
      const metadata = samlProvider.getServiceProviderMetadata()

      expect(metadata).toContain('EntityDescriptor')
      expect(metadata).toContain('SPSSODescriptor')
      expect(metadata).toContain('https://app.com')
    })

    it('should validate configuration', () => {
      expect(() => new SAMLProvider({
        entityId: 'invalid-url',
        singleSignOnUrl: 'https://test.com',
        x509Certificate: 'cert',
        attributeMapping: { email: 'email' }
      }, {
        entityId: 'https://app.com',
        assertionConsumerServiceUrl: 'https://app.com/acs'
      })).toThrow()
    })
  })

  describe('MFA Provider', () => {
    let mfaProvider: MFAProvider

    beforeEach(() => {
      mfaProvider = new MFAProvider({
        issuer: 'TestApp'
      })
    })

    it('should create MFA provider successfully', () => {
      expect(mfaProvider).toBeDefined()
    })

    it('should setup TOTP for user', async () => {
      const result = await mfaProvider.setupTOTP('user123', 'My Device')

      expect(result).toHaveProperty('secret')
      expect(result).toHaveProperty('qrCodeUrl')
      expect(result).toHaveProperty('backupCodes')
      expect(typeof result.secret).toBe('string')
      expect(result.secret.length).toBeGreaterThan(0)
      expect(result.qrCodeUrl).toMatch(/^data:image\/png;base64,/)
      expect(result.backupCodes).toHaveLength(10)
      expect(result.backupCodes.every(code => typeof code === 'string' && code.length > 0)).toBe(true)
    })

    it('should generate backup codes', async () => {
      await mfaProvider.setupTOTP('user123', 'Test Device')
      
      const newCodes = await mfaProvider.generateNewBackupCodes('user123')

      expect(newCodes).toHaveLength(10)
      expect(newCodes.every(code => typeof code === 'string')).toBe(true)
    })

    it('should list user devices', async () => {
      await mfaProvider.setupTOTP('user123', 'Device 1')
      
      const devices = await mfaProvider.getUserDevices('user123')

      expect(Array.isArray(devices)).toBe(true)
      expect(devices.length).toBeGreaterThan(0)
      expect(devices[0]).toHaveProperty('name')
      expect(devices[0]).toHaveProperty('type')
      expect(devices[0]).toHaveProperty('createdAt')
    })

    it('should setup SMS authentication', async () => {
      const result = await mfaProvider.setupSMS('user123', '+1234567890', 'My Phone')

      expect(result).toHaveProperty('deviceId')
      expect(result).toHaveProperty('setupToken')
    })

    it('should setup email authentication', async () => {
      const result = await mfaProvider.setupEmail('user123', 'user@example.com', 'Email MFA')

      expect(result).toHaveProperty('deviceId')
      expect(result).toHaveProperty('setupToken')
    })
  })

  describe('Integration', () => {
    it('should create both providers without conflicts', () => {
      const samlProvider = new SAMLProvider({
        entityId: 'https://test-idp.com',
        singleSignOnUrl: 'https://test-idp.com/sso',
        x509Certificate: 'LS0tLS1CRUdJTi0tLS0t',
        attributeMapping: { email: 'email' }
      }, {
        entityId: 'https://app.com',
        assertionConsumerServiceUrl: 'https://app.com/saml/acs'
      })

      const mfaProvider = new MFAProvider({ issuer: 'TestApp' })

      expect(samlProvider).toBeDefined()
      expect(mfaProvider).toBeDefined()
    })
  })
})