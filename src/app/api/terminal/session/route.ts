import { NextRequest, NextResponse } from 'next/server'
import { WebSocketServer, WebSocket } from 'ws'
import type { IPty } from 'node-pty'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getToken } from 'next-auth/jwt'

type SpawnFn = typeof import('node-pty')['spawn']

const loadSpawn = (): SpawnFn | null => {
  try {
    const nodePty = eval('require')('node-pty') as typeof import('node-pty')
    return nodePty.spawn
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[terminal] node-pty unavailable; interactive terminal disabled.', error)
    }
    return null
  }
}

const spawn = loadSpawn()

interface PtyProcess {
  process: IPty
  ws: WebSocket
}

const activeProcesses = new Map<string, PtyProcess>()

let wss: WebSocketServer | null = null

function ensureWebSocketServer() {
  if (!wss) {
    wss = new WebSocketServer({ noServer: true })

    wss.on('connection', (ws: WebSocket, request: NextRequest) => {
      const workspaceId = new URL(request.url || '', 'http://localhost').searchParams.get('workspaceId')

      if (!workspaceId) {
        ws.close(4000, 'Workspace ID is required')
        return
      }

      if (!spawn) {
        ws.close(1013, 'Interactive terminal is disabled on this environment')
        return
      }

      const shell = process.env.SHELL || '/bin/bash'
      const ptyProcess = spawn(shell, [], {
        name: 'xterm-256color',
        cols: 80,
        rows: 30,
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          PATH: process.env.PATH || ''
        }
      })

      activeProcesses.set(workspaceId, { process: ptyProcess, ws })

      ptyProcess.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data)
        }
      })

      ws.on('message', (message: string) => {
        ptyProcess.write(message)
      })

      ws.on('close', () => {
        ptyProcess.kill()
        const processInfo = activeProcesses.get(workspaceId)
        if (processInfo && processInfo.ws === ws) {
          activeProcesses.delete(workspaceId)
        }
      })
    })
  }
  return wss
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const token = await getToken({ req: request })
  if (!token) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  return new NextResponse(null, { status: 101 })
}

export const dynamic = 'force-dynamic'

const handler = async (req: Request, _res: unknown) => {
  if (!req.headers.get('upgrade')?.toLowerCase().includes('websocket')) {
    return new NextResponse('Expected Upgrade: WebSocket', { status: 426 })
  }

  const server = ensureWebSocketServer()

  if (!spawn) {
    return new NextResponse('Interactive terminal disabled', { status: 503 })
  }

  // @ts-expect-error - Next.js specific handling for WebSocket upgrade
  server.handleUpgrade(req, (req as any).socket, Buffer.alloc(0), (ws) => {
    server.emit('connection', ws, req)
  })

  // WebSocket upgrade returns no response (connection is handled by WebSocket server)
  return new NextResponse(null, { status: 101 })
}

export { handler as POST }
