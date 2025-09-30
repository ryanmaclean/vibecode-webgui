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
import { AIProvider, MistralModel } from '../../types/monacopilot';

// Get environment configuration
const provider = (process.env.AI_COMPLETION_PROVIDER as AIProvider) || 'mistral';
const apiKey = process.env.OPENAI_API_KEY || process.env.MISTRAL_API_KEY || '';
const modelFromEnv = process.env.AI_COMPLETION_MODEL;

// Map provider to appropriate model configuration
function getModelConfig() {
  switch (provider) {
    case 'mistral':
      // Monacopilot only supports Mistral's 'codestral' model currently
      const mistralModel: MistralModel = 'codestral';
      return {
        provider: 'mistral' as const,
        model: mistralModel
      };
    default:
      // For other providers, use custom model function
      return {
        model: async (prompt: any) => {
          // Custom implementation for other providers would go here
          // For now, return a placeholder response
          return { text: null };
        }
      };
  }
}

// Initialize the completion copilot with proper typing
const copilot = new CompletionCopilot(apiKey, getModelConfig());

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
    provider: provider,
    model: provider === 'mistral' ? 'codestral' : 'custom',
    supportedProviders: ['mistral'],
    note: 'Currently only Mistral Codestral is fully supported by monacopilot library'
  });
}
