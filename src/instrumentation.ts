/**
 * Next.js instrumentation entry point. Ensures dd-trace initialization runs before any
 * server components execute, delegating to the shared instrumentation module.
 */

let initializationPromise: Promise<void> | null = null

const isNodeRuntime = () => !process.env.NEXT_RUNTIME || process.env.NEXT_RUNTIME === 'nodejs'
const isDatadogDisabled = () => process.env.DD_ENABLED === 'false'

async function initializeDatadogTracer() {
  if (!isNodeRuntime()) {
    return
  }

  if (isDatadogDisabled()) {
    console.log('🛑 Datadog tracing disabled via DD_ENABLED=false')
    return
  }

  try {
    await import('./instrument')
  } catch (error) {
    console.error('❌ Failed to load shared instrumentation module', error)
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
