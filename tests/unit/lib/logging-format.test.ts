/**
 * Tests for src/lib/logging/format.ts
 * Log formatting, sanitization, and utility functions
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  LogLevel,
  LOG_LEVELS,
  formatLogMessage,
  sanitizeLogData,
  formatBytes,
  formatDuration,
  extractTraceContext,
} from '@/lib/logging/format';

describe('Logging Format Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('LogLevel', () => {
    it('should define correct log levels', () => {
      expect(LogLevel.DEBUG).toBe('debug');
      expect(LogLevel.INFO).toBe('info');
      expect(LogLevel.WARN).toBe('warn');
      expect(LogLevel.ERROR).toBe('error');
    });
  });

  describe('LOG_LEVELS', () => {
    it('should have increasing numeric values for severity', () => {
      expect(LOG_LEVELS[LogLevel.DEBUG]).toBeLessThan(LOG_LEVELS[LogLevel.INFO]);
      expect(LOG_LEVELS[LogLevel.INFO]).toBeLessThan(LOG_LEVELS[LogLevel.WARN]);
      expect(LOG_LEVELS[LogLevel.WARN]).toBeLessThan(LOG_LEVELS[LogLevel.ERROR]);
    });
  });

  describe('formatLogMessage', () => {
    it('should format a basic log message', () => {
      const result = formatLogMessage(LogLevel.INFO, 'Hello world');
      expect(result.level).toBe('info');
      expect(result.message).toBe('Hello world');
      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('string');
    });

    it('should include metadata in formatted message', () => {
      const result = formatLogMessage(LogLevel.ERROR, 'Error occurred', {
        service: 'api',
        requestId: 'req-123',
      });
      expect(result.service).toBe('api');
      expect(result.requestId).toBe('req-123');
    });

    it('should sanitize metadata', () => {
      const result = formatLogMessage(LogLevel.INFO, 'test', {
        password: 'secret123',
        service: 'auth',
      });
      expect(result.password).toBe('[REDACTED]');
      expect(result.service).toBe('auth');
    });

    it('should handle empty metadata', () => {
      const result = formatLogMessage(LogLevel.DEBUG, 'test');
      expect(result.level).toBe('debug');
      expect(result.message).toBe('test');
    });
  });

  describe('sanitizeLogData', () => {
    it('should redact password fields', () => {
      const result = sanitizeLogData({ password: 'secret', user: 'john' });
      expect(result.password).toBe('[REDACTED]');
      expect(result.user).toBe('john');
    });

    it('should redact token fields', () => {
      const result = sanitizeLogData({ accessToken: 'abc123', status: 'ok' });
      expect(result.accessToken).toBe('[REDACTED]');
      expect(result.status).toBe('ok');
    });

    it('should redact api key fields', () => {
      const result = sanitizeLogData({ apiKey: 'key123', api_key: 'key456' });
      expect(result.apiKey).toBe('[REDACTED]');
      expect(result.api_key).toBe('[REDACTED]');
    });

    it('should redact secret fields', () => {
      const result = sanitizeLogData({ secret: 'shhh', clientSecret: 'hidden' });
      expect(result.secret).toBe('[REDACTED]');
      expect(result.clientSecret).toBe('[REDACTED]');
    });

    it('should redact auth-related fields', () => {
      const result = sanitizeLogData({
        authorization: 'Bearer xyz',
        authHeader: 'Basic abc',
      });
      expect(result.authorization).toBe('[REDACTED]');
      expect(result.authHeader).toBe('[REDACTED]');
    });

    it('should redact cookie fields', () => {
      const result = sanitizeLogData({ cookie: 'session=abc' });
      expect(result.cookie).toBe('[REDACTED]');
    });

    it('should redact session_id fields', () => {
      const result = sanitizeLogData({ session_id: 'sess-123' });
      expect(result.session_id).toBe('[REDACTED]');
    });

    it('should redact credential fields', () => {
      const result = sanitizeLogData({ credential: 'cred-123' });
      expect(result.credential).toBe('[REDACTED]');
    });

    it('should redact private_key fields', () => {
      const result = sanitizeLogData({ private_key: 'pk-123' });
      expect(result.private_key).toBe('[REDACTED]');
    });

    it('should truncate long strings', () => {
      const longString = 'x'.repeat(2000);
      const result = sanitizeLogData({ message: longString });
      const msg = result.message as string;
      expect(msg.length).toBeLessThan(2000);
      expect(msg).toContain('truncated');
      expect(msg).toContain('2000');
    });

    it('should preserve null and undefined values', () => {
      const result = sanitizeLogData({ a: null, b: undefined });
      expect(result.a).toBeNull();
      expect(result.b).toBeUndefined();
    });

    it('should preserve numbers and booleans', () => {
      const result = sanitizeLogData({ count: 42, active: true });
      expect(result.count).toBe(42);
      expect(result.active).toBe(true);
    });

    it('should convert Date objects to ISO strings', () => {
      const date = new Date('2024-01-15T10:00:00Z');
      const result = sanitizeLogData({ created: date });
      expect(result.created).toBe('2024-01-15T10:00:00.000Z');
    });

    it('should serialize Error objects', () => {
      const err = new Error('test error');
      const result = sanitizeLogData({ error: err });
      const serialized = result.error as Record<string, unknown>;
      expect(serialized.name).toBe('Error');
      expect(serialized.message).toBe('test error');
      expect(serialized.stack).toBeDefined();
    });

    it('should handle nested objects', () => {
      const result = sanitizeLogData({
        user: { name: 'John', password: 'secret' },
      });
      const nested = result.user as Record<string, unknown>;
      expect(nested.name).toBe('John');
      expect(nested.password).toBe('[REDACTED]');
    });

    it('should truncate deeply nested objects', () => {
      let nested: Record<string, unknown> = { value: 'deep' };
      for (let i = 0; i < 10; i++) {
        nested = { child: nested };
      }
      const result = sanitizeLogData(nested);
      // Should eventually hit max depth
      let current: any = result;
      let depth = 0;
      while (current?.child && depth < 20) {
        current = current.child;
        depth++;
      }
      // At some point it should truncate
      expect(depth).toBeLessThanOrEqual(10);
    });

    it('should handle large arrays', () => {
      const bigArray = Array.from({ length: 200 }, (_, i) => i);
      const result = sanitizeLogData({ items: bigArray });
      const items = result.items as Record<string, unknown>;
      expect(items._type).toBe('array');
      expect(items._length).toBe(200);
      expect(items._truncated).toBe(true);
      expect(Array.isArray(items._preview)).toBe(true);
    });

    it('should handle small arrays normally', () => {
      const result = sanitizeLogData({ items: [1, 2, 3] });
      expect(result.items).toEqual([1, 2, 3]);
    });

    it('should handle functions by returning type name', () => {
      const result = sanitizeLogData({ callback: () => {} });
      expect(result.callback).toBe('[function]');
    });
  });

  describe('formatBytes', () => {
    it('should format 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('should format bytes', () => {
      expect(formatBytes(100)).toBe('100 B');
    });

    it('should format kilobytes', () => {
      expect(formatBytes(1024)).toBe('1 KB');
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('should format megabytes', () => {
      expect(formatBytes(1048576)).toBe('1 MB');
    });

    it('should format gigabytes', () => {
      expect(formatBytes(1073741824)).toBe('1 GB');
    });
  });

  describe('formatDuration', () => {
    it('should format microseconds', () => {
      const result = formatDuration(0.5);
      expect(result).toContain('us');
    });

    it('should format milliseconds', () => {
      const result = formatDuration(50);
      expect(result).toContain('ms');
    });

    it('should format seconds', () => {
      const result = formatDuration(5000);
      expect(result).toContain('s');
    });

    it('should format minutes', () => {
      const result = formatDuration(120000);
      expect(result).toContain('m');
    });

    it('should format edge case at 1ms boundary', () => {
      expect(formatDuration(1)).toContain('ms');
    });

    it('should format edge case at 1000ms boundary', () => {
      expect(formatDuration(1000)).toContain('s');
    });
  });

  describe('extractTraceContext', () => {
    it('should extract x-trace-id header', () => {
      const headers = new Headers({ 'x-trace-id': 'trace-123' });
      const result = extractTraceContext(headers);
      expect(result.traceId).toBe('trace-123');
    });

    it('should extract x-datadog-trace-id header', () => {
      const headers = new Headers({ 'x-datadog-trace-id': 'dd-trace-456' });
      const result = extractTraceContext(headers);
      expect(result.traceId).toBe('dd-trace-456');
    });

    it('should extract from traceparent header', () => {
      const headers = new Headers({
        traceparent: '00-traceID-spanID-01',
      });
      const result = extractTraceContext(headers);
      expect(result.traceId).toBe('traceID');
      expect(result.spanId).toBe('spanID');
    });

    it('should extract x-span-id header', () => {
      const headers = new Headers({ 'x-span-id': 'span-789' });
      const result = extractTraceContext(headers);
      expect(result.spanId).toBe('span-789');
    });

    it('should extract x-datadog-parent-id header', () => {
      const headers = new Headers({ 'x-datadog-parent-id': 'parent-abc' });
      const result = extractTraceContext(headers);
      expect(result.parentSpanId).toBe('parent-abc');
    });

    it('should return undefined for missing headers', () => {
      const headers = new Headers();
      const result = extractTraceContext(headers);
      expect(result.traceId).toBeUndefined();
      expect(result.spanId).toBeUndefined();
      expect(result.parentSpanId).toBeUndefined();
    });

    it('should prefer x-trace-id over traceparent', () => {
      const headers = new Headers({
        'x-trace-id': 'preferred',
        traceparent: '00-fallback-span-01',
      });
      const result = extractTraceContext(headers);
      expect(result.traceId).toBe('preferred');
    });
  });
});
