/**
 * AI Metrics Export API Endpoint
 * Provides cost report exports in CSV and JSON formats
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkMonitoringAuth, getUnauthorizedResponse } from '@/lib/monitoring/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Check authentication
  const authResult = await checkMonitoringAuth(request)
  if (!authResult.isAuthorized) {
    return getUnauthorizedResponse(authResult.error)
  }

  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'
    const period = searchParams.get('period') || '30d'
    const model = searchParams.get('model') // optional filter
    const provider = searchParams.get('provider') // optional filter

    // Validate format
    if (!['csv', 'json'].includes(format.toLowerCase())) {
      return NextResponse.json({
        error: 'Invalid format',
        message: 'Format must be either "csv" or "json"',
        timestamp: new Date().toISOString()
      }, { status: 400 })
    }

    // Fetch cost report data
    const costData = await getCostReportData(period, model, provider)

    // Return data based on format
    if (format.toLowerCase() === 'csv') {
      const csv = convertToCSV(costData)
      const filename = `ai-cost-report-${period}-${new Date().toISOString().split('T')[0]}.csv`

      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-cache'
        }
      })
    } else {
      const filename = `ai-cost-report-${period}-${new Date().toISOString().split('T')[0]}.json`

      return new NextResponse(JSON.stringify(costData, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-cache'
        }
      })
    }

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to export cost report',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * Parse period string to Date object
 * Supports: 1h, 6h, 12h, 24h, 7d, 30d, 90d
 */
function parsePeriodToDate(period: string): Date {
  const now = new Date()
  const match = period.match(/^(\d+)([hd])$/)

  if (!match) {
    // Default to 30 days if invalid format
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  }

  const value = parseInt(match[1])
  const unit = match[2]

  if (unit === 'h') {
    return new Date(now.getTime() - value * 60 * 60 * 1000)
  } else if (unit === 'd') {
    return new Date(now.getTime() - value * 24 * 60 * 60 * 1000)
  }

  return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
}

/**
 * Fetch cost report data from database
 */
async function getCostReportData(
  period: string,
  modelFilter?: string | null,
  providerFilter?: string | null
) {
  const startDate = parsePeriodToDate(period)
  const endDate = new Date()

  // Build filter conditions
  const whereClause: {
    created_at: { gte: Date }
    model?: string
    provider?: string
  } = {
    created_at: { gte: startDate }
  }

  if (modelFilter) {
    whereClause.model = modelFilter
  }

  if (providerFilter) {
    whereClause.provider = providerFilter
  }

  // Fetch all AI requests within the time period
  const requests = await prisma.aIRequest.findMany({
    where: whereClause,
    select: {
      id: true,
      model: true,
      provider: true,
      request_type: true,
      input_tokens: true,
      output_tokens: true,
      cost: true,
      duration_ms: true,
      status: true,
      created_at: true
    },
    orderBy: {
      created_at: 'desc'
    }
  })

  // Aggregate by model and provider
  const modelStats = new Map<string, {
    model: string
    provider: string
    requestCount: number
    totalInputTokens: number
    totalOutputTokens: number
    totalTokens: number
    totalCost: number
    avgCostPerRequest: number
    avgTokensPerRequest: number
    successCount: number
    errorCount: number
    errorRate: number
    avgDuration: number
  }>()

  // Process each request
  requests.forEach(req => {
    const key = `${req.model}-${req.provider}`

    if (!modelStats.has(key)) {
      modelStats.set(key, {
        model: req.model,
        provider: req.provider,
        requestCount: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalCost: 0,
        avgCostPerRequest: 0,
        avgTokensPerRequest: 0,
        successCount: 0,
        errorCount: 0,
        errorRate: 0,
        avgDuration: 0
      })
    }

    const stats = modelStats.get(key)!
    stats.requestCount++
    stats.totalInputTokens += req.input_tokens || 0
    stats.totalOutputTokens += req.output_tokens || 0
    stats.totalTokens += (req.input_tokens || 0) + (req.output_tokens || 0)
    stats.totalCost += req.cost || 0

    if (req.status === 'completed') {
      stats.successCount++
    } else {
      stats.errorCount++
    }
  })

  // Calculate averages and format data
  const costBreakdown = Array.from(modelStats.values()).map(stats => {
    stats.avgCostPerRequest = stats.requestCount > 0 ? stats.totalCost / stats.requestCount : 0
    stats.avgTokensPerRequest = stats.requestCount > 0 ? stats.totalTokens / stats.requestCount : 0
    stats.errorRate = stats.requestCount > 0 ? stats.errorCount / stats.requestCount : 0
    return stats
  }).sort((a, b) => b.totalCost - a.totalCost) // Sort by total cost descending

  // Calculate totals
  const totalRequests = requests.length
  const totalInputTokens = requests.reduce((sum, req) => sum + (req.input_tokens || 0), 0)
  const totalOutputTokens = requests.reduce((sum, req) => sum + (req.output_tokens || 0), 0)
  const totalCost = requests.reduce((sum, req) => sum + (req.cost || 0), 0)
  const errorCount = requests.filter(req => req.status !== 'completed').length

  return {
    metadata: {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      generatedAt: new Date().toISOString(),
      filters: {
        model: modelFilter || 'all',
        provider: providerFilter || 'all'
      }
    },
    summary: {
      totalRequests,
      totalInputTokens,
      totalOutputTokens,
      totalTokens: totalInputTokens + totalOutputTokens,
      totalCost,
      avgCostPerRequest: totalRequests > 0 ? totalCost / totalRequests : 0,
      avgTokensPerRequest: totalRequests > 0 ? (totalInputTokens + totalOutputTokens) / totalRequests : 0,
      errorCount,
      errorRate: totalRequests > 0 ? errorCount / totalRequests : 0
    },
    breakdown: costBreakdown
  }
}

/**
 * Convert cost report data to CSV format
 */
function convertToCSV(data: ReturnType<typeof getCostReportData> extends Promise<infer T> ? T : never): string {
  const lines: string[] = []

  // Add metadata section
  lines.push('# AI Cost Report')
  lines.push(`# Period: ${data.metadata.period}`)
  lines.push(`# Start Date: ${data.metadata.startDate}`)
  lines.push(`# End Date: ${data.metadata.endDate}`)
  lines.push(`# Generated At: ${data.metadata.generatedAt}`)
  lines.push(`# Model Filter: ${data.metadata.filters.model}`)
  lines.push(`# Provider Filter: ${data.metadata.filters.provider}`)
  lines.push('')

  // Add summary section
  lines.push('# Summary')
  lines.push('Metric,Value')
  lines.push(`Total Requests,${data.summary.totalRequests}`)
  lines.push(`Total Input Tokens,${data.summary.totalInputTokens}`)
  lines.push(`Total Output Tokens,${data.summary.totalOutputTokens}`)
  lines.push(`Total Tokens,${data.summary.totalTokens}`)
  lines.push(`Total Cost,$${data.summary.totalCost.toFixed(4)}`)
  lines.push(`Avg Cost Per Request,$${data.summary.avgCostPerRequest.toFixed(4)}`)
  lines.push(`Avg Tokens Per Request,${data.summary.avgTokensPerRequest.toFixed(0)}`)
  lines.push(`Error Count,${data.summary.errorCount}`)
  lines.push(`Error Rate,${(data.summary.errorRate * 100).toFixed(2)}%`)
  lines.push('')

  // Add breakdown section header
  lines.push('# Cost Breakdown by Model and Provider')
  lines.push('Model,Provider,Requests,Input Tokens,Output Tokens,Total Tokens,Total Cost,Avg Cost/Request,Avg Tokens/Request,Success Count,Error Count,Error Rate')

  // Add breakdown data
  data.breakdown.forEach(item => {
    lines.push([
      item.model,
      item.provider,
      item.requestCount,
      item.totalInputTokens,
      item.totalOutputTokens,
      item.totalTokens,
      `$${item.totalCost.toFixed(4)}`,
      `$${item.avgCostPerRequest.toFixed(4)}`,
      item.avgTokensPerRequest.toFixed(0),
      item.successCount,
      item.errorCount,
      `${(item.errorRate * 100).toFixed(2)}%`
    ].join(','))
  })

  return lines.join('\n')
}
