/**
 * VibeCode Sample Project - Main Entry Point
 *
 * This is a simple TypeScript application that demonstrates VibeCode's
 * AI-powered development features. Try modifying this code and watch
 * how AI suggestions help you write better code faster!
 */

import express, { Express, Request, Response } from 'express'
import { createGreeting } from './api/hello'

const app: Express = express()
const PORT = process.env.PORT || 3000

// Middleware for JSON parsing
app.use(express.json())

/**
 * Root endpoint - Returns basic API information
 *
 * AI TIP: Try asking "add error handling to this endpoint"
 */
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Welcome to VibeCode Sample API',
    version: '1.0.0',
    endpoints: {
      greeting: '/api/hello',
      health: '/health'
    },
    documentation: 'See README.md for more information'
  })
})

/**
 * Greeting endpoint - Demonstrates parameterized responses
 *
 * AI TIP: Try asking "add query parameter validation"
 */
app.get('/api/hello', (req: Request, res: Response) => {
  const name = req.query.name as string || 'World'
  const greeting = createGreeting(name)

  res.json({
    greeting,
    timestamp: new Date().toISOString(),
    requestedBy: name
  })
})

/**
 * Health check endpoint - Basic application health status
 *
 * AI TIP: Try asking "add memory usage to health check"
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  })
})

/**
 * Start the server
 *
 * TODO: Add graceful shutdown handling
 * TODO: Add request logging middleware
 * TODO: Add rate limiting
 */
function startServer() {
  app.listen(PORT, () => {
    console.log(`✨ VibeCode Sample API running on http://localhost:${PORT}`)
    console.log(`📚 Try these endpoints:`)
    console.log(`   - http://localhost:${PORT}/`)
    console.log(`   - http://localhost:${PORT}/api/hello?name=YourName`)
    console.log(`   - http://localhost:${PORT}/health`)
    console.log(`\n💡 Open this file in VibeCode and start coding with AI assistance!`)
  })
}

// Start the application
startServer()

// Export for testing
export { app }
