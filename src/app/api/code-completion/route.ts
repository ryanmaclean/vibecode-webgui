/**
 * Code Completion API Route
 * 
 * Handles AI-powered code completion requests from Monacopilot.
 * Supports multiple AI providers: OpenAI, Mistral, Anthropic, Groq, etc.
 * 
 * @see https://monacopilot.dev/configuration/copilot-options.html
 */

import { NextRequest, NextResponse } from 'next/server';
import { CompletionCopilot } from 'monacopilot';

// Initialize the completion copilot with your preferred provider
// You can use: 'openai', 'mistral', 'anthropic', 'groq', 'cohere', 'fireworks-ai'
const copilot = new CompletionCopilot(
  process.env.OPENAI_API_KEY || process.env.MISTRAL_API_KEY || '',
  {
    provider: (process.env.AI_COMPLETION_PROVIDER as any) || 'openai',
    model: (process.env.AI_COMPLETION_MODEL || 'gpt-4-turbo-preview') as any,
    // Optional: Configure temperature, max tokens, etc.
    temperature: 0.2,
    maxTokens: 1000,
  }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Generate completion
    const completion = await copilot.complete({ body });

    return NextResponse.json(completion);
  } catch (error) {
    console.error('[Code Completion] Error:', error);

    return NextResponse.json(
      {
        error: 'Failed to generate completion',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Optional: Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    provider: process.env.AI_COMPLETION_PROVIDER || 'openai',
    model: process.env.AI_COMPLETION_MODEL || 'gpt-4-turbo-preview',
  });
}
