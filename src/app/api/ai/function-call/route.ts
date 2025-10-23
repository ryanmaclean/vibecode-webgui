import { NextRequest, NextResponse } from 'next/server'
import { functionCallingService, FunctionCall } from '@/lib/services/function-calling'
// import { logger } from '@/lib/logger'
import { z } from '@/lib/zod-compat'

// Zod validation schema for function call requests
const functionCallRequestSchema = z.object({
  function_call: z.object({
    name: z.string()
      .min(1, 'Function name is required')
      .max(100, 'Function name too long')
      .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'Invalid function name format'),
    arguments: z.record(z.any()).optional().default({})
  }),
  workspaceId: z.string()
    .min(1, 'Workspace ID is required')
    .max(100, 'Workspace ID too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid workspace ID format')
    .optional()
}).strict()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request body with Zod
    const validation = functionCallRequestSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request format',
        details: validation.error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      }, { status: 400 })
    }

    const { function_call, workspaceId } = validation.data

    // Add workspaceId to function arguments if provided and not already present
    const functionArgs = {
      ...function_call.arguments,
      ...(workspaceId && !function_call.arguments.workspaceId ? { workspaceId } : {})
    }

    const startTime = Date.now()
    
    // Execute the function
    const result = await functionCallingService.executeFunction({
      name: function_call.name,
      arguments: functionArgs
    })

    const responseTime = Date.now() - startTime

    // Log function execution for monitoring
    console.info(`Function call: ${function_call.name} -> ${result.success ? 'success' : 'failed'} (${responseTime}ms)`)

    return NextResponse.json({
      success: result.success,
      function_name: function_call.name,
      result: result.result,
      error: result.error,
      metadata: {
        ...result.metadata,
        responseTime,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error: unknown) {
    console.error('Function calling API error:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Function execution failed',
      details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const definitions = functionCallingService.getFunctionDefinitions()
    
    return NextResponse.json({
      success: true,
      available_functions: definitions,
      total_functions: definitions.length,
      categories: {
        'web_operations': ['web_search'],
        'file_operations': ['create_file', 'list_files'],
        'code_execution': ['execute_code'],
        'package_management': ['install_package']
      }
    })
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list functions'
    }, { status: 500 })
  }
}