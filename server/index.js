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
const winston = require('winston');

// Initialize Winston logger for server
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'websocket-server' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...metadata }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(metadata).length > 0) {
            msg += ` ${JSON.stringify(metadata)}`;
          }
          return msg;
        })
      ),
    }),
  ],
});

// Configuration with security validation
const PORT = process.env.WS_PORT || 3001;
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET;

// Security check: ensure JWT_SECRET is configured in production
if (process.env.NODE_ENV === 'production' && !JWT_SECRET) {
  logger.error('FATAL: JWT_SECRET or NEXTAUTH_SECRET must be set in production');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'dev-secret-key') {
  logger.error('FATAL: JWT_SECRET cannot use default value in production');
  process.exit(1);
}

if (!JWT_SECRET) {
  logger.warn('WARNING: No JWT_SECRET configured. Using insecure default for development only.');
  logger.warn('Set NEXTAUTH_SECRET or JWT_SECRET environment variable.');
}

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
    logger.error('Health check failed', { error: error.message, stack: error.stack });
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
redis.on('error', (err) => logger.error('Redis Client Error', { error: err.message, stack: err.stack }));
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
      logger.warn('Authentication attempt without token');
      return next(new Error('Authentication token required'));
    }

    if (!JWT_SECRET) {
      logger.error('JWT_SECRET not configured during authentication attempt');
      return next(new Error('Server configuration error'));
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify required claims
    if (!decoded.sub && !decoded.id) {
      logger.warn('Token missing required subject claim');
      return next(new Error('Invalid token: missing subject'));
    }

    // Attach user information to socket
    socket.user = {
      id: decoded.sub || decoded.id,
      email: decoded.email,
      role: decoded.role || 'user', // Default to 'user' role if not specified
      name: decoded.name
    };

    // Log successful authentication (sanitized - no sensitive data)
    logger.info('User authenticated', {
      userId: socket.user.id,
      role: socket.user.role
    });

    next();
  } catch (err) {
    logger.warn('Authentication error', {
      errorType: err.name,
      message: err.message
    });
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
      logger.warn('Access denied - insufficient permissions', {
        userId: socket.user.id,
        userRole: socket.user.role,
        requiredRole: role
      });
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
  logger.info('User connected', {
    userId: socket.user?.id,
    socketId: socket.id
  });

  // Join project room
  socket.on('join-project', async (projectId) => {
    try {
      socket.join(`project:${projectId}`);
      socket.currentProject = projectId;

      // Store user presence in Redis
      await redis.setEx(`presence:${projectId}:${socket.user.id}`, 300, JSON.stringify({
        userId: socket.user.id,
        email: socket.user.email,
        socketId: socket.id,
        joinedAt: new Date().toISOString()
      }));

      // Notify other users in the project
      socket.to(`project:${projectId}`).emit('user-joined', {
        userId: socket.user.id,
        email: socket.user.email
      });

      logger.info('User joined project', {
        userId: socket.user.id,
        projectId: projectId
      });
    } catch (error) {
      logger.error('Error joining project', {
        error: error.message,
        userId: socket.user?.id,
        projectId: projectId
      });
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
        logger.info('Terminal exited', { terminalId, exitCode: code });
        terminals.delete(terminalId);
        socket.emit('terminal-exit', { terminalId, code });
      });

      socket.emit('terminal-created', { terminalId });
      logger.info('Terminal created', { terminalId, projectId });
    } catch (error) {
      logger.error('Error creating terminal', {
        error: error.message,
        terminalId: data.terminalId,
        projectId: data.projectId
      });
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
      logger.error('Error handling terminal input', {
        error: error.message,
        terminalId: data.terminalId
      });
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
      logger.error('Error resizing terminal', {
        error: error.message,
        terminalId: data.terminalId
      });
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
      logger.info('Started watching files', { projectId, path });
    } catch (error) {
      logger.error('Error setting up file watcher', {
        error: error.message,
        projectId: data.projectId,
        path: data.path
      });
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
      logger.info('User disconnected', {
        userId: socket.user?.id,
        socketId: socket.id
      });

      // Clean up terminals
      for (const [terminalId, terminal] of terminals.entries()) {
        if (terminal.socket === socket.id) {
          terminal.destroy();
          terminals.delete(terminalId);
        }
      }

      // Remove user presence
      if (socket.currentProject) {
        await redis.del(`presence:${socket.currentProject}:${socket.user.id}`);

        // Notify other users
        socket.to(`project:${socket.currentProject}`).emit('user-left', {
          userId: socket.user.id,
          email: socket.user.email
        });
      }
    } catch (error) {
      logger.error('Error handling disconnect', {
        error: error.message,
        userId: socket.user?.id
      });
    }
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');

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
    logger.info('Server closed successfully');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  logger.info('WebSocket server started', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    redisUrl: REDIS_URL.replace(/:[^:@]+@/, ':****@') // Mask password in Redis URL
  });
  if (!JWT_SECRET && process.env.NODE_ENV !== 'production') {
    logger.warn('Using fallback JWT secret for development');
  }
});

module.exports = { app, server, io };
