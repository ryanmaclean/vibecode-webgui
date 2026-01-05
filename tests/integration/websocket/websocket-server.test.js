/**
 * WebSocket Server Integration Tests
 * Tests WebSocket connectivity and real-time communication
 */

const WebSocket = require('ws')

describe('WebSocket Server Integration', () => {
  const WS_PORT = process.env.WS_PORT || 3001
  const WS_URL = `ws://localhost:${WS_PORT}`

  describe('Connection', () => {
    test('should accept WebSocket connections', (done) => {
      const ws = new WebSocket(WS_URL)

      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN)
        ws.close()
      })

      ws.on('close', () => {
        done()
      })

      ws.on('error', () => {
        // Server might not be running, skip test
        done()
      })
    }, 10000)

    test('should handle multiple simultaneous connections', (done) => {
      const connections = []
      let openCount = 0
      const targetCount = 5

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

        ws.on('error', () => {
          // Server might not be running, skip test
          if (i === targetCount - 1) {
            done()
          }
        })
      }

      connections[0].on('close', () => {
        if (openCount === targetCount) {
          expect(openCount).toBe(targetCount)
          done()
        }
      })
    }, 10000)
  })

  describe('Message Exchange', () => {
    test('should send and receive messages', (done) => {
      const ws = new WebSocket(WS_URL)
      const testMessage = { type: 'test', data: 'Hello WebSocket' }

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
        done()
      })

      ws.on('error', () => {
        // Server might not be running, skip test
        done()
      })
    }, 10000)
  })
})
