import { NextRequest, NextResponse } from 'next/server';
import { WebSocketServer, WebSocket } from 'ws';
import { spawn } from 'child_process';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getToken } from 'next-auth/jwt';

// Store active PTY processes
interface PtyProcess {
  process: ReturnType<typeof spawn>;
  ws: WebSocket;
}
const activeProcesses = new Map<string, PtyProcess>();

// WebSocket server setup
let wss: WebSocketServer | null = null;

// Initialize WebSocket server if not already done
function ensureWebSocketServer() {
  if (!wss) {
    wss = new WebSocketServer({ noServer: true });
    
    wss.on('connection', (ws: WebSocket, request: NextRequest) => {
      const workspaceId = new URL(request.url || '', 'http://localhost').searchParams.get('workspaceId');
      
      if (!workspaceId) {
        ws.close(4000, 'Workspace ID is required');
        return;
      }

      // Create a new PTY process for this session
      const shell = process.env.SHELL || '/bin/bash';
      const ptyProcess = spawn(shell, [], {
        name: 'xterm-256color',
        env: { 
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          PATH: process.env.PATH || ''
        },
      });

      // Store the PTY process
      activeProcesses.set(workspaceId, { process: ptyProcess, ws });

      // Handle data from PTY process
      ptyProcess.stdout.on('data', (data: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      ptyProcess.stderr.on('data', (data: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      // Handle terminal input
      ws.on('message', (message: string) => {
        ptyProcess.stdin.write(message);
      });

      // Cleanup on close
      ws.on('close', () => {
        ptyProcess.kill();
        const process = activeProcesses.get(workspaceId);
        if (process && process.ws === ws) {
          activeProcesses.delete(workspaceId);
        }
      });
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

// This is needed for WebSocket upgrade handling
export const dynamic = 'force-dynamic';

// Handle WebSocket upgrade
const handler = async (req: Request, _res: unknown) => {
  if (!req.headers.get('upgrade')?.toLowerCase().includes('websocket')) {
    return new NextResponse('Expected Upgrade: WebSocket', { status: 426 });
  }

  const wss = ensureWebSocketServer();
  
  // @ts-expect-error - Next.js specific handling for WebSocket upgrade
  wss.handleUpgrade(req, (req as any).socket, Buffer.alloc(0), (ws) => {
    wss.emit('connection', ws, req);
  });
};

export { handler as POST };
