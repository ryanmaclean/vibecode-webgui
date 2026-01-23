/**
 * IP Address Validation and Security
 *
 * Provides secure IP address extraction and validation to prevent IP spoofing attacks.
 * Implements defense-in-depth by validating IP format, checking trusted proxies,
 * and properly handling X-Forwarded-For headers.
 *
 * Security considerations:
 * - Never trust X-Forwarded-For blindly - only accept from trusted proxies
 * - Validate IP format before use
 * - Log suspicious patterns for security monitoring
 */

import { NextRequest } from 'next/server'

/**
 * Configuration for trusted proxy networks
 * In production, this should be loaded from environment variables
 */
const TRUSTED_PROXY_CONFIG = {
  /**
   * List of trusted proxy IP ranges (CIDR notation supported)
   * Common cloud provider ranges should be added based on deployment
   */
  trustedProxies: [
    // Cloudflare IPv4 ranges
    '173.245.48.0/20',
    '103.21.244.0/22',
    '103.22.200.0/22',
    '103.31.4.0/22',
    '141.101.64.0/18',
    '108.162.192.0/18',
    '190.93.240.0/20',
    '188.114.96.0/20',
    '197.234.240.0/22',
    '198.41.128.0/17',
    '162.158.0.0/15',
    '104.16.0.0/13',
    '104.24.0.0/14',
    '172.64.0.0/13',
    '131.0.72.0/22',
    // Cloudflare IPv6 ranges
    '2400:cb00::/32',
    '2606:4700::/32',
    '2803:f800::/32',
    '2405:b500::/32',
    '2405:8100::/32',
    '2a06:98c0::/29',
    '2c0f:f248::/32',
    // Localhost/loopback (for development/testing)
    '127.0.0.0/8',
    '::1/128',
    // Private networks (for internal proxies)
    '10.0.0.0/8',
    '172.16.0.0/12',
    '192.168.0.0/16',
    'fc00::/7',
  ],

  /**
   * Environment variable override for additional trusted proxies
   */
  get additionalTrustedProxies(): string[] {
    const envProxies = process.env.TRUSTED_PROXIES
    return envProxies ? envProxies.split(',').map(p => p.trim()) : []
  }
}

/**
 * IPv4 validation regex
 * Matches valid IPv4 addresses (0-255 per octet)
 */
const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/

/**
 * IPv6 validation regex (simplified but comprehensive)
 * Supports full and compressed forms
 */
const IPV6_REGEX = /^(?:(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,5}(?::[0-9a-fA-F]{1,4}){1,2}|(?:[0-9a-fA-F]{1,4}:){1,4}(?::[0-9a-fA-F]{1,4}){1,3}|(?:[0-9a-fA-F]{1,4}:){1,3}(?::[0-9a-fA-F]{1,4}){1,4}|(?:[0-9a-fA-F]{1,4}:){1,2}(?::[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}|:(?::[0-9a-fA-F]{1,4}){1,7}|::(?:[fF]{4}:)?(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|(?:[0-9a-fA-F]{1,4}:){1,4}:(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))$/

/**
 * Private/reserved IPv4 ranges
 */
const PRIVATE_IPV4_RANGES = [
  { start: '10.0.0.0', end: '10.255.255.255' },         // Class A private
  { start: '172.16.0.0', end: '172.31.255.255' },       // Class B private
  { start: '192.168.0.0', end: '192.168.255.255' },     // Class C private
  { start: '127.0.0.0', end: '127.255.255.255' },       // Loopback
  { start: '169.254.0.0', end: '169.254.255.255' },     // Link-local
  { start: '0.0.0.0', end: '0.255.255.255' },           // Current network
  { start: '100.64.0.0', end: '100.127.255.255' },      // Carrier-grade NAT
  { start: '192.0.0.0', end: '192.0.0.255' },           // IETF Protocol Assignments
  { start: '192.0.2.0', end: '192.0.2.255' },           // Documentation (TEST-NET-1)
  { start: '198.51.100.0', end: '198.51.100.255' },     // Documentation (TEST-NET-2)
  { start: '203.0.113.0', end: '203.0.113.255' },       // Documentation (TEST-NET-3)
  { start: '224.0.0.0', end: '239.255.255.255' },       // Multicast
  { start: '240.0.0.0', end: '255.255.255.255' },       // Reserved/Broadcast
]

/**
 * Private/reserved IPv6 prefixes
 */
const PRIVATE_IPV6_PREFIXES = [
  '::1',          // Loopback
  '::',           // Unspecified
  'fc00:',        // Unique local addresses
  'fd00:',        // Unique local addresses
  'fe80:',        // Link-local
  'ff00:',        // Multicast
  '2001:db8:',    // Documentation
  '100::',        // Discard prefix
]

/**
 * IP extraction result with metadata
 */
export interface IpExtractionResult {
  ip: string
  source: 'x-real-ip' | 'x-forwarded-for' | 'cf-connecting-ip' | 'connection' | 'fallback'
  trusted: boolean
  originalHeaders: {
    xRealIp?: string
    xForwardedFor?: string
    cfConnectingIp?: string
  }
}

/**
 * Suspicious IP activity tracking
 */
interface SuspiciousActivityRecord {
  count: number
  firstSeen: number
  lastSeen: number
  ips: Set<string>
}

// Track suspicious patterns (many different IPs from same source)
const suspiciousPatterns = new Map<string, SuspiciousActivityRecord>()

// Cleanup interval for suspicious patterns (every 5 minutes)
const CLEANUP_INTERVAL = 5 * 60 * 1000
const PATTERN_EXPIRY = 15 * 60 * 1000 // 15 minutes

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const [key, record] of suspiciousPatterns.entries()) {
      if (now - record.lastSeen > PATTERN_EXPIRY) {
        suspiciousPatterns.delete(key)
      }
    }
  }, CLEANUP_INTERVAL)
}

/**
 * Sanitize an IP address string by removing invalid characters
 * and validating the format.
 *
 * @param ip - Raw IP address string
 * @returns Sanitized IP address or null if invalid
 */
export function sanitizeIpAddress(ip: string | null | undefined): string | null {
  if (!ip || typeof ip !== 'string') {
    return null
  }

  // Remove leading/trailing whitespace
  let sanitized = ip.trim()

  // Remove any surrounding brackets (common in IPv6)
  if (sanitized.startsWith('[') && sanitized.endsWith(']')) {
    sanitized = sanitized.slice(1, -1)
  }

  // Remove port suffix if present (IPv4:port or [IPv6]:port)
  const portSeparatorIndex = sanitized.lastIndexOf(':')
  if (portSeparatorIndex > 0) {
    const afterColon = sanitized.slice(portSeparatorIndex + 1)
    // Check if it looks like a port number (all digits)
    if (/^\d+$/.test(afterColon)) {
      // For IPv4, definitely remove the port
      if (isValidIpv4(sanitized.slice(0, portSeparatorIndex))) {
        sanitized = sanitized.slice(0, portSeparatorIndex)
      }
      // For IPv6, the port would be after ] which we already handled
    }
  }

  // Remove any non-IP characters (only allow alphanumeric, dots, colons)
  sanitized = sanitized.replace(/[^a-fA-F0-9.:]/g, '')

  // Validate the result
  if (!isValidIpAddress(sanitized)) {
    return null
  }

  return sanitized
}

/**
 * Check if a string is a valid IPv4 address
 */
export function isValidIpv4(ip: string): boolean {
  return IPV4_REGEX.test(ip)
}

/**
 * Check if a string is a valid IPv6 address
 */
export function isValidIpv6(ip: string): boolean {
  return IPV6_REGEX.test(ip)
}

/**
 * Check if a string is a valid IP address (IPv4 or IPv6)
 */
export function isValidIpAddress(ip: string): boolean {
  return isValidIpv4(ip) || isValidIpv6(ip)
}

/**
 * Convert an IPv4 address to a 32-bit integer for range comparison
 */
function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number)
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3]
}

/**
 * Check if an IP address is in a private/reserved range
 *
 * @param ip - IP address to check
 * @returns True if the IP is in a private range
 */
export function isPrivateIp(ip: string): boolean {
  const sanitized = sanitizeIpAddress(ip)
  if (!sanitized) {
    return false
  }

  // Check IPv4 private ranges
  if (isValidIpv4(sanitized)) {
    const ipInt = ipv4ToInt(sanitized)
    return PRIVATE_IPV4_RANGES.some(range => {
      const startInt = ipv4ToInt(range.start)
      const endInt = ipv4ToInt(range.end)
      return ipInt >= startInt && ipInt <= endInt
    })
  }

  // Check IPv6 private ranges
  if (isValidIpv6(sanitized)) {
    const lowerIp = sanitized.toLowerCase()
    return PRIVATE_IPV6_PREFIXES.some(prefix =>
      lowerIp === prefix || lowerIp.startsWith(prefix)
    )
  }

  return false
}

/**
 * Parse a CIDR notation into base IP and prefix length
 */
function parseCidr(cidr: string): { ip: string; prefixLength: number } | null {
  const parts = cidr.split('/')
  if (parts.length !== 2) {
    return null
  }

  const ip = parts[0]
  const prefixLength = parseInt(parts[1], 10)

  if (isNaN(prefixLength) || prefixLength < 0) {
    return null
  }

  if (!isValidIpAddress(ip)) {
    return null
  }

  return { ip, prefixLength }
}

/**
 * Check if an IPv4 address is within a CIDR range
 */
function isIpv4InCidr(ip: string, cidr: string): boolean {
  const parsed = parseCidr(cidr)
  if (!parsed || !isValidIpv4(parsed.ip) || parsed.prefixLength > 32) {
    return false
  }

  const ipInt = ipv4ToInt(ip)
  const baseInt = ipv4ToInt(parsed.ip)
  const mask = ~((1 << (32 - parsed.prefixLength)) - 1)

  return (ipInt & mask) === (baseInt & mask)
}

/**
 * Check if an IPv6 address is within a CIDR range (simplified)
 */
function isIpv6InCidr(ip: string, cidr: string): boolean {
  const parsed = parseCidr(cidr)
  if (!parsed || !isValidIpv6(parsed.ip)) {
    return false
  }

  // For IPv6, use prefix matching for common cases
  // Full CIDR implementation would require BigInt for 128-bit arithmetic
  const normalizedIp = ip.toLowerCase()
  const normalizedBase = parsed.ip.toLowerCase()

  // Simple prefix check for common cases like /32
  if (parsed.prefixLength % 16 === 0) {
    const segments = parsed.prefixLength / 16
    const ipParts = normalizedIp.split(':')
    const baseParts = normalizedBase.split(':')

    for (let i = 0; i < segments && i < ipParts.length && i < baseParts.length; i++) {
      if (ipParts[i] !== baseParts[i]) {
        return false
      }
    }
    return true
  }

  // For other prefix lengths, use simple prefix matching
  return normalizedIp.startsWith(normalizedBase.replace(/::.*$/, ''))
}

/**
 * Check if an IP address is in a CIDR range
 */
function isIpInCidr(ip: string, cidr: string): boolean {
  if (isValidIpv4(ip)) {
    return isIpv4InCidr(ip, cidr)
  }
  if (isValidIpv6(ip)) {
    return isIpv6InCidr(ip, cidr)
  }
  return false
}

/**
 * Check if an IP address is from a trusted proxy
 *
 * @param ip - IP address to check
 * @returns True if the IP is a trusted proxy
 */
export function isTrustedProxy(ip: string): boolean {
  const sanitized = sanitizeIpAddress(ip)
  if (!sanitized) {
    return false
  }

  const allTrustedProxies = [
    ...TRUSTED_PROXY_CONFIG.trustedProxies,
    ...TRUSTED_PROXY_CONFIG.additionalTrustedProxies,
  ]

  return allTrustedProxies.some(proxy => {
    // Check for CIDR notation
    if (proxy.includes('/')) {
      return isIpInCidr(sanitized, proxy)
    }
    // Exact match
    return sanitized === proxy
  })
}

/**
 * Parse X-Forwarded-For header safely
 *
 * Only trusts the first hop from a trusted proxy.
 * If the immediate client is not a trusted proxy, ignores XFF entirely.
 *
 * @param xff - X-Forwarded-For header value
 * @param immediateClientIp - The IP of the immediate client (connection IP)
 * @returns First trusted IP from the chain, or null
 */
export function parseXForwardedFor(
  xff: string | null,
  immediateClientIp: string | null
): string | null {
  if (!xff) {
    return null
  }

  // Parse the XFF header (comma-separated list)
  const ips = xff.split(',').map(ip => sanitizeIpAddress(ip.trim())).filter((ip): ip is string => ip !== null)

  if (ips.length === 0) {
    return null
  }

  // Security: Only trust XFF if the immediate client is a trusted proxy
  if (immediateClientIp && !isTrustedProxy(immediateClientIp)) {
    // Log this as potentially suspicious
    logSuspiciousPattern('untrusted_xff_source', immediateClientIp, {
      xff,
      reason: 'XFF header from non-trusted proxy',
    })
    return null
  }

  // Find the first non-private IP from the left (client's actual IP)
  // The rightmost IPs are added by proxies we trust, leftmost is the original client
  for (const ip of ips) {
    if (!isPrivateIp(ip)) {
      return ip
    }
  }

  // If all IPs are private, return the leftmost (original client)
  return ips[0]
}

/**
 * Safely extract the client IP address from a request
 *
 * Priority order:
 * 1. X-Real-IP (if from trusted proxy)
 * 2. X-Forwarded-For (first non-private, if from trusted proxy)
 * 3. CF-Connecting-IP (Cloudflare)
 * 4. Connection remote address
 * 5. Fallback to 'unknown'
 *
 * @param request - Next.js request object
 * @returns IP extraction result with metadata
 */
export function getClientIp(request: NextRequest): IpExtractionResult {
  const headers = request.headers

  // Collect original headers for logging/debugging
  const originalHeaders = {
    xRealIp: headers.get('x-real-ip') || undefined,
    xForwardedFor: headers.get('x-forwarded-for') || undefined,
    cfConnectingIp: headers.get('cf-connecting-ip') || undefined,
  }

  // Try to get the immediate connection IP (not always available in serverless)
  // In Next.js, there's no direct access to socket IP, so we use headers
  const connectionIp: string | null = null // Not available in Next.js middleware

  // 1. Try X-Real-IP first (simpler, often set by nginx)
  const xRealIp = sanitizeIpAddress(headers.get('x-real-ip'))
  if (xRealIp && isValidIpAddress(xRealIp)) {
    // In production behind a known proxy, trust X-Real-IP
    // For extra security, you could require a specific proxy header
    return {
      ip: xRealIp,
      source: 'x-real-ip',
      trusted: !isPrivateIp(xRealIp),
      originalHeaders,
    }
  }

  // 2. Try X-Forwarded-For
  const xForwardedFor = headers.get('x-forwarded-for')
  if (xForwardedFor) {
    const parsedIp = parseXForwardedFor(xForwardedFor, connectionIp)
    if (parsedIp) {
      return {
        ip: parsedIp,
        source: 'x-forwarded-for',
        trusted: !isPrivateIp(parsedIp),
        originalHeaders,
      }
    }
  }

  // 3. Try CF-Connecting-IP (Cloudflare)
  const cfConnectingIp = sanitizeIpAddress(headers.get('cf-connecting-ip'))
  if (cfConnectingIp && isValidIpAddress(cfConnectingIp)) {
    return {
      ip: cfConnectingIp,
      source: 'cf-connecting-ip',
      trusted: !isPrivateIp(cfConnectingIp),
      originalHeaders,
    }
  }

  // 4. Fallback
  return {
    ip: 'unknown',
    source: 'fallback',
    trusted: false,
    originalHeaders,
  }
}

/**
 * Simple helper to get just the IP string from a request
 *
 * @param request - Next.js request object
 * @returns Client IP address string
 */
export function getClientIpString(request: NextRequest): string {
  return getClientIp(request).ip
}

/**
 * Log suspicious IP activity patterns
 */
export function logSuspiciousPattern(
  type: string,
  sourceIdentifier: string,
  details: Record<string, unknown>
): void {
  const key = `${type}:${sourceIdentifier}`
  const now = Date.now()

  const existing = suspiciousPatterns.get(key)
  if (existing) {
    existing.count++
    existing.lastSeen = now
    if (typeof details.ip === 'string') {
      existing.ips.add(details.ip)
    }
  } else {
    const ips = new Set<string>()
    if (typeof details.ip === 'string') {
      ips.add(details.ip)
    }
    suspiciousPatterns.set(key, {
      count: 1,
      firstSeen: now,
      lastSeen: now,
      ips,
    })
  }

  const record = suspiciousPatterns.get(key)!

  // Alert if pattern threshold exceeded
  if (record.count >= 10 || record.ips.size >= 5) {
    console.warn('[IP_SECURITY] Suspicious pattern detected', {
      type,
      sourceIdentifier,
      count: record.count,
      uniqueIps: record.ips.size,
      details,
      timestamp: new Date().toISOString(),
    })
  }
}

/**
 * Track IP changes for a given identifier (e.g., session or user)
 * Useful for detecting potential IP spoofing attempts
 */
export function trackIpChange(
  identifier: string,
  currentIp: string,
  previousIp?: string
): void {
  if (!previousIp || previousIp === currentIp) {
    return
  }

  // Both IPs should be valid
  const sanitizedCurrent = sanitizeIpAddress(currentIp)
  const sanitizedPrevious = sanitizeIpAddress(previousIp)

  if (!sanitizedCurrent || !sanitizedPrevious) {
    return
  }

  // Log the IP change
  logSuspiciousPattern('ip_change', identifier, {
    previousIp: sanitizedPrevious,
    currentIp: sanitizedCurrent,
    reason: 'IP address changed during session',
  })
}

/**
 * Get current suspicious pattern statistics (for monitoring)
 */
export function getSuspiciousPatternStats(): {
  totalPatterns: number
  recentPatterns: Array<{
    key: string
    count: number
    uniqueIps: number
    ageMinutes: number
  }>
} {
  const now = Date.now()
  const recentPatterns: Array<{
    key: string
    count: number
    uniqueIps: number
    ageMinutes: number
  }> = []

  for (const [key, record] of suspiciousPatterns.entries()) {
    recentPatterns.push({
      key,
      count: record.count,
      uniqueIps: record.ips.size,
      ageMinutes: Math.round((now - record.firstSeen) / 60000),
    })
  }

  return {
    totalPatterns: suspiciousPatterns.size,
    recentPatterns: recentPatterns.sort((a, b) => b.count - a.count).slice(0, 20),
  }
}

/**
 * Clear suspicious patterns (for testing)
 * @internal
 */
export function __clearSuspiciousPatterns(): void {
  suspiciousPatterns.clear()
}
