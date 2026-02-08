/**
 * Unit Tests for API Response Utilities
 * Tests RFC 7807 Problem Details, success/error responses, and helper functions
 */

import {
  getErrorMessage,
  getTimestamp,
  generateTraceId,
  createSuccessResponse,
  createProblemResponse,
  createErrorResponse,
  createErrorResponseFromError,
  createHealthResponse,
  createValidationErrorResponse,
  ApiErrors,
} from '@/lib/utils/api-response'

// Suppress console output during tests
beforeAll(() => {
  jest.spyOn(console, 'info').mockImplementation()
  jest.spyOn(console, 'error').mockImplementation()
})

afterAll(() => {
  jest.restoreAllMocks()
})

describe('API Response Utilities', () => {
  describe('getErrorMessage', () => {
    it('should extract message from Error instance', () => {
      expect(getErrorMessage(new Error('test error'))).toBe('test error')
    })

    it('should return Unknown error for non-Error values', () => {
      expect(getErrorMessage('string error')).toBe('Unknown error')
      expect(getErrorMessage(42)).toBe('Unknown error')
      expect(getErrorMessage(null)).toBe('Unknown error')
      expect(getErrorMessage(undefined)).toBe('Unknown error')
    })
  })

  describe('getTimestamp', () => {
    it('should return ISO 8601 timestamp', () => {
      const ts = getTimestamp()
      expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })
  })

  describe('generateTraceId', () => {
    it('should generate trace ID with prefix', () => {
      const traceId = generateTraceId()
      expect(traceId).toMatch(/^trace-\d+-[a-z0-9]+$/)
    })

    it('should generate unique trace IDs', () => {
      const ids = new Set<string>()
      for (let i = 0; i < 10; i++) {
        ids.add(generateTraceId())
      }
      expect(ids.size).toBe(10)
    })
  })

  describe('createSuccessResponse', () => {
    it('should create 200 response with data', async () => {
      const response = createSuccessResponse({ items: [1, 2, 3] })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.items).toEqual([1, 2, 3])
      expect(data.meta).toBeDefined()
      expect(data.meta.traceId).toBeDefined()
      expect(data.meta.timestamp).toBeDefined()
    })

    it('should accept custom status code', async () => {
      const response = createSuccessResponse({ created: true }, { status: 201 })
      expect(response.status).toBe(201)
    })

    it('should accept custom traceId', async () => {
      const response = createSuccessResponse({}, { traceId: 'custom-trace' })
      const data = await response.json()
      expect(data.meta.traceId).toBe('custom-trace')
    })

    it('should accept additional fields', async () => {
      const response = createSuccessResponse({}, {
        additionalFields: { message: 'Item created' },
      })
      const data = await response.json()
      expect(data.message).toBe('Item created')
    })

    it('should accept custom meta fields', async () => {
      const response = createSuccessResponse({}, {
        meta: { requestCount: 5 },
      })
      const data = await response.json()
      expect(data.meta.requestCount).toBe(5)
    })
  })

  describe('createProblemResponse', () => {
    it('should create RFC 7807 compliant error response', async () => {
      const response = createProblemResponse({
        title: 'Bad Request',
        status: 400,
        detail: 'Missing required field: name',
        code: 'VALIDATION_ERROR',
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.title).toBe('Bad Request')
      expect(data.status).toBe(400)
      expect(data.detail).toBe('Missing required field: name')
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toBe('Missing required field: name')
      expect(data.timestamp).toBeDefined()
      expect(data.traceId).toBeDefined()
    })

    it('should set content type header', () => {
      const response = createProblemResponse({
        title: 'Error',
        status: 500,
      })
      // NextResponse.json sets Content-Type to application/json by default
      // The application/problem+json is passed but may be overridden
      expect(response.headers.get('Content-Type')).toContain('application/json')
    })

    it('should include custom headers', () => {
      const response = createProblemResponse({
        title: 'Rate Limited',
        status: 429,
        headers: { 'Retry-After': '60' },
      })
      expect(response.headers.get('Retry-After')).toBe('60')
    })

    it('should default type to httpstatuses.com URL', async () => {
      const response = createProblemResponse({
        title: 'Not Found',
        status: 404,
      })
      const data = await response.json()
      expect(data.type).toBe('https://httpstatuses.com/404')
    })

    it('should include extensions in response body', async () => {
      const response = createProblemResponse({
        title: 'Validation Error',
        status: 422,
        extensions: { fields: ['name', 'email'] },
      })
      const data = await response.json()
      expect(data.fields).toEqual(['name', 'email'])
    })

    it('should format error code from status when code is not provided', async () => {
      const response = createProblemResponse({
        title: 'Unauthorized',
        status: 401,
      })
      const data = await response.json()
      expect(data.error.code).toBe('UNAUTHORIZED')
    })

    it('should normalize custom code to uppercase with underscores', async () => {
      const response = createProblemResponse({
        title: 'Error',
        status: 400,
        code: 'invalid-input format',
      })
      const data = await response.json()
      expect(data.error.code).toBe('INVALID_INPUT_FORMAT')
    })
  })

  describe('createErrorResponse (legacy)', () => {
    it('should create error response from message and status', async () => {
      const response = createErrorResponse('Something went wrong', 500)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.title).toBe('Something went wrong')
    })

    it('should pass through code from additional fields', async () => {
      const response = createErrorResponse('Not Found', 404, { code: 'RESOURCE_NOT_FOUND' })
      const data = await response.json()
      expect(data.error.code).toBe('RESOURCE_NOT_FOUND')
    })

    it('should pass through detail from additional fields', async () => {
      const response = createErrorResponse('Error', 400, { detail: 'Field X is required' })
      const data = await response.json()
      expect(data.detail).toBe('Field X is required')
    })

    it('should default to status 500', async () => {
      const response = createErrorResponse('Server Error')
      expect(response.status).toBe(500)
    })
  })

  describe('createErrorResponseFromError', () => {
    it('should extract Error message', async () => {
      const response = createErrorResponseFromError(new Error('DB connection failed'), 500)
      const data = await response.json()
      expect(data.detail).toBe('DB connection failed')
    })

    it('should use Unknown error for non-Error values', async () => {
      const response = createErrorResponseFromError('string error', 500)
      const data = await response.json()
      expect(data.detail).toBe('Unknown error')
    })

    it('should use fallback message as title', async () => {
      const response = createErrorResponseFromError(new Error('oops'), 500, 'Something broke')
      const data = await response.json()
      expect(data.title).toBe('Something broke')
    })

    it('should pass through traceId', async () => {
      const response = createErrorResponseFromError(new Error('err'), 500, 'Error', 'my-trace')
      const data = await response.json()
      expect(data.traceId).toBe('my-trace')
    })
  })

  describe('createHealthResponse', () => {
    it('should return 200 for healthy status', () => {
      const response = createHealthResponse('healthy')
      expect(response.status).toBe(200)
    })

    it('should return 200 for ready status', () => {
      const response = createHealthResponse('ready')
      expect(response.status).toBe(200)
    })

    it('should return 503 for unhealthy status', () => {
      const response = createHealthResponse('unhealthy')
      expect(response.status).toBe(503)
    })

    it('should return 503 for not ready status', () => {
      const response = createHealthResponse('not ready')
      expect(response.status).toBe(503)
    })

    it('should include additional data', async () => {
      const response = createHealthResponse('healthy', { uptime: 3600, version: '1.0.0' })
      const data = await response.json()
      expect(data.data.uptime).toBe(3600)
      expect(data.data.version).toBe('1.0.0')
    })
  })

  describe('createValidationErrorResponse', () => {
    it('should return 422 with validation errors', async () => {
      const errors = [
        { field: 'email', message: 'Invalid email format' },
        { field: 'name', message: 'Name is required' },
      ]
      const response = createValidationErrorResponse(errors)
      const data = await response.json()

      expect(response.status).toBe(422)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.errors).toHaveLength(2)
      expect(data.errors[0].field).toBe('email')
    })
  })

  describe('ApiErrors helpers', () => {
    it('should create 400 Bad Request', async () => {
      const response = ApiErrors.badRequest('Invalid input')
      const data = await response.json()
      expect(response.status).toBe(400)
      expect(data.error.code).toBe('BAD_REQUEST')
      expect(data.detail).toBe('Invalid input')
    })

    it('should create 401 Unauthorized', async () => {
      const response = ApiErrors.unauthorized()
      expect(response.status).toBe(401)
    })

    it('should create 403 Forbidden', async () => {
      const response = ApiErrors.forbidden()
      expect(response.status).toBe(403)
    })

    it('should create 404 Not Found', async () => {
      const response = ApiErrors.notFound('Resource does not exist')
      const data = await response.json()
      expect(response.status).toBe(404)
      expect(data.detail).toBe('Resource does not exist')
    })

    it('should create 405 Method Not Allowed', async () => {
      const response = ApiErrors.methodNotAllowed(['GET', 'POST'])
      const data = await response.json()
      expect(response.status).toBe(405)
      expect(data.detail).toContain('GET, POST')
    })

    it('should create 409 Conflict', async () => {
      const response = ApiErrors.conflict()
      expect(response.status).toBe(409)
    })

    it('should create 422 Unprocessable Entity', async () => {
      const response = ApiErrors.unprocessableEntity()
      expect(response.status).toBe(422)
    })

    it('should create 429 Too Many Requests', async () => {
      const response = ApiErrors.tooManyRequests()
      expect(response.status).toBe(429)
    })

    it('should create 500 Internal Server Error', async () => {
      const response = ApiErrors.internalServerError()
      expect(response.status).toBe(500)
    })

    it('should create 503 Service Unavailable', async () => {
      const response = ApiErrors.serviceUnavailable()
      expect(response.status).toBe(503)
    })

    it('should accept custom traceId', async () => {
      const response = ApiErrors.badRequest('err', 'trace-123')
      const data = await response.json()
      expect(data.traceId).toBe('trace-123')
    })
  })
})
