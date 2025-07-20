import { MultimodalAgent, MultimodalInput, AgentContext } from '../../src/lib/multimodal-agent';

// Mock dependencies
jest.mock('../../src/lib/openrouter-client');

describe('MultimodalAgent', () => {
  let agent: MultimodalAgent;
  let mockConfig: any;

  beforeEach(() => {
    mockConfig = {
      openRouterKey: 'test-key',
      datadogConfig: {
        apiKey: 'test-dd-key',
        service: 'test-service'
      }
    };

    // Mock console.log to capture Datadog logs
    jest.spyOn(console, 'log').mockImplementation(() => {});

    agent = new MultimodalAgent(mockConfig);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with correct capabilities', () => {
      expect(agent).toBeDefined();
      expect(agent['capabilities']).toBeDefined();
      expect(agent['capabilities']).toHaveLength(4);
      
      const capabilityIds = agent['capabilities'].map((c: any) => c.id);
      expect(capabilityIds).toContain('voice-to-code');
      expect(capabilityIds).toContain('image-to-ui');
      expect(capabilityIds).toContain('multi-file-analysis');
      expect(capabilityIds).toContain('real-time-collaboration');
    });

    test('should have all capabilities enabled by default', () => {
      const capabilities = agent['capabilities'];
      capabilities.forEach((capability: any) => {
        expect(capability.enabled).toBe(true);
        expect(capability.confidence).toBeGreaterThan(0);
      });
    });
  });

  describe('Multimodal Input Processing', () => {
    const createTestContext = (): AgentContext => ({
      workspaceId: 'test-workspace',
      userId: 'test-user',
      sessionId: 'test-session',
      previousMessages: [],
      userPreferences: {
        codeStyle: 'typescript',
        framework: 'react',
        uiLibrary: 'shadcn',
        voiceSettings: {
          enabled: true,
          autoplay: false,
          speed: 1.0,
          voice: 'en-US-Standard-A'
        },
        assistantPersonality: 'professional'
      },
      projectMetadata: {
        name: 'Test Project',
        description: 'Test project for multimodal agent',
        type: 'web-app',
        technologies: ['React', 'TypeScript'],
        complexity: 'intermediate',
        estimatedTime: 60,
        targetAudience: 'developers',
        features: ['responsive', 'accessible']
      }
    });

    test('should process text input successfully', async () => {
      const input: MultimodalInput = {
        text: 'Create a React button component',
        context: createTestContext()
      };

      // Mock the AI response
      const mockResponse = {
        content: 'Here is your React button component:\n\n```typescript\nfunction Button() { return <button>Click me</button>; }\n```',
        model: 'test-model',
        tokens: 100,
        cost: 0.01
      };

      jest.spyOn(agent as any, 'getAIResponse').mockResolvedValue(mockResponse);

      const result = await agent.processMultimodalInput(input);

      expect(result).toBeDefined();
      expect(result.role).toBe('assistant');
      expect(result.content).toContain('React button component');
      expect(result.metadata.model).toBe('test-model');
      expect(result.metadata.tokens).toBe(100);
      expect(result.metadata.cost).toBe(0.01);
      expect(result.metadata.confidence).toBeGreaterThan(0);
    });

    test('should process voice input with transcription', async () => {
      const mockAudioBlob = new Blob(['mock audio data'], { type: 'audio/wav' });
      
      const input: MultimodalInput = {
        audio: mockAudioBlob,
        voice: {
          enabled: true,
          language: 'en-US'
        },
        context: createTestContext()
      };

      // Mock voice processing
      jest.spyOn(agent['voiceProcessor'], 'transcribe').mockResolvedValue('Create a todo list component');
      jest.spyOn(agent['voiceProcessor'], 'extractIntent').mockResolvedValue('create');

      const mockResponse = {
        content: 'I will create a todo list component for you.',
        model: 'test-model',
        tokens: 50,
        cost: 0.005
      };

      jest.spyOn(agent as any, 'getAIResponse').mockResolvedValue(mockResponse);

      const result = await agent.processMultimodalInput(input);

      expect(result).toBeDefined();
      expect(result.content).toContain('todo list component');
      expect(agent['voiceProcessor'].transcribe).toHaveBeenCalledWith(mockAudioBlob);
    });

    test('should process image input with vision analysis', async () => {
      const mockImageFile = new File(['mock image'], 'design.png', { type: 'image/png' });
      
      const input: MultimodalInput = {
        images: [mockImageFile],
        text: 'Convert this design to a React component',
        context: createTestContext()
      };

      // Mock vision analysis
      const mockImageAnalysis = {
        id: 'test-analysis',
        url: 'blob:test-url',
        description: 'A dashboard with cards and buttons',
        elements: [
          {
            type: 'button' as const,
            position: { x: 100, y: 200, width: 120, height: 40 },
            content: 'Submit',
            style: { backgroundColor: '#007bff' },
            interactions: ['click']
          }
        ],
        confidence: 0.9
      };

      jest.spyOn(agent['visionAnalyzer'], 'analyzeImage').mockResolvedValue(mockImageAnalysis);

      const mockResponse = {
        content: 'Based on your design, here is the React component.',
        model: 'anthropic/claude-3.5-sonnet',
        tokens: 200,
        cost: 0.02
      };

      jest.spyOn(agent as any, 'getAIResponse').mockResolvedValue(mockResponse);

      const result = await agent.processMultimodalInput(input);

      expect(result).toBeDefined();
      expect(agent['visionAnalyzer'].analyzeImage).toHaveBeenCalledWith(mockImageFile);
      expect(result.metadata.model).toBe('anthropic/claude-3.5-sonnet');
    });

    test('should process multiple files for project analysis', async () => {
      const input: MultimodalInput = {
        text: 'Analyze this codebase and suggest improvements',
        files: [
          {
            path: 'src/components/Button.tsx',
            content: 'export function Button() { return <button>Click</button>; }',
            type: 'code',
            language: 'typescript',
            size: 1024,
            lastModified: new Date()
          },
          {
            path: 'package.json',
            content: '{"name": "test", "version": "1.0.0"}',
            type: 'config',
            language: 'json',
            size: 512,
            lastModified: new Date()
          }
        ],
        context: createTestContext()
      };

      // Mock file analysis
      jest.spyOn(agent['fileManager'], 'analyzeFiles').mockResolvedValue({
        fileCount: 2,
        totalLines: 10,
        languages: ['typescript', 'json'],
        complexity: 'simple'
      });

      jest.spyOn(agent['fileManager'], 'inferProjectStructure').mockResolvedValue({
        type: 'web-app',
        technologies: ['React', 'TypeScript']
      });

      const mockResponse = {
        content: 'Analysis complete. Here are my recommendations for your codebase.',
        model: 'test-model',
        tokens: 150,
        cost: 0.015
      };

      jest.spyOn(agent as any, 'getAIResponse').mockResolvedValue(mockResponse);

      const result = await agent.processMultimodalInput(input);

      expect(result).toBeDefined();
      expect(agent['fileManager'].analyzeFiles).toHaveBeenCalledWith(input.files);
      expect(agent['fileManager'].inferProjectStructure).toHaveBeenCalledWith(input.files);
    });
  });

  describe('Model Selection', () => {
    test('should select vision model for image inputs', () => {
      const prompt = 'Image Analysis: A dashboard with buttons';
      const context = createTestContext();

      const selectedModel = agent['selectOptimalModel'](prompt, context);

      expect(selectedModel).toBe('anthropic/claude-3.5-sonnet');
    });

    test('should select appropriate model based on complexity', () => {
      const simplePrompt = 'Create a button';
      const complexPrompt = 'Refactor this large codebase with Files Analysis and optimization';
      
      const simpleContext = createTestContext();
      simpleContext.projectMetadata.complexity = 'simple';
      
      const complexContext = createTestContext();
      complexContext.projectMetadata.complexity = 'advanced';

      const simpleModel = agent['selectOptimalModel'](simplePrompt, simpleContext);
      const complexModel = agent['selectOptimalModel'](complexPrompt, complexContext);

      expect(simpleModel).toBe('openai/gpt-4o-mini');
      expect(complexModel).toBe('anthropic/claude-3.5-sonnet');
    });
  });

  describe('Response Enhancement', () => {
    test('should extract and validate code blocks', async () => {
      const aiResponse = {
        content: 'Here is your component:\n\n```typescript\nfunction Button() { return <button>Click</button>; }\n```',
        model: 'test-model',
        tokens: 100,
        cost: 0.01
      };

      const input: MultimodalInput = {
        text: 'Create a button',
        context: createTestContext()
      };

      jest.spyOn(agent['codeGenerator'], 'validateCode').mockResolvedValue({
        valid: true,
        issues: [],
        suggestions: ['Add TypeScript types']
      });

      const enhanced = await agent['enhanceResponse'](aiResponse, input);

      expect(enhanced.codeValidation).toBeDefined();
      expect(enhanced.codeValidation.valid).toBe(true);
    });

    test('should generate improvement suggestions for file inputs', async () => {
      const aiResponse = {
        content: 'Your code looks good but could be improved.',
        model: 'test-model',
        tokens: 50,
        cost: 0.005
      };

      const input: MultimodalInput = {
        files: [
          {
            path: 'src/component.js',
            content: 'function Component() { return <div>Hello</div>; }',
            type: 'code',
            language: 'javascript',
            size: 1024,
            lastModified: new Date()
          }
        ],
        context: createTestContext()
      };

      jest.spyOn(agent as any, 'generateImprovementSuggestions').mockResolvedValue([
        {
          type: 'typescript-migration',
          description: 'Consider migrating to TypeScript',
          effort: 'medium',
          impact: 'high'
        }
      ]);

      const enhanced = await agent['enhanceResponse'](aiResponse, input);

      expect(enhanced.improvements).toBeDefined();
      expect(enhanced.improvements).toHaveLength(1);
      expect(enhanced.improvements[0].type).toBe('typescript-migration');
    });
  });

  describe('Multimodal Output Generation', () => {
    test('should generate voice output when requested', async () => {
      const response = {
        content: 'Here is your React component with TypeScript.',
        model: 'test-model'
      };

      const input: MultimodalInput = {
        voice: {
          enabled: true,
          language: 'en-US'
        },
        context: createTestContext()
      };

      jest.spyOn(agent['voiceProcessor'], 'generateSpeech').mockResolvedValue('data:audio/mp3;base64,mock-audio');

      const output = await agent['generateMultimodalOutput'](response, input);

      expect(output.audioUrl).toBe('data:audio/mp3;base64,mock-audio');
      expect(agent['voiceProcessor'].generateSpeech).toHaveBeenCalled();
    });

    test('should process code blocks in response', async () => {
      const response = {
        content: 'Here is your component:\n\n```typescript\nfunction Button() { return <button>Click</button>; }\n```'
      };

      const input: MultimodalInput = {
        text: 'Create a button',
        context: createTestContext()
      };

      const mockCodeGenerated = {
        language: 'typescript',
        framework: 'react',
        files: [{ path: 'Button.tsx', content: 'function Button() { return <button>Click</button>; }' }],
        dependencies: ['react'],
        instructions: 'Install dependencies'
      };

      jest.spyOn(agent['codeGenerator'], 'processCodeBlocks').mockResolvedValue(mockCodeGenerated);

      const output = await agent['generateMultimodalOutput'](response, input);

      expect(output.codeGenerated).toBeDefined();
      expect(output.codeGenerated.language).toBe('typescript');
      expect(output.codeGenerated.files).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle processing errors gracefully', async () => {
      const input: MultimodalInput = {
        text: 'Test input',
        context: createTestContext()
      };

      jest.spyOn(agent as any, 'getAIResponse').mockRejectedValue(new Error('API Error'));

      await expect(agent.processMultimodalInput(input)).rejects.toThrow('API Error');

      // Verify error logging
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('multimodal_processing_error')
      );
    });

    test('should handle missing context gracefully', async () => {
      const input: MultimodalInput = {
        text: 'Test without context'
      };

      const mockResponse = {
        content: 'Response without context',
        model: 'test-model',
        tokens: 50,
        cost: 0.005
      };

      jest.spyOn(agent as any, 'getAIResponse').mockResolvedValue(mockResponse);

      const result = await agent.processMultimodalInput(input);

      expect(result).toBeDefined();
      expect(result.content).toBe('Response without context');
    });
  });

  describe('Datadog Integration', () => {
    test('should log agent activity with correct structure', async () => {
      const input: MultimodalInput = {
        text: 'Test logging',
        audio: new Blob(['test'], { type: 'audio/wav' }),
        images: [new File(['test'], 'test.png', { type: 'image/png' })],
        context: createTestContext()
      };

      const mockResponse = {
        content: 'Test response',
        model: 'test-model',
        tokens: 50,
        cost: 0.005
      };

      jest.spyOn(agent as any, 'getAIResponse').mockResolvedValue(mockResponse);

      await agent.processMultimodalInput(input);

      // Verify Datadog logging calls
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/multimodal_processing_start/)
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringMatching(/multimodal_processing_complete/)
      );

      // Parse the log to verify structure
      const logCalls = (console.log as jest.Mock).mock.calls;
      const startLog = JSON.parse(logCalls.find(call => 
        call[0].includes('multimodal_processing_start')
      )?.[0] || '{}');

      expect(startLog).toMatchObject({
        '@timestamp': expect.any(String),
        service: 'vibecode-webgui',
        source: 'multimodal-agent',
        event: {
          category: 'ai_agent',
          type: 'multimodal_processing_start'
        },
        inputs: ['text', 'audio', 'images'],
        workspaceId: 'test-workspace',
        userId: 'test-user'
      });
    });
  });

  describe('Utility Functions', () => {
    test('should extract text intent correctly', async () => {
      const createIntent = await agent['extractTextIntent']('Create a new component');
      const analyzeIntent = await agent['extractTextIntent']('Analyze this code');
      const fixIntent = await agent['extractTextIntent']('Fix this bug');
      const generalIntent = await agent['extractTextIntent']('Hello there');

      expect(createIntent).toBe('create');
      expect(analyzeIntent).toBe('analyze');
      expect(fixIntent).toBe('fix');
      expect(generalIntent).toBe('general');
    });

    test('should extract code blocks correctly', () => {
      const text = `
Here is some code:

\`\`\`typescript
function hello() {
  console.log('Hello World');
}
\`\`\`

And some CSS:

\`\`\`css
.button {
  background: blue;
}
\`\`\`
      `;

      const blocks = agent['extractCodeBlocks'](text);

      expect(blocks).toHaveLength(2);
      expect(blocks[0].language).toBe('typescript');
      expect(blocks[0].content).toContain('function hello()');
      expect(blocks[1].language).toBe('css');
      expect(blocks[1].content).toContain('.button');
    });

    test('should calculate confidence correctly', () => {
      const responseWithCode = {
        content: 'Here is code:\n```typescript\nfunction test() {}\n```'
      };
      const responseWithExplanation = {
        content: 'This is a detailed explanation that is quite long and provides comprehensive information about the topic.'
      };
      const shortResponse = {
        content: 'OK'
      };

      const codeConfidence = agent['calculateConfidence'](responseWithCode);
      const explanationConfidence = agent['calculateConfidence'](responseWithExplanation);
      const shortConfidence = agent['calculateConfidence'](shortResponse);

      expect(codeConfidence).toBeGreaterThan(0.7);
      expect(explanationConfidence).toBeGreaterThan(0.7);
      expect(shortConfidence).toBe(0.7); // Base confidence
    });

    test('should calculate cost correctly', () => {
      const claudeCost = agent['calculateCost'](1000, 'anthropic/claude-3.5-sonnet');
      const gptCost = agent['calculateCost'](1000, 'openai/gpt-4o-mini');
      const unknownCost = agent['calculateCost'](1000, 'unknown-model');

      expect(claudeCost).toBe(0.015);
      expect(gptCost).toBe(0.0015);
      expect(unknownCost).toBe(0.01);
    });
  });

  describe('createTestContext helper', () => {
    const createTestContext = (): AgentContext => ({
      workspaceId: 'test-workspace',
      userId: 'test-user',
      sessionId: 'test-session',
      previousMessages: [],
      userPreferences: {
        codeStyle: 'typescript',
        framework: 'react',
        uiLibrary: 'shadcn',
        voiceSettings: {
          enabled: true,
          autoplay: false,
          speed: 1.0,
          voice: 'en-US-Standard-A'
        },
        assistantPersonality: 'professional'
      },
      projectMetadata: {
        name: 'Test Project',
        description: 'Test project for multimodal agent',
        type: 'web-app',
        technologies: ['React', 'TypeScript'],
        complexity: 'intermediate',
        estimatedTime: 60,
        targetAudience: 'developers',
        features: ['responsive', 'accessible']
      }
    });
  });
}); 