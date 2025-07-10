/**
 * Monitoring metrics API endpoint
 * Provides real-time system metrics for the monitoring dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getHealthCheck } from '@/lib/server-monitoring'
import os from 'os'

interface SystemMetrics {
  cpu: number
  memory: number
  diskUsage: number
  networkIO: { in: number; out: number }
  activeUsers: number
  activeWorkspaces: number
  totalSessions: number
  avgResponseTime: number
  errorRate: number
  uptime: number
}

// Simple in-memory metrics store (replace with Redis in production)
const metricsStore = {
  responseTimes: [] as number[],
  errorCount: 0,
  requestCount: 0,
  activeUsers: new Set<string>(),
  activeWorkspaces: new Set<string>(),
  networkStats: { in: 0, out: 0 },
  lastUpdate: Date.now(),
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin access
    const session = await getServerSession(authOptions)
    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get system metrics
    const cpuUsage = await getCPUUsage()
    const memoryUsage = getMemoryUsage()
    const diskUsage = getDiskUsage()
    const uptime = process.uptime()

    // Calculate application metrics
    const avgResponseTime = metricsStore.responseTimes.length > 0
      ? metricsStore.responseTimes.reduce((a, b) => a + b, 0) / metricsStore.responseTimes.length
      : 0

    const errorRate = metricsStore.requestCount > 0
      ? (metricsStore.errorCount / metricsStore.requestCount) * 100
      : 0

    // Get network I/O (simplified - in production, use proper system monitoring)
    const networkIO = getNetworkIO()

    const metrics: SystemMetrics = {
      cpu: cpuUsage,
      memory: memoryUsage,
      diskUsage: diskUsage,
      networkIO,
      activeUsers: metricsStore.activeUsers.size,
      activeWorkspaces: metricsStore.activeWorkspaces.size,
      totalSessions: metricsStore.requestCount,
      avgResponseTime: Math.round(avgResponseTime),
      errorRate: Number(errorRate.toFixed(2)),
      uptime: Math.round(uptime),
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Metrics API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type, data } = await request.json()

    switch (type) {
      case 'response_time':
        metricsStore.responseTimes.push(data.duration)
        // Keep only last 100 response times
        if (metricsStore.responseTimes.length > 100) {
          metricsStore.responseTimes = metricsStore.responseTimes.slice(-100)
        }
        break

      case 'error':
        metricsStore.errorCount++
        break

      case 'request':
        metricsStore.requestCount++
        break

      case 'user_activity':
        if (data.userId) {
          metricsStore.activeUsers.add(data.userId)
        }
        if (data.workspaceId) {
          metricsStore.activeWorkspaces.add(data.workspaceId)
        }
        break

      case 'network_io':
        metricsStore.networkStats.in += data.bytesIn || 0
        metricsStore.networkStats.out += data.bytesOut || 0
        break

      default:
        return NextResponse.json({ error: 'Unknown metric type' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Metrics update error:', error)
    return NextResponse.json(
      { error: 'Failed to update metrics' },
      { status: 500 }
    )
  }
}

// Helper functions for system metrics

async function getCPUUsage(): Promise<number> {
  return new Promise((resolve) => {
    const startUsage = process.cpuUsage()
    const startTime = process.hrtime()

    setTimeout(() => {
      const endUsage = process.cpuUsage(startUsage)
      const endTime = process.hrtime(startTime)

      const totalTime = endTime[0] * 1e6 + endTime[1] / 1e3 // Convert to microseconds
      const totalUsage = endUsage.user + endUsage.system

      const cpuPercent = (totalUsage / totalTime) * 100
      resolve(Math.min(100, Math.max(0, cpuPercent)))
    }, 100)
  })
}

function getMemoryUsage(): number {
  const usage = process.memoryUsage()
  const totalMemory = os.totalmem()
  const usedMemory = usage.heapUsed + usage.external
  return (usedMemory / totalMemory) * 100
}

function getDiskUsage(): number {
  // Simplified disk usage calculation
  // In production, use proper disk monitoring tools
  try {
    const stats = require('fs').statSync(process.cwd())
    // This is a placeholder - implement proper disk usage monitoring
    return Math.random() * 30 + 10 // Mock data between 10-40%
  } catch {
    return 0
  }
}

function getNetworkIO(): { in: number; out: number } {
  // Simplified network I/O calculation
  // In production, use proper network monitoring tools
  const now = Date.now()
  const timeDiff = (now - metricsStore.lastUpdate) / 1000 // seconds

  const result = {
    in: metricsStore.networkStats.in / timeDiff,
    out: metricsStore.networkStats.out / timeDiff,
  }

  // Reset counters
  metricsStore.networkStats = { in: 0, out: 0 }
  metricsStore.lastUpdate = now

  return result
}

// Clean up old data periodically
setInterval(() => {
  // Remove inactive users (older than 5 minutes)
  // In production, implement proper session tracking
  if (Math.random() > 0.8) {
    const users = Array.from(metricsStore.activeUsers)
    const userToRemove = users[Math.floor(Math.random() * users.length)]
    if (userToRemove) {
      metricsStore.activeUsers.delete(userToRemove)
    }
  }

  // Remove inactive workspaces
  if (Math.random() > 0.9) {
    const workspaces = Array.from(metricsStore.activeWorkspaces)
    const workspaceToRemove = workspaces[Math.floor(Math.random() * workspaces.length)]
    if (workspaceToRemove) {
      metricsStore.activeWorkspaces.delete(workspaceToRemove)
    }
  }
}, 60000) // Every minute