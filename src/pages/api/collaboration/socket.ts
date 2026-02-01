import { NextApiRequest, NextApiResponse } from 'next'
import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { collaborationService } from '@/lib/services/collaboration'

interface ExtendedServer extends HTTPServer {
  io?: SocketIOServer;
}

interface ExtendedSocket {
  server: ExtendedServer;
}

const SocketHandler = (req: NextApiRequest, res: NextApiResponse) => {
  const socket = res.socket as ExtendedSocket | null
  if (!socket) {
    res.status(500).end()
    return
  }

  if (!socket.server.io) {
    // Debug log removed

    const httpServer: HTTPServer = socket.server
    const io = new SocketIOServer(httpServer, {
      path: '/api/collaboration/socket',
      addTrailingSlash: false,
      cors: {
        origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
      }
    })

    // Initialize collaboration service with the socket server
    collaborationService.initialize(io)

    socket.server.io = io

    // Debug log removed
  } else {
    // Debug log removed
  }

  res.end()
}

export default SocketHandler