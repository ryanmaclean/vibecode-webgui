// Mock for socket.io-client
const eventHandlers = new Map()

const mockSocket = {
  on: jest.fn(function(event, handler) {
    // Store handlers for test triggering
    if (!this._handlers) this._handlers = new Map()
    this._handlers.set(event, handler)
    // Also store globally for test access
    eventHandlers.set(event, handler)
    
    // Simulate connection for 'connect' event
    if (event === 'connect') {
      setTimeout(() => {
        this.connected = true
        handler()
      }, 100) // Small delay to simulate connection
    }
    
    return this // Return for chaining
  }),
  emit: jest.fn(function(event, data) {
    // Simulate server-side error handling for malformed data
    if (event === 'terminal-input' && (!data || typeof data !== 'object' || !data.input)) {
      setTimeout(() => {
        const errorHandler = this._handlers?.get('error')
        if (errorHandler) {
          errorHandler({ message: 'Invalid input format' })
        }
      }, 50)
    } else if (event === 'cursor-position' && (!data || typeof data !== 'object' || 
               typeof data.x !== 'number' || typeof data.y !== 'number')) {
      setTimeout(() => {
        const errorHandler = this._handlers?.get('error')
        if (errorHandler) {
          errorHandler({ message: 'Invalid cursor position' })
        }
      }, 50)
    }
  }),
  off: jest.fn(),
  once: jest.fn(function(event, handler) {
    // Store handlers for test triggering
    if (!this._handlers) this._handlers = new Map()
    this._handlers.set(event, handler)
    // Also store globally for test access
    eventHandlers.set(event, handler)
    return this // Return for chaining
  }),
  disconnect: jest.fn(),
  connected: false,
  _triggerEvent: function(event, ...args) {
    const handler = this._handlers?.get(event)
    if (handler) handler(...args)
  }
}

const mockIo = jest.fn((options) => {
  console.log('__mocks__ io() called with:', options)
  return mockSocket
})

// Mock Socket type for named import
const Socket = jest.fn(() => mockSocket)

// Export both default and named exports - handle both CommonJS and ES modules
const mockExports = mockIo
mockExports.default = mockIo
mockExports.io = mockIo
mockExports.Socket = Socket
mockExports.mockSocket = mockSocket
mockExports.eventHandlers = eventHandlers

// Make available globally for tests
global.mockSocket = mockSocket
global.eventHandlers = eventHandlers

module.exports = mockExports