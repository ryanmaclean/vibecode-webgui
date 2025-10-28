/**
 * Next.js 15 instrumentation entry point. Runs before any server code executes.
 * Initializes Datadog tracing exactly once when running in the Node.js runtime.
 */

type NodeCreateRequire = (typeof import('module'))['createRequire']
let requireModule: ReturnType<NodeCreateRequire> | null = null
let initializationPromise: Promise<void> | null = null

const isNodeRuntime = () => !process.env.NEXT_RUNTIME || process.env.NEXT_RUNTIME === 'nodejs'
const isDatadogDisabled = () => process.env.DD_ENABLED === 'false'
const isPlaywrightRun = () => process.env.PLAYWRIGHT_TEST === 'true'

const isModuleNotFoundError = (error: unknown, moduleName: string): boolean => {
  if (!error || typeof error !== 'object') {
    return false
  }

  if ('code' in error && (error as { code: unknown }).code === 'MODULE_NOT_FOUND') {
    return true
  }

  const message = 'message' in error ? String((error as { message: unknown }).message) : ''
  return message.includes(`Cannot find module '${moduleName}'`) || message.includes(`Cannot find module "${moduleName}"`)
}

async function initializeDatadogTracer() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[src/instrumentation] runtime=%s playwright=%s env=%s', process.env.NEXT_RUNTIME, process.env.PLAYWRIGHT_TEST, process.env.NODE_ENV)
  }

  if (!isNodeRuntime()) {
    return
  }

  if (isPlaywrightRun()) {
    console.log('🧪 Skipping Datadog instrumentation during Playwright runs')
    return
  }

  if (isDatadogDisabled()) {
    console.log('🛑 Datadog tracing disabled via DD_ENABLED=false')
    return
  }

  if (!requireModule) {
    try {
      const { createRequire } = await import(/* webpackIgnore: true */ 'node:module')
      requireModule = createRequire(import.meta.url)
    } catch (error) {
      console.error('❌ Datadog tracer initialization failed', error)
      return
    }
  }

  try {
    requireModule!.resolve('dd-trace')
  } catch (error) {
    if (isModuleNotFoundError(error, 'dd-trace')) {
      console.warn('⚠️ dd-trace not installed; skipping Datadog instrumentation')
      return
    }

    console.error('❌ Datadog tracer initialization failed', error)
    return
  }

  try {
    const tracerModule = await import(/* webpackIgnore: true */ 'dd-trace')
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
}

export async function register() {
  if (!initializationPromise) {
    initializationPromise = initializeDatadogTracer()
  }

  try {
    await initializationPromise
  } finally {
    initializationPromise = null
  }
}
