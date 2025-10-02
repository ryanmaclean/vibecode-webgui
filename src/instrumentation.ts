// Next.js instrumentation entry point for server-side startup.
// Ensures Datadog tracing (dd-trace) initializes before any other server code.
//
// Next.js will call this register() during the server boot for the app router.
// Our src/instrument.ts performs the actual dd-trace initialization and tagging.

function isModuleNotFoundError(error: unknown, moduleName: string): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: unknown; message?: unknown; cause?: unknown };
  const errorCode = typeof candidate.code === 'string' ? candidate.code : undefined;
  const message = typeof candidate.message === 'string' ? candidate.message : undefined;

  const referencesModule = message?.includes(moduleName) ?? false;
  const missingByCode =
    (errorCode === 'MODULE_NOT_FOUND' || errorCode === 'ERR_MODULE_NOT_FOUND') && referencesModule;

  if (missingByCode) {
    return true;
  }

  if (candidate.cause) {
    return isModuleNotFoundError(candidate.cause, moduleName);
  }

  if (typeof AggregateError !== 'undefined' && error instanceof AggregateError) {
    return error.errors.some((nested) => isModuleNotFoundError(nested, moduleName));
  }

  return false;
}

let hasWarnedMissingDdTrace = false;

function warnMissingDdTrace() {
  if (hasWarnedMissingDdTrace) {
    return;
  }

  hasWarnedMissingDdTrace = true;
  console.warn(
    '⚠️ Datadog tracing skipped: install dd-trace with `npm install dd-trace` to enable instrumentation'
  );
}

let initializationPromise: Promise<void> | null = null;

export async function register() {
  // Ensure instrumentation only runs in the Node.js runtime to avoid bundling native modules
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') {
    return;
  }

  if (!initializationPromise) {
    console.log('📋 Instrumentation register() called - monitoring will init in middleware');

    initializationPromise = (async () => {
      try {
        await import('dd-trace');
      } catch (error) {
        if (isModuleNotFoundError(error, 'dd-trace')) {
          warnMissingDdTrace();
          return;
        }

        throw error;
      }

      try {
        await import('./instrument');
      } catch (error) {
        if (isModuleNotFoundError(error, 'dd-trace')) {
          warnMissingDdTrace();
          return;
        }

        throw error;
      }
    })();
  }

  await initializationPromise;
}
