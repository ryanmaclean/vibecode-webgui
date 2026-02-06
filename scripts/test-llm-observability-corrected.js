#!/usr/bin/env node

// Datadog Log Aggregation
const LogAggregation = require("./lib/log-aggregation-node.js");


/**
 * Test script for Datadog LLM Observability
 * Uses the corrected approach with tracer.startSpan()
 */

// Load environment from .env (preferred) or .env.local
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const root = path.join(__dirname, '..')
const primary = path.join(root, '.env')
const local = path.join(root, '.env.local')

// Initialize log aggregation
const logAggregation = new LogAggregation();

if (fs.existsSync(primary)) {
  dotenv.config({ path: primary })
} else if (fs.existsSync(local)) {
  dotenv.config({ path: local })
} else {
  dotenv.config()
}

console.log('🔍 LLM Observability Test Started')
console.log('Configuration:', {
  service: process.env.DD_SERVICE,
  mlApp: process.env.DD_LLMOBS_ML_APP,
  agentless: process.env.DD_LLMOBS_AGENTLESS_ENABLED,
  site: process.env.DD_SITE,
  apiKeyPresent: !!process.env.DD_API_KEY
})

// Import our LLM observability library
const { llmObservability } = require('../src/lib/datadog-llm.ts')

async function testLLMObservability() {
  try {
    console.log('\n📋 Testing LLM Observability Library...')
    
    // Test 1: Workflow span
    console.log('\n📋 Testing Workflow Span...')
    const workflowResult = await llmObservability.createWorkflowSpan(
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
    const taskResult = await llmObservability.createTaskSpan(
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
    const nestedResult = await llmObservability.createWorkflowSpan(
      'ai-project-generation',
      async () => {
        const projectResult = await llmObservability.createTaskSpan(
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

    // Test 4: Manual annotation
    console.log('\n📋 Testing Manual Annotation...')
    await llmObservability.createTaskSpan(
      'manual-annotation-test',
      async () => {
        llmObservability.annotate({
          input_data: { request: 'test annotation' },
          metadata: { test: true },
          tags: ['manual', 'annotation']
        })

        await new Promise(resolve => setTimeout(resolve, 25))

        llmObservability.annotate({
          output_data: { response: 'annotation successful' }
        })

        return { annotated: true }
      }
    )

    console.log('✅ Manual annotation test completed')

    // Flush all data to Datadog
    console.log('\n📤 Flushing data to Datadog...')
    await llmObservability.flush()
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
    console.log('\n✨ Test script completed. Exiting in 2 seconds...')
    setTimeout(() => process.exit(0), 2000)
  })
  .catch((error) => {
    console.error('❌ Test script failed:', error)
    process.exit(1)
  })