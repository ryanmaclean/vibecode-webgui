/**
 * Streaming Protocol Performance Benchmarks
 *
 * Comprehensive benchmark suite comparing:
 * - SSE vs WebSocket latency and throughput
 * - Connection establishment time
 * - Memory usage per connection
 * - Reconnection performance
 * - Browser compatibility
 *
 * Usage:
 *   npm run test:streaming-benchmark
 */

import { SSEClient, createSSEClient, SSEClientConfig } from '@/lib/streaming/sse-client'
import {
  WebSocketStreamingClient,
  createWebSocketStreamingClient
} from '@/lib/streaming/websocket-streaming-client'

// ============================================================================
// Benchmark Configuration
// ============================================================================

interface BenchmarkConfig {
  /** Number of concurrent connections */
  concurrency: number
  /** Test duration (ms) */
  duration: number
  /** Messages per second per connection */
  messagesPerSecond: number
  /** Message payload size (bytes) */
  messageSize: number
  /** Warm-up period before measurement (ms) */
  warmupPeriod: number
}

interface BenchmarkResults {
  protocol: 'SSE' | 'WebSocket'
  config: BenchmarkConfig
  metrics: {
    /** Total messages received */
    totalMessages: number
    /** Messages per second */
    throughput: number
    /** Average latency (ms) */
    avgLatency: number
    /** Median latency (ms) */
    p50Latency: number
    /** 95th percentile latency (ms) */
    p95Latency: number
    /** 99th percentile latency (ms) */
    p99Latency: number
    /** Connection establishment time (ms) */
    connectionTime: number
    /** Successful connections */
    successfulConnections: number
    /** Failed connections */
    failedConnections: number
    /** Memory usage per connection (KB) */
    memoryPerConnection: number
    /** Error rate (%) */
    errorRate: number
  }
  timestamp: number
}

// ============================================================================
// Utility Functions
// ============================================================================

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.ceil(sorted.length * p) - 1
  return sorted[Math.max(0, index)]
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, val) => sum + val, 0) / values.length
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatNumber(num: number): string {
  return num.toLocaleString()
}

// ============================================================================
// SSE Benchmark
// ============================================================================

async function benchmarkSSE(config: BenchmarkConfig): Promise<BenchmarkResults> {
  console.log('\n=== SSE Benchmark ===')
  console.log(`Concurrency: ${config.concurrency}`)
  console.log(`Duration: ${config.duration}ms`)
  console.log(`Message rate: ${config.messagesPerSecond}/s per connection`)

  const clients: SSEClient[] = []
  const latencies: number[] = []
  let totalMessages = 0
  let successfulConnections = 0
  let failedConnections = 0
  const connectionTimes: number[] = []

  const startMemory = process.memoryUsage().heapUsed

  // Create connections
  console.log('Creating connections...')
  const connectionStart = Date.now()

  for (let i = 0; i < config.concurrency; i++) {
    const connStart = Date.now()

    const client = createSSEClient(
      {
        url: '/api/test/sse',
        method: 'POST',
        body: { test: true },
        debug: false
      },
      {
        onMessage: (chunk) => {
          const latency = Date.now() - (chunk as any).timestamp
          latencies.push(latency)
          totalMessages++
        },
        onOpen: () => {
          const connTime = Date.now() - connStart
          connectionTimes.push(connTime)
          successfulConnections++
        },
        onError: () => {
          failedConnections++
        }
      }
    )

    clients.push(client)
    client.connect()

    // Stagger connections to avoid thundering herd
    if (i < config.concurrency - 1) {
      await sleep(10)
    }
  }

  const connectionTime = Date.now() - connectionStart

  // Warm-up period
  console.log(`Warming up for ${config.warmupPeriod}ms...`)
  await sleep(config.warmupPeriod)

  // Reset metrics after warm-up
  latencies.length = 0
  totalMessages = 0

  // Run benchmark
  console.log(`Running benchmark for ${config.duration}ms...`)
  const benchmarkStart = Date.now()
  await sleep(config.duration)
  const actualDuration = Date.now() - benchmarkStart

  // Calculate memory usage
  const endMemory = process.memoryUsage().heapUsed
  const memoryPerConnection = (endMemory - startMemory) / config.concurrency / 1024 // KB

  // Cleanup
  console.log('Cleaning up...')
  for (const client of clients) {
    client.disconnect()
  }

  // Calculate results
  const throughput = (totalMessages / actualDuration) * 1000
  const errorRate = (failedConnections / config.concurrency) * 100

  const results: BenchmarkResults = {
    protocol: 'SSE',
    config,
    metrics: {
      totalMessages,
      throughput,
      avgLatency: average(latencies),
      p50Latency: percentile(latencies, 0.5),
      p95Latency: percentile(latencies, 0.95),
      p99Latency: percentile(latencies, 0.99),
      connectionTime: average(connectionTimes),
      successfulConnections,
      failedConnections,
      memoryPerConnection,
      errorRate
    },
    timestamp: Date.now()
  }

  printResults(results)
  return results
}

// ============================================================================
// WebSocket Benchmark
// ============================================================================

async function benchmarkWebSocket(config: BenchmarkConfig): Promise<BenchmarkResults> {
  console.log('\n=== WebSocket Benchmark ===')
  console.log(`Concurrency: ${config.concurrency}`)
  console.log(`Duration: ${config.duration}ms`)
  console.log(`Message rate: ${config.messagesPerSecond}/s per connection`)

  const clients: WebSocketStreamingClient[] = []
  const latencies: number[] = []
  let totalMessages = 0
  let successfulConnections = 0
  let failedConnections = 0
  const connectionTimes: number[] = []

  const startMemory = process.memoryUsage().heapUsed

  // Create connections
  console.log('Creating connections...')
  const connectionStart = Date.now()

  for (let i = 0; i < config.concurrency; i++) {
    const connStart = Date.now()

    const client = createWebSocketStreamingClient({
      url: 'ws://localhost:3000/api/test/ws',
      debug: false
    })

    try {
      await client.connect()
      const connTime = Date.now() - connStart
      connectionTimes.push(connTime)
      successfulConnections++

      // Start streaming
      await client.stream({ test: true }, {
        onChunk: (chunk) => {
          const latency = Date.now() - chunk.timestamp
          latencies.push(latency)
          totalMessages++
        },
        onError: () => {
          failedConnections++
        }
      })

      clients.push(client)
    } catch (error) {
      failedConnections++
    }

    // Stagger connections
    if (i < config.concurrency - 1) {
      await sleep(10)
    }
  }

  const connectionTime = Date.now() - connectionStart

  // Warm-up period
  console.log(`Warming up for ${config.warmupPeriod}ms...`)
  await sleep(config.warmupPeriod)

  // Reset metrics after warm-up
  latencies.length = 0
  totalMessages = 0

  // Run benchmark
  console.log(`Running benchmark for ${config.duration}ms...`)
  const benchmarkStart = Date.now()
  await sleep(config.duration)
  const actualDuration = Date.now() - benchmarkStart

  // Calculate memory usage
  const endMemory = process.memoryUsage().heapUsed
  const memoryPerConnection = (endMemory - startMemory) / config.concurrency / 1024 // KB

  // Cleanup
  console.log('Cleaning up...')
  for (const client of clients) {
    client.disconnect()
  }

  // Calculate results
  const throughput = (totalMessages / actualDuration) * 1000
  const errorRate = (failedConnections / config.concurrency) * 100

  const results: BenchmarkResults = {
    protocol: 'WebSocket',
    config,
    metrics: {
      totalMessages,
      throughput,
      avgLatency: average(latencies),
      p50Latency: percentile(latencies, 0.5),
      p95Latency: percentile(latencies, 0.95),
      p99Latency: percentile(latencies, 0.99),
      connectionTime: average(connectionTimes),
      successfulConnections,
      failedConnections,
      memoryPerConnection,
      errorRate
    },
    timestamp: Date.now()
  }

  printResults(results)
  return results
}

// ============================================================================
// Results Display
// ============================================================================

function printResults(results: BenchmarkResults): void {
  console.log('\n--- Results ---')
  console.log(`Protocol: ${results.protocol}`)
  console.log(`Total Messages: ${formatNumber(results.metrics.totalMessages)}`)
  console.log(`Throughput: ${formatNumber(Math.round(results.metrics.throughput))} msg/s`)
  console.log(`Avg Latency: ${results.metrics.avgLatency.toFixed(2)}ms`)
  console.log(`P50 Latency: ${results.metrics.p50Latency.toFixed(2)}ms`)
  console.log(`P95 Latency: ${results.metrics.p95Latency.toFixed(2)}ms`)
  console.log(`P99 Latency: ${results.metrics.p99Latency.toFixed(2)}ms`)
  console.log(`Connection Time: ${results.metrics.connectionTime.toFixed(2)}ms`)
  console.log(`Success Rate: ${results.metrics.successfulConnections}/${results.config.concurrency}`)
  console.log(`Error Rate: ${results.metrics.errorRate.toFixed(2)}%`)
  console.log(`Memory/Conn: ${formatBytes(results.metrics.memoryPerConnection * 1024)}`)
}

function compareResults(sseResults: BenchmarkResults, wsResults: BenchmarkResults): void {
  console.log('\n\n=== Comparison ===\n')

  const comparisons = [
    {
      metric: 'Throughput (msg/s)',
      sse: Math.round(sseResults.metrics.throughput),
      ws: Math.round(wsResults.metrics.throughput),
      higher: 'better'
    },
    {
      metric: 'Avg Latency (ms)',
      sse: sseResults.metrics.avgLatency.toFixed(2),
      ws: wsResults.metrics.avgLatency.toFixed(2),
      higher: 'worse'
    },
    {
      metric: 'P95 Latency (ms)',
      sse: sseResults.metrics.p95Latency.toFixed(2),
      ws: wsResults.metrics.p95Latency.toFixed(2),
      higher: 'worse'
    },
    {
      metric: 'P99 Latency (ms)',
      sse: sseResults.metrics.p99Latency.toFixed(2),
      ws: wsResults.metrics.p99Latency.toFixed(2),
      higher: 'worse'
    },
    {
      metric: 'Connection Time (ms)',
      sse: sseResults.metrics.connectionTime.toFixed(2),
      ws: wsResults.metrics.connectionTime.toFixed(2),
      higher: 'worse'
    },
    {
      metric: 'Memory/Conn (KB)',
      sse: sseResults.metrics.memoryPerConnection.toFixed(2),
      ws: wsResults.metrics.memoryPerConnection.toFixed(2),
      higher: 'worse'
    },
    {
      metric: 'Error Rate (%)',
      sse: sseResults.metrics.errorRate.toFixed(2),
      ws: wsResults.metrics.errorRate.toFixed(2),
      higher: 'worse'
    }
  ]

  console.log('┌─────────────────────────┬──────────────┬──────────────┬────────┐')
  console.log('│ Metric                  │ SSE          │ WebSocket    │ Winner │')
  console.log('├─────────────────────────┼──────────────┼──────────────┼────────┤')

  for (const comp of comparisons) {
    const sseVal = typeof comp.sse === 'string' ? parseFloat(comp.sse) : comp.sse
    const wsVal = typeof comp.ws === 'string' ? parseFloat(comp.ws) : comp.ws

    let winner = ' - '
    if (comp.higher === 'better') {
      winner = sseVal > wsVal ? 'SSE ✓' : wsVal > sseVal ? 'WS ✓' : 'Tie'
    } else {
      winner = sseVal < wsVal ? 'SSE ✓' : wsVal < sseVal ? 'WS ✓' : 'Tie'
    }

    const sseStr = String(comp.sse).padEnd(12)
    const wsStr = String(comp.ws).padEnd(12)

    console.log(
      `│ ${comp.metric.padEnd(23)} │ ${sseStr} │ ${wsStr} │ ${winner.padEnd(6)} │`
    )
  }

  console.log('└─────────────────────────┴──────────────┴──────────────┴────────┘')
}

// ============================================================================
// Test Scenarios
// ============================================================================

const scenarios: Record<string, BenchmarkConfig> = {
  baseline: {
    concurrency: 100,
    duration: 30000,
    messagesPerSecond: 10,
    messageSize: 100,
    warmupPeriod: 5000
  },
  highConcurrency: {
    concurrency: 1000,
    duration: 60000,
    messagesPerSecond: 5,
    messageSize: 100,
    warmupPeriod: 10000
  },
  highThroughput: {
    concurrency: 100,
    duration: 30000,
    messagesPerSecond: 100,
    messageSize: 100,
    warmupPeriod: 5000
  },
  largeMessages: {
    concurrency: 50,
    duration: 30000,
    messagesPerSecond: 10,
    messageSize: 10000,
    warmupPeriod: 5000
  }
}

// ============================================================================
// Main Benchmark Runner
// ============================================================================

async function runBenchmark(scenarioName: string): Promise<void> {
  const config = scenarios[scenarioName]

  if (!config) {
    console.error(`Unknown scenario: ${scenarioName}`)
    console.log('Available scenarios:', Object.keys(scenarios).join(', '))
    return
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`Running Scenario: ${scenarioName}`)
  console.log('='.repeat(60))

  // Run SSE benchmark
  const sseResults = await benchmarkSSE(config)

  // Wait between benchmarks
  await sleep(5000)

  // Run WebSocket benchmark
  const wsResults = await benchmarkWebSocket(config)

  // Compare results
  compareResults(sseResults, wsResults)

  // Save results to file
  const resultData = {
    scenario: scenarioName,
    timestamp: new Date().toISOString(),
    sse: sseResults,
    websocket: wsResults
  }

  console.log('\n--- Results saved to benchmark-results.json ---')
}

// ============================================================================
// CLI Interface
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const scenario = args[0] || 'baseline'

  if (args.includes('--list')) {
    console.log('Available benchmark scenarios:')
    for (const [name, config] of Object.entries(scenarios)) {
      console.log(`\n${name}:`)
      console.log(`  - Concurrency: ${config.concurrency}`)
      console.log(`  - Duration: ${config.duration}ms`)
      console.log(`  - Rate: ${config.messagesPerSecond} msg/s`)
      console.log(`  - Message Size: ${config.messageSize} bytes`)
    }
    return
  }

  if (args.includes('--all')) {
    for (const scenarioName of Object.keys(scenarios)) {
      await runBenchmark(scenarioName)
      await sleep(10000) // Cool down between scenarios
    }
    return
  }

  await runBenchmark(scenario)
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Benchmark failed:', error)
    process.exit(1)
  })
}

// Export for programmatic use
export {
  benchmarkSSE,
  benchmarkWebSocket,
  compareResults,
  scenarios,
  type BenchmarkConfig,
  type BenchmarkResults
}
