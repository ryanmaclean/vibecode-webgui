import { describe, it, expect, beforeAll } from '@jest/globals';
import { ai } from '..';

describe('AI Integration', () => {
  beforeAll(async () => {
    // Initialize the AI integration
    await ai.initialize();
  });

  it('should initialize successfully', () => {
    expect(ai).toBeDefined();
    expect(ai.search).toBeDefined();
    expect(ai.prompts).toBeDefined();
    expect(ai.docs).toBeDefined();
  });

  it('should add and retrieve prompts', async () => {
    const testPrompt = {
      name: 'test-prompt',
      description: 'A test prompt',
      template: 'This is a test prompt with {{variable}}',
      tags: ['test', 'integration'],
      version: '1.0.0'
    };

    const prompt = await ai.prompts.addPrompt(testPrompt);

    expect(prompt).toBeDefined();
    expect(prompt.id).toBeDefined();
    expect(prompt.name).toBe('test-prompt');
    
    const retrievedPrompt = await ai.prompts.getPrompt(prompt.id);
    expect(retrievedPrompt).toBeDefined();
    expect(retrievedPrompt?.name).toBe('test-prompt');
  });

  it('should perform vector search', async () => {
    // This test requires a running ChromaDB instance
    if (process.env.CHROMA_DB_URL) {
      const results = await ai.search.semanticSearch('test', 'documentation', 1);
      expect(Array.isArray(results)).toBe(true);
    } else {
      console.warn('Skipping vector search test - CHROMA_DB_URL not set');
    }
  });
});
