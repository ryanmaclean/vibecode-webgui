#!/usr/bin/env node

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const Redis = require('redis');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const pty = require('node-pty');
const chokidar = require('chokidar');

// Configuration
const PORT = process.env.WS_PORT || 3001;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const JWT_SECRET = process.env.NEXTAUTH_SECRET || 'dev-secret-key';

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow WebSocket connections
}));

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://vibecode.yourdomain.com']
    : ['http://localhost:3000'],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check Redis connection
    const redisPing = await redis.ping();
    if (redisPing !== 'PONG') {
      throw new Error('Redis ping failed');
    }

    res.json({
      status: 'healthy',
      dependencies: {
        redis: 'ok'
      },
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      dependencies: {
        redis: error.message
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Initialize Redis client
const redis = Redis.createClient({ url: REDIS_URL });
redis.on('error', (err) => console.error('Redis Client Error', err));
redis.connect();

// Initialize Socket.IO
const io = socketIo(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://vibecode.yourdomain.com']
      : ['http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Authentication middleware for Socket.IO with role verification
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token ||
                 socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      console.error('No authentication token provided');
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify required claims
    if (!decoded.sub && !decoded.id) {
      console.error('Token missing required subject claim');
      return next(new Error('Invalid token: missing subject'));
    }

    // Attach user information to socket
    socket.user = {
      id: decoded.sub || decoded.id,
      email: decoded.email,
      role: decoded.role || 'user', // Default to 'user' role if not specified
      name: decoded.name
    };

    // Log successful authentication
    console.log(`User authenticated: ${socket.user.email} (${socket.user.id})`);

    next();
  } catch (err) {
    console.error('Authentication error:', err.message);
    if (err.name === 'TokenExpiredError') {
      return next(new Error('Token expired'));
    } else if (err.name === 'JsonWebTokenError') {
      return next(new Error('Invalid token'));
    }
    next(new Error('Authentication failed'));
  }
});

// Role-based access control middleware
const requireRole = (role) => {
  return (socket, next) => {
    if (!socket.user) {
      return next(new Error('Authentication required'));
    }

    if (socket.user.role !== role) {
      console.warn(`Access denied for user ${socket.user.id} (role: ${socket.user.role}) to ${role}-only resource`);
      return next(new Error('Insufficient permissions'));
    }

    next();
  };
};

// Store active terminals and file watchers
const terminals = new Map();
const fileWatchers = new Map();

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userEmail} (${socket.id})`);

  // Join project room
  socket.on('join-project', async (projectId) => {
    try {
      socket.join(`project:${projectId}`);
      socket.currentProject = projectId;

      // Store user presence in Redis
      await redis.setEx(`presence:${projectId}:${socket.userId}`, 300, JSON.stringify({
        userId: socket.userId,
        email: socket.userEmail,
        socketId: socket.id,
        joinedAt: new Date().toISOString()
      }));

      // Notify other users in the project
      socket.to(`project:${projectId}`).emit('user-joined', {
        userId: socket.userId,
        email: socket.userEmail
      });

      console.log(`User ${socket.userEmail} joined project ${projectId}`);
    } catch (error) {
      console.error('Error joining project:', error);
      socket.emit('error', { message: 'Failed to join project' });
    }
  });

  // Terminal session management
  socket.on('create-terminal', (data) => {
    try {
      const { projectId, terminalId } = data;

      if (!projectId || !terminalId) {
        return socket.emit('error', { message: 'Project ID and Terminal ID required' });
      }

      // Create new terminal session
      const terminal = pty.spawn(process.platform === 'win32' ? 'cmd.exe' : 'bash', [], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: `/workspace/${projectId}`,
        env: process.env
      });

      terminals.set(terminalId, terminal);

      // Send terminal output to client
      terminal.on('data', (data) => {
        socket.emit('terminal-output', { terminalId, data });
      });

      // Handle terminal exit
      terminal.on('exit', (code) => {
        console.log(`Terminal ${terminalId} exited with code ${code}`);
        terminals.delete(terminalId);
        socket.emit('terminal-exit', { terminalId, code });
      });

      socket.emit('terminal-created', { terminalId });
      console.log(`Terminal ${terminalId} created for project ${projectId}`);
    } catch (error) {
      console.error('Error creating terminal:', error);
      socket.emit('error', { message: 'Failed to create terminal' });
    }
  });

  // Handle terminal input
  socket.on('terminal-input', (data) => {
    try {
      const { terminalId, input } = data;
      const terminal = terminals.get(terminalId);

      if (terminal) {
        terminal.write(input);
      } else {
        socket.emit('error', { message: 'Terminal not found' });
      }
    } catch (error) {
      console.error('Error handling terminal input:', error);
    }
  });

  // Resize terminal
  socket.on('terminal-resize', (data) => {
    try {
      const { terminalId, cols, rows } = data;
      const terminal = terminals.get(terminalId);

      if (terminal) {
        terminal.resize(cols, rows);
      }
    } catch (error) {
      console.error('Error resizing terminal:', error);
    }
  });

  // File watching for real-time updates
  socket.on('watch-files', (data) => {
    try {
      const { projectId, path } = data;
      const watchKey = `${projectId}:${path}`;

      if (fileWatchers.has(watchKey)) {
        return; // Already watching this path
      }

      const watcher = chokidar.watch(path, {
        ignored: /(^|[\/\\])\../, // ignore dotfiles
        persistent: true,
        ignoreInitial: true
      });

      watcher
        .on('change', (filePath) => {
          socket.to(`project:${projectId}`).emit('file-changed', {
            path: filePath,
            type: 'change',
            timestamp: new Date().toISOString()
          });
        })
        .on('add', (filePath) => {
          socket.to(`project:${projectId}`).emit('file-changed', {
            path: filePath,
            type: 'add',
            timestamp: new Date().toISOString()
          });
        })
        .on('unlink', (filePath) => {
          socket.to(`project:${projectId}`).emit('file-changed', {
            path: filePath,
            type: 'delete',
            timestamp: new Date().toISOString()
          });
        });

      fileWatchers.set(watchKey, watcher);
      console.log(`Started watching files for project ${projectId} at ${path}`);
    } catch (error) {
      console.error('Error setting up file watcher:', error);
    }
  });

  // Real-time collaboration events
  socket.on('cursor-position', (data) => {
    const { projectId, file, position } = data;
    socket.to(`project:${projectId}`).emit('cursor-update', {
      userId: socket.userId,
      email: socket.userEmail,
      file,
      position
    });
  });

  socket.on('selection-change', (data) => {
    const { projectId, file, selection } = data;
    socket.to(`project:${projectId}`).emit('selection-update', {
      userId: socket.userId,
      email: socket.userEmail,
      file,
      selection
    });
  });

  // Handle disconnection
  socket.on('disconnect', async () => {
    try {
      console.log(`User disconnected: ${socket.userEmail} (${socket.id})`);

      // Clean up terminals
      for (const [terminalId, terminal] of terminals.entries()) {
        if (terminal.socket === socket.id) {
          terminal.destroy();
          terminals.delete(terminalId);
        }
      }

      // Remove user presence
      if (socket.currentProject) {
        await redis.del(`presence:${socket.currentProject}:${socket.userId}`);

        // Notify other users
        socket.to(`project:${socket.currentProject}`).emit('user-left', {
          userId: socket.userId,
          email: socket.userEmail
        });
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');

  // Close all terminals
  for (const terminal of terminals.values()) {
    terminal.destroy();
  }

  // Close file watchers
  for (const watcher of fileWatchers.values()) {
    await watcher.close();
  }

  // Close Redis connection
  await redis.quit();

  // Close server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 WebSocket server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 Redis URL: ${REDIS_URL}`);
});

module.exports = { app, server, io };
