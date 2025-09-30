# Chain-of-Thought with Self-Consistency

## Overview

The Chain-of-Thought with Self-Consistency feature implements an advanced reasoning technique that generates multiple parallel reasoning paths and selects the consensus answer for higher reliability. This approach significantly improves the accuracy and confidence of AI-generated responses by leveraging the wisdom of multiple reasoning approaches.

## How It Works

1. **Multiple Path Generation**: Creates N parallel reasoning paths, each using sequential thinking
2. **Answer Extraction**: Extracts final answers from each reasoning path
3. **Consensus Building**: Groups similar answers and finds the most frequent response
4. **Confidence Scoring**: Calculates confidence based on agreement ratio and path quality
5. **Result Aggregation**: Returns the consensus answer with detailed reasoning

## Key Features

- **Parallel Reasoning**: Generates multiple independent reasoning chains
- **Model Diversity**: Uses different AI models for different paths to increase diversity
- **Answer Normalization**: Intelligently groups similar answers together
- **Confidence Weighting**: Weights results by individual path confidence scores
- **Custom Patterns**: Supports custom regex patterns for answer extraction
- **Performance Metrics**: Tracks success rates, timing, and agreement ratios

## Installation & Usage

```typescript
import { SelfConsistentReasoning, ModelOrchestrator, TaskType } from '@/lib/ai'

// Initialize model orchestrator
const modelOrchestrator = new ModelOrchestrator()

// Create self-consistent reasoning engine
const reasoningEngine = new SelfConsistentReasoning(modelOrchestrator)

// Configure reasoning parameters
const config = {
  numPaths: 5,                    // Number of parallel reasoning paths
  maxThoughtsPerPath: 10,         // Maximum thoughts per path
  minConsensusThreshold: 0.6,     // Minimum agreement for consensus
  useModelDiversity: true,        // Use different models for diversity
  confidenceWeighting: true       // Weight by confidence scores
}

// Set up request context
const context = {
  taskType: TaskType.PLANNING,
  priority: 'high',
  expectedTokens: 2000,
  requiresStreaming: false,
  requiresJsonMode: false,
  requiresFunctionCalling: false,
  requiresMultimodal: false
}

// Execute self-consistent reasoning
const result = await reasoningEngine.selfConsistentReasoning(
  "Your reasoning question here",
  context,
  config
)

console.log(`Consensus: ${result.consensusAnswer}`)
console.log(`Confidence: ${result.confidence}`)
console.log(`Paths: ${result.paths.length}`)
```

## Configuration Options

### SelfConsistencyConfig

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `numPaths` | number | 5 | Number of parallel reasoning paths to generate |
| `maxThoughtsPerPath` | number | 10 | Maximum thoughts allowed per reasoning path |
| `minConsensusThreshold` | number | 0.6 | Minimum agreement ratio required for consensus |
| `useModelDiversity` | boolean | true | Whether to use different models for different paths |
| `extractAnswerPattern` | RegExp | undefined | Custom regex pattern for answer extraction |
| `confidenceWeighting` | boolean | true | Whether to weight answers by confidence scores |

## Best Practices

### When to Use Self-Consistent Reasoning

- **Complex Problem Solving**: Multi-step mathematical or logical problems
- **High-Stakes Decisions**: When accuracy is critical
- **Ambiguous Questions**: Problems with multiple valid interpretations
- **Creative Tasks**: When diverse perspectives are valuable

### Configuration Recommendations

- **High Accuracy**: Use 5-7 paths with threshold ≥ 0.7
- **Fast Response**: Use 3 paths with threshold ≥ 0.6
- **Diverse Exploration**: Enable model diversity and use higher path counts
- **Mathematical Problems**: Use custom extraction patterns

## API Reference

### Main Method

#### `selfConsistentReasoning(prompt, context, config?)`

Main method to execute self-consistent reasoning.

**Parameters:**
- `prompt` (string): The reasoning question or problem
- `context` (RequestContext): Model selection context
- `config` (Partial<SelfConsistencyConfig>): Optional configuration overrides

**Returns:** Promise<SelfConsistentResult>

## Examples

### Basic Mathematical Reasoning

```typescript
const prompt = `
If a train travels 180 miles in 3 hours, what is its average speed?
Show your work step by step.
`

const result = await reasoningEngine.selfConsistentReasoning(prompt, context, {
  numPaths: 3,
  minConsensusThreshold: 0.67,
  extractAnswerPattern: /(\d+)\s*mph/i
})

// Result: "60 mph" with high confidence
```

### Complex Logic Problem

```typescript
const prompt = `
All roses are flowers. Some flowers are red. Some red things are beautiful.
Can we conclude that some roses are beautiful?
Explain your reasoning.
`

const result = await reasoningEngine.selfConsistentReasoning(prompt, context, {
  numPaths: 5,
  maxThoughtsPerPath: 8,
  minConsensusThreshold: 0.6
})

// Analyzes logical validity across multiple reasoning approaches
```