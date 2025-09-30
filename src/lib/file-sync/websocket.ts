/**
 * Shared WebSocket message contracts for the file sync service.
 * Provides a narrow parser to protect the server from malformed payloads.
 */

export type FileUpdatePayload = {
  path: string
  content?: string
  version?: number
  checksum?: string
  metadata?: Record<string, unknown>
}

export type FileUpdateMessage = {
  type: 'file-update'
  payload: FileUpdatePayload
}

export type PingMessage = {
  type: 'ping'
}

export type SubscribeFileMessage = {
  type: 'subscribe-file'
  payload: {
    path: string
  }
}

export type FileSyncWebSocketMessage = FileUpdateMessage | PingMessage | SubscribeFileMessage

export function parseFileSyncMessage(raw: string): FileSyncWebSocketMessage | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }

  if (!isRecord(parsed) || typeof parsed.type !== 'string') {
    return undefined
  }

  switch (parsed.type) {
    case 'file-update':
      if (isRecord(parsed.payload) && typeof parsed.payload.path === 'string') {
        const payload: FileUpdatePayload = {
          path: parsed.payload.path,
          content: typeof parsed.payload.content === 'string' ? parsed.payload.content : undefined,
          version: typeof parsed.payload.version === 'number' ? parsed.payload.version : undefined,
          checksum: typeof parsed.payload.checksum === 'string' ? parsed.payload.checksum : undefined,
          metadata: isRecord(parsed.payload.metadata) ? parsed.payload.metadata : undefined,
        }
        return { type: 'file-update', payload }
      }
      return undefined
    case 'ping':
      return { type: 'ping' }
    case 'subscribe-file':
      if (isRecord(parsed.payload) && typeof parsed.payload.path === 'string') {
        return { type: 'subscribe-file', payload: { path: parsed.payload.path } }
      }
      return undefined
    default:
      return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
