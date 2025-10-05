import { SubscriptionManager } from '@/lib/file-sync/subscription-manager'

describe('SubscriptionManager', () => {
  const workspaceId = 'workspace-1'

  const createSocket = () => ({ id: Symbol('socket') })

  it('trims paths and subscribes successfully', () => {
    const manager = new SubscriptionManager<any>()
    const socket = createSocket()

    const result = manager.subscribe(workspaceId, '  src/index.ts  ', socket)

    expect(result).toEqual({ ok: true, path: 'src/index.ts' })
    expect([...manager.getSubscribers(workspaceId, 'src/index.ts')]).toContain(socket)
  })

  it('rejects empty paths', () => {
    const manager = new SubscriptionManager<any>()
    const socket = createSocket()

    const result = manager.subscribe(workspaceId, '   ', socket)

    expect(result).toEqual({ ok: false, reason: 'File path required for subscription' })
  })

  it('enforces per-socket subscription limits', () => {
    const limit = 3
    const manager = new SubscriptionManager<any>(limit)
    const socket = createSocket()

    for (let i = 0; i < limit; i += 1) {
      const path = `file-${i}.ts`
      const result = manager.subscribe(workspaceId, path, socket)
      expect(result.ok).toBe(true)
    }

    const overLimit = manager.subscribe(workspaceId, 'file-over.ts', socket)
    expect(overLimit).toEqual({ ok: false, reason: `Subscription limit of ${limit} reached` })
  })

  it('allows re-subscribing to the same path without hitting limit', () => {
    const manager = new SubscriptionManager<any>(1)
    const socket = createSocket()

    const first = manager.subscribe(workspaceId, 'foo.ts', socket)
    expect(first.ok).toBe(true)

    const second = manager.subscribe(workspaceId, 'foo.ts', socket)
    expect(second).toEqual({ ok: true, path: 'foo.ts' })
  })

  it('removes socket subscriptions for a workspace', () => {
    const manager = new SubscriptionManager<any>()
    const socket = createSocket()

    manager.subscribe(workspaceId, 'a.ts', socket)
    manager.subscribe(workspaceId, 'b.ts', socket)

    const removed = manager.removeForWorkspace(workspaceId, socket)

    expect(removed).toBe(2)
    expect(manager.getSubscribers(workspaceId, 'a.ts').size).toBe(0)
    expect(manager.getSubscribers(workspaceId, 'b.ts').size).toBe(0)
  })

  it('removes socket subscriptions across workspaces', () => {
    const manager = new SubscriptionManager<any>()
    const socket = createSocket()

    manager.subscribe('workspace-a', 'file-a.ts', socket)
    manager.subscribe('workspace-b', 'file-b.ts', socket)

    const removed = manager.removeSocket(socket)

    expect(removed).toBe(2)
    expect(manager.getSubscribers('workspace-a', 'file-a.ts').size).toBe(0)
    expect(manager.getSubscribers('workspace-b', 'file-b.ts').size).toBe(0)
  })
})
