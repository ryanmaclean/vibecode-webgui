/**
 * Tests for src/lib/security/ip-validator.ts
 * IP address validation, sanitization, and security utilities
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  sanitizeIpAddress,
  isValidIpv4,
  isValidIpv6,
  isValidIpAddress,
  isPrivateIp,
  isTrustedProxy,
  logSuspiciousPattern,
  trackIpChange,
  getSuspiciousPatternStats,
  __clearSuspiciousPatterns,
} from '@/lib/security/ip-validator';

describe('IP Validator', () => {
  beforeEach(() => {
    __clearSuspiciousPatterns();
  });

  describe('isValidIpv4', () => {
    it('should accept valid IPv4 addresses', () => {
      expect(isValidIpv4('192.168.1.1')).toBe(true);
      expect(isValidIpv4('10.0.0.1')).toBe(true);
      expect(isValidIpv4('172.16.0.1')).toBe(true);
      expect(isValidIpv4('8.8.8.8')).toBe(true);
      expect(isValidIpv4('0.0.0.0')).toBe(true);
      expect(isValidIpv4('255.255.255.255')).toBe(true);
    });

    it('should reject invalid IPv4 addresses', () => {
      expect(isValidIpv4('256.0.0.1')).toBe(false);
      expect(isValidIpv4('192.168.1')).toBe(false);
      expect(isValidIpv4('192.168.1.1.1')).toBe(false);
      expect(isValidIpv4('')).toBe(false);
      expect(isValidIpv4('abc.def.ghi.jkl')).toBe(false);
      expect(isValidIpv4('192.168.1.1:8080')).toBe(false);
    });

    it('should accept IPv4 with leading zeros (regex allows them)', () => {
      // The regex [01]?[0-9][0-9]? matches "001" since 0 is a valid leading digit
      expect(isValidIpv4('192.168.001.001')).toBe(true);
    });
  });

  describe('isValidIpv6', () => {
    it('should accept valid IPv6 addresses', () => {
      expect(isValidIpv6('::1')).toBe(true);
      expect(isValidIpv6('2001:db8::1')).toBe(true);
      expect(isValidIpv6('fe80::1')).toBe(true);
    });

    it('should accept full IPv6 address', () => {
      expect(isValidIpv6('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
    });

    it('should reject invalid IPv6', () => {
      expect(isValidIpv6('')).toBe(false);
      expect(isValidIpv6('192.168.1.1')).toBe(false);
      expect(isValidIpv6('not-an-ip')).toBe(false);
    });
  });

  describe('isValidIpAddress', () => {
    it('should accept valid IPv4', () => {
      expect(isValidIpAddress('192.168.1.1')).toBe(true);
    });

    it('should accept valid IPv6', () => {
      expect(isValidIpAddress('::1')).toBe(true);
    });

    it('should reject invalid addresses', () => {
      expect(isValidIpAddress('')).toBe(false);
      expect(isValidIpAddress('invalid')).toBe(false);
    });
  });

  describe('sanitizeIpAddress', () => {
    it('should return valid IPv4 as-is', () => {
      expect(sanitizeIpAddress('192.168.1.1')).toBe('192.168.1.1');
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

    it('should return null for null input', () => {
      expect(sanitizeIpAddress(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(sanitizeIpAddress(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(sanitizeIpAddress('')).toBeNull();
    });

    it('should return null for invalid IP', () => {
      expect(sanitizeIpAddress('not-an-ip')).toBeNull();
    });

    it('should return null for non-string input', () => {
      expect(sanitizeIpAddress(123 as any)).toBeNull();
    });

    it('should strip non-IP characters', () => {
      // Non-alphanumeric, dot, colon chars are stripped
      expect(sanitizeIpAddress('192.168.1.1\x00')).toBe('192.168.1.1');
    });
  });

  describe('isPrivateIp', () => {
    it('should identify 10.x.x.x as private', () => {
      expect(isPrivateIp('10.0.0.1')).toBe(true);
      expect(isPrivateIp('10.255.255.255')).toBe(true);
    });

    it('should identify 172.16-31.x.x as private', () => {
      expect(isPrivateIp('172.16.0.1')).toBe(true);
      expect(isPrivateIp('172.31.255.255')).toBe(true);
    });

    it('should not identify 172.32.x.x as private', () => {
      expect(isPrivateIp('172.32.0.1')).toBe(false);
    });

    it('should identify 192.168.x.x as private', () => {
      expect(isPrivateIp('192.168.0.1')).toBe(true);
      expect(isPrivateIp('192.168.255.255')).toBe(true);
    });

    it('should identify 127.x.x.x as private (loopback)', () => {
      expect(isPrivateIp('127.0.0.1')).toBe(true);
      expect(isPrivateIp('127.255.255.255')).toBe(true);
    });

    it('should identify 169.254.x.x as private (link-local)', () => {
      expect(isPrivateIp('169.254.0.1')).toBe(true);
    });

    it('should not identify public IPs as private', () => {
      expect(isPrivateIp('8.8.8.8')).toBe(false);
      expect(isPrivateIp('1.1.1.1')).toBe(false);
      expect(isPrivateIp('104.16.0.1')).toBe(false);
    });

    it('should identify IPv6 loopback as private', () => {
      expect(isPrivateIp('::1')).toBe(true);
    });

    it('should identify IPv6 unique local as private', () => {
      expect(isPrivateIp('fc00::1')).toBe(true);
      expect(isPrivateIp('fd00::1')).toBe(true);
    });

    it('should identify IPv6 link-local as private', () => {
      expect(isPrivateIp('fe80::1')).toBe(true);
    });

    it('should return false for invalid IP', () => {
      expect(isPrivateIp('not-an-ip')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isPrivateIp('')).toBe(false);
    });

    it('should identify multicast addresses as private', () => {
      expect(isPrivateIp('224.0.0.1')).toBe(true);
    });

    it('should identify documentation IPs as private', () => {
      expect(isPrivateIp('192.0.2.1')).toBe(true);
      expect(isPrivateIp('198.51.100.1')).toBe(true);
      expect(isPrivateIp('203.0.113.1')).toBe(true);
    });
  });

  describe('isTrustedProxy', () => {
    it('should trust localhost', () => {
      expect(isTrustedProxy('127.0.0.1')).toBe(true);
    });

    it('should trust private network ranges', () => {
      expect(isTrustedProxy('10.0.0.1')).toBe(true);
      expect(isTrustedProxy('192.168.1.1')).toBe(true);
    });

    it('should not trust arbitrary public IPs', () => {
      expect(isTrustedProxy('8.8.8.8')).toBe(false);
      expect(isTrustedProxy('1.1.1.1')).toBe(false);
    });

    it('should return false for invalid IP', () => {
      expect(isTrustedProxy('not-an-ip')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isTrustedProxy('')).toBe(false);
    });
  });

  describe('logSuspiciousPattern', () => {
    it('should track patterns in memory', () => {
      logSuspiciousPattern('test_type', 'source-1', { ip: '1.2.3.4' });
      const stats = getSuspiciousPatternStats();
      expect(stats.totalPatterns).toBe(1);
    });

    it('should increment count for same pattern', () => {
      logSuspiciousPattern('test_type', 'source-1', {});
      logSuspiciousPattern('test_type', 'source-1', {});
      const stats = getSuspiciousPatternStats();
      expect(stats.totalPatterns).toBe(1);
      expect(stats.recentPatterns[0].count).toBe(2);
    });

    it('should track different patterns separately', () => {
      logSuspiciousPattern('type_a', 'source-1', {});
      logSuspiciousPattern('type_b', 'source-2', {});
      const stats = getSuspiciousPatternStats();
      expect(stats.totalPatterns).toBe(2);
    });

    it('should track unique IPs', () => {
      logSuspiciousPattern('test', 'src', { ip: '1.1.1.1' });
      logSuspiciousPattern('test', 'src', { ip: '2.2.2.2' });
      logSuspiciousPattern('test', 'src', { ip: '1.1.1.1' }); // duplicate
      const stats = getSuspiciousPatternStats();
      expect(stats.recentPatterns[0].uniqueIps).toBe(2);
    });
  });

  describe('getSuspiciousPatternStats', () => {
    it('should return empty stats when no patterns', () => {
      const stats = getSuspiciousPatternStats();
      expect(stats.totalPatterns).toBe(0);
      expect(stats.recentPatterns).toEqual([]);
    });

    it('should sort by count descending', () => {
      logSuspiciousPattern('low', 'src', {});
      logSuspiciousPattern('high', 'src', {});
      logSuspiciousPattern('high', 'src', {});
      logSuspiciousPattern('high', 'src', {});
      const stats = getSuspiciousPatternStats();
      expect(stats.recentPatterns[0].count).toBe(3);
    });

    it('should include age in minutes', () => {
      logSuspiciousPattern('test', 'src', {});
      const stats = getSuspiciousPatternStats();
      expect(stats.recentPatterns[0].ageMinutes).toBeGreaterThanOrEqual(0);
    });
  });

  describe('trackIpChange', () => {
    it('should log when IP changes', () => {
      trackIpChange('session-1', '8.8.8.8', '1.1.1.1');
      const stats = getSuspiciousPatternStats();
      expect(stats.totalPatterns).toBe(1);
    });

    it('should not log when IPs are the same', () => {
      trackIpChange('session-1', '8.8.8.8', '8.8.8.8');
      const stats = getSuspiciousPatternStats();
      expect(stats.totalPatterns).toBe(0);
    });

    it('should not log when no previous IP', () => {
      trackIpChange('session-1', '8.8.8.8');
      const stats = getSuspiciousPatternStats();
      expect(stats.totalPatterns).toBe(0);
    });

    it('should not log when previous IP is undefined', () => {
      trackIpChange('session-1', '8.8.8.8', undefined);
      const stats = getSuspiciousPatternStats();
      expect(stats.totalPatterns).toBe(0);
    });

    it('should not log when current IP is invalid', () => {
      trackIpChange('session-1', 'not-valid', '8.8.8.8');
      const stats = getSuspiciousPatternStats();
      expect(stats.totalPatterns).toBe(0);
    });

    it('should not log when previous IP is invalid', () => {
      trackIpChange('session-1', '8.8.8.8', 'not-valid');
      const stats = getSuspiciousPatternStats();
      expect(stats.totalPatterns).toBe(0);
    });
  });

  describe('__clearSuspiciousPatterns', () => {
    it('should clear all patterns', () => {
      logSuspiciousPattern('test', 'src', {});
      logSuspiciousPattern('test2', 'src2', {});
      expect(getSuspiciousPatternStats().totalPatterns).toBe(2);

      __clearSuspiciousPatterns();
      expect(getSuspiciousPatternStats().totalPatterns).toBe(0);
    });
  });
});
