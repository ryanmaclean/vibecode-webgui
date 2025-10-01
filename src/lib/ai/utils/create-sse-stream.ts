const waitFor = (ms: number) =>
  ms > 0
    ? new Promise<void>(resolve => {
        setTimeout(resolve, ms)
      })
    : Promise.resolve()

export interface CreateSSEStreamResult {
  stream: ReadableStream<Uint8Array>
  completionPromise: Promise<void>
}

/**
 * Builds a ReadableStream that emits the provided SSE chunks in order.
 * Useful for stubbing streaming responses without wiring up a live upstream.
 */
export const createSSEStream = (chunks: string[], delayMs = 0): CreateSSEStreamResult => {
  const encoder = new TextEncoder()

  let resolveCompletion: (() => void) | undefined
  let rejectCompletion: ((error: Error) => void) | undefined

  const completionPromise = new Promise<void>((resolve, reject) => {
    resolveCompletion = resolve
    rejectCompletion = reject
  })

  const resolveOnce = () => {
    resolveCompletion?.()
    resolveCompletion = undefined
    rejectCompletion = undefined
  }

  const rejectOnce = (error: Error) => {
    rejectCompletion?.(error)
    resolveCompletion = undefined
    rejectCompletion = undefined
  }

  const emitChunks = async (controller: ReadableStreamDefaultController<Uint8Array>) => {
    try {
      for (let index = 0; index < chunks.length; index += 1) {
        const chunk = chunks[index]
        controller.enqueue(encoder.encode(chunk))

        const hasMoreChunks = index < chunks.length - 1
        if (hasMoreChunks) {
          await waitFor(delayMs)
        }
      }

      controller.close()
      resolveOnce()
    } catch (unknownError) {
      const error = unknownError instanceof Error ? unknownError : new Error(String(unknownError))
      controller.error(error)
      rejectOnce(error)
    }
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      void emitChunks(controller)
    },
    cancel(reason) {
      const error = reason instanceof Error ? reason : new Error(String(reason ?? 'Stream cancelled'))
      rejectOnce(error)
    }
  })

  return {
    stream,
    completionPromise
  }
}
