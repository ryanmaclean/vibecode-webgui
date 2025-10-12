/**
 * API Validation Middleware
 *
 * Provides reusable validation utilities for Next.js API routes with Zod
 * Implements security-first input validation with comprehensive error handling
 */

import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError, ZodSchema } from 'zod'
import { logger } from '@/lib/logger'

export interface ValidationOptions {
  /** Transform successful validation results */
  transform?: (data: unknown) => unknown
  /** Custom error messages for specific fields */
  customMessages?: Record<string, string>
  /** Enable detailed error reporting (disable in production) */
  verboseErrors?: boolean
}

export type ValidationResult<T> =
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: NextResponse }

/**
 * Validate request body against a Zod schema
 *
 * @param req - Next.js request object
 * @param schema - Zod validation schema
 * @param options - Validation options
 * @returns Validated data or error response
 */
export async function validateRequestBody<T extends ZodSchema>(
  req: NextRequest,
  schema: T,
  options: ValidationOptions = {}
): Promise<ValidationResult<z.infer<T>>> {
  try {
    const body = await req.json()
    const validated = schema.parse(body)

    const finalData = options.transform
      ? options.transform(validated)
      : validated

    return {
      success: true,
      data: finalData as z.infer<T>
    }
  } catch (error) {
    if (error instanceof ZodError) {
      const verboseErrors = options.verboseErrors ?? process.env.NODE_ENV !== 'production'

      return {
        success: false,
        error: NextResponse.json(
          {
            error: 'Validation failed',
            message: 'Request body contains invalid or missing fields',
            ...(verboseErrors && {
              details: error.errors.map(err => ({
                field: err.path.join('.'),
                message: options.customMessages?.[err.path.join('.')] || err.message,
                code: err.code
              }))
            })
          },
          { status: 400 }
        )
      }
    }

    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: NextResponse.json(
          {
            error: 'Invalid JSON',
            message: 'Request body must be valid JSON'
          },
          { status: 400 }
        )
      }
    }

    // Unexpected error
    return {
      success: false,
      error: NextResponse.json(
        {
          error: 'Validation error',
          message: 'An unexpected error occurred during validation'
        },
        { status: 500 }
      )
    }
  }
}

/**
 * Validate query parameters against a Zod schema
 *
 * @param req - Next.js request object
 * @param schema - Zod validation schema
 * @param options - Validation options
 * @returns Validated data or error response
 */
export function validateQueryParams<T extends ZodSchema>(
  req: NextRequest,
  schema: T,
  options: ValidationOptions = {}
): ValidationResult<z.infer<T>> {
  try {
    const { searchParams } = new URL(req.url)
    const params: Record<string, string | string[]> = {}

    // Convert URLSearchParams to object
    searchParams.forEach((value, key) => {
      if (params[key]) {
        // Handle multiple values for same key
        if (Array.isArray(params[key])) {
          (params[key] as string[]).push(value)
        } else {
          params[key] = [params[key] as string, value]
        }
      } else {
        params[key] = value
      }
    })

    const validated = schema.parse(params)

    const finalData = options.transform
      ? options.transform(validated)
      : validated

    return {
      success: true,
      data: finalData as z.infer<T>
    }
  } catch (error) {
    if (error instanceof ZodError) {
      const verboseErrors = options.verboseErrors ?? process.env.NODE_ENV !== 'production'

      return {
        success: false,
        error: NextResponse.json(
          {
            error: 'Invalid query parameters',
            message: 'Query parameters contain invalid or missing values',
            ...(verboseErrors && {
              details: error.errors.map(err => ({
                field: err.path.join('.'),
                message: options.customMessages?.[err.path.join('.')] || err.message,
                code: err.code
              }))
            })
          },
          { status: 400 }
        )
      }
    }

    return {
      success: false,
      error: NextResponse.json(
        {
          error: 'Validation error',
          message: 'An unexpected error occurred during validation'
        },
        { status: 500 }
      )
    }
  }
}

/**
 * Validate path parameters against a Zod schema
 *
 * @param params - Path parameters object
 * @param schema - Zod validation schema
 * @param options - Validation options
 * @returns Validated data or error response
 */
export function validatePathParams<T extends ZodSchema>(
  params: Record<string, string | string[]> | Promise<Record<string, string | string[]>>,
  schema: T,
  options: ValidationOptions = {}
): ValidationResult<z.infer<T>> {
  try {
    const validated = schema.parse(params)

    const finalData = options.transform
      ? options.transform(validated)
      : validated

    return {
      success: true,
      data: finalData as z.infer<T>
    }
  } catch (error) {
    if (error instanceof ZodError) {
      const verboseErrors = options.verboseErrors ?? process.env.NODE_ENV !== 'production'

      return {
        success: false,
        error: NextResponse.json(
          {
            error: 'Invalid path parameters',
            message: 'URL path contains invalid parameters',
            ...(verboseErrors && {
              details: error.errors.map(err => ({
                field: err.path.join('.'),
                message: options.customMessages?.[err.path.join('.')] || err.message,
                code: err.code
              }))
            })
          },
          { status: 400 }
        )
      }
    }

    return {
      success: false,
      error: NextResponse.json(
        {
          error: 'Validation error',
          message: 'An unexpected error occurred during validation'
        },
        { status: 500 }
      )
    }
  }
}

/**
 * Create a validated API handler with automatic error handling
 *
 * @param schema - Zod validation schema for request body
 * @param handler - Handler function that receives validated data
 * @param options - Validation options
 * @returns Next.js API route handler
 */
export function createValidatedHandler<T extends ZodSchema>(
  schema: T,
  handler: (data: z.infer<T>, req: NextRequest) => Promise<NextResponse>,
  options: ValidationOptions = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const validation = await validateRequestBody(req, schema, options)

    if (!validation.success) {
      return validation.error
    }

    try {
      return await handler(validation.data, req)
    } catch (error) {
      logger.error('Handler error:', error)
      return NextResponse.json(
        {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        },
        { status: 500 }
      )
    }
  }
}
