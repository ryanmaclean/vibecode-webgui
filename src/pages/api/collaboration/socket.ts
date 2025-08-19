import { NextApiRequest, NextApiResponse } from 'next'
import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { collaborationService } from '@/lib/services/collaboration'

const SocketHandler = (req: NextApiRequest, res: NextApiResponse) => {
  if (!(res.socket as any).server.io) {
    // Debug log removed

    const httpServer: HTTPServer = (res.socket as any).server
    const io = new SocketIOServer(httpServer, {
      path: '/api/collaboration/socket',
      addTrailingSlash: false,
      cors: {
        origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
        methods: ['GET', 'POST']
      }
    })

    // Initialize collaboration service with the socket server
    collaborationService.initialize(httpServer)
    
    (res.socket as any).server.io = io

    // Debug log removed
  } else {
    // Debug log removed
  }

  res.end()
}

export default SocketHandler