/**
 * Web Worker for token counting
 * Offloads expensive tiktoken operations from main thread
 *
 * Performance Benefits:
 * - Prevents main thread blocking during token counting
 * - Maintains UI responsiveness for large texts
 * - Enables parallel token counting for multiple messages
 *
 * Usage:
 * const worker = new Worker(new URL('./tokenCounter.worker.ts', import.meta.url))
 * worker.postMessage({ text: 'Your text here', model: 'gpt-4' })
 * worker.onmessage = (e) => console.log('Token count:', e.data.tokenCount)
 */

import { encoding_for_model, Tiktoken } from 'tiktoken'

interface TokenCountRequest {
  text: string
  model: string
  id?: string // Optional ID for matching requests to responses
}

interface TokenCountResponse {
  tokenCount: number
  id?: string
  error?: string
}

let cachedEncoding: Tiktoken | null = null
let cachedModel: string | null = null

self.onmessage = (e: MessageEvent<TokenCountRequest>) => {
  const { text, model, id } = e.data

  try {
    // Reuse encoding if same model
    if (cachedModel !== model || !cachedEncoding) {
      if (cachedEncoding) {
        cachedEncoding.free()
      }

      cachedEncoding = encoding_for_model(model as any)
      cachedModel = model
    }

    const tokens = cachedEncoding.encode(text)
    const tokenCount = tokens.length

    const response: TokenCountResponse = {
      tokenCount,
      ...(id && { id })
    }

    self.postMessage(response)
  } catch (error) {
    const response: TokenCountResponse = {
      tokenCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      ...(id && { id })
    }

    self.postMessage(response)
  }
}

// Cleanup on worker termination
self.addEventListener('unload', () => {
  if (cachedEncoding) {
    cachedEncoding.free()
  }
})
