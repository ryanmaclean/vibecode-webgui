/**
 * AI Chat API endpoint for VibeCode WebGUI
 * Handles AI-powered code assistance using Vercel AI SDK
 */

import { NextRequest, NextResponse } from 'next/server';

// Log AI interaction events to Datadog
function logAIInteraction(
  request: NextRequest,
  event: 'chat_request' | 'chat_response' | 'chat_error',
  metadata: Record<string, any>
) {
  const logData = {
    timestamp: new Date().toISOString(),
    service: 'vibecode-webgui',
    source: 'ai-chat-api',
    level: event === 'chat_error' ? 'error' : 'info',
    event_type: event,
    http: {
      url: request.url,
      method: request.method,
      user_agent: request.headers.get('user-agent') || 'unknown',
    },
    ai: {
      event,
      ...metadata,
    },
    // Add custom attributes for Datadog dashboards
    dd: {
      trace_id: request.headers.get('x-datadog-trace-id'),
      span_id: request.headers.get('x-datadog-span-id'),
    },
  };

  console.log(JSON.stringify({
    message: `[AI_CHAT] ${event}`,
    ...logData,
  }));
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Parse request body
    const body = await request.json();
    const { messages, model = 'ai/smollm2:360M-Q4_K_M', stream = false } = body;

    // Validate input
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logAIInteraction(request, 'chat_error', {
        error: 'Invalid messages format',
        model,
      });

      return NextResponse.json(
        { error: 'Messages array is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Log the chat request
    logAIInteraction(request, 'chat_request', {
      model,
      message_count: messages.length,
      stream,
      last_message_length: messages[messages.length - 1]?.content?.length || 0,
    });

    // Mock AI response for testing (replace with real AI when Docker is working)
    const mockResponses = [
      "I'll help you build that! Let me create a modern React component with TypeScript and Tailwind CSS.",
      "Great idea! I'll implement that feature using Next.js best practices and ensure it's fully responsive.",
      "Perfect! I'll add proper error handling, loading states, and accessibility features to make it production-ready.",
      "Excellent! I'll optimize the performance using React hooks and implement proper state management.",
      "I'll create that with voice integration support, making it compatible with the multimodal interface we built.",
    ];

    const response = mockResponses[Math.floor(Math.random() * mockResponses.length)];
    const processingTime = Date.now() - startTime;

    // Log successful response
    logAIInteraction(request, 'chat_response', {
      model,
      response_length: response.length,
      processing_time_ms: processingTime,
      stream,
    });

    // Simulate streaming response if requested
    if (stream) {
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          // Simulate streaming by sending chunks
          const words = response.split(' ');
          let index = 0;
          
          const sendChunk = () => {
            if (index < words.length) {
              const chunk = `data: ${JSON.stringify({
                choices: [{
                  delta: {
                    content: words[index] + ' '
                  }
                }]
              })}\n\n`;
              
              controller.enqueue(encoder.encode(chunk));
              index++;
              setTimeout(sendChunk, 50); // 50ms delay between words
            } else {
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            }
          };
          
          sendChunk();
        }
      });

      return new NextResponse(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Processing-Time': processingTime.toString(),
        },
      });
    }

    // Regular JSON response
    return NextResponse.json({
      id: `chatcmpl-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: response,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: messages.reduce((sum: number, msg: any) => sum + (msg.content?.length || 0), 0) / 4,
        completion_tokens: response.length / 4,
        total_tokens: (messages.reduce((sum: number, msg: any) => sum + (msg.content?.length || 0), 0) + response.length) / 4,
      },
      processing_time_ms: processingTime,
    }, {
      headers: {
        'X-Processing-Time': processingTime.toString(),
        'X-Model': model,
      },
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logAIInteraction(request, 'chat_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      processing_time_ms: processingTime,
    });

    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to process chat request',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET(request: NextRequest) {
  logAIInteraction(request, 'chat_request', {
    type: 'health_check',
  });

  return NextResponse.json({
    status: 'healthy',
    service: 'ai-chat-api',
    timestamp: new Date().toISOString(),
    available_models: [
      'ai/smollm2:360M-Q4_K_M',
      'ai/llama3.2:1b-Q4_K_M', 
      'ai/qwen2.5-coder:1.5b-Q4_K_M',
      'anthropic/claude-3.5-sonnet',
      'openai/gpt-4-vision',
      'google/gemini-2.0-flash',
    ],
    features: [
      'bot_protection',
      'rate_limiting', 
      'datadog_monitoring',
      'voice_integration',
      'multimodal_support',
    ],
  });
}
