import { NextRequest, NextResponse } from 'next/server'
import { HfInference } from '@huggingface/inference'
import { z } from '@/lib/zod-compat'
// import { logger } from '@/lib/logger'

// Validation schema
const huggingfaceChatSchema = z.object({
  model: z.string().min(1).max(200),
  input: z.string().min(1).max(50_000), // 50KB max input
  context: z.array(z.object({
    role: z.string(),
    content: z.string()
  })).max(50).optional(),
  max_tokens: z.number().int().positive().max(8000).optional(),
  temperature: z.number().min(0).max(2).optional()
});

interface ChatRequest {
  model: string
  input: string
  context?: Array<{ role: string; content: string }>
  max_tokens?: number
  temperature?: number
}

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    let validatedData;
    try {
      const body = await request.json();
      validatedData = huggingfaceChatSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.warn('HuggingFace chat validation failed', { errors: error.errors });
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
        );
      }
      throw error;
    }

    const { model, input, context = [], max_tokens = 150, temperature = 0.7 } = validatedData;

    const apiKey = process.env.HUGGINGFACE_API_TOKEN
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Hugging Face API key not configured'
      }, { status: 500 })
    }

    // Initialize Hugging Face client
    const hf = new HfInference(apiKey)

    let response: string = ''
    const startTime = Date.now()

    try {
      // Handle different model types
      if (model.includes('DialoGPT') || model.includes('blenderbot') || model.includes('GODEL')) {
        // Conversational models
        const conversationInput = context.length > 0 
          ? context.map(msg => `${msg.role === 'user' ? 'User' : 'Bot'}: ${msg.content}`).join('\n') + `\nUser: ${input}\nBot:`
          : `User: ${input}\nBot:`

        const result = await hf.textGeneration({
          model,
          inputs: conversationInput,
          parameters: {
            max_new_tokens: max_tokens,
            temperature,
            do_sample: true,
            top_p: 0.9,
            return_full_text: false
          }
        })
        
        response = result.generated_text || 'No response generated'
      } else {
        // Text generation models (FLAN-T5, BLOOM, etc.)
        const prompt = context.length > 0 
          ? context.map(msg => `${msg.role === 'user' ? 'Human' : 'Assistant'}: ${msg.content}`).join('\n') + `\nHuman: ${input}\nAssistant:`
          : `Human: ${input}\nAssistant:`

        const result = await hf.textGeneration({
          model,
          inputs: prompt,
          parameters: {
            max_new_tokens: max_tokens,
            temperature,
            do_sample: true,
            top_p: 0.9,
            repetition_penalty: 1.1
          }
        })

        // Clean up the response
        response = result.generated_text
          .replace(prompt, '') // Remove the original prompt
          .replace(/^Assistant:\s*/, '') // Remove "Assistant:" prefix if present
          .replace(/Human:.*$/, '') // Remove any trailing Human input
          .trim()
      }

      const responseTime = Date.now() - startTime

      // Log usage for monitoring
      // Debug log removed}... -> ${response.substring(0, 50)}... (${responseTime}ms)`)

      return NextResponse.json({
        success: true,
        response: response || 'I apologize, but I was unable to generate a response. Please try rephrasing your question.',
        metadata: {
          model,
          responseTime,
          inputTokens: input.length,
          outputTokens: response.length,
          contextLength: context.length
        }
      })

    } catch (modelError: any) {
      // Server error logged
      
      // Try fallback to a simpler approach for some models
      if (modelError.message?.includes('loading') || modelError.message?.includes('unavailable')) {
        return NextResponse.json({
          success: false,
          error: `Model ${model} is currently loading. Please try again in a few seconds.`,
          retry: true
        }, { status: 503 })
      }

      // Fallback response for model-specific errors
      return NextResponse.json({
        success: true,
        response: "I'm experiencing some technical difficulties with that specific model. Could you try asking your question again or select a different model?",
        metadata: {
          model,
          error: 'Fallback response due to model error',
          responseTime: Date.now() - startTime
        }
      })
    }

  } catch (error: any) {
    // Server error logged
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Failed to process chat request',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Hugging Face Chat API',
    endpoints: {
      'POST /api/ai/huggingface-chat': 'Send chat message to Hugging Face models'
    },
    available_models: [
      'microsoft/DialoGPT-medium',
      'microsoft/DialoGPT-large', 
      'facebook/blenderbot-400M-distill',
      'microsoft/GODEL-v1_1-large-seq2seq',
      'google/flan-t5-large',
      'bigscience/bloom-560m'
    ]
  })
}