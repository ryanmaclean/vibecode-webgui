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

<<<<<<< Updated upstream
  if (candidate.cause) {
    return isMissingDdTrace(candidate.cause);
=======
  const message = 'message' in error ? String((error as { message: unknown }).message) : ''
  return message.includes(`Cannot find module '${moduleName}'`) || message.includes(`Cannot find module "${moduleName}"`)
}

type RequireWithResolve = NodeJS.Require & { resolve: NodeJS.RequireResolve }

const getNativeRequire = (): RequireWithResolve | null => {
  const globalWithRequire = globalThis as typeof globalThis & { __non_webpack_require__?: RequireWithResolve }

  if (typeof globalWithRequire.__non_webpack_require__ === 'function') {
    return globalWithRequire.__non_webpack_require__
  }

  try {
    return eval('require') as RequireWithResolve
  } catch {
    return null
  }
}

const ensureModuleAvailable = (moduleName: string): boolean => {
  const nativeRequire = getNativeRequire()

  if (!nativeRequire) {
    console.warn(`⚠️ ${moduleName} availability could not be determined; skipping Datadog instrumentation`)
    return false
  }

  const moduleApi = nativeRequire('module') as typeof import('module')
  const resolveRequire = moduleApi.createRequire(import.meta.url)

  try {
    resolveRequire.resolve(moduleName)
    return true
  } catch (error) {
    if (isModuleNotFoundError(error, moduleName)) {
      console.warn(`⚠️ ${moduleName} not installed; skipping Datadog instrumentation`)
      return false
    }

    throw error
  }
}

async function initializeDatadogTracer() {
  if (!isNodeRuntime()) {
    return
>>>>>>> Stashed changes
  }

  if (typeof AggregateError !== 'undefined' && error instanceof AggregateError) {
    return error.errors.some(isMissingDdTrace);
  }

<<<<<<< Updated upstream
  return false;
=======
  try {
    if (!ensureModuleAvailable('dd-trace')) {
      return
    }

    const tracerModule = await import('dd-trace')
    const tracer = tracerModule.default

    tracer.init({
      service: 'vibecode-webgui',
      env: process.env.DD_ENV || process.env.NODE_ENV || 'development',
      version: process.env.DD_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
      runtimeMetrics: true,
      profiling: process.env.NODE_ENV === 'production',
      logInjection: true,
      tags: {
        'git.commit.sha': process.env.DD_GIT_COMMIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA,
        'git.repository_url': 'https://github.com/ryanmaclean/vibecode-webgui',
      },
    })

    console.log('✅ Datadog tracer initialized in instrumentation.ts')
  } catch (error) {
    console.error('❌ Datadog tracer initialization failed', error)
  }
>>>>>>> Stashed changes
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
