// Next.js instrumentation entry point for server-side startup.
// Ensures Datadog tracing (dd-trace) initializes before any other server code.
//
// Next.js will call this register() during the server boot for the app router.
// Our src/instrument.ts performs the actual dd-trace initialization and tagging.

export async function register() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[instrumentation] runtime=%s playwright=%s', process.env.NEXT_RUNTIME, process.env.PLAYWRIGHT_TEST);
  }
  // Skip Datadog wiring entirely for Playwright smoke runs so webpack doesn't pull native deps.
  if (process.env.PLAYWRIGHT_TEST === 'true') {
    return;
  }

  // Instrumentation executes for both runtimes; skip edge to avoid bundling dd-trace.
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  // Initialize tracing and monitoring (dd-trace init occurs inside this module).
  await import('./src/instrument');
}
