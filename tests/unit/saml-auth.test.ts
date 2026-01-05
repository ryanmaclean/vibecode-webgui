/**
 * Unit tests for SAML authentication provider
 */

// Mock crypto BEFORE importing SAMLProvider
jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => Buffer.from('mockrandomdata', 'utf8')),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mockedhash')
  }))
}))

import { SAMLProvider } from '@/lib/auth/saml-provider'
import crypto from 'crypto'

const mockCrypto = crypto as jest.Mocked<typeof crypto>

describe('SAML Authentication Provider', () => {
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
      assertionConsumerServiceUrl: 'https://app.com/saml/acs',
      privateKey: 'test-private-key',
      certificate: 'test-cert'
    })
  })

  describe('SAML Request Generation', () => {
    it('should generate valid SAML auth request', () => {
      const result = samlProvider.generateAuthRequest({
        assertionConsumerServiceURL: 'https://app.com/saml/acs',
        destination: 'https://idp.com/sso'
      })

      expect(result).toHaveProperty('url')
      expect(result).toHaveProperty('samlRequest')
      expect(result.url).toContain('SAMLRequest=')
      expect(result.samlRequest).toBeTruthy()
    })

    it('should include correct destination in auth request', () => {
      const destination = 'https://test-idp.com/sso'
      const result = samlProvider.generateAuthRequest({
        assertionConsumerServiceURL: 'https://app.com/saml/acs',
        destination
      })

      expect(result.url).toContain(encodeURIComponent(destination))
    })

    it('should generate unique request IDs', () => {
      mockCrypto.randomBytes
        .mockReturnValueOnce(Buffer.from('random1', 'utf8'))
        .mockReturnValueOnce(Buffer.from('random2', 'utf8'))

      const result1 = samlProvider.generateAuthRequest({
        assertionConsumerServiceURL: 'https://app.com/saml/acs',
        destination: 'https://idp.com/sso'
      })

      const result2 = samlProvider.generateAuthRequest({
        assertionConsumerServiceURL: 'https://app.com/saml/acs', 
        destination: 'https://idp.com/sso'
      })

      expect(result1.samlRequest).not.toEqual(result2.samlRequest)
    })
  })

  describe('SAML Response Processing', () => {
    const mockSamlResponse = `
      <samlp:Response xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol">
        <saml:Assertion xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion">
          <saml:Subject>
            <saml:NameID Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress">
              test@example.com
            </saml:NameID>
          </saml:Subject>
          <saml:AttributeStatement>
            <saml:Attribute Name="firstName">
              <saml:AttributeValue>John</saml:AttributeValue>
            </saml:Attribute>
            <saml:Attribute Name="lastName">
              <saml:AttributeValue>Doe</saml:AttributeValue>
            </saml:Attribute>
          </saml:AttributeStatement>
        </saml:Assertion>
      </samlp:Response>
    `

    it('should process valid SAML response', async () => {
      const encodedResponse = Buffer.from(mockSamlResponse).toString('base64')
      
      const result = await samlProvider.processResponse(encodedResponse)

      expect(result).toHaveProperty('nameId')
      expect(result).toHaveProperty('attributes')
      expect(result.nameId).toBe('test@example.com')
      expect(result.attributes.firstName).toBe('John')
      expect(result.attributes.lastName).toBe('Doe')
    })

    it('should reject empty SAML response', async () => {
      await expect(samlProvider.processResponse('')).rejects.toThrow('Invalid SAML response')
    })

    it('should reject malformed SAML response', async () => {
      const malformedResponse = Buffer.from('<invalid>xml</invalid>').toString('base64')
      
      await expect(samlProvider.processResponse(malformedResponse)).rejects.toThrow()
    })
  })

  describe('Metadata Generation', () => {
    it('should generate valid SP metadata', () => {
      const metadata = samlProvider.getServiceProviderMetadata()

      expect(metadata).toContain('EntityDescriptor')
      expect(metadata).toContain('SPSSODescriptor')
      expect(metadata).toContain('https://app.com')
    })

    it('should include correct entity ID in metadata', () => {
      const metadata = samlProvider.getServiceProviderMetadata()
      
      expect(metadata).toContain('entityID="https://app.com"')
    })
  })

  describe('Configuration Validation', () => {
    it('should validate required configuration', () => {
      expect(() => new SAMLProvider({
        entityId: '',
        singleSignOnUrl: 'https://test.com',
        x509Certificate: 'cert',
        attributeMapping: { email: 'email' }
      }, {
        entityId: 'https://app.com',
        assertionConsumerServiceUrl: 'https://app.com/acs'
      })).toThrow()

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

    it('should validate URL formats', () => {
      expect(() => new SAMLProvider({
        entityId: 'https://test.com',
        singleSignOnUrl: 'invalid-url',
        x509Certificate: 'cert',
        attributeMapping: { email: 'email' }
      }, {
        entityId: 'https://app.com',
        assertionConsumerServiceUrl: 'https://app.com/acs'
      })).toThrow()
    })
  })
})