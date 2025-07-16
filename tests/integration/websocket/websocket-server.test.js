const { io } = require('socket.io-client');
const { Server } = require('socket.io');
const http = require('http');

describe('WebSocket Server Integration', () => {
  let ioServer, server, clientSocket;

  beforeAll((done) => {
    const httpServer = http.createServer();
    ioServer = new Server(httpServer);
    
    ioServer.on('connection', (socket) => {
      socket.on('terminal-input', (data) => {
        // Add proper null/undefined check
        if (!data || typeof data !== 'object' || !data.input) {
          return socket.emit('error', { message: 'Invalid input format' });
        }
        socket.emit('terminal-output', { data: `Echo: ${data.input}` });
      });

      socket.on('cursor-position', (data) => {
        if (!data || typeof data !== 'object' || 
            typeof data.x !== 'number' || typeof data.y !== 'number') {
          return socket.emit('error', { message: 'Invalid cursor position' });
        }
        socket.broadcast.emit('cursor-update', data);
      });
    });

    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = io(`http://localhost:${port}`, {
        transports: ['websocket'],
        forceNew: true,
        reconnection: false
      });
      done();
    });
  });

  afterAll(() => {
    ioServer.close();
    if (clientSocket) clientSocket.close();
  });

  describe('Error Handling', () => {
    it('should handle malformed data gracefully', (done) => {
      clientSocket.on('error', (error) => {
        expect(error.message).toBe('Invalid input format');
        done();
      });
      
      // Send malformed data
      clientSocket.emit('terminal-input', null);
    });

    it('should handle invalid cursor position', (done) => {
      clientSocket.on('error', (error) => {
        expect(error.message).toBe('Invalid cursor position');
        done();
      });
      
      // Send invalid cursor position
      clientSocket.emit('cursor-position', { x: 'invalid', y: 'data' });
    });
  });
});
