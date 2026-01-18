import { useEffect, useState, useRef } from 'react'

/**
 * Hook for counting tokens using Web Worker (non-blocking)
 *
 * Performance Benefits:
 * - Offloads expensive tiktoken operations to Web Worker
 * - Maintains 60fps UI responsiveness during counting
 * - Handles large texts (10K+ characters) without blocking
 *
 * @param text - Text to count tokens for
 * @param model - Model to use for encoding (gpt-4, gpt-3.5-turbo, etc.)
 * @returns Token count and loading state
 *
 * @example
 * const { tokenCount, isLoading } = useTokenCounter(messageText, 'gpt-4')
 * return <span>{tokenCount} tokens</span>
 */
export function useTokenCounter(text: string, model: string = 'gpt-4') {
  const [tokenCount, setTokenCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    // Don't count empty text
    if (!text || text.trim().length === 0) {
      setTokenCount(0)
      return
    }

    setIsLoading(true)
    setError(null)

    // Create worker if not exists
    if (!workerRef.current) {
      try {
        workerRef.current = new Worker(
          new URL('../workers/tokenCounter.worker.ts', import.meta.url)
        )
      } catch (err) {
        setError('Failed to initialize token counter')
        setIsLoading(false)
        return
      }
    }

    const worker = workerRef.current

    // Set up message handler
    const handleMessage = (e: MessageEvent) => {
      const { tokenCount, error } = e.data

      if (error) {
        setError(error)
      } else {
        setTokenCount(tokenCount)
      }

      setIsLoading(false)
    }

    worker.addEventListener('message', handleMessage)

    // Send count request
    worker.postMessage({ text, model })

    // Cleanup
    return () => {
      worker.removeEventListener('message', handleMessage)
    }
  }, [text, model])

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [])

  return { tokenCount, isLoading, error }
}

/**
 * Hook for batch token counting (multiple texts)
 *
 * Performance Benefits:
 * - Processes multiple texts in parallel
 * - Single worker instance for all texts
 * - Optimized for message lists
 *
 * @param texts - Array of texts to count
 * @param model - Model to use for encoding
 * @returns Map of text to token count
 *
 * @example
 * const texts = messages.map(m => m.content)
 * const tokenCounts = useBatchTokenCounter(texts, 'gpt-4')
 * const totalTokens = Array.from(tokenCounts.values()).reduce((a, b) => a + b, 0)
 */
export function useBatchTokenCounter(
  texts: string[],
  model: string = 'gpt-4'
): Map<string, number> {
  const [tokenCounts, setTokenCounts] = useState<Map<string, number>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const pendingRequests = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (texts.length === 0) {
      setTokenCounts(new Map())
      return
    }

    setIsLoading(true)

    // Create worker if not exists
    if (!workerRef.current) {
      try {
        workerRef.current = new Worker(
          new URL('../workers/tokenCounter.worker.ts', import.meta.url)
        )
      } catch (err) {
        setIsLoading(false)
        return
      }
    }

    const worker = workerRef.current
    const newCounts = new Map<string, number>()

    // Set up message handler
    const handleMessage = (e: MessageEvent) => {
      const { tokenCount, id } = e.data

      if (id) {
        newCounts.set(id, tokenCount)
        pendingRequests.current.delete(id)

        // Update state when all requests complete
        if (pendingRequests.current.size === 0) {
          setTokenCounts(newCounts)
          setIsLoading(false)
        }
      }
    }

    worker.addEventListener('message', handleMessage)

    // Send all requests
    texts.forEach((text, index) => {
      const id = `${index}-${text.substring(0, 50)}` // Use text prefix as ID
      pendingRequests.current.add(id)
      worker.postMessage({ text, model, id })
    })

    // Cleanup
    return () => {
      worker.removeEventListener('message', handleMessage)
      pendingRequests.current.clear()
    }
  }, [texts, model])

  // Cleanup worker on unmount
  useEffect(() => {
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [])

  return tokenCounts
}
