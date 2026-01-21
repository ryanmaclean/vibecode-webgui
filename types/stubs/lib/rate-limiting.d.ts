import type { NextRequest } from 'next/server';

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

export function createAPIRateLimit(requestsPerMinute?: number): (req: NextRequest) => Promise<RateLimitResult>;
export function createAuthRateLimit(): (req: NextRequest) => Promise<RateLimitResult>;
export function createFileRateLimit(): (req: NextRequest) => Promise<RateLimitResult>;
export function createClaudeRateLimit(): (req: NextRequest) => Promise<RateLimitResult>;
