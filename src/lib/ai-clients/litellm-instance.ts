/**
 * LiteLLM Client Instance
 * Shared instance of LiteLLM client for the application
 */

import { LiteLLMClient } from './litellm-client';

// Initialize LiteLLM client
export const litellmClient = new LiteLLMClient({
  baseUrl: process.env.LITELLM_BASE_URL || 'http://localhost:4000',
  apiKey: process.env.LITELLM_MASTER_KEY || 'sk-vibecode-master-key-12345',
  defaultModel: 'gpt-4o-mini',
  enableLogging: true,
  enableCaching: true
});