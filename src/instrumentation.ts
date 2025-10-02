/**
 * Next.js instrumentation entry point for server-side startup
 * 
 * DATADOG BEST PRACTICE: Initialize tracer ONCE at application entry point
 * This is the correct location per Datadog 2024-2025 recommendations
 * 
 * Fixes #464: Consolidates multiple tracer.init() calls into single location
 */

export async function register() {
  // Only run on Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dynamic import to avoid bundling dd-trace in client/edge bundles
    const tracer = await import('dd-trace')
    
    // Initialize tracer with unified service tagging
    tracer.default.init({
      service: 'vibecode-webgui',
      env: process.env.DD_ENV || process.env.NODE_ENV || 'development',
      version: process.env.DD_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
      runtimeMetrics: true,
      profiling: process.env.NODE_ENV === 'production',
      logInjection: true,
      tags: {
        'git.commit.sha': process.env.DD_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA,
        'git.repository_url': 'https://github.com/ryanmaclean/vibecode-webgui',
      }
    })
    
    console.log('✅ Datadog tracer initialized in instrumentation.ts')
  }
}
