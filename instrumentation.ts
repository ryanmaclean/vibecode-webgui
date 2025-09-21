// Next.js instrumentation entry point for server-side startup.
// Ensures Datadog tracing (dd-trace) initializes before any other server code.
//
// Next.js will call this register() during the server boot for the app router.
// Our src/instrument.ts performs the actual dd-trace initialization and tagging.

export async function register() {
  // Initialize tracing and monitoring (dd-trace init occurs inside this module).
  await import('./src/instrument');
}
