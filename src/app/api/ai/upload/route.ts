/**
 * AI File Upload API
 * Handles file uploads for AI context with comprehensive security validation
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { z } from '@/lib/zod-compat'
import { createAPIRateLimit } from '@/lib/rate-limiting'

export const dynamic = 'force-dynamic'

// Rate limiting
const apiRateLimit = createAPIRateLimit(20) // 20 requests per minute for upload endpoints (more restrictive)

// File upload limits
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const MAX_TOTAL_SIZE = 50 * 1024 * 1024 // 50MB
const MAX_FILE_COUNT = 10

// Allowed MIME types for AI context
const ALLOWED_MIME_TYPES = [
  'text/plain',
  'text/javascript',
  'text/typescript',
  'application/json',
  'text/html',
  'text/css',
  'text/markdown',
  'application/xml',
  'text/xml',
  'application/yaml',
  'text/yaml',
]

/**
 * Validate filename for security issues
 */
function validateFilename(filename: string): { valid: boolean; error?: string } {
  // Check for directory traversal
  if (filename.includes('../') || filename.includes('..\\') || filename.includes('..')) {
    return { valid: false, error: 'Invalid filename: directory traversal detected' }
  }

  // Check for null bytes
  if (filename.includes('\0')) {
    return { valid: false, error: 'Invalid filename: null byte detected' }
  }

  // Check for path separators
  if (filename.includes('/') || filename.includes('\\')) {
    return { valid: false, error: 'Invalid filename: path separators not allowed' }
  }

  // Check for excessive length
  if (filename.length > 255) {
    return { valid: false, error: 'Invalid filename: too long' }
  }

  return { valid: true }
}

/**
 * Validate MIME type
 */
function validateMimeType(mimeType: string): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`
    }
  }
  return { valid: true }
}

/**
 * Get allowed CORS origins from environment or defaults
 */
function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS
  if (envOrigins) {
    return envOrigins.split(',').map(origin => origin.trim()).filter(Boolean)
  }
  // Default allowed origins for file uploads
  return [
    'https://vibecode.dev',
    'http://localhost:3000',
    'http://localhost:8080'
  ]
}

/**
 * Validate and return CORS origin if allowed
 */
function getValidatedCorsOrigin(requestOrigin: string | null): string | null {
  if (!requestOrigin) {
    return null
  }

  const allowedOrigins = getAllowedOrigins()

  // Check if the request origin is in the allowed list
  if (allowedOrigins.includes(requestOrigin)) {
    return requestOrigin
  }

  return null
}

/**
 * POST - Upload files for AI context
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting check
    const rateLimitResult = await apiRateLimit(request)
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString(),
            'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
          },
        }
      )
    }

    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const workspaceId = formData.get('workspaceId') as string

    // Validate workspace ID
    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      )
    }

    // Validate workspace ID format (prevent path traversal)
    if (!/^[a-zA-Z0-9_-]+$/.test(workspaceId) || workspaceId.includes('..')) {
      return NextResponse.json(
        { error: 'Invalid workspace ID format' },
        { status: 400 }
      )
    }

    // Get all files
    const files = formData.getAll('files') as File[]

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      )
    }

    // Check file count limit
    if (files.length > MAX_FILE_COUNT) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILE_COUNT} files allowed per upload` },
        { status: 400 }
      )
    }

    // Calculate total size
    let totalSize = 0
    for (const file of files) {
      totalSize += file.size
    }

    // Check total size limit
    if (totalSize > MAX_TOTAL_SIZE) {
      return NextResponse.json(
        { error: `Total upload size exceeds 50MB limit` },
        { status: 413 }
      )
    }

    // Validate each file
    const validatedFiles: Array<{ name: string; size: number; type: string }> = []

    for (const file of files) {
      // Validate filename
      const filenameValidation = validateFilename(file.name)
      if (!filenameValidation.valid) {
        return NextResponse.json(
          { error: filenameValidation.error },
          { status: 400 }
        )
      }

      // Validate individual file size
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `File "${file.name}" exceeds 10MB limit` },
          { status: 413 }
        )
      }

      // Validate MIME type
      const mimeValidation = validateMimeType(file.type)
      if (!mimeValidation.valid) {
        return NextResponse.json(
          { error: mimeValidation.error },
          { status: 415 }
        )
      }

      validatedFiles.push({
        name: file.name,
        size: file.size,
        type: file.type
      })
    }

    // In a real implementation, you would:
    // 1. Store files in a secure location
    // 2. Generate embeddings for RAG
    // 3. Store metadata in database
    // For testing purposes, we'll just return success

    return NextResponse.json({
      success: true,
      filesUploaded: validatedFiles.length,
      files: validatedFiles,
      workspaceId
    })

  } catch (error) {
    console.error('File upload error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process file upload',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * OPTIONS - CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  const requestOrigin = request.headers.get('origin')
  const validatedOrigin = getValidatedCorsOrigin(requestOrigin)

  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '3600',
  }

  // Only set Access-Control-Allow-Origin if the origin is validated
  if (validatedOrigin) {
    headers['Access-Control-Allow-Origin'] = validatedOrigin
    headers['Vary'] = 'Origin'
  }

  return new NextResponse(null, {
    status: 200,
    headers,
  })
}
