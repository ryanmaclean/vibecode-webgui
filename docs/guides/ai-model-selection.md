# AI Model Selection and Comparison Guide

A comprehensive guide for selecting, filtering, and dynamically switching between AI models in VibeCode WebGUI.

## 📚 Table of Contents

- [Overview](#-overview)
- [Quick Start](#-quick-start)
- [Model Filtering](#-model-filtering)
- [Model Recommendations](#-model-recommendations)
- [Quality and Speed Tiers](#-quality-and-speed-tiers)
- [Model Comparison](#-model-comparison)
- [Dynamic Model Switching](#-dynamic-model-switching)
- [Advanced Usage](#-advanced-usage)
- [Best Practices](#-best-practices)
- [Troubleshooting](#-troubleshooting)

## 🎯 Overview

VibeCode WebGUI provides a sophisticated AI model selection system that helps you choose the right model for your task based on quality, speed, cost, and capabilities. The system includes:

- **120+ AI Models** from multiple providers (Anthropic, OpenAI, Google, Meta, etc.)
- **Intelligent Filtering** by capabilities, cost, performance tiers
- **Smart Recommendations** based on task type and requirements
- **Dynamic Switching** for runtime model changes
- **Local Models** via Ollama integration

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/ai/models` | GET | List and filter available models |
| `/api/ai/models?action=refresh` | POST | Refresh model registry from OpenRouter |
| `/api/ai/models` (action=recommend) | POST | Get model recommendations |

### Rate Limits

- **120 requests per minute** for model listing and filtering
- Cached responses for improved performance
- Cache TTL: 5 minutes for model lists

## 🚀 Quick Start

### 1. List All Available Models

```typescript
const response = await fetch('/api/ai/models');
const { data, meta } = await response.json();

console.log(`Total models: ${meta.totalModels}`);
console.log(`Providers: ${meta.providers.length}`);
console.log(`Models:`, data.models);
```

**Response:**
```json
{
  "success": true,
  "data": {
    "models": [
      {
        "id": "anthropic/claude-3.5-sonnet",
        "name": "Claude 3.5 Sonnet",
        "provider": {
          "id": "anthropic",
          "name": "Anthropic",
          "tier": "premium"
        },
        "qualityTier": "state_of_art",
        "performance": {
          "speedTier": "fast"
        },
        "pricing": {
          "inputCostPer1M": 3.0,
          "outputCostPer1M": 15.0
        },
        "capabilities": {
          "chat": true,
          "completion": true,
          "streaming": true,
          "functionCalling": true,
          "vision": true
        }
      }
    ],
    "total": 120,
    "page": 1,
    "pageSize": 20,
    "totalPages": 6
  },
  "meta": {
    "totalModels": 120,
    "providers": [
      {
        "id": "anthropic",
        "name": "Anthropic",
        "tier": "premium",
        "available": true
      }
    ],
    "availableTags": ["vision", "function-calling", "fast", "premium"]
  }
}
```

### 2. Get Model Recommendation for a Task

```typescript
const response = await fetch('/api/ai/models', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'recommend',
    params: {
      taskType: 'code_generation',
      qualityRequirement: 'excellent',
      speedRequirement: 'fast'
    }
  })
});

const { recommendation } = await response.json();
console.log(`Recommended: ${recommendation.model.name}`);
console.log(`Reason: ${recommendation.reason}`);
```

### 3. Filter Models by Criteria

```typescript
const params = new URLSearchParams({
  minQualityTier: 'excellent',
  maxInputCost: '5.0',
  requiresVision: 'true',
  sortBy: 'price',
  sortDirection: 'asc'
});

const response = await fetch(`/api/ai/models?${params}`);
const { data } = await response.json();
```

## 🔍 Model Filtering

### Available Filter Options

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `providers` | string[] | Filter by provider IDs | `anthropic,openai` |
| `capabilities` | string[] | Required capabilities | `vision,function_calling` |
| `minQualityTier` | enum | Minimum quality tier | `excellent` |
| `minSpeedTier` | enum | Minimum speed tier | `fast` |
| `maxInputCost` | number | Max input cost per 1M tokens | `5.0` |
| `maxOutputCost` | number | Max output cost per 1M tokens | `15.0` |
| `minContextSize` | number | Minimum context window | `32000` |
| `requiresVision` | boolean | Must support vision | `true` |
| `requiresFunctionCalling` | boolean | Must support function calling | `true` |
| `requiresStreaming` | boolean | Must support streaming | `true` |
| `tags` | string[] | Filter by tags | `fast,premium` |
| `query` | string | Search query | `claude` |
| `sortBy` | enum | Sort field | `price`, `quality`, `speed` |
| `sortDirection` | enum | Sort direction | `asc`, `desc` |

### Filtering Examples

#### Filter by Quality and Cost

```typescript
// Find high-quality models under budget
const params = new URLSearchParams({
  minQualityTier: 'excellent',
  maxInputCost: '3.0',
  maxOutputCost: '10.0',
  sortBy: 'quality',
  sortDirection: 'desc'
});

const response = await fetch(`/api/ai/models?${params}`);
const { data } = await response.json();

console.log(`Found ${data.total} models matching criteria`);
data.models.forEach(model => {
  console.log(`${model.name}: $${model.pricing.inputCostPer1M}/1M input`);
});
```

#### Filter by Capabilities

```typescript
// Find models with vision and function calling
const params = new URLSearchParams({
  requiresVision: 'true',
  requiresFunctionCalling: 'true',
  minContextSize: '100000'
});

const response = await fetch(`/api/ai/models?${params}`);
const { data } = await response.json();

console.log('Models with vision and function calling:');
data.models.forEach(model => {
  console.log(`- ${model.name} (${model.limits.maxContextTokens} context)`);
});
```

#### Filter by Provider

```typescript
// Compare Anthropic and OpenAI models
const params = new URLSearchParams({
  providers: 'anthropic,openai',
  minQualityTier: 'excellent',
  sortBy: 'price'
});

const response = await fetch(`/api/ai/models?${params}`);
const { data } = await response.json();

// Group by provider
const byProvider = data.models.reduce((acc, model) => {
  const provider = model.provider.name;
  if (!acc[provider]) acc[provider] = [];
  acc[provider].push(model);
  return acc;
}, {});

Object.entries(byProvider).forEach(([provider, models]) => {
  console.log(`\n${provider}:`);
  models.forEach(m => console.log(`  - ${m.name}: $${m.pricing.inputCostPer1M}`));
});
```

#### Search and Filter Combined

```typescript
// Search for Claude models with specific requirements
const params = new URLSearchParams({
  query: 'claude',
  minQualityTier: 'good',
  requiresStreaming: 'true',
  sortBy: 'speed',
  sortDirection: 'desc'
});

const response = await fetch(`/api/ai/models?${params}`);
const { data } = await response.json();
```

### Pagination

```typescript
// Paginate through all models
async function getAllModels() {
  const allModels = [];
  let page = 1;
  const pageSize = 50;

  while (true) {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: pageSize.toString()
    });

    const response = await fetch(`/api/ai/models?${params}`);
    const { data } = await response.json();

    allModels.push(...data.models);

    if (page >= data.totalPages) break;
    page++;
  }

  return allModels;
}

const models = await getAllModels();
console.log(`Loaded ${models.length} total models`);
```

## 💡 Model Recommendations

### Recommendation System

The recommendation engine analyzes your task requirements and returns the best-fit model with reasoning and alternatives.

### Task Types

| Task Type | Description | Recommended Quality |
|-----------|-------------|---------------------|
| `code_generation` | Generate code from descriptions | Excellent - State of Art |
| `code_review` | Review and analyze code | Excellent - State of Art |
| `debugging` | Debug and fix code issues | Excellent |
| `chat` | Conversational interactions | Good - Excellent |
| `analysis` | Data and text analysis | Excellent |
| `creative_writing` | Creative content generation | Good - Excellent |
| `summarization` | Summarize long content | Good |
| `translation` | Language translation | Good - Excellent |
| `math` | Mathematical problem solving | Excellent |
| `research` | Research and information gathering | Excellent - State of Art |
| `general` | General-purpose tasks | Good |

### Basic Recommendation Request

```typescript
const response = await fetch('/api/ai/models', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'recommend',
    params: {
      taskType: 'code_generation'
    }
  })
});

const { recommendation } = await response.json();

console.log('Recommended Model:', recommendation.model.name);
console.log('Quality:', recommendation.model.qualityTier);
console.log('Speed:', recommendation.model.speedTier);
console.log('Reason:', recommendation.reason);
console.log('Confidence:', recommendation.confidence);
```

**Response:**
```json
{
  "success": true,
  "recommendation": {
    "model": {
      "id": "anthropic/claude-3.5-sonnet",
      "name": "Claude 3.5 Sonnet",
      "provider": "Anthropic",
      "qualityTier": "state_of_art",
      "speedTier": "fast",
      "pricing": {
        "inputCostPer1M": 3.0,
        "outputCostPer1M": 15.0
      },
      "limits": {
        "maxContextTokens": 200000,
        "maxOutputTokens": 8192
      }
    },
    "confidence": "high",
    "reason": "Excellent code generation capabilities with fast response times and large context window",
    "estimatedCost": {
      "perRequest": 0.00345,
      "per1000Requests": 3.45
    },
    "alternatives": [
      {
        "model": {
          "id": "openai/gpt-4-turbo",
          "name": "GPT-4 Turbo",
          "provider": "OpenAI"
        },
        "reason": "Similar quality with different API features",
        "tradeoffs": "Slightly higher cost but faster for some tasks"
      }
    ]
  }
}
```

### Advanced Recommendation with Budget

```typescript
const response = await fetch('/api/ai/models', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'recommend',
    params: {
      taskType: 'code_review',
      estimatedInputTokens: 10000,
      estimatedOutputTokens: 2000,
      budget: {
        maxCostPerRequest: 0.05,
        maxMonthlyCost: 100.0
      },
      speedRequirement: 'fast',
      qualityRequirement: 'excellent',
      needsFunctionCalling: true
    }
  })
});

const { recommendation } = await response.json();

console.log('Model:', recommendation.model.name);
console.log('Estimated cost per request:', recommendation.estimatedCost.perRequest);
console.log('Fits budget:', recommendation.estimatedCost.perRequest <= 0.05);
```

### Recommendation with Provider Preferences

```typescript
const response = await fetch('/api/ai/models', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'recommend',
    params: {
      taskType: 'debugging',
      preferredProviders: ['anthropic', 'openai'],
      excludeModels: ['anthropic/claude-instant'],
      qualityRequirement: 'excellent',
      speedRequirement: 'very_fast'
    }
  })
});

const { recommendation } = await response.json();
```

## 📊 Quality and Speed Tiers

### Quality Tiers Explained

Quality tiers represent the model's capabilities, accuracy, and reasoning ability.

| Tier | Description | Use Cases | Example Models |
|------|-------------|-----------|----------------|
| **State of Art** | Latest, most capable models | Complex reasoning, advanced code generation, research | Claude 3.5 Sonnet, GPT-4 Turbo, Gemini Pro |
| **Excellent** | High-quality, production-ready | Production code, detailed analysis, critical tasks | Claude 3 Opus, GPT-4, Gemini 1.5 Pro |
| **Good** | Reliable, cost-effective | General development, chat, standard tasks | Claude 3 Haiku, GPT-3.5 Turbo |
| **Basic** | Simple, fast responses | Simple queries, quick tests, prototyping | Smaller models, specialized models |

#### Quality Tier Selection Guide

```typescript
// State of Art - Complex code generation
const stateOfArtParams = {
  taskType: 'code_generation',
  qualityRequirement: 'state_of_art',
  // Use when: Complex architecture, critical systems, advanced algorithms
};

// Excellent - Production code review
const excellentParams = {
  taskType: 'code_review',
  qualityRequirement: 'excellent',
  // Use when: Production code, important features, detailed analysis
};

// Good - General development
const goodParams = {
  taskType: 'chat',
  qualityRequirement: 'good',
  // Use when: Development chat, documentation, standard tasks
};

// Basic - Quick tests
const basicParams = {
  taskType: 'general',
  qualityRequirement: 'any',
  // Use when: Rapid prototyping, simple queries, cost-sensitive
};
```

### Speed Tiers Explained

Speed tiers indicate how fast the model responds to requests.

| Tier | Description | Response Time | Use Cases |
|------|-------------|---------------|-----------|
| **Very Fast** | Near-instant responses | < 2 seconds | Interactive chat, real-time suggestions, autocomplete |
| **Fast** | Quick responses | 2-5 seconds | Code generation, quick reviews, general development |
| **Medium** | Standard speed | 5-10 seconds | Complex analysis, detailed reviews, research |
| **Slow** | Slower but thorough | > 10 seconds | Deep analysis, complex reasoning, large outputs |

#### Speed Tier Selection Guide

```typescript
// Very Fast - Interactive features
const veryFastParams = {
  taskType: 'chat',
  speedRequirement: 'very_fast',
  // Use when: User is waiting, real-time interaction, autocomplete
};

// Fast - Standard development
const fastParams = {
  taskType: 'code_generation',
  speedRequirement: 'fast',
  // Use when: Active development, quick iterations, code reviews
};

// Medium - Background tasks
const mediumParams = {
  taskType: 'analysis',
  speedRequirement: 'any',
  // Use when: Background processing, batch operations, detailed analysis
};
```

### Quality vs Speed vs Cost Trade-offs

```typescript
// Helper function to analyze trade-offs
async function analyzeTradeoffs(taskType: string) {
  const qualities = ['state_of_art', 'excellent', 'good', 'basic'];
  const results = [];

  for (const quality of qualities) {
    const response = await fetch('/api/ai/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'recommend',
        params: {
          taskType,
          qualityRequirement: quality,
          estimatedInputTokens: 1000,
          estimatedOutputTokens: 500
        }
      })
    });

    const { recommendation } = await response.json();
    results.push({
      quality,
      model: recommendation.model.name,
      speed: recommendation.model.speedTier,
      cost: recommendation.estimatedCost.perRequest,
      confidence: recommendation.confidence
    });
  }

  console.table(results);
  return results;
}

// Compare options for code generation
await analyzeTradeoffs('code_generation');
```

## ⚖️ Model Comparison

### Compare Multiple Models

```typescript
async function compareModels(modelIds: string[]) {
  const params = new URLSearchParams({
    pageSize: '100'
  });

  const response = await fetch(`/api/ai/models?${params}`);
  const { data } = await response.json();

  const models = data.models.filter(m => modelIds.includes(m.id));

  console.log('\nModel Comparison:\n');
  console.log('Model'.padEnd(30), 'Quality'.padEnd(15), 'Speed'.padEnd(12), 'Cost/1M In', 'Context');
  console.log('-'.repeat(85));

  models.forEach(model => {
    console.log(
      model.name.padEnd(30),
      model.qualityTier.padEnd(15),
      model.performance.speedTier.padEnd(12),
      `$${model.pricing.inputCostPer1M}`.padEnd(10),
      model.limits.maxContextTokens.toLocaleString()
    );
  });

  return models;
}

// Compare top models
await compareModels([
  'anthropic/claude-3.5-sonnet',
  'openai/gpt-4-turbo',
  'google/gemini-pro',
  'anthropic/claude-3-haiku'
]);
```

### Feature Comparison Matrix

```typescript
async function createFeatureMatrix(providers: string[]) {
  const params = new URLSearchParams({
    providers: providers.join(','),
    pageSize: '50'
  });

  const response = await fetch(`/api/ai/models?${params}`);
  const { data } = await response.json();

  const features = ['chat', 'completion', 'streaming', 'functionCalling', 'vision'];

  console.log('\nFeature Support Matrix:\n');
  console.log('Model'.padEnd(30), ...features.map(f => f.padEnd(15)));
  console.log('-'.repeat(105));

  data.models.forEach(model => {
    const support = features.map(feature =>
      (model.capabilities[feature] ? '✓' : '✗').padEnd(15)
    );
    console.log(model.name.padEnd(30), ...support);
  });
}

// Compare Anthropic and OpenAI capabilities
await createFeatureMatrix(['anthropic', 'openai']);
```

### Cost Comparison Calculator

```typescript
interface UsageEstimate {
  requestsPerDay: number;
  avgInputTokens: number;
  avgOutputTokens: number;
}

async function compareMonthlyCosts(
  modelIds: string[],
  usage: UsageEstimate
) {
  const params = new URLSearchParams({ pageSize: '100' });
  const response = await fetch(`/api/ai/models?${params}`);
  const { data } = await response.json();

  const models = data.models.filter(m => modelIds.includes(m.id));
  const requestsPerMonth = usage.requestsPerDay * 30;

  console.log('\nMonthly Cost Comparison:\n');
  console.log(`Usage: ${usage.requestsPerDay} requests/day`);
  console.log(`Input: ${usage.avgInputTokens} tokens, Output: ${usage.avgOutputTokens} tokens\n`);

  const costs = models.map(model => {
    const inputCost = (usage.avgInputTokens / 1_000_000) *
      model.pricing.inputCostPer1M * requestsPerMonth;
    const outputCost = (usage.avgOutputTokens / 1_000_000) *
      model.pricing.outputCostPer1M * requestsPerMonth;
    const totalCost = inputCost + outputCost;

    return {
      name: model.name,
      quality: model.qualityTier,
      speed: model.performance.speedTier,
      monthlyCost: totalCost,
      perRequest: totalCost / requestsPerMonth
    };
  });

  costs.sort((a, b) => a.monthlyCost - b.monthlyCost);

  console.table(costs);
  return costs;
}

// Compare costs for high-volume usage
await compareMonthlyCosts(
  [
    'anthropic/claude-3.5-sonnet',
    'anthropic/claude-3-haiku',
    'openai/gpt-4-turbo',
    'openai/gpt-3.5-turbo'
  ],
  {
    requestsPerDay: 1000,
    avgInputTokens: 2000,
    avgOutputTokens: 500
  }
);
```

## 🔄 Dynamic Model Switching

### Runtime Model Switching

```typescript
class ModelSwitcher {
  private currentModel: string;
  private modelCache: Map<string, any>;

  constructor(initialModel: string) {
    this.currentModel = initialModel;
    this.modelCache = new Map();
  }

  async switchModel(newModelId: string) {
    // Get model details
    const response = await fetch(`/api/ai/models?query=${newModelId}`);
    const { data } = await response.json();

    const model = data.models.find(m => m.id === newModelId);
    if (!model) {
      throw new Error(`Model ${newModelId} not found`);
    }

    this.currentModel = newModelId;
    this.modelCache.set(newModelId, model);

    console.log(`Switched to ${model.name}`);
    console.log(`Quality: ${model.qualityTier}, Speed: ${model.performance.speedTier}`);

    return model;
  }

  async sendMessage(message: string) {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        model: this.currentModel
      })
    });

    return response.json();
  }

  getCurrentModel() {
    return this.modelCache.get(this.currentModel);
  }
}

// Usage
const switcher = new ModelSwitcher('anthropic/claude-3-haiku');

// Start with fast, cheap model for chat
await switcher.sendMessage('Hello!');

// Switch to high-quality model for complex task
await switcher.switchModel('anthropic/claude-3.5-sonnet');
await switcher.sendMessage('Generate a React component with TypeScript...');

// Switch back for simple follow-up
await switcher.switchModel('anthropic/claude-3-haiku');
await switcher.sendMessage('Thanks!');
```

### Adaptive Model Selection

```typescript
class AdaptiveModelSelector {
  async selectModelForTask(
    message: string,
    context?: { fileCount?: number; complexity?: string }
  ) {
    // Analyze message complexity
    const isComplex = message.length > 500 ||
      message.includes('architecture') ||
      message.includes('design') ||
      context?.complexity === 'high';

    const hasFiles = (context?.fileCount ?? 0) > 5;

    // Determine task type
    let taskType: string;
    if (message.match(/generate|create|build/i)) {
      taskType = 'code_generation';
    } else if (message.match(/review|analyze|check/i)) {
      taskType = 'code_review';
    } else if (message.match(/debug|fix|error/i)) {
      taskType = 'debugging';
    } else {
      taskType = 'chat';
    }

    // Get recommendation
    const response = await fetch('/api/ai/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'recommend',
        params: {
          taskType,
          qualityRequirement: isComplex ? 'excellent' : 'good',
          speedRequirement: hasFiles ? 'any' : 'fast',
          minContextSize: hasFiles ? 100000 : undefined
        }
      })
    });

    const { recommendation } = await response.json();

    console.log(`Selected ${recommendation.model.name} for ${taskType}`);
    console.log(`Reason: ${recommendation.reason}`);

    return recommendation.model.id;
  }
}

// Usage
const selector = new AdaptiveModelSelector();

// Simple chat - selects fast, good model
const chatModel = await selector.selectModelForTask('Hello, how are you?');

// Complex generation - selects high-quality model
const codeModel = await selector.selectModelForTask(
  'Generate a complete authentication system with TypeScript',
  { complexity: 'high' }
);

// Review with many files - selects large context model
const reviewModel = await selector.selectModelForTask(
  'Review these files for security issues',
  { fileCount: 15 }
);
```

### Fallback Strategy

```typescript
class ModelFallbackStrategy {
  private fallbackChain: string[];

  constructor(preferredModel: string) {
    this.fallbackChain = [
      preferredModel,
      'anthropic/claude-3.5-sonnet',  // High-quality fallback
      'anthropic/claude-3-haiku',     // Fast fallback
      'openai/gpt-3.5-turbo'          // Final fallback
    ];
  }

  async sendWithFallback(message: string) {
    for (const modelId of this.fallbackChain) {
      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, model: modelId })
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`Success with ${modelId}`);
          return data;
        }

        // Check if rate limited
        if (response.status === 429) {
          console.log(`Rate limited on ${modelId}, trying next...`);
          continue;
        }

        // Check if model unavailable
        if (response.status === 503) {
          console.log(`${modelId} unavailable, trying next...`);
          continue;
        }

        throw new Error(`Unexpected error: ${response.status}`);
      } catch (error) {
        console.error(`Failed with ${modelId}:`, error);
        if (modelId === this.fallbackChain[this.fallbackChain.length - 1]) {
          throw new Error('All models failed');
        }
      }
    }
  }
}

// Usage
const fallback = new ModelFallbackStrategy('anthropic/claude-3-opus');
const response = await fallback.sendWithFallback('Generate code...');
```

### Load Balancing Between Models

```typescript
class ModelLoadBalancer {
  private models: string[];
  private currentIndex: number = 0;
  private requestCounts: Map<string, number>;

  constructor(models: string[]) {
    this.models = models;
    this.requestCounts = new Map(models.map(m => [m, 0]));
  }

  getNextModel(): string {
    // Round-robin selection
    const model = this.models[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.models.length;

    // Track usage
    this.requestCounts.set(model, (this.requestCounts.get(model) ?? 0) + 1);

    return model;
  }

  async sendBalanced(message: string) {
    const model = this.getNextModel();

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, model })
    });

    return response.json();
  }

  getStats() {
    console.log('\nLoad Balancing Stats:');
    this.requestCounts.forEach((count, model) => {
      console.log(`${model}: ${count} requests`);
    });
  }
}

// Usage - balance across similar-quality models
const balancer = new ModelLoadBalancer([
  'anthropic/claude-3.5-sonnet',
  'openai/gpt-4-turbo',
  'google/gemini-pro'
]);

// Send 10 requests - distributed evenly
for (let i = 0; i < 10; i++) {
  await balancer.sendBalanced(`Request ${i}`);
}

balancer.getStats();
```

## 🔧 Advanced Usage

### Ollama Local Models

```typescript
// List local Ollama models
const response = await fetch('/api/ai/models?provider=ollama');
const { data, meta } = await response.json();

if (!meta.available) {
  console.log('Ollama is not running');
} else {
  console.log(`Found ${meta.totalModels} local models`);
  console.log(`Total size: ${meta.totalSizeFormatted}`);

  data.models.forEach(model => {
    console.log(`\n${model.name}`);
    console.log(`  Family: ${model.family}`);
    console.log(`  Size: ${model.sizeFormatted}`);
    console.log(`  Parameters: ${model.parameterSize}`);
    console.log(`  Quantization: ${model.quantization}`);
  });
}
```

### Custom Model Filters

```typescript
// Create reusable filter presets
const FILTER_PRESETS = {
  budgetFriendly: {
    maxInputCost: 1.0,
    maxOutputCost: 5.0,
    minQualityTier: 'good'
  },

  premiumQuality: {
    minQualityTier: 'excellent',
    minSpeedTier: 'fast',
    requiresStreaming: true
  },

  visionCapable: {
    requiresVision: true,
    minQualityTier: 'good',
    minContextSize: 32000
  },

  functionCalling: {
    requiresFunctionCalling: true,
    minQualityTier: 'excellent',
    minSpeedTier: 'medium'
  },

  largeContext: {
    minContextSize: 100000,
    minQualityTier: 'excellent'
  }
};

// Use preset
async function applyPreset(presetName: keyof typeof FILTER_PRESETS) {
  const preset = FILTER_PRESETS[presetName];
  const params = new URLSearchParams(preset as any);

  const response = await fetch(`/api/ai/models?${params}`);
  const { data } = await response.json();

  console.log(`${presetName}: ${data.total} models found`);
  return data.models;
}

const budgetModels = await applyPreset('budgetFriendly');
const visionModels = await applyPreset('visionCapable');
```

### Model Performance Monitoring

```typescript
class ModelPerformanceMonitor {
  private stats: Map<string, {
    requests: number;
    totalTime: number;
    avgTime: number;
    errors: number;
  }>;

  constructor() {
    this.stats = new Map();
  }

  async trackRequest(modelId: string, fn: () => Promise<any>) {
    const start = Date.now();
    let error = false;

    try {
      return await fn();
    } catch (e) {
      error = true;
      throw e;
    } finally {
      const duration = Date.now() - start;
      this.recordMetrics(modelId, duration, error);
    }
  }

  private recordMetrics(modelId: string, duration: number, error: boolean) {
    const current = this.stats.get(modelId) ?? {
      requests: 0,
      totalTime: 0,
      avgTime: 0,
      errors: 0
    };

    current.requests++;
    current.totalTime += duration;
    current.avgTime = current.totalTime / current.requests;
    if (error) current.errors++;

    this.stats.set(modelId, current);
  }

  getStats(modelId: string) {
    return this.stats.get(modelId);
  }

  getAllStats() {
    const results = [];
    this.stats.forEach((stats, modelId) => {
      results.push({
        model: modelId,
        ...stats,
        successRate: ((stats.requests - stats.errors) / stats.requests * 100).toFixed(2) + '%'
      });
    });
    return results;
  }
}

// Usage
const monitor = new ModelPerformanceMonitor();

// Track requests
await monitor.trackRequest('anthropic/claude-3-haiku', async () => {
  return fetch('/api/ai/chat', {
    method: 'POST',
    body: JSON.stringify({ message: 'Hello', model: 'anthropic/claude-3-haiku' })
  });
});

// Get performance report
console.table(monitor.getAllStats());
```

## ✅ Best Practices

### 1. Choose the Right Quality Tier

```typescript
// ❌ Bad: Using state-of-art for simple tasks
const overkilResponse = await fetch('/api/ai/models', {
  method: 'POST',
  body: JSON.stringify({
    action: 'recommend',
    params: {
      taskType: 'chat',
      qualityRequirement: 'state_of_art'  // Overkill for simple chat
    }
  })
});

// ✅ Good: Match quality to task complexity
const appropriateResponse = await fetch('/api/ai/models', {
  method: 'POST',
  body: JSON.stringify({
    action: 'recommend',
    params: {
      taskType: 'chat',
      qualityRequirement: 'good'  // Sufficient for chat
    }
  })
});
```

### 2. Set Budget Constraints

```typescript
// ✅ Good: Always set budget limits for recommendations
const response = await fetch('/api/ai/models', {
  method: 'POST',
  body: JSON.stringify({
    action: 'recommend',
    params: {
      taskType: 'code_generation',
      estimatedInputTokens: 5000,
      estimatedOutputTokens: 2000,
      budget: {
        maxCostPerRequest: 0.10,
        maxMonthlyCost: 500.0
      }
    }
  })
});
```

### 3. Cache Model Metadata

```typescript
// ✅ Good: Cache model list to reduce API calls
class ModelCache {
  private cache: any = null;
  private cacheTime: number = 0;
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  async getModels(filters?: any) {
    const now = Date.now();

    if (this.cache && (now - this.cacheTime) < this.cacheTTL) {
      return this.cache;
    }

    const params = new URLSearchParams(filters);
    const response = await fetch(`/api/ai/models?${params}`);
    this.cache = await response.json();
    this.cacheTime = now;

    return this.cache;
  }

  invalidate() {
    this.cache = null;
  }
}
```

### 4. Handle Rate Limits Gracefully

```typescript
// ✅ Good: Implement exponential backoff
async function fetchWithRetry(url: string, options: any, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);

    if (response.ok) {
      return response;
    }

    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') ?? '60');
      const backoff = Math.min(retryAfter * Math.pow(2, i), 120);

      console.log(`Rate limited, retrying in ${backoff}s...`);
      await new Promise(resolve => setTimeout(resolve, backoff * 1000));
      continue;
    }

    throw new Error(`Request failed: ${response.status}`);
  }

  throw new Error('Max retries exceeded');
}
```

### 5. Monitor and Log Model Usage

```typescript
// ✅ Good: Track model usage for cost optimization
class ModelUsageTracker {
  logUsage(modelId: string, inputTokens: number, outputTokens: number, cost: number) {
    const timestamp = new Date().toISOString();

    // Log to analytics/monitoring service
    console.log(JSON.stringify({
      timestamp,
      modelId,
      inputTokens,
      outputTokens,
      cost,
      type: 'model_usage'
    }));

    // Could also send to Datadog, CloudWatch, etc.
  }

  async generateUsageReport(startDate: Date, endDate: Date) {
    // Aggregate usage data
    // Generate cost reports
    // Identify optimization opportunities
  }
}
```

## 🐛 Troubleshooting

### Model Not Found

```typescript
// Problem: Model ID not found
const response = await fetch('/api/ai/models?query=invalid-model');
const { data } = await response.json();

if (data.models.length === 0) {
  // Solution 1: Search for similar models
  const searchResponse = await fetch('/api/ai/models?query=claude');
  const { data: searchData } = await searchResponse.json();

  console.log('Did you mean one of these?');
  searchData.models.forEach(m => console.log(`- ${m.id}: ${m.name}`));

  // Solution 2: Get all available providers
  const allResponse = await fetch('/api/ai/models');
  const { meta } = await allResponse.json();

  console.log('Available providers:', meta.providers);
}
```

### No Models Match Filters

```typescript
// Problem: Filters too restrictive
const params = new URLSearchParams({
  minQualityTier: 'state_of_art',
  maxInputCost: '0.50',  // Too low
  requiresVision: 'true',
  minContextSize: '200000'
});

const response = await fetch(`/api/ai/models?${params}`);
const { data } = await response.json();

if (data.total === 0) {
  // Solution: Relax constraints progressively
  const relaxedFilters = [
    { ...params, maxInputCost: '3.0' },
    { ...params, requiresVision: undefined },
    { ...params, minContextSize: '100000' }
  ];

  for (const filter of relaxedFilters) {
    const testResponse = await fetch(`/api/ai/models?${new URLSearchParams(filter)}`);
    const { data: testData } = await testResponse.json();

    if (testData.total > 0) {
      console.log(`Found ${testData.total} models with relaxed filters`);
      break;
    }
  }
}
```

### Ollama Models Not Appearing

```typescript
// Problem: Ollama models not listed
const response = await fetch('/api/ai/models?provider=ollama');
const { meta } = await response.json();

if (!meta.available) {
  console.log('Troubleshooting steps:');
  console.log('1. Check if Ollama is running: ollama list');
  console.log('2. Verify Ollama URL: echo $OLLAMA_HOST');
  console.log('3. Test connectivity: curl http://localhost:11434/api/tags');
  console.log('4. Check firewall settings');
}
```

### Recommendation Confidence Low

```typescript
// Problem: Low confidence recommendations
const response = await fetch('/api/ai/models', {
  method: 'POST',
  body: JSON.stringify({
    action: 'recommend',
    params: {
      taskType: 'general',  // Too vague
      qualityRequirement: 'any'
    }
  })
});

const { recommendation } = await response.json();

if (recommendation.confidence === 'low') {
  // Solution: Provide more specific requirements
  const betterResponse = await fetch('/api/ai/models', {
    method: 'POST',
    body: JSON.stringify({
      action: 'recommend',
      params: {
        taskType: 'code_generation',  // Specific task
        qualityRequirement: 'excellent',
        speedRequirement: 'fast',
        needsFunctionCalling: true,
        estimatedInputTokens: 2000,
        estimatedOutputTokens: 1000
      }
    })
  });

  const { recommendation: better } = await betterResponse.json();
  console.log('Improved confidence:', better.confidence);
}
```

## 📚 Related Documentation

- [API Documentation](../api/README.md) - Complete API reference
- [AI Chat Guide](./ai-chat-integration.md) - Chat implementation guide
- [Security Guide](../security/implementation.md) - Security best practices
- [Rate Limiting](../security/rate-limiting.md) - Rate limit configuration

---

**Last Updated**: 2025-01-24
**Maintained By**: Documentation Team
