/**
 * Code Completion Rate Limiter
 * 
 * Specialized rate limiting for code completion API endpoint.
 * Implements aggressive limits to prevent abuse while allowing normal usage.
 */

import { NextRequest } from 'next/server';
import { createAPIRateLimit } from './rate-limiting';
import { ApiError, ApiErrorCode } from './api-error-handler';

// Create rate limiter for code completion (10 requests per minute)
const codeCompletionRateLimit = createAPIRateLimit(10);

/**
 * Apply rate limiting to code completion request
 */
export async function applyCodeCompletionRateLimit(req: NextRequest): Promise<void> {
  const rateLimitResult = await codeCompletionRateLimit(req);
  
  if (!rateLimitResult.success) {
    throw new ApiError(
      ApiErrorCode.RATE_LIMIT_EXCEEDED,
      'Code completion rate limit exceeded',
      429,
      {
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
        reset: rateLimitResult.reset,
      },
      rateLimitResult.retryAfter
    );
  }
}

/**
 * Get client identifier for logging
 */
export function getClientInfo(req: NextRequest): { ip: string; userAgent: string } {
  // Check for forwarded IP (behind proxy/load balancer)
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('true-client-ip') ||
    'unknown';
  
  const userAgent = req.headers.get('user-agent') || 'unknown';
  
  return { ip, userAgent };
}