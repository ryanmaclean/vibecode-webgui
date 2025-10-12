import { logger } from '@/lib/logger';

import { NextRequest, NextResponse } from 'next/server'
import { functionCallingService, FunctionCall } from '@/lib/services/function-calling'

interface FunctionCallRequest {
  function_call: FunctionCall
  workspaceId?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: FunctionCallRequest = await request.json()
    const { function_call, workspaceId } = body

    if (!function_call?.name) {
      return NextResponse.json({
        success: false,
        error: 'function_call.name is required'
      }, { status: 400 })
    }

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
    logger.info(`Function call: ${function_call.name} -> ${result.success ? 'success' : 'failed'} (${responseTime}ms)`)

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
    logger.error('Function calling API error:', error)
    
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