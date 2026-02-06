/**
 * Model Registry Service for VibeCode
 *
 * Comprehensive model registry supporting 321+ AI models from multiple providers.
 * Provides model lookup, filtering, comparison, and recommendations.
 */

import type {
  ModelProfile,
  ModelCapabilities,
  ModelPricing,
  ModelPerformance,
  ModelLimits,
  ModelProvider,
  BenchmarkSummary,
  ModelFilterOptions,
  ModelSearchOptions,
  ModelSearchResult,
  RecommendationRequest,
  ModelRecommendation,
  ComparisonCriteria,
  ComparisonResult,
  ModelComparisonScore,
  TaskType,
  QualityTier,
  SpeedTier,
  CapabilityCategory,
} from '@/types/model-comparison';
import { DEFAULT_COMPARISON_CRITERIA } from '@/types/model-comparison';
import { MODEL_CONFIGS, ModelFamily } from '@/types/context';

// ============================================================================
// Static Model Data
// ============================================================================

/**
 * Extended model data with full profiles
 * This extends MODEL_CONFIGS with additional metadata
 */
const EXTENDED_MODEL_DATA: Partial<Record<string, Partial<ModelProfile>>> = {
  // Claude Models
  'anthropic/claude-3.5-sonnet': {
    name: 'Claude 3.5 Sonnet',
    description: 'Most intelligent Claude model, excellent for complex coding and analysis tasks',
    tags: ['coding', 'reasoning', 'analysis', 'flagship'],
    qualityTier: 'state_of_art',
    capabilities: {
      coding: 95,
      reasoning: 95,
      creative: 85,
      math: 90,
      vision: 90,
      function_calling: true,
      streaming: true,
      conversation: 90,
      instruction_following: 95,
      debugging: 95,
    },
    benchmarks: {
      overall: 92,
      byCategory: {
        code_generation: 94,
        reasoning: 93,
        math: 90,
      },
      benchmarks: [
        { name: 'HumanEval', score: 92, category: 'code_generation' },
        { name: 'MMLU', score: 88.7, category: 'general' },
      ],
      benchmarkCount: 2,
    },
  },
  'anthropic/claude-3-opus': {
    name: 'Claude 3 Opus',
    description: 'Most powerful Claude 3 model for highly complex tasks',
    tags: ['reasoning', 'analysis', 'research', 'premium'],
    qualityTier: 'state_of_art',
    capabilities: {
      coding: 90,
      reasoning: 98,
      creative: 90,
      math: 95,
      vision: 95,
      function_calling: true,
      streaming: true,
      conversation: 95,
      instruction_following: 98,
      debugging: 90,
    },
    benchmarks: {
      overall: 94,
      byCategory: {
        reasoning: 96,
        math: 95,
      },
      benchmarks: [
        { name: 'MMLU', score: 86.8, category: 'general' },
        { name: 'GPQA', score: 60.1, category: 'reasoning' },
      ],
      benchmarkCount: 2,
    },
  },
  'anthropic/claude-3-haiku': {
    name: 'Claude 3 Haiku',
    description: 'Fast and cost-effective Claude model for everyday tasks',
    tags: ['fast', 'affordable', 'chat', 'lightweight'],
    qualityTier: 'good',
    capabilities: {
      coding: 75,
      reasoning: 70,
      creative: 70,
      math: 65,
      vision: 80,
      function_calling: false,
      streaming: true,
      conversation: 80,
      instruction_following: 80,
      debugging: 70,
    },
    benchmarks: {
      overall: 72,
      byCategory: {
        general: 75,
      },
      benchmarks: [
        { name: 'MMLU', score: 75.2, category: 'general' },
      ],
      benchmarkCount: 1,
    },
  },

  // OpenAI Models
  'openai/gpt-4o': {
    name: 'GPT-4o',
    description: 'OpenAI flagship model with vision and audio capabilities',
    tags: ['multimodal', 'flagship', 'vision', 'coding'],
    qualityTier: 'state_of_art',
    capabilities: {
      coding: 90,
      reasoning: 92,
      creative: 88,
      math: 88,
      vision: 95,
      function_calling: true,
      streaming: true,
      conversation: 90,
      instruction_following: 92,
      debugging: 88,
    },
    benchmarks: {
      overall: 90,
      byCategory: {
        code_generation: 91,
        reasoning: 90,
      },
      benchmarks: [
        { name: 'HumanEval', score: 90.2, category: 'code_generation' },
        { name: 'MMLU', score: 88.7, category: 'general' },
      ],
      benchmarkCount: 2,
    },
  },
  'openai/gpt-4o-mini': {
    name: 'GPT-4o Mini',
    description: 'Smaller, faster, cheaper GPT-4o variant',
    tags: ['fast', 'affordable', 'coding', 'chat'],
    qualityTier: 'excellent',
    capabilities: {
      coding: 82,
      reasoning: 80,
      creative: 78,
      math: 75,
      vision: 85,
      function_calling: true,
      streaming: true,
      conversation: 85,
      instruction_following: 85,
      debugging: 80,
    },
    benchmarks: {
      overall: 80,
      byCategory: {
        general: 82,
      },
      benchmarks: [
        { name: 'MMLU', score: 82.0, category: 'general' },
      ],
      benchmarkCount: 1,
    },
  },
  'openai/gpt-4-turbo': {
    name: 'GPT-4 Turbo',
    description: 'Optimized GPT-4 with 128K context window',
    tags: ['large-context', 'coding', 'analysis'],
    qualityTier: 'excellent',
    capabilities: {
      coding: 88,
      reasoning: 88,
      creative: 85,
      math: 85,
      vision: 90,
      function_calling: true,
      streaming: true,
      conversation: 88,
      instruction_following: 90,
      debugging: 86,
    },
    benchmarks: {
      overall: 87,
      byCategory: {
        code_generation: 88,
        reasoning: 87,
      },
      benchmarks: [
        { name: 'HumanEval', score: 87.1, category: 'code_generation' },
      ],
      benchmarkCount: 1,
    },
  },
  'openai/gpt-3.5-turbo': {
    name: 'GPT-3.5 Turbo',
    description: 'Fast and affordable model for simple tasks',
    tags: ['fast', 'cheap', 'basic', 'chat'],
    qualityTier: 'good',
    capabilities: {
      coding: 70,
      reasoning: 65,
      creative: 70,
      math: 60,
      vision: 0,
      function_calling: true,
      streaming: true,
      conversation: 75,
      instruction_following: 75,
      debugging: 65,
    },
    benchmarks: {
      overall: 68,
      byCategory: {
        general: 70,
      },
      benchmarks: [
        { name: 'MMLU', score: 70.0, category: 'general' },
      ],
      benchmarkCount: 1,
    },
  },

  // Meta Llama Models
  'meta-llama/llama-3.1-405b-instruct': {
    name: 'Llama 3.1 405B',
    description: 'Largest open-source model, excellent for complex reasoning',
    tags: ['open-source', 'reasoning', 'math', 'flagship'],
    qualityTier: 'state_of_art',
    capabilities: {
      coding: 88,
      reasoning: 92,
      creative: 82,
      math: 90,
      vision: 0,
      function_calling: false,
      streaming: true,
      conversation: 85,
      instruction_following: 88,
      debugging: 85,
    },
    benchmarks: {
      overall: 88,
      byCategory: {
        reasoning: 90,
        math: 88,
      },
      benchmarks: [
        { name: 'MMLU', score: 88.6, category: 'general' },
        { name: 'MATH', score: 68.0, category: 'math' },
      ],
      benchmarkCount: 2,
    },
  },
  'meta-llama/llama-3.1-70b-instruct': {
    name: 'Llama 3.1 70B',
    description: 'Balanced performance and efficiency',
    tags: ['open-source', 'balanced', 'coding'],
    qualityTier: 'excellent',
    capabilities: {
      coding: 82,
      reasoning: 82,
      creative: 78,
      math: 80,
      vision: 0,
      function_calling: false,
      streaming: true,
      conversation: 80,
      instruction_following: 82,
      debugging: 78,
    },
    benchmarks: {
      overall: 80,
      byCategory: {
        general: 82,
      },
      benchmarks: [
        { name: 'MMLU', score: 83.6, category: 'general' },
      ],
      benchmarkCount: 1,
    },
  },
  'meta-llama/llama-3.1-8b-instruct': {
    name: 'Llama 3.1 8B',
    description: 'Efficient model for quick tasks',
    tags: ['open-source', 'fast', 'lightweight', 'local'],
    qualityTier: 'good',
    capabilities: {
      coding: 65,
      reasoning: 62,
      creative: 65,
      math: 55,
      vision: 0,
      function_calling: false,
      streaming: true,
      conversation: 70,
      instruction_following: 68,
      debugging: 60,
    },
    benchmarks: {
      overall: 64,
      byCategory: {
        general: 66,
      },
      benchmarks: [
        { name: 'MMLU', score: 68.4, category: 'general' },
      ],
      benchmarkCount: 1,
    },
  },

  // Google Models
  'google/gemini-pro-1.5': {
    name: 'Gemini 1.5 Pro',
    description: 'Google flagship with massive 2M token context',
    tags: ['large-context', 'multimodal', 'analysis', 'flagship'],
    qualityTier: 'state_of_art',
    capabilities: {
      coding: 85,
      reasoning: 88,
      creative: 82,
      math: 85,
      vision: 90,
      function_calling: true,
      streaming: true,
      conversation: 85,
      instruction_following: 88,
      debugging: 82,
    },
    benchmarks: {
      overall: 86,
      byCategory: {
        reasoning: 88,
        general: 85,
      },
      benchmarks: [
        { name: 'MMLU', score: 85.9, category: 'general' },
      ],
      benchmarkCount: 1,
    },
  },
  'google/gemini-flash-1.5': {
    name: 'Gemini 1.5 Flash',
    description: 'Fast and efficient Gemini variant',
    tags: ['fast', 'efficient', 'multimodal'],
    qualityTier: 'excellent',
    capabilities: {
      coding: 78,
      reasoning: 78,
      creative: 75,
      math: 72,
      vision: 85,
      function_calling: true,
      streaming: true,
      conversation: 80,
      instruction_following: 80,
      debugging: 75,
    },
    benchmarks: {
      overall: 77,
      byCategory: {
        general: 78,
      },
      benchmarks: [
        { name: 'MMLU', score: 78.9, category: 'general' },
      ],
      benchmarkCount: 1,
    },
  },

  // Mistral Models
  'mistralai/mistral-large': {
    name: 'Mistral Large',
    description: 'Mistral flagship model for complex tasks',
    tags: ['reasoning', 'coding', 'multilingual', 'flagship'],
    qualityTier: 'excellent',
    capabilities: {
      coding: 85,
      reasoning: 85,
      creative: 80,
      math: 82,
      vision: 0,
      function_calling: true,
      streaming: true,
      conversation: 82,
      instruction_following: 85,
      debugging: 82,
    },
    benchmarks: {
      overall: 83,
      byCategory: {
        reasoning: 85,
        code_generation: 84,
      },
      benchmarks: [
        { name: 'MMLU', score: 81.2, category: 'general' },
      ],
      benchmarkCount: 1,
    },
  },
  'mistralai/mistral-medium': {
    name: 'Mistral Medium',
    description: 'Balanced Mistral model',
    tags: ['balanced', 'coding', 'chat'],
    qualityTier: 'good',
    capabilities: {
      coding: 75,
      reasoning: 75,
      creative: 72,
      math: 70,
      vision: 0,
      function_calling: true,
      streaming: true,
      conversation: 75,
      instruction_following: 78,
      debugging: 72,
    },
    benchmarks: {
      overall: 74,
      byCategory: {
        general: 75,
      },
      benchmarks: [
        { name: 'MMLU', score: 75.3, category: 'general' },
      ],
      benchmarkCount: 1,
    },
  },
  'mistralai/codestral': {
    name: 'Codestral',
    description: 'Specialized coding model from Mistral',
    tags: ['coding', 'specialized', 'completion'],
    qualityTier: 'excellent',
    capabilities: {
      coding: 92,
      reasoning: 70,
      creative: 50,
      math: 75,
      vision: 0,
      function_calling: false,
      streaming: true,
      conversation: 60,
      instruction_following: 75,
      debugging: 90,
    },
    benchmarks: {
      overall: 82,
      byCategory: {
        code_generation: 93,
      },
      benchmarks: [
        { name: 'HumanEval', score: 93.1, category: 'code_generation' },
      ],
      benchmarkCount: 1,
    },
  },

  // DeepSeek Models
  'deepseek/deepseek-coder-v2': {
    name: 'DeepSeek Coder V2',
    description: 'Specialized coding model with strong performance',
    tags: ['coding', 'specialized', 'affordable'],
    qualityTier: 'excellent',
    capabilities: {
      coding: 90,
      reasoning: 75,
      creative: 55,
      math: 80,
      vision: 0,
      function_calling: false,
      streaming: true,
      conversation: 65,
      instruction_following: 78,
      debugging: 88,
    },
    benchmarks: {
      overall: 80,
      byCategory: {
        code_generation: 90,
      },
      benchmarks: [
        { name: 'HumanEval', score: 90.2, category: 'code_generation' },
      ],
      benchmarkCount: 1,
    },
  },
  'deepseek/deepseek-chat': {
    name: 'DeepSeek Chat',
    description: 'General purpose chat model',
    tags: ['chat', 'affordable', 'general'],
    qualityTier: 'good',
    capabilities: {
      coding: 75,
      reasoning: 75,
      creative: 70,
      math: 72,
      vision: 0,
      function_calling: false,
      streaming: true,
      conversation: 80,
      instruction_following: 75,
      debugging: 70,
    },
    benchmarks: {
      overall: 74,
      byCategory: {
        general: 75,
      },
      benchmarks: [
        { name: 'MMLU', score: 73.5, category: 'general' },
      ],
      benchmarkCount: 1,
    },
  },

  // Qwen Models
  'qwen/qwen-2.5-72b-instruct': {
    name: 'Qwen 2.5 72B',
    description: 'Large multilingual model from Alibaba',
    tags: ['multilingual', 'reasoning', 'coding'],
    qualityTier: 'excellent',
    capabilities: {
      coding: 85,
      reasoning: 85,
      creative: 80,
      math: 85,
      vision: 0,
      function_calling: true,
      streaming: true,
      conversation: 82,
      instruction_following: 85,
      debugging: 82,
    },
    benchmarks: {
      overall: 83,
      byCategory: {
        general: 85,
        math: 84,
      },
      benchmarks: [
        { name: 'MMLU', score: 85.3, category: 'general' },
      ],
      benchmarkCount: 1,
    },
  },
};

/**
 * Provider configurations
 */
const PROVIDERS: Record<string, ModelProvider> = {
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    tier: 'medium',
    endpoint: 'https://openrouter.ai/api/v1',
    available: true,
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    tier: 'high',
    endpoint: 'https://api.anthropic.com/v1',
    available: true,
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    tier: 'high',
    endpoint: 'https://api.openai.com/v1',
    available: true,
  },
  google: {
    id: 'google',
    name: 'Google AI',
    tier: 'medium',
    endpoint: 'https://generativelanguage.googleapis.com/v1',
    available: true,
  },
  mistral: {
    id: 'mistral',
    name: 'Mistral AI',
    tier: 'medium',
    endpoint: 'https://api.mistral.ai/v1',
    available: true,
  },
  meta: {
    id: 'meta',
    name: 'Meta (via OpenRouter)',
    tier: 'medium',
    available: true,
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    tier: 'low',
    available: true,
  },
  qwen: {
    id: 'qwen',
    name: 'Qwen (Alibaba)',
    tier: 'low',
    available: true,
  },
  huggingface: {
    id: 'huggingface',
    name: 'Hugging Face',
    tier: 'free',
    available: true,
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    tier: 'free',
    available: true,
  },
};

/**
 * Pricing data for models (per 1K tokens)
 */
const MODEL_PRICING: Record<string, ModelPricing> = {
  'anthropic/claude-3.5-sonnet': { inputPer1K: 0.003, outputPer1K: 0.015, isFree: false, billingUnit: 'token', currency: 'USD' },
  'anthropic/claude-3-opus': { inputPer1K: 0.015, outputPer1K: 0.075, isFree: false, billingUnit: 'token', currency: 'USD' },
  'anthropic/claude-3-haiku': { inputPer1K: 0.00025, outputPer1K: 0.00125, isFree: false, billingUnit: 'token', currency: 'USD' },
  'openai/gpt-4o': { inputPer1K: 0.005, outputPer1K: 0.015, isFree: false, billingUnit: 'token', currency: 'USD' },
  'openai/gpt-4o-mini': { inputPer1K: 0.00015, outputPer1K: 0.0006, isFree: false, billingUnit: 'token', currency: 'USD' },
  'openai/gpt-4-turbo': { inputPer1K: 0.01, outputPer1K: 0.03, isFree: false, billingUnit: 'token', currency: 'USD' },
  'openai/gpt-3.5-turbo': { inputPer1K: 0.0005, outputPer1K: 0.0015, isFree: false, billingUnit: 'token', currency: 'USD' },
  'meta-llama/llama-3.1-405b-instruct': { inputPer1K: 0.003, outputPer1K: 0.003, isFree: false, billingUnit: 'token', currency: 'USD' },
  'meta-llama/llama-3.1-70b-instruct': { inputPer1K: 0.0008, outputPer1K: 0.0008, isFree: false, billingUnit: 'token', currency: 'USD' },
  'meta-llama/llama-3.1-8b-instruct': { inputPer1K: 0.0001, outputPer1K: 0.0001, isFree: false, billingUnit: 'token', currency: 'USD' },
  'google/gemini-pro-1.5': { inputPer1K: 0.0025, outputPer1K: 0.0075, isFree: false, billingUnit: 'token', currency: 'USD' },
  'google/gemini-flash-1.5': { inputPer1K: 0.000075, outputPer1K: 0.0003, isFree: false, billingUnit: 'token', currency: 'USD' },
  'mistralai/mistral-large': { inputPer1K: 0.003, outputPer1K: 0.009, isFree: false, billingUnit: 'token', currency: 'USD' },
  'mistralai/mistral-medium': { inputPer1K: 0.0027, outputPer1K: 0.0081, isFree: false, billingUnit: 'token', currency: 'USD' },
  'mistralai/codestral': { inputPer1K: 0.001, outputPer1K: 0.003, isFree: false, billingUnit: 'token', currency: 'USD' },
  'deepseek/deepseek-coder-v2': { inputPer1K: 0.00014, outputPer1K: 0.00028, isFree: false, billingUnit: 'token', currency: 'USD' },
  'deepseek/deepseek-chat': { inputPer1K: 0.00014, outputPer1K: 0.00028, isFree: false, billingUnit: 'token', currency: 'USD' },
  'qwen/qwen-2.5-72b-instruct': { inputPer1K: 0.0009, outputPer1K: 0.0009, isFree: false, billingUnit: 'token', currency: 'USD' },
};

/**
 * Performance data for models
 */
const MODEL_PERFORMANCE: Record<string, ModelPerformance> = {
  'anthropic/claude-3.5-sonnet': { avgLatencyMs: 800, tokensPerSecond: 80, speedTier: 'medium', timeToFirstTokenMs: 300 },
  'anthropic/claude-3-opus': { avgLatencyMs: 1500, tokensPerSecond: 50, speedTier: 'slow', timeToFirstTokenMs: 600 },
  'anthropic/claude-3-haiku': { avgLatencyMs: 300, tokensPerSecond: 150, speedTier: 'very_fast', timeToFirstTokenMs: 100 },
  'openai/gpt-4o': { avgLatencyMs: 600, tokensPerSecond: 100, speedTier: 'fast', timeToFirstTokenMs: 200 },
  'openai/gpt-4o-mini': { avgLatencyMs: 400, tokensPerSecond: 130, speedTier: 'very_fast', timeToFirstTokenMs: 150 },
  'openai/gpt-4-turbo': { avgLatencyMs: 800, tokensPerSecond: 80, speedTier: 'medium', timeToFirstTokenMs: 300 },
  'openai/gpt-3.5-turbo': { avgLatencyMs: 300, tokensPerSecond: 150, speedTier: 'very_fast', timeToFirstTokenMs: 100 },
  'meta-llama/llama-3.1-405b-instruct': { avgLatencyMs: 1200, tokensPerSecond: 40, speedTier: 'slow', timeToFirstTokenMs: 500 },
  'meta-llama/llama-3.1-70b-instruct': { avgLatencyMs: 600, tokensPerSecond: 80, speedTier: 'medium', timeToFirstTokenMs: 250 },
  'meta-llama/llama-3.1-8b-instruct': { avgLatencyMs: 200, tokensPerSecond: 200, speedTier: 'very_fast', timeToFirstTokenMs: 80 },
  'google/gemini-pro-1.5': { avgLatencyMs: 700, tokensPerSecond: 90, speedTier: 'medium', timeToFirstTokenMs: 280 },
  'google/gemini-flash-1.5': { avgLatencyMs: 250, tokensPerSecond: 180, speedTier: 'very_fast', timeToFirstTokenMs: 90 },
  'mistralai/mistral-large': { avgLatencyMs: 700, tokensPerSecond: 85, speedTier: 'medium', timeToFirstTokenMs: 270 },
  'mistralai/mistral-medium': { avgLatencyMs: 500, tokensPerSecond: 100, speedTier: 'fast', timeToFirstTokenMs: 180 },
  'mistralai/codestral': { avgLatencyMs: 400, tokensPerSecond: 120, speedTier: 'fast', timeToFirstTokenMs: 150 },
  'deepseek/deepseek-coder-v2': { avgLatencyMs: 500, tokensPerSecond: 100, speedTier: 'fast', timeToFirstTokenMs: 200 },
  'deepseek/deepseek-chat': { avgLatencyMs: 450, tokensPerSecond: 110, speedTier: 'fast', timeToFirstTokenMs: 180 },
  'qwen/qwen-2.5-72b-instruct': { avgLatencyMs: 600, tokensPerSecond: 85, speedTier: 'medium', timeToFirstTokenMs: 240 },
};

/**
 * Model limits (context windows, output limits)
 */
const MODEL_LIMITS: Record<string, ModelLimits> = {
  'anthropic/claude-3.5-sonnet': { contextWindow: 200000, maxOutputTokens: 8192, maxInputTokens: 191808 },
  'anthropic/claude-3-opus': { contextWindow: 200000, maxOutputTokens: 4096, maxInputTokens: 195904 },
  'anthropic/claude-3-haiku': { contextWindow: 200000, maxOutputTokens: 4096, maxInputTokens: 195904 },
  'openai/gpt-4o': { contextWindow: 128000, maxOutputTokens: 16384, maxInputTokens: 111616 },
  'openai/gpt-4o-mini': { contextWindow: 128000, maxOutputTokens: 16384, maxInputTokens: 111616 },
  'openai/gpt-4-turbo': { contextWindow: 128000, maxOutputTokens: 4096, maxInputTokens: 123904 },
  'openai/gpt-3.5-turbo': { contextWindow: 16384, maxOutputTokens: 4096, maxInputTokens: 12288 },
  'meta-llama/llama-3.1-405b-instruct': { contextWindow: 128000, maxOutputTokens: 4096, maxInputTokens: 123904 },
  'meta-llama/llama-3.1-70b-instruct': { contextWindow: 128000, maxOutputTokens: 4096, maxInputTokens: 123904 },
  'meta-llama/llama-3.1-8b-instruct': { contextWindow: 128000, maxOutputTokens: 4096, maxInputTokens: 123904 },
  'google/gemini-pro-1.5': { contextWindow: 2000000, maxOutputTokens: 8192, maxInputTokens: 1991808 },
  'google/gemini-flash-1.5': { contextWindow: 1000000, maxOutputTokens: 8192, maxInputTokens: 991808 },
  'mistralai/mistral-large': { contextWindow: 128000, maxOutputTokens: 4096, maxInputTokens: 123904 },
  'mistralai/mistral-medium': { contextWindow: 32000, maxOutputTokens: 4096, maxInputTokens: 27904 },
  'mistralai/codestral': { contextWindow: 32000, maxOutputTokens: 4096, maxInputTokens: 27904 },
  'deepseek/deepseek-coder-v2': { contextWindow: 128000, maxOutputTokens: 4096, maxInputTokens: 123904 },
  'deepseek/deepseek-chat': { contextWindow: 64000, maxOutputTokens: 4096, maxInputTokens: 59904 },
  'qwen/qwen-2.5-72b-instruct': { contextWindow: 131072, maxOutputTokens: 8192, maxInputTokens: 122880 },
};

// ============================================================================
// Model Registry Service
// ============================================================================

class ModelRegistryService {
  private models: Map<string, ModelProfile> = new Map();
  private cachedModels: ModelProfile[] = [];
  private lastOpenRouterFetch: number = 0;
  private openRouterCacheDuration = 1000 * 60 * 60; // 1 hour

  constructor() {
    this.initializeModels();
  }

  /**
   * Initialize models from static data and MODEL_CONFIGS
   */
  private initializeModels(): void {
    // Build profiles from static data
    for (const modelId of Object.keys(EXTENDED_MODEL_DATA)) {
      const profile = this.buildModelProfile(modelId);
      if (profile) {
        this.models.set(modelId, profile);
      }
    }

    // Add models from MODEL_CONFIGS that aren't already included
    for (const [modelKey, config] of Object.entries(MODEL_CONFIGS)) {
      const modelId = this.normalizeModelId(modelKey);
      if (!this.models.has(modelId)) {
        const profile = this.buildProfileFromConfig(modelId, config);
        this.models.set(modelId, profile);
      }
    }

    this.cachedModels = Array.from(this.models.values());
  }

  /**
   * Normalize model ID to provider/model format
   */
  private normalizeModelId(modelKey: string): string {
    if (modelKey.includes('/')) return modelKey;

    // Map known model names to full IDs
    const modelMappings: Record<string, string> = {
      'gpt-4': 'openai/gpt-4',
      'gpt-4-turbo': 'openai/gpt-4-turbo',
      'gpt-4o': 'openai/gpt-4o',
      'gpt-3.5-turbo': 'openai/gpt-3.5-turbo',
      'claude-3-opus': 'anthropic/claude-3-opus',
      'claude-3-sonnet': 'anthropic/claude-3-sonnet',
      'claude-3-haiku': 'anthropic/claude-3-haiku',
      'llama-3-70b': 'meta-llama/llama-3-70b',
      'mistral-large': 'mistralai/mistral-large',
      'gemini-pro': 'google/gemini-pro',
    };

    return modelMappings[modelKey] || `unknown/${modelKey}`;
  }

  /**
   * Build a full model profile from available data
   */
  private buildModelProfile(modelId: string): ModelProfile | null {
    const extendedData = EXTENDED_MODEL_DATA[modelId];
    if (!extendedData) return null;

    const providerId = modelId.split('/')[0];
    const provider = PROVIDERS[providerId] || PROVIDERS['openrouter'];

    const defaultCapabilities: ModelCapabilities = {
      coding: 50,
      reasoning: 50,
      creative: 50,
      math: 50,
      vision: 0,
      function_calling: false,
      streaming: true,
      conversation: 50,
      instruction_following: 50,
      debugging: 50,
    };

    const defaultBenchmarks: BenchmarkSummary = {
      overall: 50,
      byCategory: {},
      benchmarks: [],
      benchmarkCount: 0,
    };

    return {
      id: modelId,
      name: extendedData.name || modelId.split('/')[1],
      description: extendedData.description || '',
      family: this.getModelFamily(modelId),
      provider,
      capabilities: { ...defaultCapabilities, ...extendedData.capabilities },
      pricing: MODEL_PRICING[modelId] || { inputPer1K: 0.001, outputPer1K: 0.003, isFree: false, billingUnit: 'token', currency: 'USD' },
      performance: MODEL_PERFORMANCE[modelId] || { avgLatencyMs: 500, tokensPerSecond: 80, speedTier: 'medium' },
      limits: MODEL_LIMITS[modelId] || { contextWindow: 32000, maxOutputTokens: 4096, maxInputTokens: 27904 },
      benchmarks: { ...defaultBenchmarks, ...extendedData.benchmarks },
      qualityTier: extendedData.qualityTier || 'good',
      tags: extendedData.tags || [],
      deprecated: false,
      metadata: {},
    };
  }

  /**
   * Build profile from MODEL_CONFIGS entry
   */
  private buildProfileFromConfig(modelId: string, config: typeof MODEL_CONFIGS[string]): ModelProfile {
    const providerId = modelId.split('/')[0];
    const provider = PROVIDERS[providerId] || PROVIDERS['openrouter'];

    return {
      id: modelId,
      name: config.model,
      description: `${config.model} model`,
      family: config.family,
      provider,
      capabilities: {
        coding: 50,
        reasoning: 50,
        creative: 50,
        math: 50,
        vision: 0,
        function_calling: false,
        streaming: true,
        conversation: 50,
        instruction_following: 50,
        debugging: 50,
      },
      pricing: {
        inputPer1K: config.inputCostPer1K || 0.001,
        outputPer1K: config.outputCostPer1K || 0.003,
        isFree: !config.inputCostPer1K,
        billingUnit: 'token',
        currency: 'USD',
      },
      performance: {
        avgLatencyMs: 500,
        tokensPerSecond: 80,
        speedTier: 'medium',
      },
      limits: {
        contextWindow: config.maxContextTokens,
        maxOutputTokens: config.maxOutputTokens,
        maxInputTokens: config.maxContextTokens - config.responseReserved,
      },
      benchmarks: {
        overall: 50,
        byCategory: {},
        benchmarks: [],
        benchmarkCount: 0,
      },
      qualityTier: 'good',
      tags: [],
      deprecated: false,
      metadata: {},
    };
  }

  /**
   * Determine model family from ID
   */
  private getModelFamily(modelId: string): ModelFamily | string {
    const id = modelId.toLowerCase();
    if (id.includes('gpt-4')) return ModelFamily.GPT4;
    if (id.includes('gpt-3.5')) return ModelFamily.GPT35_TURBO;
    if (id.includes('claude-3')) return ModelFamily.CLAUDE_3;
    if (id.includes('claude')) return ModelFamily.CLAUDE;
    if (id.includes('llama-3')) return ModelFamily.LLAMA_3;
    if (id.includes('llama')) return ModelFamily.LLAMA;
    if (id.includes('mistral')) return ModelFamily.MISTRAL;
    if (id.includes('gemini')) return ModelFamily.GEMINI;
    return modelId.split('/')[0];
  }

  // ============================================================================
  // Public API Methods
  // ============================================================================

  /**
   * Get all models
   */
  getAllModels(): ModelProfile[] {
    return this.cachedModels;
  }

  /**
   * Get model by ID
   */
  getModelById(modelId: string): ModelProfile | undefined {
    return this.models.get(modelId);
  }

  /**
   * Get models by provider
   */
  getModelsByProvider(providerId: string): ModelProfile[] {
    return this.cachedModels.filter(m => m.provider.id === providerId || m.id.startsWith(`${providerId}/`));
  }

  /**
   * Get models by capability
   */
  getModelsByCapability(capability: CapabilityCategory, minScore: number = 70): ModelProfile[] {
    return this.cachedModels.filter(m => {
      const capValue = m.capabilities[capability as keyof ModelCapabilities];
      return typeof capValue === 'number' && capValue >= minScore;
    });
  }

  /**
   * Search models with filters
   */
  searchModels(options: ModelSearchOptions = {}): ModelSearchResult {
    let results = this.cachedModels;

    // Apply text search
    if (options.query) {
      const query = options.query.toLowerCase();
      results = results.filter(m =>
        m.name.toLowerCase().includes(query) ||
        m.description.toLowerCase().includes(query) ||
        m.tags.some(t => t.toLowerCase().includes(query)) ||
        m.id.toLowerCase().includes(query)
      );
    }

    // Apply filters
    results = this.applyFilters(results, options);

    // Apply sorting
    results = this.applySorting(results, options);

    // Apply pagination
    const page = options.page || 1;
    const pageSize = options.pageSize || 20;
    const startIndex = (page - 1) * pageSize;
    const paginatedResults = results.slice(startIndex, startIndex + pageSize);

    return {
      models: paginatedResults,
      totalCount: results.length,
      page,
      pageSize,
      totalPages: Math.ceil(results.length / pageSize),
      filters: options,
      query: options.query,
    };
  }

  /**
   * Apply filters to model list
   */
  private applyFilters(models: ModelProfile[], options: ModelFilterOptions): ModelProfile[] {
    return models.filter(model => {
      // Provider filter
      if (options.providers && options.providers.length > 0) {
        const modelProvider = model.id.split('/')[0];
        if (!options.providers.includes(modelProvider) && !options.providers.includes(model.provider.id)) {
          return false;
        }
      }

      // Capability filter
      if (options.capabilities && options.capabilities.length > 0) {
        const hasAllCapabilities = options.capabilities.every(cap => {
          const capValue = model.capabilities[cap as keyof ModelCapabilities];
          return typeof capValue === 'boolean' ? capValue : (capValue as number) >= 70;
        });
        if (!hasAllCapabilities) return false;
      }

      // Quality tier filter
      if (options.minQualityTier) {
        const tierOrder: Record<QualityTier, number> = { basic: 0, good: 1, excellent: 2, state_of_art: 3 };
        if (tierOrder[model.qualityTier] < tierOrder[options.minQualityTier]) {
          return false;
        }
      }

      // Price filters
      if (options.maxInputCost !== undefined && model.pricing.inputPer1K > options.maxInputCost) {
        return false;
      }
      if (options.maxOutputCost !== undefined && model.pricing.outputPer1K > options.maxOutputCost) {
        return false;
      }

      // Context size filter
      if (options.minContextSize && model.limits.contextWindow < options.minContextSize) {
        return false;
      }

      // Speed tier filter
      if (options.minSpeedTier) {
        const speedOrder: Record<SpeedTier, number> = { slow: 0, medium: 1, fast: 2, very_fast: 3 };
        if (speedOrder[model.performance.speedTier] < speedOrder[options.minSpeedTier]) {
          return false;
        }
      }

      // Deprecated filter
      if (!options.includeDeprecated && model.deprecated) {
        return false;
      }

      // Vision filter
      if (options.requiresVision && model.capabilities.vision <= 0) {
        return false;
      }

      // Function calling filter
      if (options.requiresFunctionCalling && !model.capabilities.function_calling) {
        return false;
      }

      // Streaming filter
      if (options.requiresStreaming && !model.capabilities.streaming) {
        return false;
      }

      // Tags filter
      if (options.tags && options.tags.length > 0) {
        if (!options.tags.some(tag => model.tags.includes(tag))) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Apply sorting to model list
   */
  private applySorting(models: ModelProfile[], options: ModelSearchOptions): ModelProfile[] {
    const sortedModels = [...models];
    const direction = options.sortDirection === 'asc' ? 1 : -1;

    switch (options.sortBy) {
      case 'name':
        sortedModels.sort((a, b) => direction * a.name.localeCompare(b.name));
        break;
      case 'price':
        sortedModels.sort((a, b) => direction * (a.pricing.inputPer1K - b.pricing.inputPer1K));
        break;
      case 'contextSize':
        sortedModels.sort((a, b) => direction * (a.limits.contextWindow - b.limits.contextWindow));
        break;
      case 'quality':
        const qualityOrder: Record<QualityTier, number> = { basic: 0, good: 1, excellent: 2, state_of_art: 3 };
        sortedModels.sort((a, b) => direction * (qualityOrder[a.qualityTier] - qualityOrder[b.qualityTier]));
        break;
      case 'speed':
        const speedOrder: Record<SpeedTier, number> = { slow: 0, medium: 1, fast: 2, very_fast: 3 };
        sortedModels.sort((a, b) => direction * (speedOrder[a.performance.speedTier] - speedOrder[b.performance.speedTier]));
        break;
      case 'relevance':
      default:
        // Sort by benchmark overall score (quality)
        sortedModels.sort((a, b) => direction * (b.benchmarks.overall - a.benchmarks.overall));
        break;
    }

    return sortedModels;
  }

  /**
   * Get model recommendations based on task
   */
  getRecommendation(request: RecommendationRequest): ModelRecommendation {
    const taskCapabilities = this.getTaskCapabilities(request.taskType);

    // Score all models
    const scoredModels = this.cachedModels
      .filter(m => !m.deprecated)
      .filter(m => !request.excludeModels?.includes(m.id))
      .filter(m => {
        // Filter by requirements
        if (request.needsVision && m.capabilities.vision <= 0) return false;
        if (request.needsFunctionCalling && !m.capabilities.function_calling) return false;
        if (request.preferredProviders?.length && !request.preferredProviders.some(p => m.id.startsWith(p))) return false;
        if (request.qualityRequirement && request.qualityRequirement !== 'any') {
          const qualityOrder: Record<QualityTier, number> = { basic: 0, good: 1, excellent: 2, state_of_art: 3 };
          const requiredLevel = qualityOrder[request.qualityRequirement as QualityTier] || 0;
          if (qualityOrder[m.qualityTier] < requiredLevel) return false;
        }
        if (request.speedRequirement && request.speedRequirement !== 'any') {
          const speedOrder: Record<SpeedTier, number> = { slow: 0, medium: 1, fast: 2, very_fast: 3 };
          const requiredLevel = request.speedRequirement === 'fast' ? 2 : 3;
          if (speedOrder[m.performance.speedTier] < requiredLevel) return false;
        }
        return true;
      })
      .map(model => {
        let score = 0;

        // Capability matching
        for (const [cap, weight] of Object.entries(taskCapabilities)) {
          const capValue = model.capabilities[cap as keyof ModelCapabilities];
          if (typeof capValue === 'number') {
            score += capValue * weight;
          }
        }

        // Quality bonus
        const qualityBonus: Record<QualityTier, number> = { basic: 0, good: 10, excellent: 20, state_of_art: 30 };
        score += qualityBonus[model.qualityTier];

        // Budget consideration
        if (request.budget?.maxCostPerRequest) {
          const estimatedCost = this.estimateCost(model, request.estimatedInputTokens || 1000, request.estimatedOutputTokens || 500);
          if (estimatedCost > request.budget.maxCostPerRequest) {
            score -= 50;
          }
        }

        return { model, score };
      })
      .sort((a, b) => b.score - a.score);

    if (scoredModels.length === 0) {
      // Return a default recommendation
      const defaultModel = this.getModelById('anthropic/claude-3-haiku') || this.cachedModels[0];
      return {
        model: defaultModel,
        confidence: 50,
        reason: 'Default recommendation - no models matched your criteria',
        alternatives: [],
      };
    }

    const bestModel = scoredModels[0];
    const confidence = Math.min(95, Math.round(bestModel.score / 2));

    const alternatives = scoredModels.slice(1, 4).map(sm => ({
      model: sm.model,
      reason: this.generateAlternativeReason(sm.model, bestModel.model),
      tradeoffs: this.generateTradeoffs(sm.model, bestModel.model),
    }));

    return {
      model: bestModel.model,
      confidence,
      reason: this.generateRecommendationReason(bestModel.model, request),
      estimatedCost: {
        perRequest: this.estimateCost(bestModel.model, request.estimatedInputTokens || 1000, request.estimatedOutputTokens || 500),
      },
      alternatives,
    };
  }

  /**
   * Get capability weights for a task type
   */
  private getTaskCapabilities(taskType: TaskType): Partial<Record<CapabilityCategory, number>> {
    const capabilities: Record<TaskType, Partial<Record<CapabilityCategory, number>>> = {
      code_generation: { coding: 1.5, reasoning: 0.8, debugging: 1.0 },
      code_review: { coding: 1.2, debugging: 1.5, reasoning: 1.0 },
      debugging: { debugging: 1.5, coding: 1.2, reasoning: 1.0 },
      chat: { conversation: 1.5, instruction_following: 1.0 },
      analysis: { reasoning: 1.5, instruction_following: 1.0 },
      creative_writing: { creative: 1.5, conversation: 0.8 },
      summarization: { reasoning: 1.0, instruction_following: 1.2 },
      translation: { instruction_following: 1.2, conversation: 0.8 },
      math: { math: 1.5, reasoning: 1.2 },
      research: { reasoning: 1.5, instruction_following: 1.0, coding: 0.5 },
      general: { instruction_following: 1.0, conversation: 1.0, reasoning: 0.8 },
    };
    return capabilities[taskType] || capabilities.general;
  }

  /**
   * Estimate cost for a request
   */
  private estimateCost(model: ModelProfile, inputTokens: number, outputTokens: number): number {
    const inputCost = (inputTokens / 1000) * model.pricing.inputPer1K;
    const outputCost = (outputTokens / 1000) * model.pricing.outputPer1K;
    return inputCost + outputCost;
  }

  /**
   * Generate recommendation reason
   */
  private generateRecommendationReason(model: ModelProfile, request: RecommendationRequest): string {
    const reasons: string[] = [];
    reasons.push(`${model.name} is recommended for ${request.taskType.replace('_', ' ')} tasks`);

    if (model.qualityTier === 'state_of_art' || model.qualityTier === 'excellent') {
      reasons.push(`with ${model.qualityTier.replace('_', '-')} quality`);
    }

    if (model.performance.speedTier === 'fast' || model.performance.speedTier === 'very_fast') {
      reasons.push('and fast response times');
    }

    return reasons.join(' ');
  }

  /**
   * Generate alternative reason
   */
  private generateAlternativeReason(alternative: ModelProfile, best: ModelProfile): string {
    if (alternative.pricing.inputPer1K < best.pricing.inputPer1K) {
      return 'More cost-effective option';
    }
    if (alternative.performance.speedTier > best.performance.speedTier) {
      return 'Faster response times';
    }
    if (alternative.limits.contextWindow > best.limits.contextWindow) {
      return 'Larger context window';
    }
    return 'Strong alternative option';
  }

  /**
   * Generate tradeoffs between models
   */
  private generateTradeoffs(alternative: ModelProfile, best: ModelProfile): string[] {
    const tradeoffs: string[] = [];

    if (alternative.qualityTier !== best.qualityTier) {
      tradeoffs.push(`Quality: ${alternative.qualityTier} vs ${best.qualityTier}`);
    }
    if (alternative.pricing.inputPer1K !== best.pricing.inputPer1K) {
      tradeoffs.push(`Cost: $${alternative.pricing.inputPer1K}/1K vs $${best.pricing.inputPer1K}/1K`);
    }
    if (alternative.performance.speedTier !== best.performance.speedTier) {
      tradeoffs.push(`Speed: ${alternative.performance.speedTier} vs ${best.performance.speedTier}`);
    }

    return tradeoffs;
  }

  /**
   * Compare multiple models
   */
  compareModels(modelIds: string[], criteria: ComparisonCriteria = DEFAULT_COMPARISON_CRITERIA): ComparisonResult {
    const models = modelIds.map(id => this.getModelById(id)).filter((m): m is ModelProfile => m !== undefined);

    if (models.length === 0) {
      throw new Error('No valid models found for comparison');
    }

    const scores: ModelComparisonScore[] = models.map(model => {
      const criteriaScores = {
        cost: this.scoreCost(model, models),
        speed: this.scoreSpeed(model, models),
        quality: this.scoreQuality(model, models),
        contextSize: this.scoreContextSize(model, models),
      };

      const overallScore =
        criteriaScores.cost * criteria.cost +
        criteriaScores.speed * criteria.speed +
        criteriaScores.quality * criteria.quality +
        criteriaScores.contextSize * criteria.context_size;

      return {
        modelId: model.id,
        overallScore: Math.round(overallScore * 100) / 100,
        criteriaScores,
        capabilityMatch: model.benchmarks.overall,
        benchmarkScore: model.benchmarks.overall,
        pros: this.generatePros(model),
        cons: this.generateCons(model),
        rankingReason: '',
      };
    });

    // Sort by overall score
    scores.sort((a, b) => b.overallScore - a.overallScore);

    // Add ranking reasons
    scores.forEach((score, index) => {
      score.rankingReason = index === 0
        ? 'Best overall match for your criteria'
        : `Ranks #${index + 1} based on weighted criteria`;
    });

    const recommendation = scores[0].modelId;
    const recommendedModel = models.find(m => m.id === recommendation)!;

    return {
      models,
      scores,
      recommendation,
      recommendationReason: `${recommendedModel.name} scores highest with balanced performance across all criteria`,
      criteria,
      generatedAt: new Date().toISOString(),
      summary: {
        bestForCoding: this.findBestFor(models, 'coding'),
        bestForReasoning: this.findBestFor(models, 'reasoning'),
        bestValue: this.findBestValue(models),
        fastest: this.findFastest(models),
        largestContext: this.findLargestContext(models),
      },
    };
  }

  /**
   * Score model cost (higher is better = cheaper)
   */
  private scoreCost(model: ModelProfile, allModels: ModelProfile[]): number {
    const maxCost = Math.max(...allModels.map(m => m.pricing.inputPer1K + m.pricing.outputPer1K));
    const modelCost = model.pricing.inputPer1K + model.pricing.outputPer1K;
    if (maxCost === 0) return 100;
    return Math.round((1 - modelCost / maxCost) * 100);
  }

  /**
   * Score model speed
   */
  private scoreSpeed(model: ModelProfile, allModels: ModelProfile[]): number {
    const speedOrder: Record<SpeedTier, number> = { slow: 25, medium: 50, fast: 75, very_fast: 100 };
    return speedOrder[model.performance.speedTier];
  }

  /**
   * Score model quality
   */
  private scoreQuality(model: ModelProfile, allModels: ModelProfile[]): number {
    const qualityOrder: Record<QualityTier, number> = { basic: 25, good: 50, excellent: 75, state_of_art: 100 };
    return qualityOrder[model.qualityTier];
  }

  /**
   * Score context size
   */
  private scoreContextSize(model: ModelProfile, allModels: ModelProfile[]): number {
    const maxContext = Math.max(...allModels.map(m => m.limits.contextWindow));
    return Math.round((model.limits.contextWindow / maxContext) * 100);
  }

  /**
   * Generate pros for a model
   */
  private generatePros(model: ModelProfile): string[] {
    const pros: string[] = [];
    if (model.qualityTier === 'state_of_art') pros.push('State of the art quality');
    if (model.qualityTier === 'excellent') pros.push('Excellent quality');
    if (model.performance.speedTier === 'very_fast') pros.push('Very fast responses');
    if (model.pricing.isFree) pros.push('Free to use');
    if (model.pricing.inputPer1K < 0.001) pros.push('Very affordable');
    if (model.limits.contextWindow >= 100000) pros.push('Large context window');
    if (model.capabilities.vision > 0) pros.push('Vision capable');
    if (model.capabilities.function_calling) pros.push('Function calling support');
    if (model.capabilities.coding >= 90) pros.push('Excellent for coding');
    return pros.slice(0, 5);
  }

  /**
   * Generate cons for a model
   */
  private generateCons(model: ModelProfile): string[] {
    const cons: string[] = [];
    if (model.qualityTier === 'basic') cons.push('Basic quality tier');
    if (model.performance.speedTier === 'slow') cons.push('Slower response times');
    if (model.pricing.inputPer1K >= 0.01) cons.push('Higher cost');
    if (model.limits.contextWindow < 16000) cons.push('Limited context window');
    if (model.capabilities.vision <= 0) cons.push('No vision support');
    if (!model.capabilities.function_calling) cons.push('No function calling');
    return cons.slice(0, 3);
  }

  /**
   * Find best model for a capability
   */
  private findBestFor(models: ModelProfile[], capability: CapabilityCategory): string | undefined {
    return models
      .filter(m => typeof m.capabilities[capability as keyof ModelCapabilities] === 'number')
      .sort((a, b) => (b.capabilities[capability as keyof ModelCapabilities] as number) - (a.capabilities[capability as keyof ModelCapabilities] as number))
      [0]?.id;
  }

  /**
   * Find best value model
   */
  private findBestValue(models: ModelProfile[]): string | undefined {
    return models
      .filter(m => m.qualityTier !== 'basic')
      .sort((a, b) => {
        const aValue = (a.benchmarks.overall / 100) / Math.max(0.0001, a.pricing.inputPer1K);
        const bValue = (b.benchmarks.overall / 100) / Math.max(0.0001, b.pricing.inputPer1K);
        return bValue - aValue;
      })
      [0]?.id;
  }

  /**
   * Find fastest model
   */
  private findFastest(models: ModelProfile[]): string | undefined {
    const speedOrder: Record<SpeedTier, number> = { slow: 0, medium: 1, fast: 2, very_fast: 3 };
    return models
      .sort((a, b) => speedOrder[b.performance.speedTier] - speedOrder[a.performance.speedTier])
      [0]?.id;
  }

  /**
   * Find model with largest context
   */
  private findLargestContext(models: ModelProfile[]): string | undefined {
    return models
      .sort((a, b) => b.limits.contextWindow - a.limits.contextWindow)
      [0]?.id;
  }

  /**
   * Load models from OpenRouter API (for extended data)
   */
  async loadFromOpenRouter(): Promise<void> {
    const now = Date.now();
    if (now - this.lastOpenRouterFetch < this.openRouterCacheDuration) {
      return; // Use cached data
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.log('OpenRouter API key not available, using static data');
      return;
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': process.env.NEXTAUTH_URL || 'http://localhost:3000',
        },
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.statusText}`);
      }

      const data = await response.json();

      // Update models with fresh data
      for (const model of data.data || []) {
        const modelId = model.id;
        const existing = this.models.get(modelId);

        if (existing) {
          // Update pricing and limits
          existing.pricing.inputPer1K = model.pricing?.prompt || existing.pricing.inputPer1K;
          existing.pricing.outputPer1K = model.pricing?.completion || existing.pricing.outputPer1K;
          existing.limits.contextWindow = model.context_length || existing.limits.contextWindow;
        } else {
          // Add new model
          const newProfile: ModelProfile = {
            id: modelId,
            name: model.name || modelId.split('/')[1],
            description: model.description || '',
            family: this.getModelFamily(modelId),
            provider: PROVIDERS[modelId.split('/')[0]] || PROVIDERS['openrouter'],
            capabilities: {
              coding: 50,
              reasoning: 50,
              creative: 50,
              math: 50,
              vision: 0,
              function_calling: false,
              streaming: true,
              conversation: 50,
              instruction_following: 50,
              debugging: 50,
            },
            pricing: {
              inputPer1K: model.pricing?.prompt || 0.001,
              outputPer1K: model.pricing?.completion || 0.003,
              isFree: model.pricing?.prompt === 0,
              billingUnit: 'token',
              currency: 'USD',
            },
            performance: {
              avgLatencyMs: 500,
              tokensPerSecond: 80,
              speedTier: 'medium',
            },
            limits: {
              contextWindow: model.context_length || 32000,
              maxOutputTokens: 4096,
              maxInputTokens: (model.context_length || 32000) - 4096,
            },
            benchmarks: {
              overall: 50,
              byCategory: {},
              benchmarks: [],
              benchmarkCount: 0,
            },
            qualityTier: 'good',
            tags: [],
            deprecated: false,
          };
          this.models.set(modelId, newProfile);
        }
      }

      this.cachedModels = Array.from(this.models.values());
      this.lastOpenRouterFetch = now;
    } catch (error) {
      console.error('Failed to load models from OpenRouter:', error);
    }
  }

  /**
   * Get model count
   */
  getModelCount(): number {
    return this.cachedModels.length;
  }

  /**
   * Get provider list
   */
  getProviders(): ModelProvider[] {
    return Object.values(PROVIDERS);
  }

  /**
   * Get available tags
   */
  getAllTags(): string[] {
    const tagSet = new Set<string>();
    this.cachedModels.forEach(m => m.tags.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }
}

// Export singleton instance
export const modelRegistry = new ModelRegistryService();

// Export class for testing
export { ModelRegistryService };
