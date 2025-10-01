export type StreamContentChunk = {
  type: 'content'
  content: string
}

export type StreamMetadataChunk = {
  type: 'metadata'
  metadata: Record<string, unknown>
}

export type StreamChunk = StreamContentChunk | StreamMetadataChunk

export interface SSEDecoderHandlers {
  onContentChunk: (chunk: StreamContentChunk) => void
  onMetadataChunk: (chunk: StreamMetadataChunk) => void
  onMalformedChunk?: (error: unknown, rawPayload: string) => void
}

export interface SSEDecoderState {
  bufferedText: string
  pendingDataLines: string[]
}

export interface SSEDecoder {
  push: (textChunk: string) => void
  finish: () => void
  reset: () => void
  getState: () => SSEDecoderState
}

export const isContentChunk = (value: unknown): value is StreamContentChunk => {
  if (typeof value !== 'object' || value === null) return false
  const chunk = value as Record<string, unknown>
  return chunk.type === 'content' && typeof chunk.content === 'string'
}

export const isMetadataChunk = (value: unknown): value is StreamMetadataChunk => {
  if (typeof value !== 'object' || value === null) return false
  const chunk = value as Record<string, unknown>
  return chunk.type === 'metadata' && typeof chunk.metadata === 'object' && chunk.metadata !== null
}

export const createSSEDecoder = (handlers: SSEDecoderHandlers): SSEDecoder => {
  const state: SSEDecoderState = {
    bufferedText: '',
    pendingDataLines: []
  }

  const flushPendingData = () => {
    if (state.pendingDataLines.length === 0) return

    const dataPayload = state.pendingDataLines.join('\n')
    state.pendingDataLines = []

    if (!dataPayload) return

    try {
      const parsed = JSON.parse(dataPayload)

      if (isContentChunk(parsed)) {
        handlers.onContentChunk(parsed)
        return
      }

      if (isMetadataChunk(parsed)) {
        handlers.onMetadataChunk(parsed)
        return
      }

      handlers.onMalformedChunk?.(new Error('Unsupported stream chunk type'), dataPayload)
    } catch (error) {
      handlers.onMalformedChunk?.(error, dataPayload)
    }
  }

  const processLine = (line: string) => {
    if (line.trim() === '') {
      flushPendingData()
      return
    }

    if (!line.startsWith('data:')) {
      return
    }

    const dataValue = line.startsWith('data: ')
      ? line.slice(6)
      : line.slice(5)

    state.pendingDataLines.push(dataValue)
  }

  const drainBuffer = () => {
    let newlineIndex = state.bufferedText.indexOf('\n')

    while (newlineIndex !== -1) {
      const rawLine = state.bufferedText.slice(0, newlineIndex)
      state.bufferedText = state.bufferedText.slice(newlineIndex + 1)
      const line = rawLine.replace(/\r$/, '')
      processLine(line)
      newlineIndex = state.bufferedText.indexOf('\n')
    }
  }

  const push = (textChunk: string) => {
    if (!textChunk) return
    state.bufferedText += textChunk
    drainBuffer()
  }

  const finish = () => {
    if (state.bufferedText.length > 0) {
      state.bufferedText += '\n'
      drainBuffer()
    } else {
      flushPendingData()
    }
  }

  const reset = () => {
    state.bufferedText = ''
    state.pendingDataLines = []
  }

  const getState = () => ({
    bufferedText: state.bufferedText,
    pendingDataLines: [...state.pendingDataLines]
  })

  return {
    push,
    finish,
    reset,
    getState
  }
}
