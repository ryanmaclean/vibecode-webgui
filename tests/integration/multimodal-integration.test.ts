import { MultimodalAgent, MultimodalInput } from '../../src/lib/multimodal-agent';
import { MultimodalSampleGenerator } from '../../src/samples/multimodal-agent-samples';

/**
 * Multimodal Integration Tests
 * 
 * Tests real integration with:
 * - OpenRouter API (if OPENROUTER_API_KEY provided)
 * - Datadog logging and monitoring
 * - File processing and analysis
 * - Voice and vision capabilities
 * - Geographic tracking
 */

describe('Multimodal Agent Integration', () => {
  let agent: MultimodalAgent;
  let sampleGenerator: MultimodalSampleGenerator;
  const hasApiKey = !!process.env.OPENROUTER_API_KEY;

  beforeAll(() => {
    // Initialize agent with real or mock configuration
    agent = new MultimodalAgent({
      openRouterKey: process.env.OPENROUTER_API_KEY || 'mock-key-for-testing',
      datadogConfig: {
        apiKey: process.env.DD_API_KEY || 'mock-dd-key',
        service: 'vibecode-multimodal-test'
      }
    });

    sampleGenerator = new MultimodalSampleGenerator(agent);

    // Mock console.log to capture Datadog logs
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('🔧 Agent Initialization', () => {
    test('should initialize with all required components', () => {
      expect(agent).toBeDefined();
      expect(agent['openRouter']).toBeDefined();
      expect(agent['voiceProcessor']).toBeDefined();
      expect(agent['visionAnalyzer']).toBeDefined();
      expect(agent['codeGenerator']).toBeDefined();
      expect(agent['fileManager']).toBeDefined();
      expect(agent['capabilities']).toHaveLength(4);
    });

    test('should have all capabilities enabled', () => {
      const capabilities = agent['capabilities'];
      capabilities.forEach(capability => {
        expect(capability.enabled).toBe(true);
        expect(capability.confidence).toBeGreaterThan(0.5);
      });
    });
  });

  describe('📝 Text Processing Integration', () => {
    test('should process simple text input and generate response', async () => {
      const input: MultimodalInput = {
        text: 'Create a simple React button component with TypeScript',
        context: {
          workspaceId: 'test-workspace',
          userId: 'test-user',
          sessionId: `test-session-${Date.now()}`,
          previousMessages: [],
          userPreferences: {
            codeStyle: 'typescript',
            framework: 'react',
            uiLibrary: 'shadcn',
            voiceSettings: {
              enabled: false,
              autoplay: false,
              speed: 1.0,
              voice: 'en-US-Standard-A'
            },
            assistantPersonality: 'professional'
          },
          projectMetadata: {
            name: 'Test Project',
            description: 'Integration test project',
            type: 'web-app',
            technologies: ['React', 'TypeScript'],
            complexity: 'simple',
            estimatedTime: 30,
            targetAudience: 'developers',
            features: ['responsive']
          }
        }
      };

      const startTime = Date.now();
      const result = await agent.processMultimodalInput(input);
      const duration = Date.now() - startTime;

      // Validate response structure
      expect(result).toMatchObject({
        id: expect.any(String),
        role: 'assistant',
        content: expect.any(String),
        timestamp: expect.any(Date),
        metadata: {
          model: expect.any(String),
          tokens: expect.any(Number),
          cost: expect.any(Number),
          processingTime: expect.any(Number),
          confidence: expect.any(Number)
        }
      });

      // Validate response quality
      expect(result.content.length).toBeGreaterThan(10);
      expect(result.metadata.confidence).toBeGreaterThan(0.5);
      expect(result.metadata.confidence).toBeLessThanOrEqual(1.0);
      expect(result.metadata.processingTime).toBeGreaterThan(0);
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds

      // Validate content contains relevant keywords
      const contentLower = result.content.toLowerCase();
      expect(contentLower).toMatch(/react|button|component|typescript/);

      // Verify Datadog logging occurred
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('multimodal_processing_start')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('multimodal_processing_complete')
      );
    }, 30000);

    test('should handle complex coding request with context', async () => {
      const input: MultimodalInput = {
        text: 'Create a todo application with CRUD operations, TypeScript, and proper error handling',
        context: {
          workspaceId: 'test-workspace-complex',
          userId: 'test-user',
          sessionId: `test-session-${Date.now()}`,
          previousMessages: [],
          userPreferences: {
            codeStyle: 'typescript',
            framework: 'react',
            uiLibrary: 'shadcn',
            voiceSettings: {
              enabled: false,
              autoplay: false,
              speed: 1.0,
              voice: 'en-US-Standard-A'
            },
            assistantPersonality: 'technical'
          },
          projectMetadata: {
            name: 'Complex Todo App',
            description: 'Advanced todo application with full CRUD',
            type: 'web-app',
            technologies: ['React', 'TypeScript', 'Node.js'],
            complexity: 'advanced',
            estimatedTime: 120,
            targetAudience: 'developers',
            features: ['crud', 'error-handling', 'typescript']
          }
        }
      };

      const result = await agent.processMultimodalInput(input);

      // Should select appropriate model for complex task
      expect(result.metadata.model).toMatch(/claude-3.5-sonnet|gpt-4/);
      expect(result.content.length).toBeGreaterThan(200);
      
      // Should contain technical content
      const contentLower = result.content.toLowerCase();
      expect(contentLower).toMatch(/todo|crud|typescript|error/);
      
      // Complex tasks should have high confidence
      expect(result.metadata.confidence).toBeGreaterThan(0.7);
    }, 45000);
  });

  describe('🎤 Voice Processing Integration', () => {
    test('should process voice input with transcription', async () => {
      // Create mock audio blob
      const mockAudioBlob = new Blob(['mock-audio-data'], { type: 'audio/wav' });
      
      const input: MultimodalInput = {
        audio: mockAudioBlob,
        voice: {
          enabled: true,
          language: 'en-US'
        },
        context: {
          workspaceId: 'test-voice',
          userId: 'test-user',
          sessionId: `voice-session-${Date.now()}`,
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
            assistantPersonality: 'encouraging'
          },
          projectMetadata: {
            name: 'Voice Test Project',
            description: 'Testing voice input capabilities',
            type: 'web-app',
            technologies: ['React', 'TypeScript'],
            complexity: 'simple',
            estimatedTime: 60,
            targetAudience: 'developers',
            features: ['voice-interface']
          }
        }
      };

      const result = await agent.processMultimodalInput(input);

      // Should process successfully
      expect(result).toBeDefined();
      expect(result.content).toBeTruthy();
      
      // Should contain voice-related processing indicators
      expect(result.metadata.processingTime).toBeGreaterThan(0);
      
      // Verify Datadog logging includes voice input type
      const logCalls = (console.log as jest.Mock).mock.calls;
      const startLog = logCalls.find(call => 
        call[0].includes('multimodal_processing_start')
      );
      
      if (startLog) {
        const logData = JSON.parse(startLog[0]);
        expect(logData.inputs).toContain('audio');
      }
    }, 20000);

    test('should generate voice output when requested', async () => {
      const input: MultimodalInput = {
        text: 'Explain how React hooks work',
        voice: {
          enabled: true,
          language: 'en-US'
        },
        context: {
          workspaceId: 'test-voice-output',
          userId: 'test-user',
          sessionId: `voice-output-${Date.now()}`,
          previousMessages: [],
          userPreferences: {
            codeStyle: 'typescript',
            framework: 'react',
            uiLibrary: 'shadcn',
            voiceSettings: {
              enabled: true,
              autoplay: true,
              speed: 1.0,
              voice: 'en-US-Standard-A'
            },
            assistantPersonality: 'encouraging'
          },
          projectMetadata: {
            name: 'Voice Output Test',
            description: 'Testing voice output generation',
            type: 'web-app',
            technologies: ['React'],
            complexity: 'intermediate',
            estimatedTime: 30,
            targetAudience: 'developers',
            features: ['voice-output']
          }
        }
      };

      const result = await agent.processMultimodalInput(input);

      // Should include multimodal output
      expect(result.multimodal).toBeDefined();
      
      // Mock voice processor should generate audio URL
      if (result.multimodal?.audioUrl) {
        expect(result.multimodal.audioUrl).toMatch(/data:audio|http/);
      }
    }, 15000);
  });

  describe('📁 File Processing Integration', () => {
    test('should analyze single code file', async () => {
      const input: MultimodalInput = {
        text: 'Analyze this React component and suggest improvements',
        files: [
          {
            path: 'src/components/UserCard.tsx',
            content: `
import React from 'react';

// Simple component with improvement opportunities
export function UserCard({ user }) {
  return (
    <div style={{padding: 20, border: '1px solid gray'}}>
      <h3>{user.name}</h3>
      <p>{user.email}</p>
      <button onClick={() => alert('Follow clicked')}>
        Follow
      </button>
    </div>
  );
}
            `,
            type: 'code',
            language: 'typescript',
            size: 400,
            lastModified: new Date()
          }
        ],
        context: {
          workspaceId: 'test-file-analysis',
          userId: 'test-user',
          sessionId: `file-session-${Date.now()}`,
          previousMessages: [],
          userPreferences: {
            codeStyle: 'typescript',
            framework: 'react',
            uiLibrary: 'shadcn',
            voiceSettings: {
              enabled: false,
              autoplay: false,
              speed: 1.0,
              voice: 'en-US-Standard-A'
            },
            assistantPersonality: 'technical'
          },
          projectMetadata: {
            name: 'File Analysis Test',
            description: 'Testing file analysis capabilities',
            type: 'web-app',
            technologies: ['React', 'TypeScript'],
            complexity: 'intermediate',
            estimatedTime: 45,
            targetAudience: 'developers',
            features: ['code-analysis']
          }
        }
      };

      const result = await agent.processMultimodalInput(input);

      // Should analyze the file and provide suggestions
      expect(result.content).toBeTruthy();
      expect(result.content.length).toBeGreaterThan(50);
      
      // Should contain analysis-related content
      const contentLower = result.content.toLowerCase();
      expect(contentLower).toMatch(/component|typescript|improve|suggest/);
      
      // Should have processed file inputs
      const logCalls = (console.log as jest.Mock).mock.calls;
      const startLog = logCalls.find(call => 
        call[0].includes('multimodal_processing_start')
      );
      
      if (startLog) {
        const logData = JSON.parse(startLog[0]);
        expect(logData.inputs).toContain('files');
      }
    }, 25000);

    test('should analyze multiple files for project overview', async () => {
      const input: MultimodalInput = {
        text: 'Analyze this codebase and provide a comprehensive overview',
        files: [
          {
            path: 'package.json',
            content: JSON.stringify({
              name: 'test-project',
              version: '1.0.0',
              dependencies: {
                'react': '^18.0.0',
                'typescript': '^5.0.0'
              },
              scripts: {
                'dev': 'next dev',
                'build': 'next build'
              }
            }, null, 2),
            type: 'config',
            language: 'json',
            size: 200,
            lastModified: new Date()
          },
          {
            path: 'src/App.tsx',
            content: `
import React from 'react';
import { UserCard } from './components/UserCard';

function App() {
  const user = { name: 'John Doe', email: 'john@example.com' };
  
  return (
    <div className="App">
      <h1>My Application</h1>
      <UserCard user={user} />
    </div>
  );
}

export default App;
            `,
            type: 'code',
            language: 'typescript',
            size: 300,
            lastModified: new Date()
          },
          {
            path: 'README.md',
            content: `
# Test Project

A simple React application for testing multimodal capabilities.

## Features
- React components
- TypeScript support
- Modern development setup
            `,
            type: 'documentation',
            language: 'markdown',
            size: 150,
            lastModified: new Date()
          }
        ],
        context: {
          workspaceId: 'test-multi-file',
          userId: 'test-user',
          sessionId: `multi-file-${Date.now()}`,
          previousMessages: [],
          userPreferences: {
            codeStyle: 'typescript',
            framework: 'react',
            uiLibrary: 'shadcn',
            voiceSettings: {
              enabled: false,
              autoplay: false,
              speed: 1.0,
              voice: 'en-US-Standard-A'
            },
            assistantPersonality: 'professional'
          },
          projectMetadata: {
            name: 'Multi-File Analysis',
            description: 'Testing multi-file project analysis',
            type: 'web-app',
            technologies: ['React', 'TypeScript', 'Next.js'],
            complexity: 'intermediate',
            estimatedTime: 90,
            targetAudience: 'developers',
            features: ['project-analysis', 'multi-file']
          }
        }
      };

      const result = await agent.processMultimodalInput(input);

      // Should provide comprehensive analysis
      expect(result.content.length).toBeGreaterThan(100);
      
      // Should mention multiple files and project structure
      const contentLower = result.content.toLowerCase();
      expect(contentLower).toMatch(/project|react|typescript|package\.json/);
      
      // Should have higher processing time for multiple files
      expect(result.metadata.processingTime).toBeGreaterThan(100);
    }, 30000);
  });

  describe('🖼️ Image Processing Integration', () => {
    test('should handle image input for UI generation', async () => {
      // Create mock image file
      const mockImageFile = new File(['mock-image-data'], 'mockup.png', { 
        type: 'image/png' 
      });

      const input: MultimodalInput = {
        text: 'Convert this UI mockup into a React component',
        images: [mockImageFile],
        context: {
          workspaceId: 'test-image',
          userId: 'test-user',
          sessionId: `image-session-${Date.now()}`,
          previousMessages: [],
          userPreferences: {
            codeStyle: 'typescript',
            framework: 'react',
            uiLibrary: 'tailwind',
            voiceSettings: {
              enabled: false,
              autoplay: false,
              speed: 1.0,
              voice: 'en-US-Standard-A'
            },
            assistantPersonality: 'creative'
          },
          projectMetadata: {
            name: 'Image to UI Test',
            description: 'Testing image-to-component generation',
            type: 'web-app',
            technologies: ['React', 'TypeScript', 'Tailwind CSS'],
            complexity: 'intermediate',
            estimatedTime: 60,
            targetAudience: 'designers',
            features: ['design-to-code', 'vision-ai']
          }
        }
      };

      const result = await agent.processMultimodalInput(input);

      // Should process successfully with vision model
      expect(result).toBeDefined();
      expect(result.metadata.model).toMatch(/claude-3.5-sonnet|gpt-4.*vision/);
      
      // Should contain UI/component related content
      const contentLower = result.content.toLowerCase();
      expect(contentLower).toMatch(/component|react|ui|design|mockup/);
      
      // Verify image input was logged
      const logCalls = (console.log as jest.Mock).mock.calls;
      const startLog = logCalls.find(call => 
        call[0].includes('multimodal_processing_start')
      );
      
      if (startLog) {
        const logData = JSON.parse(startLog[0]);
        expect(logData.inputs).toContain('images');
      }
    }, 20000);
  });

  describe('🎯 Sample Scenarios Integration', () => {
    test('should execute voice-to-code sample successfully', async () => {
      const result = await sampleGenerator.runSample('voice-react-component');

      expect(result).toBeDefined();
      expect(result.sample.id).toBe('voice-react-component');
      expect(result.result).toBeDefined();
      expect(result.performance.duration).toBeGreaterThan(0);
      
      // Should complete within estimated time budget (with some tolerance)
      const estimatedTime = result.sample.estimatedTime * 1000; // Convert to ms
      const actualTime = result.performance.duration;
      const tolerance = estimatedTime * 2; // Allow 2x estimated time
      
      expect(actualTime).toBeLessThan(tolerance);
    }, 60000);

    test('should execute file analysis sample successfully', async () => {
      const result = await sampleGenerator.runSample('pair-programming-session');

      expect(result).toBeDefined();
      expect(result.sample.category).toBe('collaboration');
      expect(result.result.content).toBeTruthy();
      
      // Should contain refactoring-related content
      const contentLower = result.result.content.toLowerCase();
      expect(contentLower).toMatch(/hook|refactor|component|function/);
    }, 45000);

    test('should handle sample execution with performance tracking', async () => {
      const sampleIds = ['voice-react-component', 'design-to-react', 'pair-programming-session'];
      const results = [];

      for (const sampleId of sampleIds) {
        try {
          const result = await sampleGenerator.runSample(sampleId);
          results.push(result);
        } catch (error) {
          console.warn(`Sample ${sampleId} failed: ${error.message}`);
        }
      }

      // At least some samples should succeed
      expect(results.length).toBeGreaterThan(0);
      
      // Calculate average performance
      const avgDuration = results.reduce((sum, r) => sum + r.performance.duration, 0) / results.length;
      const avgConfidence = results.reduce((sum, r) => sum + r.result.metadata.confidence, 0) / results.length;
      
      expect(avgDuration).toBeGreaterThan(0);
      expect(avgConfidence).toBeGreaterThan(0.5);
      
      console.log(`Sample execution stats: ${results.length} samples, avg duration: ${avgDuration}ms, avg confidence: ${(avgConfidence * 100).toFixed(1)}%`);
    }, 120000);
  });

  describe('📊 Datadog Integration', () => {
    test('should log structured data for geographic analytics', async () => {
      const input: MultimodalInput = {
        text: 'Create a simple component for testing geographic tracking',
        context: {
          workspaceId: 'geo-test-workspace',
          userId: 'geo-test-user',
          sessionId: `geo-session-${Date.now()}`,
          previousMessages: [],
          userPreferences: {
            codeStyle: 'typescript',
            framework: 'react',
            uiLibrary: 'shadcn',
            voiceSettings: {
              enabled: false,
              autoplay: false,
              speed: 1.0,
              voice: 'en-US-Standard-A'
            },
            assistantPersonality: 'professional'
          },
          projectMetadata: {
            name: 'Geographic Test',
            description: 'Testing geographic analytics',
            type: 'web-app',
            technologies: ['React'],
            complexity: 'simple',
            estimatedTime: 30,
            targetAudience: 'global',
            features: ['analytics']
          }
        }
      };

      await agent.processMultimodalInput(input);

      // Verify structured logging for Datadog
      const logCalls = (console.log as jest.Mock).mock.calls;
      
      // Find start log
      const startLogCall = logCalls.find(call => 
        call[0].includes('multimodal_processing_start')
      );
      expect(startLogCall).toBeDefined();
      
      if (startLogCall) {
        const startLog = JSON.parse(startLogCall[0]);
        
        // Verify Datadog-compatible structure
        expect(startLog).toMatchObject({
          '@timestamp': expect.any(String),
          service: 'vibecode-webgui',
          source: 'multimodal-agent',
          event: {
            category: 'ai_agent',
            type: 'multimodal_processing_start'
          },
          workspaceId: 'geo-test-workspace',
          userId: 'geo-test-user'
        });
      }

      // Find completion log
      const completeLogCall = logCalls.find(call => 
        call[0].includes('multimodal_processing_complete')
      );
      expect(completeLogCall).toBeDefined();
      
      if (completeLogCall) {
        const completeLog = JSON.parse(completeLogCall[0]);
        
        expect(completeLog).toMatchObject({
          '@timestamp': expect.any(String),
          messageId: expect.any(String),
          processingTime: expect.any(Number),
          confidence: expect.any(Number)
        });
      }
    }, 15000);

    test('should track different input modalities for analytics', async () => {
      const mockAudio = new Blob(['mock-audio'], { type: 'audio/wav' });
      const mockImage = new File(['mock-image'], 'test.png', { type: 'image/png' });
      
      const input: MultimodalInput = {
        text: 'Multi-modal test',
        audio: mockAudio,
        images: [mockImage],
        files: [
          {
            path: 'test.ts',
            content: 'const test = true;',
            type: 'code',
            language: 'typescript',
            size: 20,
            lastModified: new Date()
          }
        ],
        voice: {
          enabled: true,
          language: 'en-US'
        },
        context: {
          workspaceId: 'multi-modal-test',
          userId: 'analytics-user',
          sessionId: `analytics-${Date.now()}`,
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
            name: 'Multi-Modal Analytics',
            description: 'Testing comprehensive input tracking',
            type: 'web-app',
            technologies: ['React', 'TypeScript'],
            complexity: 'advanced',
            estimatedTime: 120,
            targetAudience: 'developers',
            features: ['multi-modal', 'analytics']
          }
        }
      };

      await agent.processMultimodalInput(input);

      // Verify all input types are tracked
      const logCalls = (console.log as jest.Mock).mock.calls;
      const startLog = logCalls.find(call => 
        call[0].includes('multimodal_processing_start')
      );
      
      if (startLog) {
        const logData = JSON.parse(startLog[0]);
        expect(logData.inputs).toContain('text');
        expect(logData.inputs).toContain('audio');
        expect(logData.inputs).toContain('images');
        expect(logData.inputs).toContain('files');
        expect(logData.inputs).toContain('voice');
      }
    }, 25000);
  });

  describe('⚡ Performance & Reliability', () => {
    test('should handle concurrent requests efficiently', async () => {
      const concurrentRequests = 3;
      const requests = Array.from({ length: concurrentRequests }, (_, i) => ({
        text: `Create a component number ${i + 1}`,
        context: {
          workspaceId: `concurrent-test-${i}`,
          userId: 'performance-user',
          sessionId: `perf-session-${Date.now()}-${i}`,
          previousMessages: [],
          userPreferences: {
            codeStyle: 'typescript',
            framework: 'react',
            uiLibrary: 'shadcn',
            voiceSettings: {
              enabled: false,
              autoplay: false,
              speed: 1.0,
              voice: 'en-US-Standard-A'
            },
            assistantPersonality: 'efficient'
          },
          projectMetadata: {
            name: `Performance Test ${i + 1}`,
            description: 'Testing concurrent processing',
            type: 'web-app',
            technologies: ['React'],
            complexity: 'simple',
            estimatedTime: 30,
            targetAudience: 'developers',
            features: ['performance']
          }
        }
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        requests.map(req => agent.processMultimodalInput(req))
      );
      const totalTime = Date.now() - startTime;

      // All requests should complete successfully
      expect(results).toHaveLength(concurrentRequests);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.content).toBeTruthy();
        expect(result.metadata.confidence).toBeGreaterThan(0);
      });

      // Concurrent processing should be reasonably efficient
      expect(totalTime).toBeLessThan(60000); // Should complete within 60 seconds
      
      console.log(`Concurrent requests completed in ${totalTime}ms (${concurrentRequests} requests)`);
    }, 70000);

    test('should maintain consistent quality across multiple requests', async () => {
      const testRequests = [
        'Create a React button component',
        'Build a todo list with TypeScript',
        'Design a user profile card',
        'Implement a search input field'
      ];

      const results = [];
      
      for (const request of testRequests) {
        const result = await agent.processMultimodalInput({
          text: request,
          context: {
            workspaceId: 'quality-test',
            userId: 'quality-user',
            sessionId: `quality-${Date.now()}-${Math.random()}`,
            previousMessages: [],
            userPreferences: {
              codeStyle: 'typescript',
              framework: 'react',
              uiLibrary: 'shadcn',
              voiceSettings: {
                enabled: false,
                autoplay: false,
                speed: 1.0,
                voice: 'en-US-Standard-A'
              },
              assistantPersonality: 'consistent'
            },
            projectMetadata: {
              name: 'Quality Test',
              description: 'Testing response quality consistency',
              type: 'web-app',
              technologies: ['React', 'TypeScript'],
              complexity: 'intermediate',
              estimatedTime: 45,
              targetAudience: 'developers',
              features: ['quality-assurance']
            }
          }
        });
        
        results.push(result);
      }

      // Calculate quality metrics
      const confidences = results.map(r => r.metadata.confidence);
      const processingTimes = results.map(r => r.metadata.processingTime);
      const contentLengths = results.map(r => r.content.length);

      const avgConfidence = confidences.reduce((sum, c) => sum + c, 0) / confidences.length;
      const avgProcessingTime = processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length;
      const avgContentLength = contentLengths.reduce((sum, l) => sum + l, 0) / contentLengths.length;

      // Quality should be consistently good
      expect(avgConfidence).toBeGreaterThan(0.7);
      expect(avgProcessingTime).toBeLessThan(10000); // Average under 10 seconds
      expect(avgContentLength).toBeGreaterThan(50); // Substantial responses

      // Confidence should be consistent (low standard deviation)
      const confidenceStdDev = Math.sqrt(
        confidences.reduce((sum, c) => sum + Math.pow(c - avgConfidence, 2), 0) / confidences.length
      );
      expect(confidenceStdDev).toBeLessThan(0.3); // Consistent quality

      console.log(`Quality metrics - Avg confidence: ${(avgConfidence * 100).toFixed(1)}%, Avg time: ${avgProcessingTime}ms, Std dev: ${confidenceStdDev.toFixed(3)}`);
    }, 120000);
  });

  describe('🔄 Error Handling & Recovery', () => {
    test('should handle malformed input gracefully', async () => {
      const malformedInputs = [
        { text: '', context: undefined }, // Missing context
        { text: undefined, context: {} }, // Missing text
        { files: [] as any, context: {} }, // Empty files with invalid context
      ];

      for (const input of malformedInputs) {
        try {
          const result = await agent.processMultimodalInput(input as any);
          // If it succeeds, should still return valid structure
          expect(result).toBeDefined();
          expect(result.content).toBeTruthy();
        } catch (error) {
          // Should throw meaningful errors
          expect(error).toBeInstanceOf(Error);
          expect(error.message).toBeTruthy();
        }
      }
    }, 30000);

    test('should log errors appropriately for debugging', async () => {
      // Force an error by providing invalid configuration
      const invalidInput: MultimodalInput = {
        text: 'This should cause an error',
        context: {
          workspaceId: '',
          userId: '',
          sessionId: '',
          previousMessages: [],
          userPreferences: {} as any, // Invalid preferences
          projectMetadata: {} as any // Invalid metadata
        }
      };

      try {
        await agent.processMultimodalInput(invalidInput);
      } catch (error) {
        // Error should be logged for Datadog
        const errorLogs = (console.log as jest.Mock).mock.calls.filter(call =>
          call[0].includes('multimodal_processing_error')
        );
        
        expect(errorLogs.length).toBeGreaterThan(0);
      }
    }, 15000);
  });
}); 