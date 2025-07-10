/**
 * Integration tests for WebSocket server
 */
const { createServer } = require('http')
const { Server } = require('socket.io')
const Client = require('socket.io-client')
const jwt = require('jsonwebtoken')

describe('WebSocket Server Integration', () => {
  let httpServer
  let io
  let clientSocket
  let serverSocket

  const JWT_SECRET = 'test-secret'
  const PORT = 3002

  beforeAll((done) => {
    // Create HTTP server
    httpServer = createServer()
    
    // Create Socket.IO server
    io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    })

    // Authentication middleware
    io.use((socket, next) => {
      try {
        const token = socket.handshake.auth.token
        if (!token) {
          return next(new Error('Authentication token required'))
        }

        const decoded = jwt.verify(token, JWT_SECRET)
        socket.userId = decoded.sub || decoded.id
        socket.userEmail = decoded.email
        next()
      } catch (err) {
        next(new Error('Invalid authentication token'))
      }
    })

    // Connection handler
    io.on('connection', (socket) => {
      serverSocket = socket
      
      socket.on('join-project', (projectId) => {
        socket.join(`project:${projectId}`)
        socket.currentProject = projectId
        socket.emit('project-joined', { projectId })
      })

      socket.on('terminal-input', (data) => {
        socket.emit('terminal-output', { data: `Echo: ${data.input}` })
      })

      socket.on('cursor-position', (data) => {
        socket.to(`project:${data.projectId}`).emit('cursor-update', {
          userId: socket.userId,
          ...data,
        })
      })
    })

    httpServer.listen(PORT, done)
  })

  afterAll((done) => {
    io.close()
    httpServer.close(done)
  })

  beforeEach((done) => {
    // Generate valid JWT token
    const token = jwt.sign(
      {
        sub: 'test-user-123',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
      },
      JWT_SECRET
    )

    // Create client socket with authentication
    clientSocket = new Client(`http://localhost:${PORT}`, {
      auth: { token },
    })

    clientSocket.on('connect', done)
  })

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect()
    }
  })

  describe('Authentication', () => {
    it('should reject connection without token', (done) => {
      const unauthenticatedClient = new Client(`http://localhost:${PORT}`)
      
      unauthenticatedClient.on('connect_error', (error) => {
        expect(error.message).toBe('Authentication token required')
        unauthenticatedClient.disconnect()
        done()
      })
    })

    it('should reject connection with invalid token', (done) => {
      const invalidClient = new Client(`http://localhost:${PORT}`, {
        auth: { token: 'invalid-token' },
      })
      
      invalidClient.on('connect_error', (error) => {
        expect(error.message).toBe('Invalid authentication token')
        invalidClient.disconnect()
        done()
      })
    })

    it('should accept connection with valid token', () => {
      expect(clientSocket.connected).toBe(true)
      expect(serverSocket.userId).toBe('test-user-123')
      expect(serverSocket.userEmail).toBe('test@example.com')
    })
  })

  describe('Project Management', () => {
    it('should join project room', (done) => {
      const projectId = 'test-project-456'
      
      clientSocket.emit('join-project', projectId)
      
      clientSocket.on('project-joined', (data) => {
        expect(data.projectId).toBe(projectId)
        expect(serverSocket.currentProject).toBe(projectId)
        done()
      })
    })
  })

  describe('Terminal Operations', () => {
    it('should handle terminal input and return output', (done) => {
      const testInput = 'ls -la'
      
      clientSocket.emit('terminal-input', { input: testInput })
      
      clientSocket.on('terminal-output', (data) => {
        expect(data.data).toBe(`Echo: ${testInput}`)
        done()
      })
    })
  })

  describe('Real-time Collaboration', () => {
    let secondClient
    
    beforeEach((done) => {
      const token = jwt.sign(
        {
          sub: 'test-user-456',
          email: 'test2@example.com',
          iat: Math.floor(Date.now() / 1000),
        },
        JWT_SECRET
      )

      secondClient = new Client(`http://localhost:${PORT}`, {
        auth: { token },
      })

      secondClient.on('connect', done)
    })

    afterEach(() => {
      if (secondClient && secondClient.connected) {
        secondClient.disconnect()
      }
    })

    it('should broadcast cursor position to other users in same project', (done) => {
      const projectId = 'collaboration-project'
      const cursorData = {
        projectId,
        file: 'test.js',
        position: { line: 10, column: 5 },
      }

      // Both clients join the same project
      clientSocket.emit('join-project', projectId)
      secondClient.emit('join-project', projectId)

      // Second client listens for cursor updates
      secondClient.on('cursor-update', (data) => {
        expect(data.userId).toBe('test-user-123')
        expect(data.file).toBe(cursorData.file)
        expect(data.position).toEqual(cursorData.position)
        done()
      })

      // First client sends cursor position
      setTimeout(() => {
        clientSocket.emit('cursor-position', cursorData)
      }, 50)
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed data gracefully', (done) => {
      // Send malformed data
      clientSocket.emit('terminal-input', null)
      
      // Server should not crash and continue responding
      setTimeout(() => {
        clientSocket.emit('terminal-input', { input: 'test' })
        
        clientSocket.on('terminal-output', (data) => {
          expect(data.data).toBe('Echo: test')
          done()
        })
      }, 100)
    })
  })
})