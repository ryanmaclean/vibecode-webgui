import { NextApiRequest, NextApiResponse } from 'next'
import { Server as SocketIOServer } from 'socket.io'
import { Server as HTTPServer } from 'http'
import { collaborationService } from '@/lib/services/collaboration'

const SocketHandler = (req: NextApiRequest, res: NextApiResponse) => {
  if (!res.socket.server.io) {
    console.log('🚀 Initializing Socket.IO server for collaboration...')

    const httpServer: HTTPServer = res.socket.server
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
    
    res.socket.server.io = io

    console.log('✅ Socket.IO server initialized for real-time collaboration')
  } else {
    console.log('📡 Socket.IO server already running')
  }

  res.end()
}

export default SocketHandler