/**
 * Code Completion API Route
 * 
 * Handles AI-powered code completion requests from Monacopilot.
 * Supports multiple AI providers: OpenAI, Mistral, Anthropic, Groq, etc.
 * 
 * Features:
 * - Request validation with Zod schemas
 * - Rate limiting (10 requests per minute per IP)
 * - Comprehensive error handling and logging
 * - Timeout protection for AI service calls
 * - Structured error responses with error codes
 * 
 * @see https://monacopilot.dev/configuration/copilot-options.html
 */

import { NextRequest, NextResponse } from 'next/server';
import { CompletionCopilot } from 'monacopilot';
import { validateRequest } from '@/lib/code-completion-validation';
import { applyCodeCompletionRateLimit, getClientInfo } from '@/lib/code-completion-rate-limit';
import { 
  createErrorResponse, 
  ApiError, 
  ApiErrorCode, 
  generateRequestId, 
  withTimeout,
  categorizeExternalError,
  type ErrorContext 
} from '@/lib/api-error-handler';

// Initialize the completion copilot with your preferred provider
// You can use: 'openai', 'mistral', 'anthropic', 'groq', 'cohere', 'fireworks-ai'
const copilot = new CompletionCopilot(
  process.env.OPENAI_API_KEY || process.env.MISTRAL_API_KEY || '',
  {
    provider: (process.env.AI_COMPLETION_PROVIDER as any) || 'openai',
    model: process.env.AI_COMPLETION_MODEL || 'gpt-4-turbo-preview',
    // Optional: Configure temperature, max tokens, etc.
    temperature: 0.2,
    maxTokens: 1000,
  }
);

// Timeout for AI completion requests (30 seconds)
const AI_COMPLETION_TIMEOUT = 30 * 1000;

export async function POST(request: NextRequest) {
  const requestId = generateRequestId();
  const { ip, userAgent } = getClientInfo(request);
  
  const errorContext: ErrorContext = {
    requestId,
    ip,
    userAgent,
    endpoint: '/api/code-completion',
    method: 'POST',
  };

  try {
    // Apply rate limiting
    await applyCodeCompletionRateLimit(request);

    // Parse and validate request body
    let body: unknown;
    try {
      body = await request.json();
    } catch (parseError) {
      throw new ApiError(
        ApiErrorCode.VALIDATION_ERROR,
        'Invalid JSON in request body',
        400,
        { parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error' }
      );
    }

    // Validate request schema
    const validation = validateRequest(body);
    if (!validation.success) {
      throw new ApiError(
        ApiErrorCode.VALIDATION_ERROR,
        'Request validation failed',
        400,
        { validationErrors: validation.errors }
      );
    }

    const validatedData = validation.data;

    // Check if AI API key is configured
    const apiKey = process.env.OPENAI_API_KEY || process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new ApiError(
        ApiErrorCode.AI_SERVICE_ERROR,
        'AI service not configured',
        503,
        { provider: process.env.AI_COMPLETION_PROVIDER || 'openai' }
      );
    }

    // Generate completion with timeout protection
    let completion;
    try {
      completion = await withTimeout(
        copilot.complete(validatedData),
        AI_COMPLETION_TIMEOUT,
        'AI completion'
      );
    } catch (aiError) {
      // Categorize and rethrow AI service errors
      throw categorizeExternalError(aiError);
    }

    // Log successful completion
    console.log(`[Code Completion] Success: ${requestId}`, {
      requestId,
      ip,
      language: validatedData.language,
      textLength: validatedData.text.length,
      provider: process.env.AI_COMPLETION_PROVIDER || 'openai',
      model: process.env.AI_COMPLETION_MODEL || 'gpt-4-turbo-preview',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      ...completion,
      requestId,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    // Handle all errors with centralized error handler
    if (error instanceof ApiError) {
      return createErrorResponse(error, errorContext);
    }

    // Handle unexpected errors
    const unexpectedError = new ApiError(
      ApiErrorCode.INTERNAL_SERVER_ERROR,
      'An unexpected error occurred',
      500,
      { originalError: error instanceof Error ? error.message : 'Unknown error' }
    );

    return createErrorResponse(unexpectedError, errorContext);
  }
}

// Optional: Health check endpoint
export async function GET() {
  try {
    const healthResponse = {
      status: 'ok' as const,
      provider: process.env.AI_COMPLETION_PROVIDER || 'openai',
      model: process.env.AI_COMPLETION_MODEL || 'gpt-4-turbo-preview',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      rateLimits: {
        codeCompletion: {
          maxRequests: 10,
          windowMs: 60000, // 1 minute
        },
      },
    };

    return NextResponse.json(healthResponse);
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
