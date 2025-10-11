/**
 * Content Security Policy Configuration
 * Provides secure CSP headers with nonce support for inline scripts
 */

/**
 * Generate a cryptographically secure nonce for CSP
 * Uses Web Crypto API for Edge runtime compatibility
 */
export function generateNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    // Use Web Crypto API (Edge runtime compatible)
    const array = new Uint8Array(16)
    crypto.getRandomValues(array)
    return btoa(String.fromCharCode(...array))
  } else {
    // Fallback for environments without crypto
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }
}

/**
 * Generate secure CSP headers with nonce support
 */
export function generateCSPHeader(nonce: string): string {
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://www.datadoghq-browser-agent.com https://cdn.jsdelivr.net`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.openrouter.ai https://api.openai.com https://api.anthropic.com https://browser-intake-datadoghq.com wss: ws:",
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "upgrade-insecure-requests"
  ]

  return cspDirectives.join('; ')
}

/**
 * Development CSP (more permissive for hot reload)
 */
export function generateDevCSPHeader(nonce: string): string {
  const cspDirectives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' https://www.datadoghq-browser-agent.com https://cdn.jsdelivr.net`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https://api.openrouter.ai https://api.openai.com https://api.anthropic.com https://browser-intake-datadoghq.com wss: ws: http://localhost:*",
    "worker-src 'self' blob:",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'"
  ]

  return cspDirectives.join('; ')
}

/**
 * Security headers configuration
 */
export function getSecurityHeaders(nonce?: string) {
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  return [
    {
      key: 'X-DNS-Prefetch-Control',
      value: 'on'
    },
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload'
    },
    {
      key: 'X-XSS-Protection',
      value: '1; mode=block'
    },
    {
      key: 'X-Frame-Options',
      value: 'SAMEORIGIN'
    },
    {
      key: 'X-Content-Type-Options',
      value: 'nosniff'
    },
    {
      key: 'Referrer-Policy',
      value: 'origin-when-cross-origin'
    },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()'
    },
    {
      key: 'Content-Security-Policy',
      value: nonce 
        ? (isDevelopment ? generateDevCSPHeader(nonce) : generateCSPHeader(nonce))
        : (isDevelopment ? generateDevCSPHeader('dev-nonce') : generateCSPHeader('dev-nonce'))
    }
  ]
}

/**
 * CORS headers for API routes
 */
export function getCORSHeaders() {
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  return [
    {
      key: 'Access-Control-Allow-Origin',
      value: isDevelopment ? '*' : 'https://vibecode.dev'
    },
    {
      key: 'Access-Control-Allow-Methods',
      value: 'GET, POST, PUT, DELETE, OPTIONS'
    },
    {
      key: 'Access-Control-Allow-Headers',
      value: 'Content-Type, Authorization, X-Requested-With, X-CSP-Nonce'
    },
    {
      key: 'Access-Control-Max-Age',
      value: '86400'
    }
  ]
}

/**
 * Get nonce from request headers (for API routes)
 */
export function getNonceFromHeaders(headers: Headers): string | null {
  return headers.get('x-csp-nonce') || headers.get('X-CSP-Nonce')
}

/**
 * Add nonce to script tag
 */
export function addNonceToScript(scriptContent: string, nonce: string): string {
  // For inline scripts
  if (scriptContent.includes('<script>')) {
    return scriptContent.replace(/<script>/g, `<script nonce="${nonce}">`)
  }
  
  // For script tags with attributes
  if (scriptContent.includes('<script ')) {
    return scriptContent.replace(/<script /g, `<script nonce="${nonce}" `)
  }
  
  return scriptContent
}

/**
 * CSP violation reporting endpoint URL
 */
export function getCSPReportEndpoint(): string {
  return '/api/security/csp-report'
}

/**
 * Enhanced CSP for production with reporting
 */
export function generateCSPWithReporting(nonce: string): string {
  const baseCSP = generateCSPHeader(nonce)
  const reportEndpoint = getCSPReportEndpoint()
  
  return `${baseCSP}; report-uri ${reportEndpoint}; report-to csp-endpoint`
}

/**
 * Report-To header for CSP reporting
 */
export function getReportToHeader(): string {
  return JSON.stringify({
    group: 'csp-endpoint',
    max_age: 10886400,
    endpoints: [
      {
        url: getCSPReportEndpoint()
      }
    ]
  })
}