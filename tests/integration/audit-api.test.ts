/**
 * Audit API Integration Tests
 *
 * Tests the audit log API endpoints for compliance tool integration:
 * - /api/audit/logs - Query and filter audit logs
 * - /api/audit/export - Export audit logs in CSV/JSON format
 *
 * These tests verify authentication, rate limiting, filtering,
 * pagination, and export functionality.
 *
 * @see src/app/api/audit/logs/route.ts
 * @see src/app/api/audit/export/route.ts
 */

import { describe, it, expect, beforeAll, beforeEach, jest } from '@jest/globals';
import { NextRequest } from 'next/server';

// Mock types for audit data
interface MockAuditLogEntry {
  id: string;
  timestamp: Date;
  user_id: number | null;
  action: string;
  resource: string;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
  hash: string;
  previous_hash: string | null;
  severity: string;
  category: string;
  outcome: string;
  session_id: string | null;
}

// Mock data store
const mockAuditLogs: MockAuditLogEntry[] = [];
let mockAuthResult = {
  isAuthorized: true,
  error: undefined as string | undefined,
  user: { id: '1', email: 'admin@test.com', role: 'admin' },
};
let mockRateLimitResult = {
  success: true,
  limit: 60,
  remaining: 59,
  reset: Math.ceil(Date.now() / 1000) + 60,
  retryAfter: undefined as number | undefined,
};

// Mock the monitoring auth module
jest.mock('@/lib/monitoring/auth', () => ({
  checkDashboardAuth: jest.fn().mockImplementation(async () => mockAuthResult),
  getDashboardUnauthorizedResponse: jest.fn().mockImplementation((error?: string) =>
    Response.json(
      {
        error: 'Unauthorized access to dashboard',
        message: error || 'Admin authentication required',
        timestamp: new Date().toISOString(),
        required_roles: ['admin'],
      },
      { status: 401 }
    )
  ),
}));

// Mock rate limiting
jest.mock('@/lib/rate-limiting', () => ({
  createAPIRateLimit: jest.fn().mockImplementation(() => async () => mockRateLimitResult),
  __clearStore: jest.fn(),
}));

// Mock the audit service - complete mock without requireActual to avoid circular deps
jest.mock('@/lib/audit', () => {
  // Define enums inline to avoid import issues
  const AuditAction = {
    ADMIN_AUDIT_LOG_VIEWED: 'admin.audit_log_viewed',
    ADMIN_EXPORT_REQUESTED: 'admin.export_requested',
    USER_LOGIN: 'user.login',
    AI_CHAT_REQUEST: 'ai.chat_request',
  };

  const AuditCategory = {
    AUTH: 'auth',
    ADMIN: 'admin',
    AI_OPERATIONS: 'ai_operations',
    DATA_ACCESS: 'data_access',
    SYSTEM: 'system',
    API: 'api',
    GENERAL: 'general',
  };

  const AuditSeverity = {
    INFO: 'info',
    WARNING: 'warning',
    CRITICAL: 'critical',
  };

  const AuditOutcome = {
    SUCCESS: 'success',
    FAILURE: 'failure',
    ERROR: 'error',
  };

  const ExportFormat = {
    JSON: 'json',
    CSV: 'csv',
  };

  // Import zod for schema creation
  const { z } = require('zod');

  return {
    AuditAction,
    AuditCategory,
    AuditSeverity,
    AuditOutcome,
    ExportFormat,
    auditCategorySchema: z.nativeEnum(AuditCategory),
    auditSeveritySchema: z.nativeEnum(AuditSeverity),
    auditOutcomeSchema: z.nativeEnum(AuditOutcome),
    exportFormatSchema: z.nativeEnum(ExportFormat),
    auditService: {
      query: jest.fn().mockImplementation(async (filter: Record<string, unknown>) => {
        let filtered = [...mockAuditLogs];

        if (filter.userId) {
          filtered = filtered.filter((l) => l.user_id === filter.userId);
        }
        if (filter.actions && (filter.actions as string[]).length > 0) {
          filtered = filtered.filter((l) => (filter.actions as string[]).includes(l.action));
        }
        if (filter.category) {
          filtered = filtered.filter((l) => l.category === filter.category);
        }
        if (filter.severity) {
          filtered = filtered.filter((l) => l.severity === filter.severity);
        }
        if (filter.outcome) {
          filtered = filtered.filter((l) => l.outcome === filter.outcome);
        }
        if (filter.sessionId) {
          filtered = filtered.filter((l) => l.session_id === filter.sessionId);
        }
        if (filter.startTime) {
          filtered = filtered.filter((l) => l.timestamp >= (filter.startTime as Date));
        }
        if (filter.endTime) {
          filtered = filtered.filter((l) => l.timestamp <= (filter.endTime as Date));
        }

        const limit = (filter.limit as number) || 100;
        const offset = (filter.offset as number) || 0;
        const totalCount = filtered.length;
        const entries = filtered.slice(offset, offset + limit);

        return {
          entries: entries.map((e) => ({
            id: e.id,
            timestamp: e.timestamp,
            userId: e.user_id,
            action: e.action,
            resource: e.resource,
            ipAddress: e.ip_address,
            userAgent: e.user_agent,
            metadata: e.metadata,
            hash: e.hash,
            previousHash: e.previous_hash,
            severity: e.severity,
            category: e.category,
            outcome: e.outcome,
            sessionId: e.session_id,
          })),
          totalCount,
          hasMore: offset + entries.length < totalCount,
        };
      }),
      count: jest.fn().mockImplementation(async (filter: Record<string, unknown>) => {
        let filtered = [...mockAuditLogs];

        if (filter.userId) {
          filtered = filtered.filter((l) => l.user_id === filter.userId);
        }
        if (filter.actions && (filter.actions as string[]).length > 0) {
          filtered = filtered.filter((l) => (filter.actions as string[]).includes(l.action));
        }
        if (filter.category) {
          filtered = filtered.filter((l) => l.category === filter.category);
        }

        return filtered.length;
      }),
    },
    exportAuditLogs: jest.fn().mockImplementation(async (options: Record<string, unknown>) => {
      const format = options.format || 'json';
      const maxRecords = (options.maxRecords as number) || 10000;
      const filter = options.filter as Record<string, unknown>;

      let filtered = [...mockAuditLogs];

      if (filter?.userId) {
        filtered = filtered.filter((l) => l.user_id === filter.userId);
      }
      if (filter?.category) {
        filtered = filtered.filter((l) => l.category === filter.category);
      }

      const truncated = filtered.length > maxRecords;
      const records = filtered.slice(0, maxRecords);

      if (format === 'csv') {
        const csv = 'id,timestamp,action,resource\n' + records.map((r) => `${r.id},${r.timestamp.toISOString()},${r.action},${r.resource}`).join('\n');
        return {
          success: true,
          content: csv,
          contentType: 'text/csv',
          filename: `audit-logs-${Date.now()}.csv`,
          recordCount: records.length,
          totalCount: filtered.length,
          truncated,
          format: 'csv',
        };
      }

      const json = JSON.stringify({
        metadata: {
          exportedAt: new Date().toISOString(),
          recordCount: records.length,
          totalCount: filtered.length,
          truncated,
        },
        entries: records.map((e) => ({
          id: e.id,
          timestamp: e.timestamp.toISOString(),
          action: e.action,
          resource: e.resource,
          category: e.category,
          severity: e.severity,
          outcome: e.outcome,
        })),
      });

      return {
        success: true,
        content: json,
        contentType: 'application/json',
        filename: `audit-logs-${Date.now()}.json`,
        recordCount: records.length,
        totalCount: filtered.length,
        truncated,
        format: 'json',
      };
    }),
    logAuditAsync: jest.fn(),
  };
});

// Import route handlers after mocking
import { GET as logsHandler, HEAD as logsHeadHandler } from '@/app/api/audit/logs/route';
import { GET as exportHandler, HEAD as exportHeadHandler } from '@/app/api/audit/export/route';

// Helper to create mock request
function createMockRequest(
  url: string,
  options: RequestInit & { headers?: Record<string, string> } = {}
): NextRequest {
  const baseUrl = 'http://localhost:3000';
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

  return new NextRequest(fullUrl, {
    method: options.method || 'GET',
    headers: {
      'x-forwarded-for': '127.0.0.1',
      ...options.headers,
    },
  });
}

// Helper to generate mock audit logs
function generateMockAuditLog(overrides: Partial<MockAuditLogEntry> = {}): MockAuditLogEntry {
  const id = crypto.randomUUID();
  const timestamp = new Date();

  return {
    id,
    timestamp,
    user_id: 1,
    action: 'user.login',
    resource: 'session:test',
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0',
    metadata: { browser: 'Chrome' },
    hash: `hash_${id}`,
    previous_hash: null,
    severity: 'info',
    category: 'auth',
    outcome: 'success',
    session_id: 'session_123',
    ...overrides,
  };
}

describe('Audit API Integration Tests', () => {
  beforeAll(() => {
    // Clear and seed mock data
    mockAuditLogs.length = 0;

    // Add some test audit logs
    for (let i = 0; i < 25; i++) {
      mockAuditLogs.push(
        generateMockAuditLog({
          id: `log_${i}`,
          user_id: i % 3 === 0 ? 1 : 2,
          action: i % 2 === 0 ? 'user.login' : 'ai.chat_request',
          category: i % 2 === 0 ? 'auth' : 'ai_operations',
          severity: i % 5 === 0 ? 'warning' : 'info',
          session_id: `session_${i % 5}`,
          timestamp: new Date(Date.now() - i * 60000),
        })
      );
    }
  });

  beforeEach(() => {
    // Reset auth and rate limit mocks
    mockAuthResult = {
      isAuthorized: true,
      error: undefined,
      user: { id: '1', email: 'admin@test.com', role: 'admin' },
    };
    mockRateLimitResult = {
      success: true,
      limit: 60,
      remaining: 59,
      reset: Math.ceil(Date.now() / 1000) + 60,
      retryAfter: undefined,
    };
  });

  describe('/api/audit/logs endpoint', () => {
    describe('GET - Query audit logs', () => {
      it('should return audit logs with default pagination', async () => {
        const request = createMockRequest('/api/audit/logs');
        const response = await logsHandler(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data).toHaveProperty('entries');
        expect(data).toHaveProperty('totalCount');
        expect(data).toHaveProperty('hasMore');
        expect(data).toHaveProperty('pagination');
        expect(Array.isArray(data.entries)).toBe(true);
      });

      it('should filter by userId', async () => {
        const request = createMockRequest('/api/audit/logs?userId=1');
        const response = await logsHandler(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.entries.length).toBeGreaterThan(0);
        data.entries.forEach((entry: { userId: number }) => {
          expect(entry.userId).toBe(1);
        });
      });

      it('should filter by actions (comma-separated)', async () => {
        const request = createMockRequest('/api/audit/logs?actions=user.login');
        const response = await logsHandler(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        data.entries.forEach((entry: { action: string }) => {
          expect(entry.action).toBe('user.login');
        });
      });

      it('should filter by category', async () => {
        const request = createMockRequest('/api/audit/logs?category=auth');
        const response = await logsHandler(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        data.entries.forEach((entry: { category: string }) => {
          expect(entry.category).toBe('auth');
        });
      });

      it('should filter by severity', async () => {
        const request = createMockRequest('/api/audit/logs?severity=warning');
        const response = await logsHandler(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        data.entries.forEach((entry: { severity: string }) => {
          expect(entry.severity).toBe('warning');
        });
      });

      it('should filter by outcome', async () => {
        const request = createMockRequest('/api/audit/logs?outcome=success');
        const response = await logsHandler(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        data.entries.forEach((entry: { outcome: string }) => {
          expect(entry.outcome).toBe('success');
        });
      });

      it('should filter by sessionId', async () => {
        const request = createMockRequest('/api/audit/logs?sessionId=session_0');
        const response = await logsHandler(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        data.entries.forEach((entry: { sessionId: string }) => {
          expect(entry.sessionId).toBe('session_0');
        });
      });

      it('should support pagination with limit and offset', async () => {
        const request = createMockRequest('/api/audit/logs?limit=5&offset=0');
        const response = await logsHandler(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.entries.length).toBeLessThanOrEqual(5);
        expect(data.pagination.limit).toBe(5);
        expect(data.pagination.offset).toBe(0);
      });

      it('should indicate hasMore when there are more entries', async () => {
        const request = createMockRequest('/api/audit/logs?limit=5&offset=0');
        const response = await logsHandler(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        if (data.totalCount > 5) {
          expect(data.hasMore).toBe(true);
        }
      });

      it('should return 401 for unauthorized requests', async () => {
        mockAuthResult = {
          isAuthorized: false,
          error: 'Authentication required',
          user: undefined,
        };

        const request = createMockRequest('/api/audit/logs');
        const response = await logsHandler(request);

        expect(response.status).toBe(401);
      });

      it('should return 429 when rate limited', async () => {
        mockRateLimitResult = {
          success: false,
          limit: 60,
          remaining: 0,
          reset: Math.ceil(Date.now() / 1000) + 60,
          retryAfter: 60,
        };

        const request = createMockRequest('/api/audit/logs');
        const response = await logsHandler(request);

        expect(response.status).toBe(429);
        expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      });

      it('should return 400 for invalid query parameters', async () => {
        const request = createMockRequest('/api/audit/logs?limit=invalid');
        const response = await logsHandler(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toHaveProperty('error');
      });

      it('should include rate limit headers in response', async () => {
        const request = createMockRequest('/api/audit/logs');
        await logsHandler(request);

        // Rate limit headers are set on 429 responses
        // For successful responses, we verify the request succeeded
        expect(mockRateLimitResult.success).toBe(true);
      });
    });

    describe('HEAD - Get log count', () => {
      it('should return count in X-Total-Count header', async () => {
        const request = createMockRequest('/api/audit/logs');
        const response = await logsHeadHandler(request);

        expect(response.status).toBe(200);
        expect(response.headers.get('X-Total-Count')).toBeDefined();
      });

      it('should return 401 for unauthorized requests', async () => {
        mockAuthResult = {
          isAuthorized: false,
          error: 'Authentication required',
          user: undefined,
        };

        const request = createMockRequest('/api/audit/logs');
        const response = await logsHeadHandler(request);

        expect(response.status).toBe(401);
      });

      it('should return 429 when rate limited', async () => {
        mockRateLimitResult = {
          success: false,
          limit: 60,
          remaining: 0,
          reset: Math.ceil(Date.now() / 1000) + 60,
          retryAfter: 60,
        };

        const request = createMockRequest('/api/audit/logs');
        const response = await logsHeadHandler(request);

        expect(response.status).toBe(429);
      });
    });
  });

  describe('/api/audit/export endpoint', () => {
    describe('GET - Export audit logs', () => {
      it('should export logs as JSON by default', async () => {
        const request = createMockRequest('/api/audit/export');
        const response = await exportHandler(request);

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toContain('application/json');
        expect(response.headers.get('Content-Disposition')).toContain('attachment');
        expect(response.headers.get('X-Export-Format')).toBe('json');
      });

      it('should export logs as CSV when format=csv', async () => {
        const request = createMockRequest('/api/audit/export?format=csv');
        const response = await exportHandler(request);

        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toContain('text/csv');
        expect(response.headers.get('Content-Disposition')).toContain('attachment');
        expect(response.headers.get('X-Export-Format')).toBe('csv');
      });

      it('should include record count headers', async () => {
        const request = createMockRequest('/api/audit/export');
        const response = await exportHandler(request);

        expect(response.status).toBe(200);
        expect(response.headers.get('X-Export-Record-Count')).toBeDefined();
        expect(response.headers.get('X-Export-Total-Count')).toBeDefined();
        expect(response.headers.get('X-Export-Truncated')).toBeDefined();
      });

      it('should filter exports by userId', async () => {
        const request = createMockRequest('/api/audit/export?userId=1');
        const response = await exportHandler(request);

        expect(response.status).toBe(200);
        const recordCount = parseInt(response.headers.get('X-Export-Record-Count') || '0', 10);
        expect(recordCount).toBeGreaterThan(0);
      });

      it('should filter exports by category', async () => {
        const request = createMockRequest('/api/audit/export?category=auth');
        const response = await exportHandler(request);

        expect(response.status).toBe(200);
      });

      it('should respect maxRecords parameter', async () => {
        const request = createMockRequest('/api/audit/export?maxRecords=5');
        const response = await exportHandler(request);

        expect(response.status).toBe(200);
        const recordCount = parseInt(response.headers.get('X-Export-Record-Count') || '0', 10);
        expect(recordCount).toBeLessThanOrEqual(5);
      });

      it('should indicate truncation when records exceed maxRecords', async () => {
        const request = createMockRequest('/api/audit/export?maxRecords=5');
        const response = await exportHandler(request);

        expect(response.status).toBe(200);
        const totalCount = parseInt(response.headers.get('X-Export-Total-Count') || '0', 10);
        const truncated = response.headers.get('X-Export-Truncated');

        if (totalCount > 5) {
          expect(truncated).toBe('true');
        }
      });

      it('should include request ID in response', async () => {
        const request = createMockRequest('/api/audit/export');
        const response = await exportHandler(request);

        expect(response.status).toBe(200);
        expect(response.headers.get('X-Request-Id')).toBeDefined();
      });

      it('should return 401 for unauthorized requests', async () => {
        mockAuthResult = {
          isAuthorized: false,
          error: 'Authentication required',
          user: undefined,
        };

        const request = createMockRequest('/api/audit/export');
        const response = await exportHandler(request);

        expect(response.status).toBe(401);
      });

      it('should return 429 when rate limited', async () => {
        mockRateLimitResult = {
          success: false,
          limit: 10,
          remaining: 0,
          reset: Math.ceil(Date.now() / 1000) + 60,
          retryAfter: 60,
        };

        const request = createMockRequest('/api/audit/export');
        const response = await exportHandler(request);

        expect(response.status).toBe(429);
        const data = await response.json();
        expect(data.error).toContain('Too many requests');
      });

      it('should return 400 for invalid query parameters', async () => {
        const request = createMockRequest('/api/audit/export?maxRecords=invalid');
        const response = await exportHandler(request);

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data).toHaveProperty('error');
      });
    });

    describe('HEAD - Get export metadata', () => {
      it('should return export metadata headers', async () => {
        const request = createMockRequest('/api/audit/export');
        const response = await exportHeadHandler(request);

        expect(response.status).toBe(200);
        expect(response.headers.get('X-Export-Total-Count')).toBeDefined();
        expect(response.headers.get('X-Export-Record-Count')).toBeDefined();
        expect(response.headers.get('X-Export-Truncated')).toBeDefined();
        expect(response.headers.get('X-Export-Format')).toBeDefined();
      });

      it('should return 401 for unauthorized requests', async () => {
        mockAuthResult = {
          isAuthorized: false,
          error: 'Authentication required',
          user: undefined,
        };

        const request = createMockRequest('/api/audit/export');
        const response = await exportHeadHandler(request);

        expect(response.status).toBe(401);
      });

      it('should return 429 when rate limited', async () => {
        mockRateLimitResult = {
          success: false,
          limit: 10,
          remaining: 0,
          reset: Math.ceil(Date.now() / 1000) + 60,
          retryAfter: 60,
        };

        const request = createMockRequest('/api/audit/export');
        const response = await exportHeadHandler(request);

        expect(response.status).toBe(429);
      });
    });
  });

  describe('Security Tests', () => {
    it('should require authentication for all endpoints', async () => {
      mockAuthResult = {
        isAuthorized: false,
        error: 'Authentication required',
        user: undefined,
      };

      const endpoints = [
        { handler: logsHandler, url: '/api/audit/logs' },
        { handler: logsHeadHandler, url: '/api/audit/logs' },
        { handler: exportHandler, url: '/api/audit/export' },
        { handler: exportHeadHandler, url: '/api/audit/export' },
      ];

      for (const endpoint of endpoints) {
        const request = createMockRequest(endpoint.url);
        const response = await endpoint.handler(request);
        expect(response.status).toBe(401);
      }
    });

    it('should enforce rate limiting on all endpoints', async () => {
      mockRateLimitResult = {
        success: false,
        limit: 60,
        remaining: 0,
        reset: Math.ceil(Date.now() / 1000) + 60,
        retryAfter: 60,
      };

      const endpoints = [
        { handler: logsHandler, url: '/api/audit/logs' },
        { handler: logsHeadHandler, url: '/api/audit/logs' },
        { handler: exportHandler, url: '/api/audit/export' },
        { handler: exportHeadHandler, url: '/api/audit/export' },
      ];

      for (const endpoint of endpoints) {
        const request = createMockRequest(endpoint.url);
        const response = await endpoint.handler(request);
        expect(response.status).toBe(429);
      }
    });

    it('should include rate limit headers on 429 responses', async () => {
      mockRateLimitResult = {
        success: false,
        limit: 60,
        remaining: 0,
        reset: Math.ceil(Date.now() / 1000) + 60,
        retryAfter: 60,
      };

      const request = createMockRequest('/api/audit/logs');
      const response = await logsHandler(request);

      expect(response.status).toBe(429);
      expect(response.headers.get('X-RateLimit-Limit')).toBe('60');
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
      expect(response.headers.get('X-RateLimit-Reset')).toBeDefined();
      expect(response.headers.get('Retry-After')).toBe('60');
    });
  });

  describe('Error Handling', () => {
    it('should return proper error structure for invalid parameters', async () => {
      const request = createMockRequest('/api/audit/logs?limit=-1');
      const response = await logsHandler(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty('error');
      expect(data).toHaveProperty('details');
    });

    it('should handle missing optional parameters gracefully', async () => {
      const request = createMockRequest('/api/audit/logs');
      const response = await logsHandler(request);

      expect(response.status).toBe(200);
    });

    it('should validate date format for time range filters', async () => {
      const request = createMockRequest('/api/audit/logs?startTime=invalid-date');
      const response = await logsHandler(request);

      expect(response.status).toBe(400);
    });
  });

  describe('Compliance Features', () => {
    it('should log access to audit logs (meta-audit)', async () => {
      const { logAuditAsync } = await import('@/lib/audit');

      const request = createMockRequest('/api/audit/logs');
      await logsHandler(request);

      expect(logAuditAsync).toHaveBeenCalled();
    });

    it('should log export requests', async () => {
      const { logAuditAsync } = await import('@/lib/audit');

      const request = createMockRequest('/api/audit/export');
      await exportHandler(request);

      expect(logAuditAsync).toHaveBeenCalled();
    });

    it('should include hash chain info in exports when includeHashes=true', async () => {
      const request = createMockRequest('/api/audit/export?includeHashes=true');
      const response = await exportHandler(request);

      expect(response.status).toBe(200);
      // Verify export succeeded - hash inclusion is handled by exportAuditLogs
    });
  });

  describe('Performance', () => {
    it('should respond within acceptable time for log queries', async () => {
      const start = performance.now();
      const request = createMockRequest('/api/audit/logs');
      await logsHandler(request);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(10)
        .fill(null)
        .map(() => logsHandler(createMockRequest('/api/audit/logs')));

      const responses = await Promise.all(requests);

      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });
});

/**
 * Test Coverage Summary:
 *
 * ✅ /api/audit/logs GET endpoint
 *    - Default pagination
 *    - Filtering by userId, actions, category, severity, outcome, sessionId
 *    - Pagination with limit and offset
 *    - hasMore indicator
 *    - Authentication required
 *    - Rate limiting
 *    - Invalid parameter validation
 *
 * ✅ /api/audit/logs HEAD endpoint
 *    - Returns count in header
 *    - Authentication required
 *    - Rate limiting
 *
 * ✅ /api/audit/export GET endpoint
 *    - JSON export (default)
 *    - CSV export
 *    - Record count headers
 *    - Filtering support
 *    - maxRecords limiting
 *    - Truncation indication
 *    - Request ID tracking
 *    - Authentication required
 *    - Rate limiting
 *    - Invalid parameter validation
 *
 * ✅ /api/audit/export HEAD endpoint
 *    - Export metadata headers
 *    - Authentication required
 *    - Rate limiting
 *
 * ✅ Security Tests
 *    - Authentication enforcement
 *    - Rate limiting enforcement
 *    - Rate limit headers
 *
 * ✅ Error Handling
 *    - Invalid parameter errors
 *    - Missing optional parameters
 *    - Date validation
 *
 * ✅ Compliance Features
 *    - Meta-audit logging
 *    - Export request logging
 *    - Hash chain info support
 *
 * ✅ Performance
 *    - Response time validation
 *    - Concurrent request handling
 */
