/**
 * Sequential Thinking API endpoint for VibeCode WebGUI
 * Communicates with the MCP sequential_thinking server to break down prompts into structured thoughts
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAIAuth } from '@/lib/auth/middleware'
import { validateAIQuery } from '@/lib/security/input-validator'
import { z } from '@/lib/zod-compat'

// Zod validation schema for sequential thinking requests
const sequentialThinkingSchema = z.object({
  prompt: z.string()
    .min(1, 'Prompt is required')
    .max(5000, 'Prompt too long')
    .regex(/^[^\x00-\x1F\x7F]*$/, 'Prompt contains invalid characters'),
  numSteps: z.number()
    .int('Number of steps must be an integer')
    .min(1, 'At least 1 step required')
    .max(20, 'Maximum 20 steps allowed')
    .optional()
    .default(5)
}).strict()
// Add type augmentation for NextRequest
declare module 'next/server' {
  interface NextRequest {
    user?: {
      id?: string;
      role?: string;
      email?: string;
    };
  }
}

// Force dynamic rendering to prevent static analysis during build
export const dynamic = 'force-dynamic'

function logSequentialThinking(
  _request: NextRequest,
  _event: 'thinking_request' | 'thinking_response' | 'thinking_error',
  _metadata: Record<string, any>
) {
  const logEntry = {
    ddsource: 'vibecode-nextjs',
    service: 'sequential-thinking-api',
    event: _event,
    timestamp: new Date().toISOString(),
    ..._metadata,
  };

  try {
    console.info(JSON.stringify(logEntry));
  } catch (error) {
    console.warn('Failed to stringify sequential thinking log entry', error);
  }
}

async function handlePOST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse and validate request body with Zod
    const body = await request.json();
    const validation = sequentialThinkingSchema.safeParse(body);
    
    if (!validation.success) {
      logSequentialThinking(request, 'thinking_error', {
        error: 'Request validation failed',
        validationErrors: validation.error.issues,
        userId: request.user?.id,
      });

      return NextResponse.json(
        { 
          error: 'Invalid request format',
          details: validation.error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        },
        { status: 400 }
      );
    }

    const { prompt, numSteps } = validation.data;

    // Log the sequential thinking request
    logSequentialThinking(request, 'thinking_request', {
      prompt_length: prompt.length,
      num_steps: numSteps,
      userId: request.user?.id,
      userRole: request.user?.role,
    });

    // Make a request to the MCP sequential_thinking server
    try {
      const mcpResponse = await fetch('http://localhost:3004/v1/tools/think_sequentially', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          num_steps: numSteps,
        }),
      });

      if (!mcpResponse.ok) {
        throw new Error(`MCP server responded with status: ${mcpResponse.status}`);
      }

      const mcpData = await mcpResponse.json();
      const processingTime = Date.now() - startTime;

      // Log successful response
      logSequentialThinking(request, 'thinking_response', {
        response_length: JSON.stringify(mcpData).length,
        processing_time_ms: processingTime,
        num_steps: numSteps,
        userId: request.user?.id || 'anonymous',
        userRole: request.user?.role,
      });

      return NextResponse.json(mcpData, {
        headers: {
          'X-Processing-Time': processingTime.toString(),
          'X-User-ID': request.user?.id || 'anonymous',
        },
      });

    } catch (mcpError) {
      logSequentialThinking(request, 'thinking_error', {
        error: 'MCP server error',
        details: mcpError instanceof Error ? mcpError.message : 'Unknown MCP error',
        userId: request.user?.id || 'anonymous',
      });

      // Fallback response when MCP sequential-thinking server is unavailable
      const mockThoughts = [];

      for (let i = 1; i <= numSteps; i++) {
        mockThoughts.push({
          type: 'thought',
          text: `Step ${i}/${numSteps}: Sequential thinking service unavailable. Connect the MCP server at localhost:3004 to enable analysis.`
        });
      }

      mockThoughts.push({
        type: 'text',
        text: `Sequential thinking service is not connected. ${numSteps} placeholder steps were returned. Start the MCP server to process this request.`
      });

      const processingTime = Date.now() - startTime;
      
      return NextResponse.json(
        { 
          content: mockThoughts,
          fallback: true,
          error: mcpError instanceof Error ? mcpError.message : 'Failed to connect to MCP server',
        }, 
        {
          headers: {
            'X-Processing-Time': processingTime.toString(),
            'X-User-ID': request.user?.id || 'anonymous',
            'X-Fallback': 'true',
          },
        }
      );
    }

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logSequentialThinking(request, 'thinking_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time_ms: processingTime,
      userId: request.user?.id,
      userRole: request.user?.role,
    });

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to process sequential thinking request',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Health check endpoint (authenticated)
async function handleGET(request: NextRequest) {
  logSequentialThinking(request, 'thinking_request', {
    type: 'health_check',
    userId: request.user?.id,
    userRole: request.user?.role,
  });

  return NextResponse.json({
    status: 'healthy',
    service: 'sequential-thinking-api',
    timestamp: new Date().toISOString(),
    user: {
      id: request.user?.id,
      role: request.user?.role,
      email: request.user?.email,
    },
    features: [
      'structured_thinking',
      'problem_decomposition',
      'authentication',
      'input_validation',
      'datadog_monitoring',
      'security_logging',
    ],
    security: {
      authenticated: true,
      user_role: request.user?.role,
      input_validated: true,
    },
  });
}

// Export authenticated handlers
export const POST = withAIAuth(handlePOST);
export const GET = withAIAuth(handleGET);
