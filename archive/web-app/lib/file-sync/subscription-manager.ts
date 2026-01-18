import type { WebSocket } from 'ws'

const DEFAULT_MAX_SUBSCRIPTIONS = 50

type SocketKey = object

export type SubscribeOutcome =
  | { ok: true; path: string }
  | { ok: false; reason: string }

function subscriptionKey(workspaceId: string, path: string): string {
  return `${workspaceId}::${path}`
}

export class SubscriptionManager<T extends SocketKey> {
  private workspaceMap = new Map<string, Map<string, Set<T>>>()
  private socketMap = new Map<T, Set<string>>()

  constructor(private readonly maxSubscriptionsPerSocket = DEFAULT_MAX_SUBSCRIPTIONS) {}

  subscribe(workspaceId: string, rawPath: string, socket: T): SubscribeOutcome {
    const path = rawPath.trim()
    if (!path) {
      return { ok: false, reason: 'File path required for subscription' }
    }

    if (!this.workspaceMap.has(workspaceId)) {
      this.workspaceMap.set(workspaceId, new Map())
    }

    const fileMap = this.workspaceMap.get(workspaceId)!
    if (!fileMap.has(path)) {
      fileMap.set(path, new Set())
    }

    if (!this.socketMap.has(socket)) {
      this.socketMap.set(socket, new Set())
    }

    const socketSubscriptions = this.socketMap.get(socket)!
    const key = subscriptionKey(workspaceId, path)

    if (socketSubscriptions.size >= this.maxSubscriptionsPerSocket && !socketSubscriptions.has(key)) {
      return {
        ok: false,
        reason: `Subscription limit of ${this.maxSubscriptionsPerSocket} reached`,
      }
    }

    socketSubscriptions.add(key)
    fileMap.get(path)!.add(socket)
    return { ok: true, path }
  }

  removeForWorkspace(workspaceId: string, socket: T): number {
    let removed = 0
    const fileMap = this.workspaceMap.get(workspaceId)
    if (!fileMap) {
      return removed
    }

    const socketSubscriptions = this.socketMap.get(socket)

    for (const [path, sockets] of fileMap.entries()) {
      if (sockets.delete(socket)) {
        removed += 1
      }
      if (sockets.size === 0) {
        fileMap.delete(path)
      }
      socketSubscriptions?.delete(subscriptionKey(workspaceId, path))
    }

    if (fileMap.size === 0) {
      this.workspaceMap.delete(workspaceId)
    }

    if (socketSubscriptions && socketSubscriptions.size === 0) {
      this.socketMap.delete(socket)
    }

    return removed
  }

  removeSocket(socket: T): number {
    let removed = 0
    const socketSubscriptions = this.socketMap.get(socket)
    if (!socketSubscriptions) {
      return removed
    }

    for (const key of socketSubscriptions) {
      const [workspaceId, path] = key.split('::')
      const fileMap = this.workspaceMap.get(workspaceId)
      const sockets = fileMap?.get(path)
      if (sockets) {
        if (sockets.delete(socket)) {
          removed += 1
        }
        if (sockets.size === 0) {
          fileMap!.delete(path)
        }
      }
      if (fileMap && fileMap.size === 0) {
        this.workspaceMap.delete(workspaceId)
      }
    }

    this.socketMap.delete(socket)
    return removed
  }

  getSubscribers(workspaceId: string, path: string | undefined): Set<T> {
    if (!path) {
      return new Set()
    }

    const fileMap = this.workspaceMap.get(workspaceId)
    return fileMap?.get(path) ?? new Set()
  }

  clear(): void {
    this.workspaceMap.clear()
    this.socketMap.clear()
  }
}

export const subscriptionManager = new SubscriptionManager<WebSocket>()
