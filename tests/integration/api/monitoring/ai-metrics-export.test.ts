/**
 * Integration tests for /api/monitoring/ai-metrics/export endpoint
 * Tests CSV and JSON export functionality
 */

import { GET } from '@/app/api/monitoring/ai-metrics/export/route'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

jest.mock('@/lib/prisma')
jest.mock('@/lib/monitoring/auth', () => ({
  checkMonitoringAuth: jest.fn().mockResolvedValue({ isAuthorized: true }),
  getUnauthorizedResponse: jest.fn()
}))

describe('GET /api/monitoring/ai-metrics/export', () => {
  const mockAIRequests = [
    {
      id: '1',
      model: 'gpt-4',
      provider: 'openai',
      request_type: 'chat',
      input_tokens: 100,
      output_tokens: 50,
      cost: 0.005,
      duration_ms: 1200,
      status: 'success',
      created_at: new Date('2026-02-23T10:00:00Z')
    }
  ]

  beforeEach(() => {
    jest.clearAllMocks()
    ;(prisma.aIRequest.findMany as jest.Mock).mockResolvedValue(mockAIRequests)
  })

  test('returns CSV format by default', async () => {
    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics/export?period=30d')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/csv')
    expect(response.headers.get('Content-Disposition')).toContain('attachment')
    expect(response.headers.get('Content-Disposition')).toContain('.csv')
  })

  test('returns JSON format when specified', async () => {
    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics/export?period=30d&format=json')
    const response = await GET(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/json')
    expect(response.headers.get('Content-Disposition')).toContain('.json')
  })

  test('CSV includes proper headers', async () => {
    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics/export?period=30d&format=csv')
    const response = await GET(request)
    const csvText = await response.text()

    expect(csvText).toContain('Model')
    expect(csvText).toContain('Provider')
    expect(csvText).toContain('Total Cost')
    expect(csvText).toContain('Request Count')
    expect(csvText).toContain('Avg Cost/Request')
  })

  test('CSV data is properly formatted', async () => {
    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics/export?period=30d&format=csv')
    const response = await GET(request)
    const csvText = await response.text()

    expect(csvText).toContain('gpt-4')
    expect(csvText).toContain('openai')
    expect(csvText).toContain('0.005')
  })

  test('JSON includes comprehensive metadata', async () => {
    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics/export?period=30d&format=json')
    const response = await GET(request)
    const jsonData = await response.json()

    expect(jsonData).toHaveProperty('metadata')
    expect(jsonData.metadata).toHaveProperty('exportDate')
    expect(jsonData.metadata).toHaveProperty('period')
    expect(jsonData.metadata).toHaveProperty('startDate')
    expect(jsonData.metadata).toHaveProperty('endDate')
  })

  test('JSON includes summary statistics', async () => {
    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics/export?period=30d&format=json')
    const response = await GET(request)
    const jsonData = await response.json()

    expect(jsonData).toHaveProperty('summary')
    expect(jsonData.summary).toHaveProperty('totalCost')
    expect(jsonData.summary).toHaveProperty('totalRequests')
  })

  test('JSON includes detailed cost breakdown', async () => {
    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics/export?period=30d&format=json')
    const response = await GET(request)
    const jsonData = await response.json()

    expect(jsonData).toHaveProperty('costBreakdown')
    expect(Array.isArray(jsonData.costBreakdown)).toBe(true)
  })

  test('supports different period values', async () => {
    const periods = ['1h', '6h', '12h', '24h', '7d', '30d', '90d']

    for (const period of periods) {
      const request = new NextRequest(`http://localhost:3000/api/monitoring/ai-metrics/export?period=${period}`)
      const response = await GET(request)

      expect(response.status).toBe(200)
    }
  })

  test('filename includes date and period', async () => {
    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics/export?period=7d')
    const response = await GET(request)

    const disposition = response.headers.get('Content-Disposition')
    expect(disposition).toMatch(/ai-cost-report-\d{4}-\d{2}-\d{2}/)
    expect(disposition).toContain('7d')
  })

  test('handles authentication failure', async () => {
    const { checkMonitoringAuth, getUnauthorizedResponse } = require('@/lib/monitoring/auth')
    checkMonitoringAuth.mockResolvedValueOnce({ isAuthorized: false, error: 'Unauthorized' })
    getUnauthorizedResponse.mockReturnValueOnce(new Response('Unauthorized', { status: 401 }))

    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics/export?period=30d')
    const response = await GET(request)

    expect(response.status).toBe(401)
  })

  test('handles database errors gracefully', async () => {
    ;(prisma.aIRequest.findMany as jest.Mock).mockRejectedValueOnce(new Error('Database error'))

    const request = new NextRequest('http://localhost:3000/api/monitoring/ai-metrics/export?period=30d')
    const response = await GET(request)

    expect(response.status).toBe(500)
  })
})
