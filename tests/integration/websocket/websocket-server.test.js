const http = require('http');

// Disable mocks for real integration testing
jest.unmock('socket.io-client');
jest.unmock('socket.io');

describe('WebSocket Server Integration', () => {
  let ioServer, httpServer, clientSocket;

  beforeAll((done) => {
    httpServer = http.createServer();
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

    // Return a promise that resolves when connection is established
    return new Promise((resolve, reject) => {
      httpServer.listen(() => {
        const port = httpServer.address().port;
        clientSocket = io(`http://localhost:${port}`, {
          transports: ['websocket'],
          forceNew: true,
          reconnection: false,
          timeout: 5000 // Add timeout
        });

        // Add timeout to prevent hanging
        const timeout = setTimeout(() => {
          console.error('WebSocket connection timeout');
          reject(new Error('Connection timeout'));
        }, 10000);

        // Ensure the client is fully connected before tests run
        clientSocket.on('connect', () => {
          clearTimeout(timeout);
          resolve();
        });

        clientSocket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });
      // Ensure the client is fully connected before tests run
      clientSocket.on('connect', () => done());
    });
  }, 15000); // Increase timeout for beforeAll

  beforeEach(() => {
    // Clear previous error listeners to prevent cross-test interference
    if (clientSocket) {
      clientSocket.off('error');
    }
  });

  beforeEach(() => {
    // Clear previous error listeners to prevent cross-test interference
    if (clientSocket) {
      clientSocket.off('error');
    }
  });

  afterAll(() => {
    if (clientSocket) clientSocket.disconnect();
    if (ioServer) ioServer.close();
    if (httpServer) httpServer.close();
  });

  describe('Error Handling', () => {
    it('should handle malformed data gracefully', (done) => {
      clientSocket.once('error', (error) => {
        expect(error.message).toBe('Invalid input format');
        done();
      });

      // Send malformed data
      clientSocket.emit('terminal-input', null);
    });

    it('should handle invalid cursor position', (done) => {
      clientSocket.once('error', (error) => {
        expect(error.message).toBe('Invalid cursor position');
        done();
      });

      // Send invalid cursor position
      clientSocket.emit('cursor-position', { x: 'invalid', y: 'data' });
    });
  });
});
