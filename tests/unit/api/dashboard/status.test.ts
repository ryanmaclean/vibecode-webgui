/**
 * Dashboard Status API Route Tests
 * Tests the /api/dashboard/status endpoint
 *
 * AGENT 92: Enhanced Monitoring Dashboards Foundation
 */

describe('GET /api/dashboard/status', () => {
  let GET: () => Promise<Response>

  beforeEach(async () => {
    // Import the route module
    const routeModule = await import('@/app/api/dashboard/status/route')
    GET = routeModule.GET
  })

  it('should return system status information', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty('timestamp')
    expect(data).toHaveProperty('version')
    expect(data).toHaveProperty('environment')
    expect(data).toHaveProperty('deployment')
    expect(data).toHaveProperty('resources')
  })

  it('should include version information', async () => {
    const response = await GET()
    const data = await response.json()

    expect(data.version).toHaveProperty('app')
    expect(data.version).toHaveProperty('node')
    expect(data.version).toHaveProperty('platform')

    expect(typeof data.version.app).toBe('string')
    expect(typeof data.version.node).toBe('string')
    expect(typeof data.version.platform).toBe('string')

    // Node version should start with 'v'
    expect(data.version.node).toMatch(/^v\d+/)
  })

  it('should include environment name', async () => {
    const response = await GET()
    const data = await response.json()

    expect(typeof data.environment).toBe('string')
    expect(['development', 'test', 'production']).toContain(data.environment)
  })

  it('should include deployment information', async () => {
    const response = await GET()
    const data = await response.json()

    expect(data.deployment).toHaveProperty('platform')
    expect(data.deployment).toHaveProperty('region')

    expect(typeof data.deployment.platform).toBe('string')
    expect(typeof data.deployment.region).toBe('string')
  })

  it('should include memory resource information', async () => {
    const response = await GET()
    const data = await response.json()

    expect(data.resources).toHaveProperty('memory')
    expect(data.resources.memory).toHaveProperty('rss')
    expect(data.resources.memory).toHaveProperty('heapTotal')
    expect(data.resources.memory).toHaveProperty('heapUsed')
    expect(data.resources.memory).toHaveProperty('external')
    expect(data.resources.memory).toHaveProperty('arrayBuffers')

    // All memory values should be positive numbers
    expect(data.resources.memory.rss).toBeGreaterThan(0)
    expect(data.resources.memory.heapTotal).toBeGreaterThan(0)
    expect(data.resources.memory.heapUsed).toBeGreaterThan(0)
  })

  it('should include CPU information', async () => {
    const response = await GET()
    const data = await response.json()

    expect(data.resources).toHaveProperty('cpu')
    expect(data.resources.cpu).toHaveProperty('count')
    expect(data.resources.cpu).toHaveProperty('loadAverage')
    expect(data.resources.cpu).toHaveProperty('model')

    expect(data.resources.cpu.count).toBeGreaterThan(0)
    expect(Array.isArray(data.resources.cpu.loadAverage)).toBe(true)
    expect(data.resources.cpu.loadAverage.length).toBe(3)
    expect(typeof data.resources.cpu.model).toBe('string')
  })

  it('should include uptime in seconds', async () => {
    const response = await GET()
    const data = await response.json()

    expect(data.resources).toHaveProperty('uptime')
    expect(typeof data.resources.uptime).toBe('number')
    expect(data.resources.uptime).toBeGreaterThanOrEqual(0)
  })

  it('should return valid ISO timestamp', async () => {
    const response = await GET()
    const data = await response.json()

    const timestamp = new Date(data.timestamp)
    expect(timestamp.getTime()).toBeGreaterThan(0)
    expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  it('should detect platform correctly', async () => {
    const response = await GET()
    const data = await response.json()

    const validPlatforms = ['darwin', 'linux', 'win32', 'freebsd', 'openbsd']
    expect(validPlatforms).toContain(data.version.platform)
  })

  it('should format memory values as MB integers', async () => {
    const response = await GET()
    const data = await response.json()

    // Check that memory values are integers (rounded MB)
    expect(Number.isInteger(data.resources.memory.rss)).toBe(true)
    expect(Number.isInteger(data.resources.memory.heapTotal)).toBe(true)
    expect(Number.isInteger(data.resources.memory.heapUsed)).toBe(true)
  })

  it('should round load averages to 2 decimal places', async () => {
    const response = await GET()
    const data = await response.json()

    data.resources.cpu.loadAverage.forEach((load: number) => {
      const decimalPlaces = (load.toString().split('.')[1] || '').length
      expect(decimalPlaces).toBeLessThanOrEqual(2)
    })
  })

  it('should handle concurrent requests', async () => {
    const requests = Array(5).fill(null).map(() => GET())
    const responses = await Promise.all(requests)

    responses.forEach(async (response) => {
      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toHaveProperty('timestamp')
    })
  })

  it('should return consistent structure across multiple calls', async () => {
    const response1 = await GET()
    const data1 = await response1.json()

    const response2 = await GET()
    const data2 = await response2.json()

    // Same keys in both responses
    expect(Object.keys(data1).sort()).toEqual(Object.keys(data2).sort())
    expect(Object.keys(data1.version).sort()).toEqual(Object.keys(data2.version).sort())
    expect(Object.keys(data1.resources).sort()).toEqual(Object.keys(data2.resources).sort())
  })
})
