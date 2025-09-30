// Next.js instrumentation entry point for server-side startup.
// Ensures Datadog tracing (dd-trace) initializes before any other server code.
//
// Next.js will call this register() during the server boot for the app router.
// Our src/instrument.ts performs the actual dd-trace initialization and tagging.

export async function register() {
  if (process.env.NODE_ENV === 'production' || process.env.DD_FORCE_INSTRUMENT === 'true') {
    await import('./instrument')
  }
}
