/**
 * Rate Limiter Module
 *
 * Provides production-ready rate limiting for API endpoints using
 * sliding window algorithm for accurate, smooth rate limiting.
 *
 * @example
 * ```typescript
 * import {
 *   withRateLimiting,
 *   RateLimitPresets,
 *   checkRateLimit,
 *   applyRateLimitHeaders,
 * } from '@/lib/rate-limiter'
 *
 * // Using the wrapper
 * export const POST = withRateLimiting(
 *   RateLimitPresets.AUTH_STRICT,
 *   'auth-login'
 * )(async (req) => {
 *   return NextResponse.json({ success: true })
 * })
 *
 * // Using middleware-style
 * export async function POST(req: NextRequest) {
 *   const result = await checkRateLimit(req, RateLimitPresets.AUTH_STRICT, 'login')
 *   if (!result.allowed) {
 *     return createRateLimitedResponse(result, RateLimitPresets.AUTH_STRICT)
 *   }
 *   // ... handler logic
 * }
 * ```
 */

export {
  // Main class
  SlidingWindowRateLimiter,
  // Factory function
  createRateLimiter,
  // Higher-order function wrapper
  withRateLimiting,
  // Middleware-style helpers
  checkRateLimit,
  createRateLimitedResponse,
  applyRateLimitHeaders,
  // Preset configurations
  RateLimitPresets,
  // Types
  type SlidingWindowConfig,
  type RateLimitResult,
  // Utilities (for testing)
  getClientIP,
} from './sliding-window'
