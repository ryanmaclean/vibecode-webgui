// Comprehensive LLM Observability test with multiple spans and explicit trace flushing
import 'dd-trace/init'
import OpenAI from 'openai'
import { PrismaClient } from '@prisma/client'
import { LLMTracer } from '@/lib/monitoring/llm-tracer'
import { llmObservability } from '@/lib/datadog-llm'
import tracer from 'dd-trace'

async function main() {
  console.log('🚀 Starting comprehensive LLM Observability test...')
  
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is required')
  
  const model = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
  const client = new OpenAI({ apiKey })
  const prisma = new PrismaClient()

  // Test 1: Embedding generation with LLM tracer
  console.log('📊 Test 1: Embedding generation with LLM tracer')
  const input1 = 'VibeCode comprehensive LLM observability test - embedding generation.'
  
  const result1 = await LLMTracer.traceLLMCall('embedding_generation', {
    model,
    provider: 'openai',
    input: input1,
    userId: 'test-user-1',
    sessionId: 'test-session-1',
  }, async () => {
    const resp = await client.embeddings.create({ model, input: input1 })
    const embedding = resp.data[0].embedding

    // Annotate with additional metadata
    llmObservability.annotate({
      input_data: input1,
      output_data: { 
        embedding_length: embedding.length,
        embedding_model: model,
        provider: 'openai'
      },
      metadata: { 
        provider: 'openai', 
        model,
        operation_type: 'embeddings',
        test_type: 'comprehensive'
      },
      tags: ['comprehensive-test', 'embedding', 'openai']
    })

    return { 
      usage: (resp as any).usage || undefined, 
      output: `embedding_length:${embedding.length}`,
      embedding: embedding.slice(0, 5) // First 5 dimensions for logging
    }
  })

  console.log('✅ Test 1 completed:', result1)

  // Test 2: Chat completion with LLM tracer
  console.log('📊 Test 2: Chat completion with LLM tracer')
  const input2 = 'Explain what LLM observability means in one sentence.'
  
  const result2 = await LLMTracer.traceLLMCall('chat_completion', {
    model: 'gpt-3.5-turbo',
    provider: 'openai',
    input: input2,
    userId: 'test-user-2',
    sessionId: 'test-session-2',
  }, async () => {
    const resp = await client.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: input2 }],
      max_tokens: 100
    })

    const content = resp.choices[0]?.message?.content || ''

    // Annotate with chat-specific metadata
    llmObservability.annotate({
      input_data: input2,
      output_data: { 
        response: content,
        finish_reason: resp.choices[0]?.finish_reason,
        model: 'gpt-3.5-turbo'
      },
      metadata: { 
        provider: 'openai', 
        model: 'gpt-3.5-turbo',
        operation_type: 'chat_completion',
        test_type: 'comprehensive'
      },
      tags: ['comprehensive-test', 'chat', 'openai', 'gpt-3.5-turbo']
    })

    return { 
      usage: resp.usage || undefined, 
      output: content,
      finish_reason: resp.choices[0]?.finish_reason
    }
  })

  console.log('✅ Test 2 completed:', result2)

  // Test 3: Workflow span with llmObservability
  console.log('📊 Test 3: Workflow span with llmObservability')
  const result3 = await llmObservability.createWorkflowSpan('comprehensive_workflow', async () => {
    // Simulate a workflow that includes multiple AI operations
    const workflowInput = 'Process this text for sentiment analysis and generate a summary.'
    
    // Simulate sentiment analysis
    const sentimentResult = await LLMTracer.traceLLMCall('sentiment_analysis', {
      model: 'gpt-3.5-turbo',
      provider: 'openai',
      input: workflowInput,
      userId: 'workflow-user',
      sessionId: 'workflow-session',
    }, async () => {
      const resp = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ 
          role: 'user', 
          content: `Analyze the sentiment of this text: "${workflowInput}"` 
        }],
        max_tokens: 50
      })
      return resp.choices[0]?.message?.content || ''
    })

    // Simulate summary generation
    const summaryResult = await LLMTracer.traceLLMCall('summary_generation', {
      model: 'gpt-3.5-turbo',
      provider: 'openai',
      input: workflowInput,
      userId: 'workflow-user',
      sessionId: 'workflow-session',
    }, async () => {
      const resp = await client.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ 
          role: 'user', 
          content: `Summarize this text: "${workflowInput}"` 
        }],
        max_tokens: 100
      })
      return resp.choices[0]?.message?.content || ''
    })

    return {
      sentiment: sentimentResult,
      summary: summaryResult,
      workflow_completed: true
    }
  }, {
    input: 'comprehensive_workflow_test',
    output: 'workflow_results',
    context: { test_type: 'comprehensive', workflow_steps: 2 },
    tags: ['comprehensive-test', 'workflow', 'multi-step']
  })

  console.log('✅ Test 3 completed:', result3)

  // Flush traces to ensure they're sent to Datadog
  console.log('🔄 Flushing traces to Datadog...')
  await llmObservability.flush()
  
  // Also flush the main tracer
  const ddTracer = tracer as any
  if (ddTracer.tracer?._writer?.flush) {
    await new Promise(resolve => {
      ddTracer.tracer._writer.flush(() => {
        console.log('✅ Main tracer flushed')
        resolve(undefined)
      })
    })
  }

  console.log('🎉 Comprehensive LLM Observability test completed!')
  console.log('📈 Check Datadog APM and LLM Observability for traces with:')
  console.log('   - service:vibecode-webgui')
  console.log('   - span.type:ai')
  console.log('   - ai.request.provider:openai')
  console.log('   - tags:comprehensive-test')
}

await main()
