import type { ModelConfig } from '../types';

export const MODELS: ModelConfig[] = [
  // Docker Model Runner Local Models (from the blog post)
  {
    id: 'ai/smollm2:360M-Q4_K_M',
    name: 'SmolLM2 360M (Local)',
    provider: 'Docker Model Runner',
    supportsImages: false,
    supportsFiles: true,
    supportsAudio: false,
    maxTokens: 2048,
    inputCostPer1k: 0, // Local models are free
    outputCostPer1k: 0,
    contextWindow: 8192
  },
  {
    id: 'ai/llama3.2:1b-Q4_K_M',
    name: 'Llama 3.2 1B (Local)',
    provider: 'Docker Model Runner',
    supportsImages: false,
    supportsFiles: true,
    supportsAudio: false,
    maxTokens: 2048,
    inputCostPer1k: 0,
    outputCostPer1k: 0,
    contextWindow: 8192
  },
  {
    id: 'ai/qwen2.5-coder:1.5b-Q4_K_M',
    name: 'Qwen2.5 Coder 1.5B (Local)',
    provider: 'Docker Model Runner',
    supportsImages: false,
    supportsFiles: true,
    supportsAudio: false,
    maxTokens: 4096,
    inputCostPer1k: 0,
    outputCostPer1k: 0,
    contextWindow: 16384
  },
  // Cloud models for comparison
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    supportsImages: true,
    supportsFiles: true,
    supportsAudio: false,
    maxTokens: 8192,
    inputCostPer1k: 0.003,
    outputCostPer1k: 0.015,
    contextWindow: 200000
  },
  {
    id: 'openai/gpt-4-vision',
    name: 'GPT-4 Vision',
    provider: 'OpenAI',
    supportsImages: true,
    supportsFiles: true,
    supportsAudio: true,
    maxTokens: 4096,
    inputCostPer1k: 0.01,
    outputCostPer1k: 0.03,
    contextWindow: 128000
  },
  {
    id: 'google/gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    supportsImages: true,
    supportsFiles: true,
    supportsAudio: true,
    maxTokens: 8192,
    inputCostPer1k: 0.000125,
    outputCostPer1k: 0.000375,
    contextWindow: 1000000
  }
];
