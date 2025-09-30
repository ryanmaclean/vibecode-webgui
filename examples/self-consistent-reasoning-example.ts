/**
 * Example usage of Chain-of-Thought with Self-Consistency
 * Demonstrates how to use the selfConsistentReasoning function
 */

import { SelfConsistentReasoning, SelfConsistencyConfig } from '../src/lib/ai/self-consistent-reasoning'
import { ModelOrchestrator, TaskType } from '../src/lib/ai/model-orchestration'

// Example demonstrating self-consistent reasoning usage
async function demonstrateSelfConsistentReasoning() {
  console.log('🧠 Chain-of-Thought with Self-Consistency Demo')
  console.log('=' .repeat(50))

  // Initialize the model orchestrator (normally configured with real models)
  const modelOrchestrator = new ModelOrchestrator([])
  
  // Create the self-consistent reasoning engine
  const selfConsistentReasoning = new SelfConsistentReasoning(modelOrchestrator)

  // Define a reasoning problem
  const prompt = `
A farmer has 17 sheep, and all but 9 die. How many sheep are left?
Think through this step by step and provide your reasoning.
  `.trim()

  // Configure the reasoning process
  const config: Partial<SelfConsistencyConfig> = {
    numPaths: 5,                    // Generate 5 different reasoning paths
    maxThoughtsPerPath: 8,          // Maximum 8 thoughts per path
    minConsensusThreshold: 0.6,     // Need 60% agreement for consensus
    useModelDiversity: true,        // Use different models for diversity
    confidenceWeighting: true       // Weight answers by confidence
  }

  // Set up request context
  const context = {
    taskType: TaskType.PLANNING,
    priority: 'high' as const,
    expectedTokens: 2000,
    requiresStreaming: false,
    requiresJsonMode: false,
    requiresFunctionCalling: false,
    requiresMultimodal: false
  }

  try {
    console.log('🤔 Generating multiple reasoning paths...')
    
    // Execute self-consistent reasoning
    const result = await selfConsistentReasoning.selfConsistentReasoning(
      prompt,
      context,
      config
    )

    // Display results
    console.log('\n📊 Results:')
    console.log(`Consensus Answer: ${result.consensusAnswer}`)
    console.log(`Confidence: ${(result.confidence * 100).toFixed(1)}%`)
    console.log(`Success Rate: ${(result.successRate * 100).toFixed(1)}%`)
    console.log(`Total Time: ${result.totalTime}ms`)
    console.log(`Paths Generated: ${result.paths.length}`)

    console.log('\n🔍 Answer Analysis:')
    console.log(`Agreement Ratio: ${(result.answerComparison.agreementRatio * 100).toFixed(1)}%`)
    console.log(`Answer Groups Found: ${result.answerComparison.answerGroups.length}`)

    if (result.answerComparison.answerGroups.length > 0) {
      console.log('\n📈 Answer Distribution:')
      result.answerComparison.answerGroups.forEach((group, index) => {
        console.log(`  ${index + 1}. "${group.answer}" - ${group.frequency} paths (${(group.avgConfidence * 100).toFixed(1)}% avg confidence)`)
      })
    }

    console.log('\n💭 Consensus Reasoning:')
    console.log(result.reasoning)

    console.log('\n🛤️  Individual Paths:')
    result.paths.forEach((path, index) => {
      console.log(`\nPath ${index + 1} (${path.model}):`)
      console.log(`  Answer: ${path.finalAnswer}`)
      console.log(`  Confidence: ${(path.confidence * 100).toFixed(1)}%`)
      console.log(`  Thoughts: ${path.thoughts.length}`)
      console.log(`  Summary: ${path.reasoning.substring(0, 100)}...`)
    })

    return result

  } catch (error) {
    console.error('❌ Error during self-consistent reasoning:', error)
    throw error
  }
}

// Example of a more complex reasoning problem
async function complexReasoningExample() {
  console.log('\n🧮 Complex Mathematical Reasoning Example')
  console.log('=' .repeat(50))

  const modelOrchestrator = new ModelOrchestrator([])
  const selfConsistentReasoning = new SelfConsistentReasoning(modelOrchestrator)

  const prompt = `
If a car travels 60 miles in 1 hour and 15 minutes, what is its average speed in miles per hour?
Show your work and explain each step clearly.
  `.trim()

  const config: Partial<SelfConsistencyConfig> = {
    numPaths: 3,
    maxThoughtsPerPath: 6,
    minConsensusThreshold: 0.67,  // Higher threshold for math problems
    extractAnswerPattern: /(\d+(?:\.\d+)?)\s*mph|(\d+(?:\.\d+)?)\s*miles\s*per\s*hour/i
  }

  const context = {
    taskType: TaskType.EXPLANATION,
    priority: 'medium' as const,
    expectedTokens: 1500,
    requiresStreaming: false,
    requiresJsonMode: false,
    requiresFunctionCalling: false,
    requiresMultimodal: false
  }

  const result = await selfConsistentReasoning.selfConsistentReasoning(
    prompt,
    context,
    config
  )

  console.log(`📐 Mathematical consensus: ${result.consensusAnswer}`)
  console.log(`🎯 Confidence: ${(result.confidence * 100).toFixed(1)}%`)
  
  return result
}

// Export for potential use in other examples
export {
  demonstrateSelfConsistentReasoning,
  complexReasoningExample
}

// Run examples if this file is executed directly
if (require.main === module) {
  (async () => {
    try {
      await demonstrateSelfConsistentReasoning()
      await complexReasoningExample()
    } catch (error) {
      console.error('Demo failed:', error)
      process.exit(1)
    }
  })()
}