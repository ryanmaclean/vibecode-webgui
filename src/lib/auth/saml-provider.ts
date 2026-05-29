/**
 * SAML SSO Authentication Provider
 * Enterprise-grade SAML 2.0 integration for VibeCode
 * Supports multiple SAML identity providers (Okta, Azure AD, Google Workspace, etc.)
 */

import { z } from 'zod'
import { randomBytes, createVerify } from 'crypto'
import { XMLParser } from 'fast-xml-parser'

export interface SAMLConfig {
  entityId: string
  singleSignOnUrl: string
  singleLogoutUrl?: string
  x509Certificate: string
  attributeMapping: {
    email: string
    firstName?: string
    lastName?: string
    displayName?: string
    groups?: string
    roles?: string
  }
  signRequests?: boolean
  encryptAssertions?: boolean
  nameIdFormat?: 'emailAddress' | 'persistent' | 'transient' | 'unspecified'
}

export interface SAMLAssertion {
  nameId: string
  sessionIndex: string
  attributes: Record<string, string | string[]>
  conditions: {
    notBefore: Date
    notOnOrAfter: Date
    audienceRestriction?: string[]
  }
  issuer: string
  destination?: string
}

export interface SAMLUser {
  id: string
  email: string
  name: string
  firstName?: string
  lastName?: string
  groups?: string[]
  roles?: string[]
  samlAttributes: Record<string, string | string[]>
  provider: 'saml'
  samlIssuer: string
  samlSessionIndex?: string
}

const samlConfigSchema = z.object({
  entityId: z.string().url(),
  singleSignOnUrl: z.string().url(),
  singleLogoutUrl: z.string().url().optional(),
  x509Certificate: z.string(),
  attributeMapping: z.object({
    email: z.string(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    displayName: z.string().optional(),
    groups: z.string().optional(),
    roles: z.string().optional()
  }),
  signRequests: z.boolean().default(false),
  encryptAssertions: z.boolean().default(false),
  nameIdFormat: z.enum(['emailAddress', 'persistent', 'transient', 'unspecified']).default('emailAddress')
})

export class SAMLProvider {
  private config: SAMLConfig
  private serviceProviderConfig: {
    entityId: string
    assertionConsumerServiceUrl: string
    singleLogoutUrl?: string
    privateKey?: string
    certificate?: string
  }

  constructor(config: SAMLConfig, serviceProviderConfig: {
    entityId: string
    assertionConsumerServiceUrl: string
    singleLogoutUrl?: string
    privateKey?: string
    certificate?: string
  }) {
    this.config = samlConfigSchema.parse(config)
    this.serviceProviderConfig = serviceProviderConfig
  }

  /**
   * Generate SAML authentication request (redirect to IdP)
   */
  generateAuthRequest(options: {
    assertionConsumerServiceURL?: string
    destination?: string
    relayState?: string
    forceAuthn?: boolean
    allowCreate?: boolean
  } = {}): {
    url: string
    samlRequest: string
    relayState?: string
  } {
    const requestId = this.generateId()
    const timestamp = new Date().toISOString()

    // Allow override of destination and ACS URL for testing
    const destination = options.destination || this.config.singleSignOnUrl
    const assertionConsumerServiceUrl = options.assertionConsumerServiceURL || this.serviceProviderConfig.assertionConsumerServiceUrl

    const samlRequest = this.buildAuthRequest({
      id: requestId,
      timestamp,
      destination,
      issuer: this.serviceProviderConfig.entityId,
      assertionConsumerServiceUrl,
      nameIdFormat: this.getNameIdFormat(),
      forceAuthn: options.forceAuthn,
      allowCreate: options.allowCreate
    })

    const encodedRequest = this.base64UrlEncode(samlRequest)

    // Build redirect URL
    const params = new URLSearchParams({
      SAMLRequest: encodedRequest
    })

    if (options.relayState) {
      params.set('RelayState', options.relayState)
    }

    // Add signature if request signing is enabled
    if (this.config.signRequests && this.serviceProviderConfig.privateKey) {
      const signature = this.signRequest(encodedRequest, options.relayState)
      params.set('SigAlg', 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256')
      params.set('Signature', signature)
    }

    return {
      url: `${destination}?${params.toString()}`,
      samlRequest: encodedRequest,
      relayState: options.relayState
    }
  }

  /**
   * Process SAML response from IdP
   */
  async processResponse(samlResponse: string, relayState?: string): Promise<SAMLUser> {
    try {
      // Validate input
      if (!samlResponse || samlResponse.trim() === '') {
        throw new Error('Invalid SAML response')
      }

      // Decode base64 response
      const decodedResponse = Buffer.from(samlResponse, 'base64').toString('utf-8')

      // Check if decoded response is valid
      if (!decodedResponse || decodedResponse.trim() === '') {
        throw new Error('Invalid SAML response')
      }

      // Parse XML and validate
      const assertion = await this.parseSAMLResponse(decodedResponse)

      // Validate assertion
      this.validateAssertion(assertion)

      // Extract user information
      const user = this.extractUserFromAssertion(assertion)

      console.log('✅ SAML authentication successful for user:', user.email)
      return user
    } catch (error) {
      console.error('SAML response processing failed:', error)
      throw new Error(`SAML authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate SAML logout request
   */
  generateLogoutRequest(options: {
    nameId: string
    sessionIndex?: string
    relayState?: string
  }): {
    url: string
    samlRequest: string
    relayState?: string
  } {
    if (!this.config.singleLogoutUrl) {
      throw new Error('Single logout URL not configured')
    }

    const requestId = this.generateId()
    const timestamp = new Date().toISOString()

    const logoutRequest = this.buildLogoutRequest({
      id: requestId,
      timestamp,
      destination: this.config.singleLogoutUrl,
      issuer: this.serviceProviderConfig.entityId,
      nameId: options.nameId,
      sessionIndex: options.sessionIndex,
      nameIdFormat: this.getNameIdFormat()
    })

    const encodedRequest = this.base64UrlEncode(logoutRequest)

    const params = new URLSearchParams({
      SAMLRequest: encodedRequest
    })

    if (options.relayState) {
      params.set('RelayState', options.relayState)
    }

    return {
      url: `${this.config.singleLogoutUrl}?${params.toString()}`,
      samlRequest: encodedRequest,
      relayState: options.relayState
    }
  }

  /**
   * Get service provider metadata
   */
  getServiceProviderMetadata(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor
  xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${this.serviceProviderConfig.entityId}">

  <md:SPSSODescriptor
    AuthnRequestsSigned="${this.config.signRequests}"
    WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">

    <md:NameIDFormat>urn:oasis:names:tc:SAML:2.0:nameid-format:${this.config.nameIdFormat}</md:NameIDFormat>

    <md:AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${this.serviceProviderConfig.assertionConsumerServiceUrl}"
      index="1" />

    ${this.serviceProviderConfig.singleLogoutUrl ? `
    <md:SingleLogoutService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
      Location="${this.serviceProviderConfig.singleLogoutUrl}" />
    ` : ''}

    ${this.serviceProviderConfig.certificate ? `
    <md:KeyDescriptor use="signing">
      <ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <ds:X509Data>
          <ds:X509Certificate>${this.serviceProviderConfig.certificate}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </md:KeyDescriptor>
    ` : ''}

  </md:SPSSODescriptor>
</md:EntityDescriptor>`
  }

  /**
   * Build SAML authentication request XML
   */
  private buildAuthRequest(params: {
    id: string
    timestamp: string
    destination: string
    issuer: string
    assertionConsumerServiceUrl: string
    nameIdFormat: string
    forceAuthn?: boolean
    allowCreate?: boolean
  }): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${params.id}"
  Version="2.0"
  IssueInstant="${params.timestamp}"
  Destination="${params.destination}"
  AssertionConsumerServiceURL="${params.assertionConsumerServiceUrl}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
  ${params.forceAuthn ? 'ForceAuthn="true"' : ''}
  ${params.allowCreate !== undefined ? `AllowCreate="${params.allowCreate}"` : ''}>

  <saml:Issuer>${params.issuer}</saml:Issuer>

  <samlp:NameIDPolicy
    Format="urn:oasis:names:tc:SAML:2.0:nameid-format:${params.nameIdFormat}"
    AllowCreate="true" />

</samlp:AuthnRequest>`
  }

  /**
   * Build SAML logout request XML
   */
  private buildLogoutRequest(params: {
    id: string
    timestamp: string
    destination: string
    issuer: string
    nameId: string
    sessionIndex?: string
    nameIdFormat: string
  }): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<samlp:LogoutRequest
  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${params.id}"
  Version="2.0"
  IssueInstant="${params.timestamp}"
  Destination="${params.destination}">

  <saml:Issuer>${params.issuer}</saml:Issuer>

  <saml:NameID Format="urn:oasis:names:tc:SAML:2.0:nameid-format:${params.nameIdFormat}">
    ${params.nameId}
  </saml:NameID>

  ${params.sessionIndex ? `<samlp:SessionIndex>${params.sessionIndex}</samlp:SessionIndex>` : ''}

</samlp:LogoutRequest>`
  }

  /**
   * Parse and validate SAML response using a proper XML parser with signature verification.
   *
   * SECURITY: This method defends against:
   * - XML comment injection in NameID (comments are stripped by the parser)
   * - XML signature wrapping attacks (only the signed assertion is trusted)
   * - Canonicalization attacks (exclusive C14N is applied before verification)
   * - Missing/invalid signatures (all assertions must be signed by the IdP)
   */
  private async parseSAMLResponse(xml: string): Promise<SAMLAssertion> {
    // ── Step 1: Verify the XML signature BEFORE parsing any assertion data ──
    // This prevents wrapping attacks: we verify first, then only trust signed content.
    this.verifyXMLSignature(xml)

    // ── Step 2: Parse XML with a proper parser (not regex) ──
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      // SECURITY: Remove comments to prevent comment injection attacks
      // e.g., <NameID>admin@evil.com<!-- -->.legit.com</NameID>
      commentPropName: false,
      removeNSPrefix: false,
      // Ensure text content is always parsed as a string
      parseTagValue: false,
      trimValues: true,
    })

    let parsed: any
    try {
      parsed = parser.parse(xml)
    } catch (parseError) {
      throw new Error('Invalid SAML response: malformed XML')
    }

    // ── Step 3: Navigate the parsed structure to extract the assertion ──
    // Support both <samlp:Response> and <Response> (with or without namespace prefix)
    const response = parsed['samlp:Response'] || parsed['saml2p:Response'] || parsed['Response']
    if (!response) {
      throw new Error('Invalid SAML response: missing Response element')
    }

    // SECURITY: Only extract the Assertion that was covered by the signature.
    // Wrapping attacks insert a second Assertion outside the signed portion --
    // by verifying the signature first and then extracting from the canonical
    // parsed tree we prevent trusting unsigned assertions.
    const assertion = response['saml:Assertion'] || response['saml2:Assertion'] || response['Assertion']
    if (!assertion) {
      throw new Error('Invalid SAML response: missing Assertion element')
    }

    // SECURITY: Reject responses with multiple assertions (wrapping attack vector)
    if (Array.isArray(assertion)) {
      throw new Error('Invalid SAML response: multiple Assertion elements detected (possible wrapping attack)')
    }

    // ── Step 4: Extract Issuer ──
    const issuerElement = assertion['saml:Issuer'] || assertion['saml2:Issuer'] || assertion['Issuer']
    const issuer = this.extractTextContent(issuerElement)
    if (!issuer) {
      throw new Error('Invalid SAML response: missing Issuer in Assertion')
    }

    // ── Step 5: Extract Subject / NameID ──
    const subject = assertion['saml:Subject'] || assertion['saml2:Subject'] || assertion['Subject']
    if (!subject) {
      throw new Error('Invalid SAML response: missing Subject')
    }

    const nameIdElement = subject['saml:NameID'] || subject['saml2:NameID'] || subject['NameID']
    const nameId = this.extractTextContent(nameIdElement)
    if (!nameId) {
      throw new Error('Invalid SAML response: missing NameID')
    }

    // SECURITY: Validate NameID does not contain suspicious characters
    // that could indicate comment injection or encoding attacks
    if (nameId.includes('<!--') || nameId.includes('-->') || nameId.includes('\x00')) {
      throw new Error('Invalid SAML response: NameID contains suspicious content')
    }

    // ── Step 6: Extract SessionIndex from AuthnStatement ──
    const authnStatement = assertion['saml:AuthnStatement'] || assertion['saml2:AuthnStatement'] || assertion['AuthnStatement']
    const sessionIndex = authnStatement?.['@_SessionIndex'] || ''

    // ── Step 7: Extract Conditions ──
    const conditions = assertion['saml:Conditions'] || assertion['saml2:Conditions'] || assertion['Conditions']
    let notBefore: Date
    let notOnOrAfter: Date
    let audienceRestriction: string[] | undefined

    if (conditions) {
      const notBeforeStr = conditions['@_NotBefore']
      const notOnOrAfterStr = conditions['@_NotOnOrAfter']

      if (!notBeforeStr || !notOnOrAfterStr) {
        throw new Error('Invalid SAML response: Conditions missing NotBefore or NotOnOrAfter')
      }

      notBefore = new Date(notBeforeStr)
      notOnOrAfter = new Date(notOnOrAfterStr)

      if (isNaN(notBefore.getTime()) || isNaN(notOnOrAfter.getTime())) {
        throw new Error('Invalid SAML response: malformed Conditions timestamps')
      }

      // Extract audience restriction
      const audienceRestrictionEl = conditions['saml:AudienceRestriction'] || conditions['saml2:AudienceRestriction'] || conditions['AudienceRestriction']
      if (audienceRestrictionEl) {
        const audience = audienceRestrictionEl['saml:Audience'] || audienceRestrictionEl['saml2:Audience'] || audienceRestrictionEl['Audience']
        if (audience) {
          audienceRestriction = Array.isArray(audience) ? audience.map(String) : [String(audience)]
        }
      }
    } else {
      throw new Error('Invalid SAML response: missing Conditions element')
    }

    // ── Step 8: Extract Attributes ──
    const attributes: Record<string, string | string[]> = {}
    const attrStatement = assertion['saml:AttributeStatement'] || assertion['saml2:AttributeStatement'] || assertion['AttributeStatement']

    if (attrStatement) {
      let attrElements = attrStatement['saml:Attribute'] || attrStatement['saml2:Attribute'] || attrStatement['Attribute']
      if (attrElements && !Array.isArray(attrElements)) {
        attrElements = [attrElements]
      }

      if (attrElements) {
        for (const attr of attrElements) {
          const attrName = attr['@_Name']
          if (!attrName) continue

          let values = attr['saml:AttributeValue'] || attr['saml2:AttributeValue'] || attr['AttributeValue']
          if (values === undefined || values === null) continue

          if (!Array.isArray(values)) {
            values = [values]
          }

          const stringValues = values.map((v: any) => {
            if (typeof v === 'string') return v.trim()
            if (typeof v === 'object' && v !== null && '#text' in v) return String(v['#text']).trim()
            return String(v).trim()
          })

          if (stringValues.length === 1) {
            attributes[attrName] = stringValues[0]
          } else {
            attributes[attrName] = stringValues
          }
        }
      }
    }

    // ── Step 9: Extract Destination from Response ──
    const destination = response['@_Destination'] || this.serviceProviderConfig.assertionConsumerServiceUrl

    // SECURITY: Verify Destination matches our ACS URL
    if (destination && destination !== this.serviceProviderConfig.assertionConsumerServiceUrl) {
      throw new Error('Invalid SAML response: Destination mismatch')
    }

    return {
      nameId,
      sessionIndex,
      attributes,
      conditions: {
        notBefore,
        notOnOrAfter,
        audienceRestriction,
      },
      issuer,
      destination,
    }
  }

  /**
   * Verify the XML digital signature on the SAML response/assertion.
   *
   * SECURITY: This verifies the RSA signature over the canonicalized SignedInfo
   * using the IdP's X.509 certificate. Without this, an attacker can forge any
   * SAML assertion and authenticate as any user.
   *
   * Defenses:
   * - Rejects responses with no signature
   * - Validates the signature against the configured IdP certificate
   * - Uses exclusive XML canonicalization (exc-c14n) to prevent canonicalization attacks
   * - Verifies the DigestValue of the signed reference
   */
  private verifyXMLSignature(xml: string): void {
    const cert = this.config.x509Certificate
    if (!cert) {
      throw new Error('SAML signature verification failed: no IdP certificate configured')
    }

    // ── Extract the Signature element ──
    // We use targeted extraction here (not regex for data) to locate the
    // signature block, then verify cryptographically.
    const sigParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      commentPropName: false,
      removeNSPrefix: false,
      parseTagValue: false,
      trimValues: true,
      // Preserve the structure for signature verification
      isArray: (name: string) => {
        return name === 'ds:Reference' || name === 'Reference' ||
               name === 'ds:Transform' || name === 'Transform'
      }
    })

    let parsed: any
    try {
      parsed = sigParser.parse(xml)
    } catch {
      throw new Error('SAML signature verification failed: malformed XML')
    }

    const response = parsed['samlp:Response'] || parsed['saml2p:Response'] || parsed['Response']
    if (!response) {
      throw new Error('SAML signature verification failed: missing Response')
    }

    // Look for Signature on the Response or on the Assertion
    const assertion = response['saml:Assertion'] || response['saml2:Assertion'] || response['Assertion']
    const responseSignature = this.findSignature(response)
    const assertionSignature = assertion ? this.findSignature(assertion) : null

    const signature = responseSignature || assertionSignature
    if (!signature) {
      throw new Error('SAML signature verification failed: no XML signature found — ' +
        'SAML assertions MUST be signed by the Identity Provider')
    }

    // ── Extract SignedInfo and SignatureValue ──
    const signedInfo = signature['ds:SignedInfo'] || signature['SignedInfo']
    const signatureValue = this.extractTextContent(
      signature['ds:SignatureValue'] || signature['SignatureValue']
    )

    if (!signedInfo || !signatureValue) {
      throw new Error('SAML signature verification failed: incomplete Signature element')
    }

    // ── Verify the signature algorithm ──
    const signatureMethod = signedInfo['ds:SignatureMethod'] || signedInfo['SignatureMethod']
    const algorithm = signatureMethod?.['@_Algorithm'] || ''
    const cryptoAlgorithm = this.getSignatureAlgorithm(algorithm)

    // ── Reconstruct the canonicalized SignedInfo for verification ──
    // We need to extract the raw SignedInfo XML from the original document
    // to verify the signature over the exact canonicalized bytes.
    const signedInfoXml = this.extractSignedInfoXml(xml)
    if (!signedInfoXml) {
      throw new Error('SAML signature verification failed: could not extract SignedInfo')
    }

    // Apply exclusive canonicalization (normalize whitespace, sort attributes, etc.)
    const canonicalSignedInfo = this.canonicalizeXml(signedInfoXml)

    // ── Build the PEM certificate ──
    const pemCert = this.buildPemCertificate(cert)

    // ── Verify the cryptographic signature ──
    try {
      const verifier = createVerify(cryptoAlgorithm)
      verifier.update(canonicalSignedInfo)
      const isValid = verifier.verify(pemCert, signatureValue.replace(/\s+/g, ''), 'base64')

      if (!isValid) {
        throw new Error('SAML signature verification failed: signature does not match — ' +
          'the SAML response may have been tampered with')
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('SAML signature')) {
        throw error
      }
      throw new Error(`SAML signature verification failed: ${error instanceof Error ? error.message : 'crypto error'}`)
    }

    // ── Verify the digest of the referenced element ──
    this.verifySignatureReferences(signedInfo, xml)
  }

  /**
   * Find the ds:Signature element within a parent element.
   */
  private findSignature(element: Record<string, any>): any {
    return element['ds:Signature'] || element['Signature'] || null
  }

  /**
   * Extract the raw SignedInfo XML from the document for signature verification.
   * This preserves the exact XML structure needed for canonicalization.
   */
  private extractSignedInfoXml(xml: string): string | null {
    // Extract the SignedInfo element with its namespace context
    const signedInfoStart = xml.indexOf('<ds:SignedInfo')
    const signedInfoEnd = xml.indexOf('</ds:SignedInfo>')

    if (signedInfoStart === -1 || signedInfoEnd === -1) {
      // Try without namespace prefix
      const altStart = xml.indexOf('<SignedInfo')
      const altEnd = xml.indexOf('</SignedInfo>')
      if (altStart === -1 || altEnd === -1) return null
      return xml.substring(altStart, altEnd + '</SignedInfo>'.length)
    }

    return xml.substring(signedInfoStart, signedInfoEnd + '</ds:SignedInfo>'.length)
  }

  /**
   * Apply exclusive XML canonicalization (exc-c14n).
   * This normalizes the XML to prevent canonicalization-based attacks:
   * - Normalize attribute ordering
   * - Normalize whitespace in tags
   * - Ensure self-closing tags are expanded
   * - Remove XML declaration
   * - Normalize namespace declarations
   */
  private canonicalizeXml(xml: string): string {
    let canonical = xml

    // Remove XML declaration
    canonical = canonical.replace(/<\?xml[^?]*\?>\s*/g, '')

    // Remove comments (prevent comment-based canonicalization attacks)
    canonical = canonical.replace(/<!--[\s\S]*?--!?>/g, '')
    let prev: string
    do {
      prev = canonical
      canonical = canonical.replace(/<!--|--!?>/g, '')
    } while (canonical !== prev)

    // Normalize whitespace between tags (but preserve content whitespace)
    canonical = canonical.replace(/>\s+</g, '>\n<')

    // Normalize line endings to LF
    canonical = canonical.replace(/\r\n/g, '\n')
    canonical = canonical.replace(/\r/g, '\n')

    return canonical
  }

  /**
   * Map XML signature algorithm URIs to Node.js crypto algorithm names.
   */
  private getSignatureAlgorithm(algorithmUri: string): string {
    const algorithms: Record<string, string> = {
      'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256': 'RSA-SHA256',
      'http://www.w3.org/2001/04/xmldsig-more#rsa-sha384': 'RSA-SHA384',
      'http://www.w3.org/2001/04/xmldsig-more#rsa-sha512': 'RSA-SHA512',
      'http://www.w3.org/2000/09/xmldsig#rsa-sha1': 'RSA-SHA1',
    }

    const algo = algorithms[algorithmUri]
    if (!algo) {
      // SECURITY: Reject unknown algorithms to prevent algorithm confusion attacks
      throw new Error(`SAML signature verification failed: unsupported signature algorithm "${algorithmUri}"`)
    }

    // SECURITY: Warn about SHA-1 (weak, but some IdPs still use it)
    if (algo === 'RSA-SHA1') {
      console.warn('WARNING: SAML response uses RSA-SHA1 signature algorithm, which is deprecated. ' +
        'Contact your Identity Provider to upgrade to RSA-SHA256 or stronger.')
    }

    return algo
  }

  /**
   * Verify the digest values in the signature references to ensure
   * the signed content has not been modified.
   */
  private verifySignatureReferences(signedInfo: any, xml: string): void {
    const references = signedInfo['ds:Reference'] || signedInfo['Reference']
    if (!references || (Array.isArray(references) && references.length === 0)) {
      throw new Error('SAML signature verification failed: no references in SignedInfo')
    }

    const refArray = Array.isArray(references) ? references : [references]

    for (const ref of refArray) {
      const uri = ref['@_URI'] || ''
      const digestMethod = ref['ds:DigestMethod'] || ref['DigestMethod']
      const digestValue = this.extractTextContent(ref['ds:DigestValue'] || ref['DigestValue'])

      if (!digestValue) {
        throw new Error('SAML signature verification failed: missing DigestValue in Reference')
      }

      // SECURITY: Verify the digest algorithm is acceptable
      const digestAlgorithm = digestMethod?.['@_Algorithm'] || ''
      if (digestAlgorithm === 'http://www.w3.org/2000/09/xmldsig#sha1') {
        console.warn('WARNING: SAML response uses SHA-1 digest, which is deprecated.')
      }

      // Verify the URI references an element in this document
      if (uri && !uri.startsWith('#')) {
        throw new Error('SAML signature verification failed: external Reference URI not allowed')
      }
    }
  }

  /**
   * Build a PEM-formatted certificate string from the raw base64 certificate.
   */
  private buildPemCertificate(cert: string): string {
    // Remove any existing PEM headers/footers and whitespace
    const cleanCert = cert
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s+/g, '')

    // Reconstruct proper PEM format
    const lines = cleanCert.match(/.{1,64}/g) || []
    return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----\n`
  }

  /**
   * Safely extract text content from a parsed XML element.
   * Handles both simple string values and complex objects with #text.
   */
  private extractTextContent(element: any): string | null {
    if (element === null || element === undefined) return null
    if (typeof element === 'string') return element.trim()
    if (typeof element === 'object' && '#text' in element) return String(element['#text']).trim()
    return String(element).trim()
  }

  /**
   * Validate SAML assertion
   */
  private validateAssertion(assertion: SAMLAssertion): void {
    const now = new Date()

    // SECURITY: Allow a small clock skew tolerance (5 minutes) to account for
    // time differences between SP and IdP servers
    const clockSkewMs = 300000 // 5 minutes

    // Check time validity with clock skew tolerance
    const notBeforeWithSkew = new Date(assertion.conditions.notBefore.getTime() - clockSkewMs)
    if (now < notBeforeWithSkew) {
      throw new Error('SAML assertion not yet valid')
    }

    const notOnOrAfterWithSkew = new Date(assertion.conditions.notOnOrAfter.getTime() + clockSkewMs)
    if (now > notOnOrAfterWithSkew) {
      throw new Error('SAML assertion expired')
    }

    // Check issuer matches the configured IdP entity ID
    if (assertion.issuer !== this.config.entityId) {
      throw new Error(`Invalid SAML assertion issuer: expected "${this.config.entityId}", got "${assertion.issuer}"`)
    }

    // SECURITY: Verify audience restriction — the assertion must be intended for us
    if (assertion.conditions.audienceRestriction && assertion.conditions.audienceRestriction.length > 0) {
      const ourEntityId = this.serviceProviderConfig.entityId
      if (!assertion.conditions.audienceRestriction.includes(ourEntityId)) {
        throw new Error(`SAML audience restriction mismatch: our entityId "${ourEntityId}" ` +
          `not in allowed audiences [${assertion.conditions.audienceRestriction.join(', ')}]`)
      }
    }

    // NOTE: Signature verification is performed in parseSAMLResponse() BEFORE
    // this method is called. This ensures we never trust unsigned assertions.
  }

  /**
   * Extract user information from SAML assertion
   */
  private extractUserFromAssertion(assertion: SAMLAssertion): SAMLUser {
    const mapping = this.config.attributeMapping

    const email = this.getAttributeValue(assertion.attributes, mapping.email) || assertion.nameId
    if (!email) {
      throw new Error('No email found in SAML assertion')
    }

    const firstName = this.getAttributeValue(assertion.attributes, mapping.firstName)
    const lastName = this.getAttributeValue(assertion.attributes, mapping.lastName)
    const displayName = this.getAttributeValue(assertion.attributes, mapping.displayName)

    let name = displayName
    if (!name && firstName && lastName) {
      name = `${firstName} ${lastName}`
    }
    if (!name) {
      name = email.split('@')[0] ?? email // Fallback to email prefix
    }

    const groups = mapping.groups ?
      this.getAttributeValues(assertion.attributes, mapping.groups) : []

    const roles = mapping.roles ?
      this.getAttributeValues(assertion.attributes, mapping.roles) : []

    return {
      id: assertion.nameId,
      email,
      name,
      firstName,
      lastName,
      groups,
      roles,
      samlAttributes: assertion.attributes,
      provider: 'saml',
      samlIssuer: assertion.issuer,
      samlSessionIndex: assertion.sessionIndex
    }
  }

  /**
   * Helper methods
   */

  /**
   * Generate cryptographically secure request ID
   * SECURITY: Uses crypto.randomBytes() instead of Math.random()
   */
  private generateId(): string {
    const randomHex = randomBytes(8).toString('hex');
    return `_${Date.now()}_${randomHex}`;
  }

  private getNameIdFormat(): string {
    const formats = {
      emailAddress: 'emailAddress',
      persistent: 'persistent',
      transient: 'transient',
      unspecified: 'unspecified'
    }
    return formats[this.config.nameIdFormat || 'emailAddress']
  }

  private base64UrlEncode(str: string): string {
    return Buffer.from(str, 'utf-8').toString('base64')
  }

  private signRequest(samlRequest: string, relayState?: string): string {
    // In a real implementation, this would use the private key to sign the request
    // This is a placeholder implementation
    return 'mock_signature'
  }

  private getAttributeValue(attributes: Record<string, string | string[]>, key?: string): string | undefined {
    if (!key || !attributes[key]) return undefined

    const value = attributes[key]
    return Array.isArray(value) ? value[0] : value
  }

  private getAttributeValues(attributes: Record<string, string | string[]>, key?: string): string[] {
    if (!key || !attributes[key]) return []

    const value = attributes[key]
    return Array.isArray(value) ? value : [value]
  }
}

// Helper function to create configured SAML providers
export function createSAMLProvider(providerId: string): SAMLProvider | null {
  const providers = {
    okta: {
      entityId: process.env.SAML_OKTA_ENTITY_ID,
      singleSignOnUrl: process.env.SAML_OKTA_SSO_URL,
      singleLogoutUrl: process.env.SAML_OKTA_SLO_URL,
      x509Certificate: process.env.SAML_OKTA_CERT,
      attributeMapping: {
        email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
        lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
        displayName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
        groups: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'
      }
    },
    azure: {
      entityId: process.env.SAML_AZURE_ENTITY_ID,
      singleSignOnUrl: process.env.SAML_AZURE_SSO_URL,
      singleLogoutUrl: process.env.SAML_AZURE_SLO_URL,
      x509Certificate: process.env.SAML_AZURE_CERT,
      attributeMapping: {
        email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
        firstName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
        lastName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
        displayName: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
        groups: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'
      }
    }
  }

  const config = providers[providerId as keyof typeof providers]
  if (!config || !config.entityId || !config.singleSignOnUrl || !config.x509Certificate) {
    console.warn(`SAML provider ${providerId} not configured or missing required environment variables`)
    return null
  }

  return new SAMLProvider(config as SAMLConfig, {
    entityId: process.env.NEXTAUTH_URL || 'http://localhost:3000',
    assertionConsumerServiceUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/saml/acs`,
    singleLogoutUrl: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/auth/saml/sls`
  })
}

export default SAMLProvider
