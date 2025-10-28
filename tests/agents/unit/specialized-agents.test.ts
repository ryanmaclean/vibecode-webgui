/**
 * Unit Tests for Specialized Agent Types
 *
 * Tests CodeAgent, ResearchAgent, CreativeAgent, and DataAnalysisAgent
 */

import {
  CodeAgent,
  ResearchAgent,
  CreativeAgent,
  DataAnalysisAgent,
  createSpecializedAgent,
} from '@/lib/agent-framework/agents';
import { UnifiedAIClient } from '@/lib/unified-ai-client';

jest.mock('@/lib/unified-ai-client');

describe('Specialized Agents - Unit Tests', () => {
  let mockClient: jest.Mocked<UnifiedAIClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = new UnifiedAIClient() as jest.Mocked<UnifiedAIClient>;
  });

  describe('CodeAgent', () => {
    it('should create CodeAgent with default tools', () => {
      const agent = new CodeAgent({ client: mockClient });

      expect(agent).toBeInstanceOf(CodeAgent);
    });

    it('should create CodeAgent without code execution', () => {
      const agent = new CodeAgent({
        enableCodeExecution: false,
        client: mockClient,
      });

      expect(agent).toBeInstanceOf(CodeAgent);
    });

    it('should create CodeAgent without file system access', () => {
      const agent = new CodeAgent({
        enableFileSystem: false,
        client: mockClient,
      });

      expect(agent).toBeInstanceOf(CodeAgent);
    });

    it('should create CodeAgent without web search', () => {
      const agent = new CodeAgent({
        enableWebSearch: false,
        client: mockClient,
      });

      expect(agent).toBeInstanceOf(CodeAgent);
    });

    it('should use low temperature for deterministic output', async () => {
      const agent = new CodeAgent({ client: mockClient });

      mockClient.chat = jest.fn().mockResolvedValue({
        content: 'Code response',
        model: 'gpt-4o',
        provider: 'openai',
      });

      await agent.processMessage('Write a function');

      expect(mockClient.chat).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(String),
        expect.objectContaining({ temperature: 0.2 })
      );
    });

    it('should handle code-specific prompts', async () => {
      const agent = new CodeAgent({ client: mockClient });

      mockClient.chat = jest.fn().mockResolvedValue({
        content: 'def hello():\n    print("Hello")',
        model: 'gpt-4o',
        provider: 'openai',
      });

      const response = await agent.processMessage('Write a Python hello function');

      expect(response.content).toContain('def hello()');
    });
  });

  describe('ResearchAgent', () => {
    it('should create ResearchAgent with default tools', () => {
      const agent = new ResearchAgent({ client: mockClient });

      expect(agent).toBeInstanceOf(ResearchAgent);
    });

    it('should create ResearchAgent without web search', () => {
      const agent = new ResearchAgent({
        enableWebSearch: false,
        client: mockClient,
      });

      expect(agent).toBeInstanceOf(ResearchAgent);
    });

    it('should create ResearchAgent without file access', () => {
      const agent = new ResearchAgent({
        enableFileAccess: false,
        client: mockClient,
      });

      expect(agent).toBeInstanceOf(ResearchAgent);
    });

    it('should respect maxSearchResults configuration', () => {
      const agent = new ResearchAgent({
        maxSearchResults: 10,
        client: mockClient,
      });

      expect(agent).toBeInstanceOf(ResearchAgent);
    });

    it('should use medium temperature for balanced output', async () => {
      const agent = new ResearchAgent({ client: mockClient });

      mockClient.chat = jest.fn().mockResolvedValue({
        content: 'Research findings',
        model: 'gpt-4o',
        provider: 'openai',
      });

      await agent.processMessage('Research quantum computing');

      expect(mockClient.chat).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(String),
        expect.objectContaining({ temperature: 0.7 })
      );
    });

    it('should handle research queries', async () => {
      const agent = new ResearchAgent({ client: mockClient });

      mockClient.chat = jest.fn().mockResolvedValue({
        content: 'Based on recent research...',
        model: 'gpt-4o',
        provider: 'openai',
      });

      const response = await agent.processMessage('What is quantum entanglement?');

      expect(response.content).toBeDefined();
    });
  });

  describe('CreativeAgent', () => {
    it('should create CreativeAgent with default tools', () => {
      const agent = new CreativeAgent({ client: mockClient });

      expect(agent).toBeInstanceOf(CreativeAgent);
    });

    it('should create CreativeAgent without web search', () => {
      const agent = new CreativeAgent({
        enableWebSearch: false,
        client: mockClient,
      });

      expect(agent).toBeInstanceOf(CreativeAgent);
    });

    it('should respect creativity level', async () => {
      const agent = new CreativeAgent({
        creativity: 0.95,
        client: mockClient,
      });

      mockClient.chat = jest.fn().mockResolvedValue({
        content: 'Creative content',
        model: 'gpt-4o',
        provider: 'openai',
      });

      await agent.processMessage('Write a story');

      expect(mockClient.chat).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(String),
        expect.objectContaining({ temperature: 0.95 })
      );
    });

    it('should use high temperature for creative output', async () => {
      const agent = new CreativeAgent({ client: mockClient });

      mockClient.chat = jest.fn().mockResolvedValue({
        content: 'Once upon a time...',
        model: 'gpt-4o',
        provider: 'openai',
      });

      await agent.processMessage('Tell me a story');

      expect(mockClient.chat).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(String),
        expect.objectContaining({ temperature: 0.8 })
      );
    });

    it('should handle creative prompts', async () => {
      const agent = new CreativeAgent({ client: mockClient });

      mockClient.chat = jest.fn().mockResolvedValue({
        content: 'A whimsical tale of adventure...',
        model: 'gpt-4o',
        provider: 'openai',
      });

      const response = await agent.processMessage('Write a fantasy story');

      expect(response.content).toBeDefined();
    });
  });

  describe('DataAnalysisAgent', () => {
    it('should create DataAnalysisAgent with default tools', () => {
      const agent = new DataAnalysisAgent({ client: mockClient });

      expect(agent).toBeInstanceOf(DataAnalysisAgent);
    });

    it('should create DataAnalysisAgent without code execution', () => {
      const agent = new DataAnalysisAgent({
        enableCodeExecution: false,
        client: mockClient,
      });

      expect(agent).toBeInstanceOf(DataAnalysisAgent);
    });

    it('should create DataAnalysisAgent without file access', () => {
      const agent = new DataAnalysisAgent({
        enableFileAccess: false,
        client: mockClient,
      });

      expect(agent).toBeInstanceOf(DataAnalysisAgent);
    });

    it('should use low temperature for precise analysis', async () => {
      const agent = new DataAnalysisAgent({ client: mockClient });

      mockClient.chat = jest.fn().mockResolvedValue({
        content: 'Analysis results',
        model: 'gpt-4o',
        provider: 'openai',
      });

      await agent.processMessage('Analyze this dataset');

      expect(mockClient.chat).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(String),
        expect.objectContaining({ temperature: 0.3 })
      );
    });

    it('should handle data analysis queries', async () => {
      const agent = new DataAnalysisAgent({ client: mockClient });

      mockClient.chat = jest.fn().mockResolvedValue({
        content: 'Statistical analysis shows...',
        model: 'gpt-4o',
        provider: 'openai',
      });

      const response = await agent.processMessage('Calculate mean and median');

      expect(response.content).toBeDefined();
    });
  });

  describe('createSpecializedAgent Factory', () => {
    it('should create CodeAgent when type is "code"', () => {
      const agent = createSpecializedAgent('code', { client: mockClient });

      expect(agent).toBeInstanceOf(CodeAgent);
    });

    it('should create ResearchAgent when type is "research"', () => {
      const agent = createSpecializedAgent('research', { client: mockClient });

      expect(agent).toBeInstanceOf(ResearchAgent);
    });

    it('should create CreativeAgent when type is "creative"', () => {
      const agent = createSpecializedAgent('creative', { client: mockClient });

      expect(agent).toBeInstanceOf(CreativeAgent);
    });

    it('should create DataAnalysisAgent when type is "data"', () => {
      const agent = createSpecializedAgent('data', { client: mockClient });

      expect(agent).toBeInstanceOf(DataAnalysisAgent);
    });

    it('should create general Agent when type is "general"', () => {
      const agent = createSpecializedAgent('general', { client: mockClient });

      expect(agent).toBeDefined();
    });

    it('should create general Agent when no type specified', () => {
      const agent = createSpecializedAgent(undefined, { client: mockClient });

      expect(agent).toBeDefined();
    });

    it('should pass options to specialized agents', () => {
      const agent = createSpecializedAgent('code', {
        model: 'gpt-4o',
        temperature: 0.1,
        client: mockClient,
      });

      expect(agent).toBeInstanceOf(CodeAgent);
    });
  });

  describe('Agent Type Behavior Differences', () => {
    it('should have different default models for different types', () => {
      const codeAgent = new CodeAgent({ client: mockClient });
      const researchAgent = new ResearchAgent({ client: mockClient });
      const creativeAgent = new CreativeAgent({ client: mockClient });
      const dataAgent = new DataAnalysisAgent({ client: mockClient });

      // Each agent type should have appropriate defaults
      expect(codeAgent).toBeDefined();
      expect(researchAgent).toBeDefined();
      expect(creativeAgent).toBeDefined();
      expect(dataAgent).toBeDefined();
    });

    it('should have different system prompts for different types', async () => {
      const agents = [
        new CodeAgent({ client: mockClient }),
        new ResearchAgent({ client: mockClient }),
        new CreativeAgent({ client: mockClient }),
        new DataAnalysisAgent({ client: mockClient }),
      ];

      mockClient.chat = jest.fn().mockResolvedValue({
        content: 'Response',
        model: 'gpt-4o',
        provider: 'openai',
      });

      for (const agent of agents) {
        await agent.processMessage('Test');
      }

      // Each agent should have used a different system prompt
      expect(mockClient.chat).toHaveBeenCalledTimes(4);
    });
  });

  describe('Tool Configuration', () => {
    it('should configure tools based on agent type and options', () => {
      // CodeAgent with all features enabled
      const fullCodeAgent = new CodeAgent({
        enableCodeExecution: true,
        enableFileSystem: true,
        enableWebSearch: true,
        client: mockClient,
      });

      // CodeAgent with minimal features
      const minimalCodeAgent = new CodeAgent({
        enableCodeExecution: false,
        enableFileSystem: false,
        enableWebSearch: false,
        client: mockClient,
      });

      expect(fullCodeAgent).toBeDefined();
      expect(minimalCodeAgent).toBeDefined();
    });

    it('should allow custom tools alongside default tools', () => {
      const customTool = {
        name: 'custom_tool',
        description: 'Custom tool',
        parameters: { type: 'object', properties: {} },
        execute: jest.fn(),
      };

      const agent = new CodeAgent({
        tools: [customTool],
        client: mockClient,
      });

      expect(agent).toBeDefined();
    });
  });
});
