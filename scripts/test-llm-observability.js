#!/usr/bin/env node

/**
 * Test script for Datadog LLM Observability
 * Verifies that traces are being sent to Datadog
 */

// Set environment variables
process.env.DD_LLMOBS_ENABLED = '1'
process.env.DD_LLMOBS_AGENTLESS_ENABLED = '1'
process.env.DD_LLMOBS_ML_APP = 'vibecode-ai-test'
process.env.DD_SERVICE = 'vibecode-test'
process.env.DD_ENV = 'development'
process.env.DD_API_KEY = process.env.DATADOG_API_KEY || '7ff60a7cdd44e0a596562bad2fd89342'
process.env.DD_SITE = 'datadoghq.com'

// Initialize ddtrace BEFORE any other imports
const tracer = require('dd-trace')

tracer.init({
  service: 'vibecode-test',
  env: 'development',
  version: '1.0.0',
  logInjection: true,
  runtimeMetrics: true,
  site: 'datadoghq.com',
  apiKey: process.env.DD_API_KEY,
})

// Enable LLM Observability
const { llmobs: LLMObs } = tracer

LLMObs.enable({
  mlApp: 'vibecode-ai-test',
  agentlessEnabled: true,
  integrations_enabled: true,
  site: 'datadoghq.com',
  apiKey: process.env.DD_API_KEY,
})

console.log('🔍 LLM Observability Test Started')
console.log('Configuration:', {
  service: process.env.DD_SERVICE,
  mlApp: process.env.DD_LLMOBS_ML_APP,
  agentless: process.env.DD_LLMOBS_AGENTLESS_ENABLED,
  site: process.env.DD_SITE,
  apiKeyPresent: !!process.env.DD_API_KEY
})

async function testLLMObservability() {
  try {
    // Test 1: Workflow span
    console.log('\\n📋 Testing Workflow Span...')
    const workflowResult = await LLMObs.workflow('test-workflow', async () => {
      LLMObs.annotate({
        input_data: {
          prompt: 'Test workflow for LLM observability',
          framework: 'test'
        },
        tags: ['test', 'workflow'],
        metadata: {
          test_type: 'integration',
          version: '1.0.0'
        }
      })

      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 100))

      LLMObs.annotate({
        output_data: {
          status: 'success',
          duration: 100
        }
      })

      return { status: 'workflow-completed' }
    })

    console.log('✅ Workflow completed:', workflowResult)

    // Test 2: Task span
    console.log('\\n📋 Testing Task Span...')
    const taskResult = await LLMObs.task('test-task', async () => {
      LLMObs.annotate({
        input_data: {
          operation: 'generate-project',
          language: 'typescript'
        },
        tags: ['test', 'task', 'project-generation']
      })

      // Simulate AI operation
      await new Promise(resolve => setTimeout(resolve, 50))

      LLMObs.annotate({
        output_data: {
          files_created: 5,
          project_type: 'react'
        }
      })

      return { status: 'task-completed', files: 5 }
    })

    console.log('✅ Task completed:', taskResult)

    // Test 3: LLM call simulation (manual annotation)
    console.log('\\n📋 Testing LLM Call Simulation...')
    const llmResult = await LLMObs.llm('simulated-openai-call', async () => {
      LLMObs.annotate({
        input_data: {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'user', content: 'Generate a React component' }
          ]
        },
        tags: ['test', 'llm-call', 'openai'],
        metadata: {
          provider: 'openai',
          model: 'gpt-3.5-turbo'
        }
      })

      // Simulate LLM response time
      await new Promise(resolve => setTimeout(resolve, 200))

      LLMObs.annotate({
        output_data: {
          response: 'Generated React component code',
          tokens_used: 150,
          finish_reason: 'stop'
        }
      })

      return {
        response: 'Generated React component',
        tokens: 150
      }
    })

    console.log('✅ LLM call completed:', llmResult)

    // Flush all data to Datadog
    console.log('\\n📤 Flushing data to Datadog...')
    await LLMObs.flush()
    console.log('✅ Data flushed successfully')

    console.log('\\n🎉 All LLM Observability tests completed successfully!')
    console.log('📊 Check your Datadog dashboard for traces in the "vibecode-ai-test" ML App')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the test
testLLMObservability()
  .then(() => {
    console.log('\\n✨ Test script completed. Exiting in 2 seconds...')
    setTimeout(() => process.exit(0), 2000)
  })
  .catch((error) => {
    console.error('❌ Test script failed:', error)
    process.exit(1)
  })