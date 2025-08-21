import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { tools } from '../../lib/tools';

// IMPORTANT! Set the runtime to edge
export const runtime = 'edge';

export default async function handler(req: Request) {
  try {
    const { messages } = await req.json();

    // Initialize model with OpenRouter or OpenAI
    let model;
    if (process.env.OPENROUTER_API_KEY) {
      // Use OpenRouter with OpenAI-compatible interface
      model = openai('gpt-3.5-turbo', {
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
      } as any);
    } else if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-test-dummy-key-for-testing-only') {
      model = openai('gpt-4o-mini');
    } else {
      // Return error response for missing API keys
      return new Response(JSON.stringify({ 
        error: 'No valid AI API key configured. Please set OPENROUTER_API_KEY or OPENAI_API_KEY.' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const result = await streamText({
      model,
      system: 'You are a helpful coding assistant for VibeCode. When asked about a GitHub repository, use the getGithubRepoInfo tool to provide information.',
      messages,
      tools,
      maxSteps: 5,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Chat API error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process request',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
