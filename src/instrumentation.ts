// Next.js instrumentation entry point for server-side startup.
// Ensures Datadog tracing (dd-trace) initializes before any other server code.
//
// Next.js will call this register() during the server boot for the app router.
// Our src/instrument.ts performs the actual dd-trace initialization and tagging.

export function register() {
  // CRITICAL: This function must be synchronous and never import dd-trace at build time
  // Next.js analyzes this file during builds for BOTH server and browser bundles
  // Dynamic import of dd-trace would cause webpack to bundle all Datadog native modules

  // Therefore, we do NO work here - all monitoring initialization happens in middleware
  // See src/middleware.ts for actual dd-trace initialization

  console.log('📋 Instrumentation register() called - monitoring will init in middleware')
}
