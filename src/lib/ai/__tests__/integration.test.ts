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
    const promptId = await ai.prompts.addPrompt({
      name: 'Test Prompt',
      description: 'A test prompt',
      template: 'This is a test prompt with {variable}',
      tags: ['test']
    });

    expect(promptId).toBeDefined();
    
    const prompt = ai.prompts.getPrompt(promptId);
    expect(prompt).toBeDefined();
    expect(prompt?.name).toBe('Test Prompt');
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
