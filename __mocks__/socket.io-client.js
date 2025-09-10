// Mock for socket.io-client
const mockSocket = {
  on: jest.fn(function(event, handler) {
    // Store handlers for test triggering
    if (!this._handlers) this._handlers = new Map()
    this._handlers.set(event, handler)
    return this // Return for chaining
  }),
  emit: jest.fn(),
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

// Export both default and named export
module.exports = mockIo
module.exports.default = mockIo
module.exports.io = mockIo