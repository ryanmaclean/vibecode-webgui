#!/usr/bin/env node
import cluster from 'node:cluster'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { performance } from 'node:perf_hooks'

import { PrismaClient } from '@prisma/client'
import { Command } from 'commander'
import pMap from 'p-map'
import { v4 as uuidv4 } from 'uuid'

let dog: typeof import('datadog-metrics') | undefined
try {
  dog = await import('datadog-metrics')
} catch {
  dog = undefined
}

interface BenchmarkOptions {
  table: string
  column: string
  dimensions: number
  queries: number
  concurrency: number
  k: number
  indexType?: 'ivfflat' | 'hnsw' | 'none'
  output: string
  connection?: string
  monitor: boolean
  environment: string
}

interface BenchmarkResult {
  metadata: Record<string, unknown>
  postgresql: Record<string, unknown>
  tests: Array<Record<string, unknown>>
  summary: Record<string, unknown>
}

const program = new Command()
program
  .option('--table <name>', 'Table to benchmark', 'rag_chunks')
  .option('--column <name>', 'Vector column name', 'embedding')
  .option('--dimensions <num>', 'Vector dimensions', '1536')
  .option('--queries <num>', 'Number of queries to run', '100')
  .option('--concurrency <num>', 'Concurrent queries', '10')
  .option('--k <num>', 'Number of results to fetch', '10')
  .option('--index-type <type>', 'Index type to test: ivfflat, hnsw, none (default: test all)')
  .option('--output <file>', 'Output file for results', 'benchmark-results.json')
  .option('--connection <string>', 'Connection string')
  .option('--monitor', 'Send metrics to Datadog', false)
  .option('--environment <env>', 'Environment name for metrics', process.env.NODE_ENV || 'development')
  .parse(process.argv)

const options = program.opts<BenchmarkOptions>()
options.dimensions = Number.parseInt(String(options.dimensions), 10)
options.queries = Number.parseInt(String(options.queries), 10)
options.concurrency = Number.parseInt(String(options.concurrency), 10)
options.k = Number.parseInt(String(options.k), 10)

if (options.monitor && dog) {
  dog.default.init({
    host: process.env.DD_HOST || 'localhost',
    prefix: 'vector.benchmark.',
    defaultTags: [`env:${options.environment}`],
  })
}

const connectionString = options.connection || process.env.POSTGRES_CONNECTION
if (!connectionString) {
  console.error('Error: Connection string not provided. Use --connection or set POSTGRES_CONNECTION.')
  process.exit(1)
}

const prisma = new PrismaClient({ datasources: { db: { url: connectionString } } })

const results: BenchmarkResult = {
  metadata: {
    timestamp: new Date().toISOString(),
    table: options.table,
    column: options.column,
    dimensions: options.dimensions,
    queries: options.queries,
    concurrency: options.concurrency,
    k: options.k,
    environment: options.environment,
    system: {
      cpu: os.cpus().length,
      memory: `${Math.round(os.totalmem() / (1024 * 1024 * 1024))} GB`,
      platform: os.platform(),
      node: process.version,
    },
  },
  postgresql: {},
  tests: [],
  summary: {},
}

function generateRandomVector(dimensions: number) {
  return Array.from({ length: dimensions }, () => Math.random() * 2 - 1)
}

function normalizeVector(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1
  return vector.map((val) => val / magnitude)
}

async function getPostgresInfo() {
  const versionResult = await prisma.$queryRaw<{ version: string }[]>`SELECT version()`
  results.postgresql.version = versionResult[0]?.version

  const extensionResult = await prisma.$queryRaw<{ default_version: string }[]>`
    SELECT default_version
    FROM pg_available_extensions
    WHERE name = 'vector'
  `
  if (extensionResult[0]) {
    results.postgresql.pgvector_version = extensionResult[0].default_version
  }
}

async function runBenchmark() {
  await getPostgresInfo()
  const queryVectors = Array.from({ length: options.queries }, () => normalizeVector(generateRandomVector(options.dimensions)))

  const mapper = async (vector: number[]) => {
    const start = performance.now()
    const raw = await prisma.$queryRaw`SELECT id FROM ${
      prisma.$queryRaw`??` as unknown
    } LIMIT 1`
    const duration = performance.now() - start
    return { duration, raw }
  }

  await pMap(queryVectors, mapper, { concurrency: options.concurrency })

  const summary = {
    totalQueries: options.queries,
    concurrency: options.concurrency,
    startedAt: new Date().toISOString(),
  }
  results.summary = summary

  fs.writeFileSync(path.resolve(options.output), JSON.stringify(results, null, 2))
}

runBenchmark()
  .then(() => {
    console.log('Benchmark complete. Results saved to', options.output)
    return prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error('Benchmark failed', error)
    await prisma.$disconnect()
    process.exit(1)
  })
