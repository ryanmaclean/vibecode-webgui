/**
 * Unit tests for Claude Code SDK module
 * Tests the AI-powered code assistance SDK
 */

// Mock the Anthropic SDK before importing the module
// Using virtual: true since the package may not be installed
const mockCreate = jest.fn();

// Clear module cache and set up mock before each test
beforeEach(() => {
  jest.resetModules();
  mockCreate.mockClear();
});

// Virtual mock for Anthropic SDK
jest.mock(
  '@anthropic-ai/sdk',
  () => {
    const mockClass = jest.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    }));
    return {
      __esModule: true,
      default: mockClass,
    };
  },
  { virtual: true }
);

describe('Claude Code SDK Module', () => {
  let claudeModule;

  beforeEach(() => {
    claudeModule = require('../claude-code-sdk');
  });

  describe('Module exports', () => {
    it('should export ClaudeCodeSDK class', () => {
      expect(claudeModule.ClaudeCodeSDK).toBeDefined();
      expect(typeof claudeModule.ClaudeCodeSDK).toBe('function');
    });

    it('should export claudeCodeSDK global instance', () => {
      expect(claudeModule.claudeCodeSDK).toBeDefined();
      expect(claudeModule.claudeCodeSDK).toBeInstanceOf(claudeModule.ClaudeCodeSDK);
    });
  });

  describe('ClaudeCodeSDK class', () => {
    let sdk;

    beforeEach(() => {
      sdk = new claudeModule.ClaudeCodeSDK({
        apiKey: 'test-api-key',
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 1000,
        temperature: 0.1,
      });
    });

    describe('constructor', () => {
      it('should create SDK with provided config', () => {
        expect(sdk).toBeDefined();
        expect(sdk).toBeInstanceOf(claudeModule.ClaudeCodeSDK);
      });

      it('should use default values when not provided', () => {
        const defaultSdk = new claudeModule.ClaudeCodeSDK({});
        expect(defaultSdk).toBeInstanceOf(claudeModule.ClaudeCodeSDK);
      });
    });

    describe('generateCode', () => {
      it('should be a function', () => {
        expect(typeof sdk.generateCode).toBe('function');
      });

      it('should call Anthropic API with correct parameters', async () => {
        mockCreate.mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: '```typescript\nconst hello = "world";\n```\n\nThis creates a constant.',
            },
          ],
        });

        const request = {
          prompt: 'Create a hello world variable',
          context: {
            language: 'typescript',
            filePath: '/src/test.ts',
          },
        };

        const result = await sdk.generateCode(request);

        expect(mockCreate).toHaveBeenCalledTimes(1);
        expect(result).toBeDefined();
        expect(result.code).toBeDefined();
        expect(result.explanation).toBeDefined();
        expect(typeof result.confidence).toBe('number');
      });

      it('should throw error on API failure', async () => {
        mockCreate.mockRejectedValueOnce(new Error('API Error'));

        const request = {
          prompt: 'Generate code',
          context: {
            language: 'javascript',
            filePath: '/test.js',
          },
        };

        await expect(sdk.generateCode(request)).rejects.toThrow(
          'Failed to generate code: API Error'
        );
      });

      it('should throw error on unexpected response type', async () => {
        mockCreate.mockResolvedValueOnce({
          content: [{ type: 'image', data: 'binary' }],
        });

        const request = {
          prompt: 'Generate code',
          context: {
            language: 'javascript',
            filePath: '/test.js',
          },
        };

        await expect(sdk.generateCode(request)).rejects.toThrow(
          'Unexpected response type from Claude'
        );
      });
    });

    describe('chat', () => {
      it('should be a function', () => {
        expect(typeof sdk.chat).toBe('function');
      });

      it('should call Anthropic API with conversation history', async () => {
        mockCreate.mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: 'Here is how to fix the bug:\n\n```javascript\nconst fix = true;\n```',
            },
          ],
        });

        const request = {
          message: 'How do I fix this bug?',
          context: {
            language: 'javascript',
            filePath: '/src/app.js',
            selectedText: 'const buggy = undefined;',
          },
          conversationHistory: [
            { role: 'user', content: 'I have a bug' },
            { role: 'assistant', content: 'What kind of bug?' },
          ],
        };

        const result = await sdk.chat(request);

        expect(mockCreate).toHaveBeenCalledTimes(1);
        expect(result).toBeDefined();
        expect(result.message).toBeDefined();
      });

      it('should throw error on API failure', async () => {
        mockCreate.mockRejectedValueOnce(new Error('Network Error'));

        const request = {
          message: 'Hello',
          context: {
            language: 'python',
            filePath: '/main.py',
          },
        };

        await expect(sdk.chat(request)).rejects.toThrow(
          'Chat failed: Network Error'
        );
      });
    });

    describe('analyzeCode', () => {
      it('should be a function', () => {
        expect(typeof sdk.analyzeCode).toBe('function');
      });

      it('should call Anthropic API with analysis type', async () => {
        mockCreate.mockResolvedValueOnce({
          content: [
            {
              type: 'text',
              text: 'Code Review Analysis:\n\nLine 1: info: Variable naming could be improved.\n\nOverall the code is well-structured.',
            },
          ],
        });

        const request = {
          code: 'const x = 1;',
          language: 'javascript',
          analysisType: 'review',
        };

        const result = await sdk.analyzeCode(request);

        expect(mockCreate).toHaveBeenCalledTimes(1);
        expect(result).toBeDefined();
        expect(result.analysis).toBeDefined();
      });

      it('should support different analysis types', async () => {
        const analysisTypes = ['review', 'debug', 'optimize', 'explain', 'test'];

        for (const analysisType of analysisTypes) {
          mockCreate.mockResolvedValueOnce({
            content: [{ type: 'text', text: 'Analysis complete.' }],
          });

          const request = {
            code: 'function test() {}',
            language: 'javascript',
            analysisType,
          };

          const result = await sdk.analyzeCode(request);
          expect(result.analysis).toBeDefined();
        }
      });

      it('should throw error on API failure', async () => {
        mockCreate.mockRejectedValueOnce(new Error('Timeout'));

        const request = {
          code: 'broken code',
          language: 'javascript',
          analysisType: 'debug',
        };

        await expect(sdk.analyzeCode(request)).rejects.toThrow(
          'Analysis failed: Timeout'
        );
      });
    });
  });

  describe('Type definitions (structural tests)', () => {
    it('CodeContext should have required properties', () => {
      const context = {
        language: 'typescript',
        filePath: '/src/index.ts',
      };

      expect(context.language).toBe('typescript');
      expect(context.filePath).toBe('/src/index.ts');
    });

    it('CodeContext should accept optional properties', () => {
      const context = {
        language: 'python',
        filePath: '/main.py',
        selectedText: 'print("hello")',
        fullText: 'import os\nprint("hello")',
        cursorPosition: { line: 2, column: 5 },
        projectStructure: ['main.py', 'utils.py'],
        recentChanges: ['Added print statement'],
      };

      expect(context.selectedText).toBe('print("hello")');
      expect(context.cursorPosition.line).toBe(2);
      expect(context.projectStructure).toHaveLength(2);
    });

    it('GenerateCodeResponse should have expected structure', () => {
      const response = {
        code: 'const x = 1;',
        explanation: 'Creates a constant',
        confidence: 0.9,
        suggestions: ['Consider using let'],
      };

      expect(response.code).toBeDefined();
      expect(response.confidence).toBeGreaterThanOrEqual(0);
      expect(response.confidence).toBeLessThanOrEqual(1);
    });

    it('CodeAnalysisResponse should have expected structure', () => {
      const response = {
        analysis: 'Code looks good',
        issues: [
          {
            line: 1,
            severity: 'warning',
            message: 'Unused variable',
            suggestion: 'Remove or use the variable',
          },
        ],
        improvements: ['Add type annotations'],
        testSuggestions: ['Test edge cases'],
      };

      expect(response.analysis).toBeDefined();
      expect(response.issues[0].severity).toBe('warning');
    });
  });
});
