import { subscriptionManager } from '@/lib/file-sync/subscription-manager'

jest.mock('chokidar', () => ({
  watch: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    close: jest.fn(),
  })),
}))

jest.mock('dd-trace', () => ({
  dogstatsd: {
    increment: jest.fn(),
    histogram: jest.fn(),
  },
}))

jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: {
    json: jest.fn(() => ({ status: 200 })),
  },
}))

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(() => Promise.resolve({ user: { id: 'test-user' } })),
}))

jest.mock('@/lib/auth', () => ({ authOptions: {} }))

jest.mock('ws', () => {
  class MockWebSocket {
    static OPEN = 1
  }

  return {
    WebSocketServer: jest.fn().mockImplementation(() => ({ on: jest.fn() })),
    WebSocket: MockWebSocket,
  }
})

const { __TEST__ } = require('@/app/api/files/sync/route') as {
  __TEST__: {
    handleSubscription: (socket: any, workspaceId: string, path: string) => void
    recordBroadcastMetrics: (args: {
      workspaceId: string
      path?: string
      targeted: number
      totalConnections: number
    }) => void
    sanitizeTagValue: (value: string) => string
  }
}

const statsd = (require('dd-trace').dogstatsd as unknown) as {
  increment: jest.Mock
  histogram: jest.Mock
}

const OPEN_STATE = 1

function createSocket() {
  return {
    readyState: OPEN_STATE,
    send: jest.fn(),
  }
}

describe('files/sync metrics', () => {
  beforeEach(() => {
    subscriptionManager.clear()
    jest.clearAllMocks()
  })

  it('acknowledges subscriptions and records success metrics', () => {
    const socket = createSocket()

    __TEST__.handleSubscription(socket, 'Workspace-1', '  src/index.ts  ')

    expect(socket.send).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(socket.send.mock.calls[0][0] as string)
    expect(payload).toMatchObject({ type: 'subscribed', path: 'src/index.ts' })
    expect(statsd.increment).toHaveBeenCalledWith('filesync.subscription.success', 1, {
      workspace: 'workspace-1',
      path: 'src_index.ts',
    })
  })

  it('records subscription errors for invalid paths', () => {
    const socket = createSocket()

    __TEST__.handleSubscription(socket, 'Workspace-1', '   ')

    expect(socket.send).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(socket.send.mock.calls[0][0] as string)
    expect(payload).toMatchObject({ type: 'error' })
    expect(statsd.increment).toHaveBeenCalledWith('filesync.subscription.error', 1, {
      workspace: 'workspace-1',
      reason: 'file_path_required_for_subscription',
    })
  })

  it('records broadcast metrics', () => {
    __TEST__.recordBroadcastMetrics({
      workspaceId: 'Workspace-1',
      path: 'src/app.ts',
      targeted: 3,
      totalConnections: 5,
    })

    expect(statsd.increment).toHaveBeenCalledWith('filesync.broadcast.events', 1, {
      workspace: 'workspace-1',
      path: 'src_app.ts',
      connections: '5',
    })
    expect(statsd.histogram).toHaveBeenCalledWith('filesync.broadcast.targets', 3, {
      workspace: 'workspace-1',
      path: 'src_app.ts',
      connections: '5',
    })
  })

  it('sanitizes tag values consistently', () => {
    expect(__TEST__.sanitizeTagValue('  Weird Value!* ')).toBe('weird_value__')
  })
})
