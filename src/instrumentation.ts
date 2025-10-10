// Next.js instrumentation entry point for server-side startup.
// Ensures Datadog tracing (dd-trace) initializes before any other server code.
//
// Next.js will call this register() during the server boot for the app router.
// Our src/instrument.ts performs the actual dd-trace initialization and tagging.

function isMissingDdTrace(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown; cause?: unknown };
  const errorCode = typeof candidate.code === 'string' ? candidate.code : undefined;
  const message = typeof candidate.message === 'string' ? candidate.message : undefined;

  const matchedModule = message?.includes('dd-trace') ?? false;
  const isModuleMissing =
    (errorCode === 'MODULE_NOT_FOUND' || errorCode === 'ERR_MODULE_NOT_FOUND') && matchedModule;

  if (isModuleMissing) {
    return true;
  }

  if (candidate.cause) {
    return isMissingDdTrace(candidate.cause);
  }

  if (typeof AggregateError !== 'undefined' && error instanceof AggregateError) {
    return error.errors.some(isMissingDdTrace);
  }

  return false;
}

export async function register() {
  // CRITICAL: This function must avoid bundling dd-trace during static analysis
  // Next.js analyzes this file during builds for BOTH server and browser bundles
  // Keep the dynamic import inside register so it only runs in Node.js runtime

  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  console.log('📋 Instrumentation register() called - monitoring will init in middleware');

  try {
    await import('./instrument');
  } catch (error) {
    if (isMissingDdTrace(error)) {
      console.warn('⚠️ Datadog tracing skipped: dd-trace not installed');
      return;
    }

    throw error;
  }
}
