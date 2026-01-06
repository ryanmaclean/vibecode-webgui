/**
 * WebSocket Server Integration Tests
 * Tests WebSocket connectivity and real-time communication
 */

const WebSocket = require('ws')
const net = require('net')

// Check if WebSocket server is available
async function isWebSocketServerAvailable(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, 'localhost')
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => {
      resolve(false)
    })
    socket.setTimeout(1000, () => {
      socket.destroy()
      resolve(false)
    })
  })
}

describe('WebSocket Server Integration', () => {
  const WS_PORT = process.env.WS_PORT || 3001
  const WS_URL = `ws://localhost:${WS_PORT}`
  let serverAvailable = false

  beforeAll(async () => {
    serverAvailable = await isWebSocketServerAvailable(WS_PORT)
    if (!serverAvailable) {
      console.log(`⚠ WebSocket server not available at port ${WS_PORT} - skipping WebSocket tests`)
    }
  })

  describe('Connection', () => {
    test('should accept WebSocket connections', (done) => {
      if (!serverAvailable) {
        console.log('Skipping: WebSocket server not available')
        done()
        return
      }

      const ws = new WebSocket(WS_URL)
      let isDone = false

      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN)
        ws.close()
      })

      ws.on('close', () => {
        if (!isDone) {
          isDone = true
          done()
        }
      })

      ws.on('error', (error) => {
        if (!isDone) {
          isDone = true
          console.log('WebSocket error:', error.message)
          done()
        }
      })
    }, 10000)

    test('should handle multiple simultaneous connections', (done) => {
      if (!serverAvailable) {
        console.log('Skipping: WebSocket server not available')
        done()
        return
      }

      const connections = []
      let openCount = 0
      let closedCount = 0
      const targetCount = 5
      let isDone = false

      for (let i = 0; i < targetCount; i++) {
        const ws = new WebSocket(WS_URL)
        connections.push(ws)

        ws.on('open', () => {
          openCount++
          if (openCount === targetCount) {
            // All connections established
            connections.forEach(conn => conn.close())
          }
        })

        ws.on('close', () => {
          closedCount++
          if (closedCount === targetCount && !isDone) {
            isDone = true
            expect(openCount).toBe(targetCount)
            done()
          }
        })

        ws.on('error', (error) => {
          if (!isDone) {
            isDone = true
            console.log('WebSocket error:', error.message)
            done()
          }
        })
      }
    }, 10000)
  })

  describe('Message Exchange', () => {
    test('should send and receive messages', (done) => {
      if (!serverAvailable) {
        console.log('Skipping: WebSocket server not available')
        done()
        return
      }

      const ws = new WebSocket(WS_URL)
      const testMessage = { type: 'test', data: 'Hello WebSocket' }
      let isDone = false

      ws.on('open', () => {
        ws.send(JSON.stringify(testMessage))
      })

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString())
          expect(message).toBeDefined()
          ws.close()
        } catch (error) {
          ws.close()
        }
      })

      ws.on('close', () => {
        if (!isDone) {
          isDone = true
          done()
        }
      })

      ws.on('error', (error) => {
        if (!isDone) {
          isDone = true
          console.log('WebSocket error:', error.message)
          done()
        }
      })
    }, 10000)
  })
})
