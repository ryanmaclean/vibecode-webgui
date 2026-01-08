/**
 * Unit Tests for Content Security Policy Configuration
 * Tests CSP header generation, nonce handling, and security headers
 */

import { jest } from '@jest/globals'
import * as csp from '@/lib/security/csp-config'

describe('Content Security Policy Configuration', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('generateNonce', () => {
    it('should generate a nonce using Web Crypto API', () => {
      const nonce = csp.generateNonce()

      expect(nonce).toBeTruthy()
      expect(typeof nonce).toBe('string')
      expect(nonce.length).toBeGreaterThan(0)
    })

    it('should generate unique nonces', () => {
      const nonce1 = csp.generateNonce()
      const nonce2 = csp.generateNonce()

      expect(nonce1).not.toBe(nonce2)
    })

    it('should generate base64-encoded nonces', () => {
      const nonce = csp.generateNonce()

      // Base64 characters plus padding
      expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/)
    })

    it('should handle fallback when crypto is not available', () => {
      const originalCrypto = global.crypto
      // @ts-ignore - Testing fallback
      global.crypto = undefined

      const nonce = csp.generateNonce()

      expect(nonce).toBeTruthy()
      expect(typeof nonce).toBe('string')

      global.crypto = originalCrypto
    })
  })

  describe('generateCSPHeader', () => {
    it('should generate production CSP header with nonce', () => {
      const nonce = 'test-nonce-123'
      const header = csp.generateCSPHeader(nonce)

      expect(header).toContain("default-src 'self'")
      expect(header).toContain(`script-src 'self' 'nonce-${nonce}'`)
      expect(header).toContain("style-src 'self' 'unsafe-inline'")
      expect(header).toContain("object-src 'none'")
      expect(header).toContain("upgrade-insecure-requests")
    })

    it('should include DataDog domains in script-src', () => {
      const nonce = 'test-nonce'
      const header = csp.generateCSPHeader(nonce)

      expect(header).toContain('https://www.datadoghq-browser-agent.com')
    })

    it('should include CDN domains', () => {
      const nonce = 'test-nonce'
      const header = csp.generateCSPHeader(nonce)

      expect(header).toContain('https://cdn.jsdelivr.net')
    })

    it('should include AI API domains in connect-src', () => {
      const nonce = 'test-nonce'
      const header = csp.generateCSPHeader(nonce)

      expect(header).toContain('https://api.openrouter.ai')
      expect(header).toContain('https://api.openai.com')
      expect(header).toContain('https://api.anthropic.com')
    })

    it('should allow WebSocket connections', () => {
      const nonce = 'test-nonce'
      const header = csp.generateCSPHeader(nonce)

      expect(header).toContain('wss:')
      expect(header).toContain('ws:')
    })

    it('should set frame-ancestors to self', () => {
      const nonce = 'test-nonce'
      const header = csp.generateCSPHeader(nonce)

      expect(header).toContain("frame-ancestors 'self'")
    })

    it('should disallow object embeds', () => {
      const nonce = 'test-nonce'
      const header = csp.generateCSPHeader(nonce)

      expect(header).toContain("object-src 'none'")
    })
  })

  describe('generateDevCSPHeader', () => {
    it('should generate development CSP header with relaxed rules', () => {
      const nonce = 'dev-nonce'
      const header = csp.generateDevCSPHeader(nonce)

      expect(header).toContain("script-src 'self' 'nonce-dev-nonce' 'unsafe-eval'")
      expect(header).toContain('http://localhost:*')
    })

    it('should allow unsafe-eval in development', () => {
      const nonce = 'dev-nonce'
      const header = csp.generateDevCSPHeader(nonce)

      expect(header).toContain("'unsafe-eval'")
    })

    it('should not include upgrade-insecure-requests in dev', () => {
      const nonce = 'dev-nonce'
      const header = csp.generateDevCSPHeader(nonce)

      expect(header).not.toContain('upgrade-insecure-requests')
    })

    it('should allow localhost connections', () => {
      const nonce = 'dev-nonce'
      const header = csp.generateDevCSPHeader(nonce)

      expect(header).toContain('http://localhost:*')
    })
  })

  describe('getSecurityHeaders', () => {
    it('should return all security headers in production', () => {
      process.env.NODE_ENV = 'production'
      const nonce = 'prod-nonce'

      const headers = csp.getSecurityHeaders(nonce)

      expect(headers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: 'X-DNS-Prefetch-Control' }),
          expect.objectContaining({ key: 'Strict-Transport-Security' }),
          expect.objectContaining({ key: 'X-XSS-Protection' }),
          expect.objectContaining({ key: 'X-Frame-Options' }),
          expect.objectContaining({ key: 'X-Content-Type-Options' }),
          expect.objectContaining({ key: 'Referrer-Policy' }),
          expect.objectContaining({ key: 'Permissions-Policy' }),
          expect.objectContaining({ key: 'Content-Security-Policy' }),
        ])
      )
    })

    it('should use production CSP in production mode', () => {
      process.env.NODE_ENV = 'production'
      const nonce = 'prod-nonce'

      const headers = csp.getSecurityHeaders(nonce)
      const cspHeader = headers.find((h) => h.key === 'Content-Security-Policy')

      expect(cspHeader?.value).toContain('upgrade-insecure-requests')
      expect(cspHeader?.value).not.toContain("'unsafe-eval'")
    })

    it('should use development CSP in development mode', () => {
      process.env.NODE_ENV = 'development'
      const nonce = 'dev-nonce'

      const headers = csp.getSecurityHeaders(nonce)
      const cspHeader = headers.find((h) => h.key === 'Content-Security-Policy')

      expect(cspHeader?.value).toContain("'unsafe-eval'")
    })

    it('should set HSTS header correctly', () => {
      const headers = csp.getSecurityHeaders()
      const hstsHeader = headers.find((h) => h.key === 'Strict-Transport-Security')

      expect(hstsHeader?.value).toContain('max-age=63072000')
      expect(hstsHeader?.value).toContain('includeSubDomains')
      expect(hstsHeader?.value).toContain('preload')
    })

    it('should set X-Frame-Options to SAMEORIGIN', () => {
      const headers = csp.getSecurityHeaders()
      const frameHeader = headers.find((h) => h.key === 'X-Frame-Options')

      expect(frameHeader?.value).toBe('SAMEORIGIN')
    })

    it('should disable browser features via Permissions-Policy', () => {
      const headers = csp.getSecurityHeaders()
      const permissionsHeader = headers.find((h) => h.key === 'Permissions-Policy')

      expect(permissionsHeader?.value).toContain('camera=()')
      expect(permissionsHeader?.value).toContain('microphone=()')
      expect(permissionsHeader?.value).toContain('geolocation=()')
    })

    it('should use default nonce when not provided', () => {
      process.env.NODE_ENV = 'development'

      const headers = csp.getSecurityHeaders()
      const cspHeader = headers.find((h) => h.key === 'Content-Security-Policy')

      expect(cspHeader?.value).toContain('nonce-dev-nonce')
    })
  })

  describe('getCORSHeaders', () => {
    it('should allow all origins in development', () => {
      process.env.NODE_ENV = 'development'

      const headers = csp.getCORSHeaders()
      const originHeader = headers.find((h) => h.key === 'Access-Control-Allow-Origin')

      expect(originHeader?.value).toBe('*')
    })

    it('should restrict origins in production', () => {
      process.env.NODE_ENV = 'production'

      const headers = csp.getCORSHeaders()
      const originHeader = headers.find((h) => h.key === 'Access-Control-Allow-Origin')

      expect(originHeader?.value).toBe('https://vibecode.dev')
    })

    it('should allow standard HTTP methods', () => {
      const headers = csp.getCORSHeaders()
      const methodsHeader = headers.find((h) => h.key === 'Access-Control-Allow-Methods')

      expect(methodsHeader?.value).toContain('GET')
      expect(methodsHeader?.value).toContain('POST')
      expect(methodsHeader?.value).toContain('PUT')
      expect(methodsHeader?.value).toContain('DELETE')
      expect(methodsHeader?.value).toContain('OPTIONS')
    })

    it('should allow required headers', () => {
      const headers = csp.getCORSHeaders()
      const allowHeadersHeader = headers.find((h) => h.key === 'Access-Control-Allow-Headers')

      expect(allowHeadersHeader?.value).toContain('Content-Type')
      expect(allowHeadersHeader?.value).toContain('Authorization')
      expect(allowHeadersHeader?.value).toContain('X-CSP-Nonce')
    })

    it('should set max age for preflight caching', () => {
      const headers = csp.getCORSHeaders()
      const maxAgeHeader = headers.find((h) => h.key === 'Access-Control-Max-Age')

      expect(maxAgeHeader?.value).toBe('86400')
    })
  })

  describe('getNonceFromHeaders', () => {
    it('should extract nonce from lowercase header', () => {
      const headers = new Headers()
      headers.set('x-csp-nonce', 'test-nonce-123')

      const nonce = csp.getNonceFromHeaders(headers)

      expect(nonce).toBe('test-nonce-123')
    })

    it('should extract nonce from uppercase header', () => {
      const headers = new Headers()
      headers.set('X-CSP-Nonce', 'test-nonce-456')

      const nonce = csp.getNonceFromHeaders(headers)

      expect(nonce).toBe('test-nonce-456')
    })

    it('should return null when header is not present', () => {
      const headers = new Headers()

      const nonce = csp.getNonceFromHeaders(headers)

      expect(nonce).toBeNull()
    })
  })

  describe('addNonceToScript', () => {
    it('should add nonce to inline script tags', () => {
      const script = '<script>console.log("test")</script>'
      const nonce = 'test-nonce'

      const result = csp.addNonceToScript(script, nonce)

      expect(result).toBe('<script nonce="test-nonce">console.log("test")</script>')
    })

    it('should add nonce to script tags with attributes', () => {
      const script = '<script type="text/javascript">alert(1)</script>'
      const nonce = 'test-nonce'

      const result = csp.addNonceToScript(script, nonce)

      expect(result).toContain('nonce="test-nonce"')
    })

    it('should handle multiple script tags', () => {
      const script = '<script>test1</script><script>test2</script>'
      const nonce = 'test-nonce'

      const result = csp.addNonceToScript(script, nonce)

      expect(result).toBe(
        '<script nonce="test-nonce">test1</script><script nonce="test-nonce">test2</script>'
      )
    })

    it('should return unchanged when no script tags', () => {
      const content = '<div>No scripts here</div>'
      const nonce = 'test-nonce'

      const result = csp.addNonceToScript(content, nonce)

      expect(result).toBe(content)
    })
  })

  describe('getCSPReportEndpoint', () => {
    it('should return CSP report endpoint URL', () => {
      const endpoint = csp.getCSPReportEndpoint()

      expect(endpoint).toBe('/api/security/csp-report')
    })
  })

  describe('generateCSPWithReporting', () => {
    it('should include report-uri directive', () => {
      const nonce = 'test-nonce'
      const cspHeader = csp.generateCSPWithReporting(nonce)

      expect(cspHeader).toContain('report-uri /api/security/csp-report')
    })

    it('should include report-to directive', () => {
      const nonce = 'test-nonce'
      const cspHeader = csp.generateCSPWithReporting(nonce)

      expect(cspHeader).toContain('report-to csp-endpoint')
    })

    it('should include base CSP directives', () => {
      const nonce = 'test-nonce'
      const cspHeader = csp.generateCSPWithReporting(nonce)

      expect(cspHeader).toContain("default-src 'self'")
      expect(cspHeader).toContain(`script-src 'self' 'nonce-${nonce}'`)
    })
  })

  describe('getReportToHeader', () => {
    it('should return valid Report-To JSON', () => {
      const reportTo = csp.getReportToHeader()
      const parsed = JSON.parse(reportTo)

      expect(parsed).toHaveProperty('group', 'csp-endpoint')
      expect(parsed).toHaveProperty('max_age', 10886400)
      expect(parsed).toHaveProperty('endpoints')
      expect(Array.isArray(parsed.endpoints)).toBe(true)
    })

    it('should include report endpoint in Report-To header', () => {
      const reportTo = csp.getReportToHeader()
      const parsed = JSON.parse(reportTo)

      expect(parsed.endpoints[0]).toHaveProperty('url', '/api/security/csp-report')
    })
  })
})
