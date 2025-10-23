import { NextRequest, NextResponse } from 'next/server'
import { functionCallingService, FunctionCall } from '@/lib/services/function-calling'
// import { logger } from '@/lib/logger'
import { z } from '@/lib/zod-compat'
import { aiFunctionCallSchema } from '@/lib/api/validation/schemas'

interface FunctionCallRequest {
  function_call: FunctionCall
  workspaceId?: string
}

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    let validatedData
    try {
      const body = await request.json()
      validatedData = aiFunctionCallSchema.parse(body)
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.warn('Function call validation failed', { errors: error.errors })
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid request parameters',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          },
          { status: 400 }
        )
      }
      throw error
    }

    const { function_call, workspaceId } = validatedData

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
    console.log(`Function call: ${function_call.name} -> ${result.success ? 'success' : 'failed'} (${responseTime}ms)`)

    return NextResponse.json({
      success: result.success,
      function_name: function_call.name,
      result: result.result,
      error: result.error,
      metadata: {
        executionTime: result.executionTime,
        responseTime,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Function execution failed';
    const errorDetails = process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined;
    const errorInfo = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : { error: String(error) };

    console.error('Function calling API error:', errorInfo)

    return NextResponse.json({
      success: false,
      error: errorMessage,
      details: errorDetails
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const definitions = functionCallingService.getRegisteredFunctions()
    
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