// Validation script to check LLM Observability setup and trace emission
import 'dd-trace/init'
import { LLMTracer } from '@/lib/monitoring/llm-tracer'
import { llmObservability } from '@/lib/datadog-llm'
import tracer from 'dd-trace'

async function validateSetup() {
  console.log('🔍 Validating LLM Observability Setup...')
  
  // Check environment variables
  console.log('\n📋 Environment Variables:')
  console.log(`DD_LLMOBS_ENABLED: ${process.env.DD_LLMOBS_ENABLED}`)
  console.log(`DD_LLMOBS_AGENTLESS_ENABLED: ${process.env.DD_LLMOBS_AGENTLESS_ENABLED}`)
  console.log(`DD_SERVICE: ${process.env.DD_SERVICE}`)
  console.log(`DD_ENV: ${process.env.DD_ENV}`)
  console.log(`DD_AGENT_HOST: ${process.env.DD_AGENT_HOST}`)
  console.log(`DD_TRACE_AGENT_PORT: ${process.env.DD_TRACE_AGENT_PORT}`)
  
  // Check LLM Observability config
  console.log('\n🤖 LLM Observability Config:')
  const config = llmObservability.getConfig()
  console.log(JSON.stringify(config, null, 2))
  
  // Test span creation
  console.log('\n🧪 Testing Span Creation:')
  
  const testSpan = await LLMTracer.traceLLMCall('validation_test', {
    model: 'test-model',
    provider: 'test-provider',
    input: 'This is a validation test input',
    userId: 'validation-user',
    sessionId: 'validation-session',
  }, async () => {
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // Test annotation
    llmObservability.annotate({
      input_data: 'validation input',
      output_data: 'validation output',
      metadata: { test: true, validation: true },
      tags: ['validation', 'test']
    })
    
    return { success: true, message: 'Validation test completed' }
  })
  
  console.log('✅ Test span result:', testSpan)
  
  // Check tracer status
  console.log('\n📊 Tracer Status:')
  const ddTracer = tracer as any
  console.log(`Tracer initialized: ${!!ddTracer}`)
  console.log(`Tracer version: ${ddTracer.version || 'unknown'}`)
  console.log(`Agent host: ${ddTracer._tracer?._hostname || 'unknown'}`)
  console.log(`Agent port: ${ddTracer._tracer?._port || 'unknown'}`)
  
  // Flush traces
  console.log('\n🔄 Flushing traces...')
  await llmObservability.flush()
  
  if (ddTracer.tracer?._writer?.flush) {
    await new Promise(resolve => {
      ddTracer.tracer._writer.flush(() => {
        console.log('✅ Traces flushed to agent')
        resolve(undefined)
      })
    })
  }
  
  console.log('\n✅ Validation completed!')
  console.log('\n📈 Next steps:')
  console.log('1. Check Datadog APM for traces with service:vibecode-webgui')
  console.log('2. Look for spans with span.type:ai in LLM Observability')
  console.log('3. Verify ai.* tags are present on spans')
  console.log('4. Check agent logs for trace reception')
}

await validateSetup()
