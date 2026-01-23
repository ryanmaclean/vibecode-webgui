/* eslint-disable @typescript-eslint/no-unused-vars */

import { NextRequest, NextResponse } from 'next/server'
import { createAPIRateLimit } from '@/lib/rate-limiting'

const apiRateLimit = createAPIRateLimit(10) // 10 requests per minute - initialization is expensive

export async function GET(_request: NextRequest) {
  try {
    const apiKey = process.env.HUGGINGFACE_API_TOKEN

    // Check if Hugging Face API key is configured
    if (!apiKey) {
      return NextResponse.json({
        initialized: false,
        error: 'Hugging Face API key not configured'
      })
    }

    // Test the API key by making a simple request to HF API
    const testResponse = await fetch('https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: "Hello",
        options: { wait_for_model: false }
      })
    })

    const initialized = testResponse.status !== 401 // Not unauthorized

    return NextResponse.json({
      initialized,
      status: testResponse.status,
      available_models: [
        'microsoft/DialoGPT-medium',
        'microsoft/DialoGPT-large',
        'facebook/blenderbot-400M-distill',
        'microsoft/GODEL-v1_1-large-seq2seq',
        'google/flan-t5-large',
        'bigscience/bloom-560m'
      ]
    })

  } catch (error) {
    // Server error logged
    return NextResponse.json({
      initialized: false,
      error: 'Failed to initialize Hugging Face client'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimitResult = await apiRateLimit(request)
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': rateLimitResult.limit.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.reset.toString(),
          'Retry-After': rateLimitResult.retryAfter?.toString() ?? '60',
        },
      }
    )
  }

  return GET(request)
}
