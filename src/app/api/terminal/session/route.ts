import { NextRequest, NextResponse } from 'next/server';
import { WebSocketServer, WebSocket } from 'ws';
import type { IPty } from 'node-pty';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getToken } from 'next-auth/jwt';
import { validateQueryParams } from '@/lib/api/validation/middleware';
import { terminalWebSocketQuerySchema } from '@/lib/api/validation/schemas';
// import { logger } from '@/lib/logger';
import path from 'path';

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic';

// Dynamic import for node-pty to avoid build-time loading
let nodePty: typeof import('node-pty') | null = null;
const getNodePty = async () => {
  if (!nodePty) {
    nodePty = await import('node-pty');
  }
  return nodePty;
};

// Store active PTY processes
interface PtyProcess {
  process: any; // node-pty IPty interface
  ws: WebSocket;
}
const activeProcesses = new Map<string, PtyProcess>();

// WebSocket server setup
let wss: WebSocketServer | null = null;

// Initialize WebSocket server if not already done
function ensureWebSocketServer() {
  if (!wss) {
    wss = new WebSocketServer({ noServer: true });

    wss.on('connection', async (ws: WebSocket, request: NextRequest) => {
      const url = new URL(request.url || '', 'http://localhost');

      // SECURITY: Validate query parameters
      const mockReq = {
        url: url.toString(),
        headers: new Map()
      } as unknown as NextRequest;

      const validation = validateQueryParams(mockReq, terminalWebSocketQuerySchema);
      if (!validation.success) {
        console.error('Terminal WebSocket validation failed');
        ws.close(4000, 'Invalid query parameters');
        return;
      }

      const { workspaceId, userId } = validation.data;

      try {
        // SECURITY: Construct safe workspace path
        const workspacePath = path.join('/workspaces', workspaceId);

        // SECURITY: Validate workspace path is within allowed directory
        if (!workspacePath.startsWith('/workspaces/')) {
          console.error(`Invalid workspace path attempted: ${workspacePath}`);
          ws.close(4001, 'Invalid workspace path');
          return;
        }

        // Create a new PTY process for this session (using dynamic import)
        const pty = await getNodePty();
        const shell = process.env.SHELL || '/bin/bash';
        const ptyProcess = pty.spawn(shell, [], {
          name: 'xterm-256color',
          cols: 80,
          rows: 30,
          cwd: workspacePath, // SECURITY: Use validated workspace path
          env: {
            ...process.env,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
            PATH: process.env.PATH || '',
            WORKSPACE_ID: workspaceId, // SECURITY: Validated ID only
            USER_ID: userId // SECURITY: Validated user ID only
          },
        });

        // Store the PTY process
        activeProcesses.set(workspaceId, { process: ptyProcess, ws });

        // Handle data from PTY process
        ptyProcess.onData((data: string) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          }
        });

        // Handle terminal input
        ws.on('message', (message: string) => {
          // SECURITY: Limit message size to prevent DoS
          if (message.length > 10_000) {
            console.warn(`Terminal input too large: ${message.length} bytes`);
            ws.close(4002, 'Message too large');
            return;
          }
          ptyProcess.write(message);
        });

        // Cleanup on close
        ws.on('close', () => {
          ptyProcess.kill();
          const process = activeProcesses.get(workspaceId);
          if (process && process.ws === ws) {
            activeProcesses.delete(workspaceId);
          }
        });
      } catch (error) {
        console.error('Terminal session creation error:', error);
        ws.close(4003, 'Failed to create terminal session');
      }
    });
  }
  return wss;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // Get the token for WebSocket authentication
  const token = await getToken({ req: request });
  if (!token) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // This will be handled by the WebSocket upgrade
  return new NextResponse(null, { status: 101 });
}

// Handle WebSocket upgrade
const handler = async (req: Request, _res: unknown): Promise<NextResponse> => {
  if (!req.headers.get('upgrade')?.toLowerCase().includes('websocket')) {
    return new NextResponse('Expected Upgrade: WebSocket', { status: 426 });
  }

  const wss = ensureWebSocketServer();

  // @ts-expect-error - Next.js specific handling for WebSocket upgrade
  wss.handleUpgrade(req, (req as any).socket, Buffer.alloc(0), (ws) => {
    wss.emit('connection', ws, req);
  });

  return new NextResponse(null, { status: 101 });
};

export { handler as POST };
