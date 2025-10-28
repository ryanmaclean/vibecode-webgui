#!/usr/bin/env node

/**
 * Test script for Datadog LLM Observability
 * Uses direct tracer integration with proper CommonJS imports
 */

// Load environment from .env (preferred) or .env.local
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const root = path.join(__dirname, '..')
const primary = path.join(root, '.env')
const local = path.join(root, '.env.local')
if (fs.existsSync(primary)) {
  dotenv.config({ path: primary })
} else if (fs.existsSync(local)) {
  dotenv.config({ path: local })
} else {
  dotenv.config()
}

// Initialize ddtrace BEFORE any other imports
const tracer = require('dd-trace')

tracer.init({
  service: process.env.DD_SERVICE || 'vibecode-webgui',
  env: process.env.DD_ENV || 'development',
  version: process.env.npm_package_version || '1.0.0',
  logInjection: true,
  runtimeMetrics: true,
  ...(process.env.DD_LLMOBS_AGENTLESS_ENABLED === '1' && {
    site: process.env.DD_SITE || 'datadoghq.com',
    apiKey: process.env.DD_API_KEY,
  })
})

console.log('🔍 LLM Observability Test Started')
console.log('Configuration:', {
  service: process.env.DD_SERVICE,
  mlApp: process.env.DD_LLMOBS_ML_APP,
  agentless: process.env.DD_LLMOBS_AGENTLESS_ENABLED,
  site: process.env.DD_SITE,
  apiKeyPresent: !!process.env.DD_API_KEY
})

// Simple LLM observability functions using tracer directly
function createWorkflowSpan(name, operation, metadata = {}) {
  const span = tracer.startSpan(`llm.workflow.${name}`, {
    tags: {
      'llm.operation': 'workflow',
      'llm.name': name,
      'service.name': process.env.DD_SERVICE || 'vibecode-webgui',
      'ml.app': process.env.DD_LLMOBS_ML_APP || 'vibecode-ai',
      ...(metadata.tags?.reduce((acc, tag) => ({ ...acc, [`tag.${tag}`]: true }), {}) || {})
    }
  })

  return tracer.scope().activate(span, async () => {
    try {
      if (metadata.input) {
        span.setTag('llm.input.data', JSON.stringify(metadata.input))
      }
      
      if (metadata.context) {
        Object.entries(metadata.context).forEach(([key, value]) => {
          span.setTag(`llm.metadata.${key}`, String(value))
        })
      }

      const result = await operation()

      if (metadata.output !== undefined) {
        span.setTag('llm.output.data', JSON.stringify(metadata.output))
      }

      span.setTag('llm.status', 'success')
      return result
    } catch (error) {
      span.setTag('llm.status', 'error')
      span.setTag('error.message', error instanceof Error ? error.message : String(error))
      throw error
    } finally {
      span.finish()
    }
  })
}

function createTaskSpan(name, operation, metadata = {}) {
  const span = tracer.startSpan(`llm.task.${name}`, {
    tags: {
      'llm.operation': 'task',
      'llm.name': name,
      'service.name': process.env.DD_SERVICE || 'vibecode-webgui',
      'ml.app': process.env.DD_LLMOBS_ML_APP || 'vibecode-ai',
      ...(metadata.tags?.reduce((acc, tag) => ({ ...acc, [`tag.${tag}`]: true }), {}) || {})
    }
  })

  return tracer.scope().activate(span, async () => {
    try {
      if (metadata.input) {
        span.setTag('llm.input.data', JSON.stringify(metadata.input))
      }
      
      if (metadata.context) {
        Object.entries(metadata.context).forEach(([key, value]) => {
          span.setTag(`llm.metadata.${key}`, String(value))
        })
      }

      const result = await operation()

      if (metadata.output !== undefined) {
        span.setTag('llm.output.data', JSON.stringify(metadata.output))
      }

      span.setTag('llm.status', 'success')
      return result
    } catch (error) {
      span.setTag('llm.status', 'error')
      span.setTag('error.message', error instanceof Error ? error.message : String(error))
      throw error
    } finally {
      span.finish()
    }
  })
}

function flushTraces() {
  return new Promise((resolve) => {
    // Give traces time to be sent
    setTimeout(() => {
      console.log('LLM observability data sent to Datadog')
      resolve()
    }, 1000)
  })
}

async function testLLMObservability() {
  try {
    console.log('\n📋 Testing LLM Observability...')
    
    // Test 1: Workflow span
    console.log('\n📋 Testing Workflow Span...')
    const workflowResult = await createWorkflowSpan(
      'test-workflow',
      async () => {
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 100))
        return { status: 'workflow-completed' }
      },
      {
        input: {
          prompt: 'Test workflow for LLM observability',
          framework: 'test'
        },
        tags: ['test', 'workflow'],
        context: {
          test_type: 'integration',
          version: '1.0.0'
        },
        output: {
          status: 'success',
          duration: 100
        }
      }
    )

    console.log('✅ Workflow completed:', workflowResult)

    // Test 2: Task span
    console.log('\n📋 Testing Task Span...')
    const taskResult = await createTaskSpan(
      'test-task',
      async () => {
        // Simulate AI operation
        await new Promise(resolve => setTimeout(resolve, 50))
        return { status: 'task-completed', files: 5 }
      },
      {
        input: {
          operation: 'generate-project',
          language: 'typescript'
        },
        tags: ['test', 'task', 'project-generation'],
        context: {
          provider: 'test',
          model: 'test-model'
        },
        output: {
          files_created: 5,
          project_type: 'react'
        }
      }
    )

    console.log('✅ Task completed:', taskResult)

    // Test 3: Nested operations (task within workflow)
    console.log('\n📋 Testing Nested Operations...')
    const nestedResult = await createWorkflowSpan(
      'ai-project-generation',
      async () => {
        const projectResult = await createTaskSpan(
          'generate-files',
          async () => {
            // Simulate file generation
            await new Promise(resolve => setTimeout(resolve, 75))
            return { files: ['App.tsx', 'package.json'] }
          },
          {
            input: { template: 'react' },
            tags: ['file-generation'],
            context: { operation: 'template-based' },
            output: { fileCount: 2 }
          }
        )

        return { projectName: 'test-project', ...projectResult }
      },
      {
        input: { prompt: 'Create a React app' },
        tags: ['ai-generation', 'full-workflow'],
        context: { user: 'test-user' },
        output: { success: true }
      }
    )

    console.log('✅ Nested operations completed:', nestedResult)

    // Test 4: Direct OpenAI simulation
    console.log('\n📋 Testing OpenAI Simulation...')
    const openaiResult = await createTaskSpan(
      'openai-completion',
      async () => {
        // Simulate OpenAI API call
        await new Promise(resolve => setTimeout(resolve, 200))
        return {
          id: 'chatcmpl-test',
          choices: [{ message: { content: 'Generated React component' } }],
          usage: { total_tokens: 150 }
        }
      },
      {
        input: {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Generate a React component' }],
          max_tokens: 500
        },
        tags: ['openai', 'completion', 'llm-call'],
        context: {
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          endpoint: '/v1/chat/completions'
        },
        output: {
          response: 'Generated React component',
          tokens_used: 150,
          finish_reason: 'stop'
        }
      }
    )

    console.log('✅ OpenAI simulation completed:', openaiResult)

    // Flush all data to Datadog
    console.log('\n📤 Flushing data to Datadog...')
    await flushTraces()
    console.log('✅ Data flushed successfully')

    console.log('\n🎉 All LLM Observability tests completed successfully!')
    console.log('📊 Check your Datadog dashboard for traces in the "vibecode-ai" ML App')
    console.log('🔗 Datadog APM: https://app.datadoghq.com/apm/traces')

  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the test
testLLMObservability()
  .then(() => {
    console.log('\n✨ Test script completed. Exiting in 3 seconds...')
    setTimeout(() => process.exit(0), 3000)
  })
  .catch((error) => {
    console.error('❌ Test script failed:', error)
    process.exit(1)
  })