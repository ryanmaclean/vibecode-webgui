/**
 * Embeddings Monitoring API Endpoint
 * Returns real process metrics for embedding service health
 */

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const detailed = url.searchParams.get('detailed') === 'true'

    const memUsage = process.memoryUsage()
    const uptime = process.uptime()

    const metrics = {
      status: 'operational',
      timestamp: new Date().toISOString(),
      service: 'embeddings',
      uptime: Math.round(uptime),
      memory: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
      },
      ...(detailed && {
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
        },
      }),
    }

    return NextResponse.json(metrics)
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: 'Failed to collect embeddings metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
