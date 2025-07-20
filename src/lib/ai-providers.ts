// AI Provider Configuration and Management
// Centralized configuration for multi-provider AI support

// AI Provider configuration using OpenRouter for multi-provider access

export interface AIProvider {
  id: string
  name: string
  company: string
  models: AIModel[]
  capabilities: ProviderCapabilities
  pricing: PricingTier
  status: 'active' | 'maintenance' | 'deprecated'
}

export interface AIModel {
  id: string
  name: string
  description: string
  contextWindow: number
  maxTokens: number
  supportsFunctionCalling: boolean
  supportsVision: boolean
  costPer1kTokens: {
    input: number
    output: number
  }
}

export interface ProviderCapabilities {
  streaming: boolean
  functionCalling: boolean
  vision: boolean
  codeGeneration: boolean
  reasoning: boolean
}

export type PricingTier = 'free' | 'low' | 'medium' | 'high' | 'premium'

// Provider configurations
export const AI_PROVIDERS: Record<string, AIProvider> = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    company: 'OpenAI',
    models: [
      {
        id: 'gpt-4',
        name: 'GPT-4',
        description: 'Most capable model for complex reasoning and code generation',
        contextWindow: 8192,
        maxTokens: 4096,
        supportsFunctionCalling: true,
        supportsVision: false,
        costPer1kTokens: { input: 0.03, output: 0.06 }
      },
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'Faster GPT-4 with larger context window',
        contextWindow: 128000,
        maxTokens: 4096,
        supportsFunctionCalling: true,
        supportsVision: true,
        costPer1kTokens: { input: 0.01, output: 0.03 }
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Fast and cost-effective for most coding tasks',
        contextWindow: 16384,
        maxTokens: 4096,
        supportsFunctionCalling: true,
        supportsVision: false,
        costPer1kTokens: { input: 0.0015, output: 0.002 }
      }
    ],
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: true,
      codeGeneration: true,
      reasoning: true
    },
    pricing: 'medium',
    status: 'active'
  },

  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    company: 'Anthropic',
    models: [
      {
        id: 'claude-3-opus',
        name: 'Claude 3 Opus',
        description: 'Most powerful model for complex analysis and reasoning',
        contextWindow: 200000,
        maxTokens: 4096,
        supportsFunctionCalling: true,
        supportsVision: true,
        costPer1kTokens: { input: 0.015, output: 0.075 }
      },
      {
        id: 'claude-3-sonnet',
        name: 'Claude 3 Sonnet',
        description: 'Balanced performance and speed for coding tasks',
        contextWindow: 200000,
        maxTokens: 4096,
        supportsFunctionCalling: true,
        supportsVision: true,
        costPer1kTokens: { input: 0.003, output: 0.015 }
      },
      {
        id: 'claude-3-haiku',
        name: 'Claude 3 Haiku',
        description: 'Fastest model for quick coding assistance',
        contextWindow: 200000,
        maxTokens: 4096,
        supportsFunctionCalling: true,
        supportsVision: true,
        costPer1kTokens: { input: 0.00025, output: 0.00125 }
      }
    ],
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: true,
      codeGeneration: true,
      reasoning: true
    },
    pricing: 'medium',
    status: 'active'
  },

  google: {
    id: 'google',
    name: 'Google AI',
    company: 'Google',
    models: [
      {
        id: 'gemini-pro',
        name: 'Gemini Pro',
        description: 'Google\'s advanced model for code and reasoning',
        contextWindow: 32768,
        maxTokens: 8192,
        supportsFunctionCalling: true,
        supportsVision: false,
        costPer1kTokens: { input: 0.0005, output: 0.0015 }
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: 'Latest model with enhanced capabilities',
        contextWindow: 1000000,
        maxTokens: 8192,
        supportsFunctionCalling: true,
        supportsVision: true,
        costPer1kTokens: { input: 0.00125, output: 0.00375 }
      }
    ],
    capabilities: {
      streaming: true,
      functionCalling: true,
      vision: true,
      codeGeneration: true,
      reasoning: true
    },
    pricing: 'low',
    status: 'active'
  }
}

// Model registry for OpenRouter multi-provider access
export const MODEL_REGISTRY = {
  // OpenAI models
  'gpt-4': 'openai/gpt-4',
  'gpt-4-turbo': 'openai/gpt-4-turbo',
  'gpt-3.5-turbo': 'openai/gpt-3.5-turbo',
  
  // Anthropic models
  'claude-3-opus': 'anthropic/claude-3-opus',
  'claude-3-sonnet': 'anthropic/claude-3-sonnet-20240229',
  'claude-3-haiku': 'anthropic/claude-3-haiku-20240307',
  
  // Google models
  'gemini-pro': 'google/gemini-pro',
  'gemini-1.5-pro': 'google/gemini-1.5-pro',
  
  // Additional models via OpenRouter
  'llama-3.1-70b': 'meta-llama/llama-3.1-70b-instruct',
  'mistral-large': 'mistralai/mistral-large',
  'codestral': 'mistralai/codestral-mamba',
} as const

export type SupportedModel = keyof typeof MODEL_REGISTRY

// Utility functions
export function getAllModels(): AIModel[] {
  return Object.values(AI_PROVIDERS).flatMap(provider => provider.models)
}

export function getModelsByProvider(providerId: string): AIModel[] {
  return AI_PROVIDERS[providerId]?.models || []
}

export function getModelInfo(modelId: string): AIModel | undefined {
  return getAllModels().find(model => model.id === modelId)
}

export function getProviderForModel(modelId: string): AIProvider | undefined {
  for (const provider of Object.values(AI_PROVIDERS)) {
    if (provider.models.some(model => model.id === modelId)) {
      return provider
    }
  }
  return undefined
}

export function getRecommendedModel(task: 'coding' | 'reasoning' | 'speed' | 'cost'): string {
  switch (task) {
    case 'coding':
      return 'gpt-4-turbo' // Best balance for coding
    case 'reasoning':
      return 'claude-3-opus' // Best reasoning capabilities
    case 'speed':
      return 'claude-3-haiku' // Fastest responses
    case 'cost':
      return 'gpt-3.5-turbo' // Most cost-effective
    default:
      return 'gpt-4-turbo'
  }
}

export function estimateCost(modelId: string, inputTokens: number, outputTokens: number): number {
  const model = getModelInfo(modelId)
  if (!model) return 0
  
  const inputCost = (inputTokens / 1000) * model.costPer1kTokens.input
  const outputCost = (outputTokens / 1000) * model.costPer1kTokens.output
  
  return inputCost + outputCost
}

// Default model preferences
export const DEFAULT_MODELS = {
  chat: 'gpt-4-turbo',
  codeGeneration: 'gpt-4',
  quickHelp: 'gpt-3.5-turbo',
  analysis: 'claude-3-sonnet',
  reasoning: 'claude-3-opus'
} as const