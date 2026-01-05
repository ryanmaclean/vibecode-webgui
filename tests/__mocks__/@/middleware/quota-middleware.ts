/**
 * Mock for quota-middleware module
 * Used in tests to bypass quota checks
 */

import type { NextRequest, NextResponse } from 'next/server';

export interface QuotaCheckResult {
  allowed: boolean;
  reason?: string;
  remainingQuota?: number;
  resetTime?: number;
}

/**
 * Mock quota check - always allows in test environment
 */
export async function withQuotaCheck(
  request: NextRequest,
  action: 'create_workspace' | 'upload_file' | 'api_call' | 'create_session',
  options: { fileSize?: number } = {}
): Promise<QuotaCheckResult> {
  // Always allow in test environment
  return { allowed: true, remainingQuota: 1000, resetTime: Date.now() + 3600000 };
}

/**
 * Mock quota response helper
 */
export function createQuotaResponse(result: QuotaCheckResult): NextResponse {
  return new Response(
    JSON.stringify({
      error: 'Quota exceeded',
      message: result.reason,
      remaining: result.remainingQuota,
      resetTime: result.resetTime,
      code: 'QUOTA_EXCEEDED'
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': result.remainingQuota?.toString() || '0',
        'X-RateLimit-Reset': result.resetTime?.toString() || '0',
        'Retry-After': '3600'
      }
    }
  ) as NextResponse;
}
