/**
 * Tests for IP Address Validation and Security
 *
 * Covers:
 * - IP format validation (IPv4 and IPv6)
 * - IP sanitization
 * - Private IP detection
 * - Trusted proxy checking
 * - X-Forwarded-For parsing
 * - Client IP extraction
 * - Suspicious pattern detection
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';
import {
  sanitizeIpAddress,
  isValidIpv4,
  isValidIpv6,
  isValidIpAddress,
  isPrivateIp,
  isTrustedProxy,
  parseXForwardedFor,
  getClientIp,
  getClientIpString,
  logSuspiciousPattern,
  trackIpChange,
  getSuspiciousPatternStats,
  __clearSuspiciousPatterns,
} from '../../../../src/lib/security/ip-validator';

describe('IP Validator', () => {
  beforeEach(() => {
    __clearSuspiciousPatterns();
    jest.clearAllMocks();
  });

  describe('sanitizeIpAddress', () => {
    it('should return null for null input', () => {
      expect(sanitizeIpAddress(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(sanitizeIpAddress(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(sanitizeIpAddress('')).toBeNull();
    });

    it('should trim whitespace', () => {
      expect(sanitizeIpAddress('  192.168.1.1  ')).toBe('192.168.1.1');
    });

    it('should remove brackets from IPv6', () => {
      expect(sanitizeIpAddress('[::1]')).toBe('::1');
    });

    it('should remove port from IPv4', () => {
      expect(sanitizeIpAddress('192.168.1.1:8080')).toBe('192.168.1.1');
    });

    it('should remove invalid characters', () => {
      // When invalid chars are removed and result is still valid IP
      expect(sanitizeIpAddress('192.168.1.1')).toBe('192.168.1.1');
      // When invalid chars make the result invalid, returns null
      expect(sanitizeIpAddress('192.168.1.1<script>')).toBeNull();
    });

    it('should return null for invalid IP after sanitization', () => {
      expect(sanitizeIpAddress('not-an-ip')).toBeNull();
    });

    it('should handle valid IPv4 addresses', () => {
      expect(sanitizeIpAddress('8.8.8.8')).toBe('8.8.8.8');
      expect(sanitizeIpAddress('192.168.0.1')).toBe('192.168.0.1');
      expect(sanitizeIpAddress('255.255.255.255')).toBe('255.255.255.255');
    });

    it('should handle valid IPv6 addresses', () => {
      expect(sanitizeIpAddress('2001:db8::1')).toBe('2001:db8::1');
      expect(sanitizeIpAddress('::1')).toBe('::1');
      expect(sanitizeIpAddress('fe80::1')).toBe('fe80::1');
    });
  });

  describe('isValidIpv4', () => {
    it('should validate correct IPv4 addresses', () => {
      expect(isValidIpv4('192.168.1.1')).toBe(true);
      expect(isValidIpv4('10.0.0.1')).toBe(true);
      expect(isValidIpv4('172.16.0.1')).toBe(true);
      expect(isValidIpv4('8.8.8.8')).toBe(true);
      expect(isValidIpv4('0.0.0.0')).toBe(true);
      expect(isValidIpv4('255.255.255.255')).toBe(true);
    });

    it('should reject invalid IPv4 addresses', () => {
      expect(isValidIpv4('256.1.1.1')).toBe(false);
      expect(isValidIpv4('192.168.1')).toBe(false);
      expect(isValidIpv4('192.168.1.1.1')).toBe(false);
      expect(isValidIpv4('abc.def.ghi.jkl')).toBe(false);
      expect(isValidIpv4('')).toBe(false);
      expect(isValidIpv4('192.168.1.1:80')).toBe(false);
    });

    it('should reject IPv6 addresses', () => {
      expect(isValidIpv4('::1')).toBe(false);
      expect(isValidIpv4('2001:db8::1')).toBe(false);
    });
  });

  describe('isValidIpv6', () => {
    it('should validate correct IPv6 addresses', () => {
      expect(isValidIpv6('::1')).toBe(true);
      expect(isValidIpv6('2001:db8::1')).toBe(true);
      expect(isValidIpv6('fe80::1')).toBe(true);
      expect(isValidIpv6('::ffff:192.168.1.1')).toBe(true);
      expect(isValidIpv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
    });

    it('should reject invalid IPv6 addresses', () => {
      expect(isValidIpv6('')).toBe(false);
      expect(isValidIpv6('not-an-ipv6')).toBe(false);
      expect(isValidIpv6('192.168.1.1')).toBe(false);
    });
  });

  describe('isValidIpAddress', () => {
    it('should accept valid IPv4 addresses', () => {
      expect(isValidIpAddress('192.168.1.1')).toBe(true);
      expect(isValidIpAddress('8.8.8.8')).toBe(true);
    });

    it('should accept valid IPv6 addresses', () => {
      expect(isValidIpAddress('::1')).toBe(true);
      expect(isValidIpAddress('2001:db8::1')).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(isValidIpAddress('invalid')).toBe(false);
      expect(isValidIpAddress('')).toBe(false);
    });
  });

  describe('isPrivateIp', () => {
    describe('IPv4 private ranges', () => {
      it('should detect 10.x.x.x as private', () => {
        expect(isPrivateIp('10.0.0.1')).toBe(true);
        expect(isPrivateIp('10.255.255.255')).toBe(true);
      });

      it('should detect 172.16-31.x.x as private', () => {
        expect(isPrivateIp('172.16.0.1')).toBe(true);
        expect(isPrivateIp('172.31.255.255')).toBe(true);
        expect(isPrivateIp('172.15.0.1')).toBe(false);
        expect(isPrivateIp('172.32.0.1')).toBe(false);
      });

      it('should detect 192.168.x.x as private', () => {
        expect(isPrivateIp('192.168.0.1')).toBe(true);
        expect(isPrivateIp('192.168.255.255')).toBe(true);
      });

      it('should detect 127.x.x.x as private (loopback)', () => {
        expect(isPrivateIp('127.0.0.1')).toBe(true);
        expect(isPrivateIp('127.255.255.255')).toBe(true);
      });

      it('should detect link-local as private', () => {
        expect(isPrivateIp('169.254.0.1')).toBe(true);
        expect(isPrivateIp('169.254.255.255')).toBe(true);
      });

      it('should detect carrier-grade NAT as private', () => {
        expect(isPrivateIp('100.64.0.1')).toBe(true);
        expect(isPrivateIp('100.127.255.255')).toBe(true);
      });

      it('should not detect public IPs as private', () => {
        expect(isPrivateIp('8.8.8.8')).toBe(false);
        expect(isPrivateIp('1.1.1.1')).toBe(false);
        expect(isPrivateIp('203.0.114.1')).toBe(false); // Just outside TEST-NET-3
      });
    });

    describe('IPv6 private ranges', () => {
      it('should detect ::1 as private (loopback)', () => {
        expect(isPrivateIp('::1')).toBe(true);
      });

      it('should detect fc00::/7 as private (unique local)', () => {
        expect(isPrivateIp('fc00::1')).toBe(true);
        expect(isPrivateIp('fd00::1')).toBe(true);
      });

      it('should detect fe80::/10 as private (link-local)', () => {
        expect(isPrivateIp('fe80::1')).toBe(true);
      });

      it('should not detect public IPv6 as private', () => {
        expect(isPrivateIp('2001:4860:4860::8888')).toBe(false); // Google DNS
      });
    });

    it('should return false for invalid IPs', () => {
      expect(isPrivateIp('invalid')).toBe(false);
      expect(isPrivateIp('')).toBe(false);
    });
  });

  describe('isTrustedProxy', () => {
    it('should trust localhost', () => {
      expect(isTrustedProxy('127.0.0.1')).toBe(true);
      expect(isTrustedProxy('::1')).toBe(true);
    });

    it('should trust private network ranges', () => {
      expect(isTrustedProxy('10.0.0.1')).toBe(true);
      expect(isTrustedProxy('192.168.1.1')).toBe(true);
      expect(isTrustedProxy('172.16.0.1')).toBe(true);
    });

    it('should trust Cloudflare IPs', () => {
      expect(isTrustedProxy('173.245.48.1')).toBe(true);
      expect(isTrustedProxy('104.16.0.1')).toBe(true);
    });

    it('should not trust arbitrary public IPs', () => {
      expect(isTrustedProxy('8.8.8.8')).toBe(false);
      expect(isTrustedProxy('1.1.1.1')).toBe(false);
    });

    it('should return false for invalid IPs', () => {
      expect(isTrustedProxy('invalid')).toBe(false);
      expect(isTrustedProxy('')).toBe(false);
    });
  });

  describe('parseXForwardedFor', () => {
    it('should return null for null input', () => {
      expect(parseXForwardedFor(null, null)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseXForwardedFor('', null)).toBeNull();
    });

    it('should parse single IP', () => {
      expect(parseXForwardedFor('8.8.8.8', null)).toBe('8.8.8.8');
    });

    it('should return first non-private IP from chain', () => {
      expect(parseXForwardedFor('8.8.8.8, 10.0.0.1', null)).toBe('8.8.8.8');
    });

    it('should skip private IPs and return first public', () => {
      // XFF parsing finds the first non-private IP from the left
      // 8.8.8.8 is a public IP (Google DNS)
      expect(parseXForwardedFor('10.0.0.1, 192.168.1.1, 8.8.8.8', null)).toBe('8.8.8.8');
    });

    it('should return leftmost IP if all are private', () => {
      expect(parseXForwardedFor('10.0.0.1, 192.168.1.1', null)).toBe('10.0.0.1');
    });

    it('should handle whitespace in chain', () => {
      expect(parseXForwardedFor('  8.8.8.8  ,  10.0.0.1  ', null)).toBe('8.8.8.8');
    });

    it('should ignore invalid IPs in chain', () => {
      expect(parseXForwardedFor('invalid, 8.8.8.8', null)).toBe('8.8.8.8');
    });

    it('should reject XFF from untrusted proxy', () => {
      // When immediate client is not a trusted proxy, XFF should be ignored
      expect(parseXForwardedFor('8.8.8.8', '8.8.8.8')).toBeNull();
    });

    it('should accept XFF from trusted proxy', () => {
      // When immediate client is a trusted proxy (e.g., localhost), XFF should be accepted
      expect(parseXForwardedFor('8.8.8.8', '127.0.0.1')).toBe('8.8.8.8');
    });
  });

  describe('getClientIp', () => {
    function createRequest(headers: Record<string, string> = {}): NextRequest {
      return new NextRequest('http://localhost/api/test', { headers });
    }

    it('should extract IP from x-real-ip header', () => {
      // Use 8.8.8.8 (Google DNS) as a true public IP
      // Note: 203.0.113.x is in TEST-NET-3 range which is reserved/documentation
      const req = createRequest({ 'x-real-ip': '8.8.8.8' });
      const result = getClientIp(req);

      expect(result.ip).toBe('8.8.8.8');
      expect(result.source).toBe('x-real-ip');
      expect(result.trusted).toBe(true);
    });

    it('should extract IP from x-forwarded-for header', () => {
      const req = createRequest({ 'x-forwarded-for': '8.8.8.8, 10.0.0.1' });
      const result = getClientIp(req);

      expect(result.ip).toBe('8.8.8.8');
      expect(result.source).toBe('x-forwarded-for');
    });

    it('should extract IP from cf-connecting-ip header', () => {
      const req = createRequest({ 'cf-connecting-ip': '8.8.8.8' });
      const result = getClientIp(req);

      expect(result.ip).toBe('8.8.8.8');
      expect(result.source).toBe('cf-connecting-ip');
    });

    it('should prioritize x-real-ip over x-forwarded-for', () => {
      const req = createRequest({
        'x-real-ip': '8.8.8.8',
        'x-forwarded-for': '1.1.1.1',
      });
      const result = getClientIp(req);

      expect(result.ip).toBe('8.8.8.8');
      expect(result.source).toBe('x-real-ip');
    });

    it('should fall back to unknown when no headers present', () => {
      const req = createRequest({});
      const result = getClientIp(req);

      expect(result.ip).toBe('unknown');
      expect(result.source).toBe('fallback');
      expect(result.trusted).toBe(false);
    });

    it('should include original headers in result', () => {
      const req = createRequest({
        'x-real-ip': '8.8.8.8',
        'x-forwarded-for': '10.0.0.1',
        'cf-connecting-ip': '1.1.1.1',
      });
      const result = getClientIp(req);

      expect(result.originalHeaders).toEqual({
        xRealIp: '8.8.8.8',
        xForwardedFor: '10.0.0.1',
        cfConnectingIp: '1.1.1.1',
      });
    });

    it('should mark private IPs as untrusted', () => {
      const req = createRequest({ 'x-real-ip': '192.168.1.1' });
      const result = getClientIp(req);

      expect(result.ip).toBe('192.168.1.1');
      expect(result.trusted).toBe(false);
    });

    it('should sanitize malformed IP addresses', () => {
      const req = createRequest({ 'x-real-ip': '  8.8.8.8  ' });
      const result = getClientIp(req);

      expect(result.ip).toBe('8.8.8.8');
    });

    it('should handle invalid x-real-ip gracefully', () => {
      const req = createRequest({
        'x-real-ip': 'invalid',
        'x-forwarded-for': '8.8.8.8',
      });
      const result = getClientIp(req);

      expect(result.ip).toBe('8.8.8.8');
      expect(result.source).toBe('x-forwarded-for');
    });
  });

  describe('getClientIpString', () => {
    it('should return just the IP string', () => {
      const req = new NextRequest('http://localhost/api/test', {
        headers: { 'x-real-ip': '8.8.8.8' },
      });

      expect(getClientIpString(req)).toBe('8.8.8.8');
    });

    it('should return unknown for missing headers', () => {
      const req = new NextRequest('http://localhost/api/test');

      expect(getClientIpString(req)).toBe('unknown');
    });
  });

  describe('logSuspiciousPattern', () => {
    it('should track patterns', () => {
      logSuspiciousPattern('test_pattern', 'source1', { ip: '8.8.8.8' });

      const stats = getSuspiciousPatternStats();
      expect(stats.totalPatterns).toBe(1);
      expect(stats.recentPatterns[0].key).toBe('test_pattern:source1');
      expect(stats.recentPatterns[0].count).toBe(1);
    });

    it('should increment count for repeated patterns', () => {
      logSuspiciousPattern('test_pattern', 'source1', { ip: '8.8.8.8' });
      logSuspiciousPattern('test_pattern', 'source1', { ip: '8.8.4.4' });
      logSuspiciousPattern('test_pattern', 'source1', { ip: '9.9.9.9' });

      const stats = getSuspiciousPatternStats();
      expect(stats.recentPatterns[0].count).toBe(3);
      expect(stats.recentPatterns[0].uniqueIps).toBe(3);
    });

    it('should log warning when threshold exceeded', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      for (let i = 0; i < 10; i++) {
        logSuspiciousPattern('test_pattern', 'source1', { ip: `203.0.113.${i}` });
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        '[IP_SECURITY] Suspicious pattern detected',
        expect.objectContaining({
          type: 'test_pattern',
          sourceIdentifier: 'source1',
          count: 10,
        })
      );

      consoleSpy.mockRestore();
    });
  });

  describe('trackIpChange', () => {
    it('should not log when IPs are the same', () => {
      trackIpChange('user1', '8.8.8.8', '8.8.8.8');

      const stats = getSuspiciousPatternStats();
      expect(stats.totalPatterns).toBe(0);
    });

    it('should not log when previous IP is undefined', () => {
      trackIpChange('user1', '8.8.8.8', undefined);

      const stats = getSuspiciousPatternStats();
      expect(stats.totalPatterns).toBe(0);
    });

    it('should log when IP changes', () => {
      trackIpChange('user1', '8.8.4.4', '8.8.8.8');

      const stats = getSuspiciousPatternStats();
      expect(stats.totalPatterns).toBe(1);
      expect(stats.recentPatterns[0].key).toBe('ip_change:user1');
    });

    it('should not log for invalid IPs', () => {
      trackIpChange('user1', 'invalid', '8.8.8.8');

      const stats = getSuspiciousPatternStats();
      expect(stats.totalPatterns).toBe(0);
    });
  });

  describe('Rate limiter integration', () => {
    it('should provide consistent IP for rate limiting', () => {
      const headers = { 'x-forwarded-for': '8.8.8.8, 10.0.0.1, 192.168.1.1' };
      const req1 = new NextRequest('http://localhost/api/test', { headers });
      const req2 = new NextRequest('http://localhost/api/test', { headers });

      expect(getClientIpString(req1)).toBe(getClientIpString(req2));
    });

    it('should handle spoofed headers safely', () => {
      // Attacker tries to spoof their IP to bypass rate limiting
      const req = new NextRequest('http://localhost/api/test', {
        headers: {
          'x-forwarded-for': '1.1.1.1, 2.2.2.2, 3.3.3.3',
          'x-real-ip': '4.4.4.4',
        },
      });

      // Should use x-real-ip as it has higher priority
      const ip = getClientIpString(req);
      expect(ip).toBe('4.4.4.4');
    });
  });
});
