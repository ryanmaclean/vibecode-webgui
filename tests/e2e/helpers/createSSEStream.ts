import { PassThrough } from 'stream'

const waitFor = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const waitForDrain = (stream: PassThrough) =>
  new Promise<void>((resolve, reject) => {
    function cleanup() {
      stream.off('drain', handleDrain)
      stream.off('error', handleError)
    }

    function handleDrain() {
      cleanup()
      resolve()
    }

    function handleError(error: Error) {
      cleanup()
      reject(error)
    }

    stream.once('drain', handleDrain)
    stream.once('error', handleError)
  })

// Simple helper to build a PassThrough stream that emits SSE-style chunks with an optional delay.
export const createSSEStream = (chunks: string[], delayMs = 0) => {
  const stream = new PassThrough()
  const normalizedDelay = Math.max(0, delayMs ?? 0)

  const completionPromise = (async () => {
    try {
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index]
        const canContinue = stream.write(chunk)

        if (!canContinue) {
          await waitForDrain(stream)
        }

        const hasMoreChunks = index < chunks.length - 1
        if (normalizedDelay > 0 && hasMoreChunks) {
          await waitFor(normalizedDelay)
        }
      }

      stream.end()
    } catch (unknownError) {
      const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError))
      stream.destroy(error)
      throw error
    }
  })()

  return {
    stream,
    completionPromise,
  }
}

export type CreateSSEStreamResult = ReturnType<typeof createSSEStream>
