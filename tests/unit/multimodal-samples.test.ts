import { MultimodalSampleGenerator, SampleScenario } from '../../src/samples/multimodal-agent-samples';
import { MultimodalAgent } from '../../src/lib/multimodal-agent';

// Mock the MultimodalAgent
jest.mock('../../src/lib/multimodal-agent');

describe('MultimodalSampleGenerator', () => {
  let mockAgent: jest.Mocked<MultimodalAgent>;
  let sampleGenerator: MultimodalSampleGenerator;

  beforeEach(() => {
    mockAgent = new MultimodalAgent({
      openRouterKey: 'test-key'
    }) as jest.Mocked<MultimodalAgent>;

    sampleGenerator = new MultimodalSampleGenerator(mockAgent);

    // Mock console.log to capture output
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Sample Collection', () => {
    test('should have comprehensive sample collection', () => {
      const allSamples = sampleGenerator.getAllSamples();

      expect(allSamples.length).toBeGreaterThan(10);
      
      // Verify all categories are represented
      const categories = [...new Set(allSamples.map(s => s.category))];
      expect(categories).toContain('voice');
      expect(categories).toContain('vision');
      expect(categories).toContain('collaboration');
      expect(categories).toContain('automation');
      expect(categories).toContain('analysis');
    });

    test('should have voice samples with proper structure', () => {
      const voiceSamples = sampleGenerator.getAllSamples().filter(s => s.category === 'voice');

      expect(voiceSamples.length).toBeGreaterThan(0);

      voiceSamples.forEach(sample => {
        expect(sample).toMatchObject({
          id: expect.any(String),
          title: expect.any(String),
          description: expect.any(String),
          category: 'voice',
          complexity: expect.stringMatching(/^(beginner|intermediate|advanced)$/),
          inputs: expect.objectContaining({
            text: expect.any(String),
            voice: expect.objectContaining({
              enabled: true,
              language: expect.any(String)
            }),
            context: expect.any(Object)
          }),
          expectedOutputs: expect.any(Array),
          estimatedTime: expect.any(Number)
        });
      });
    });

    test('should have vision samples with image inputs', () => {
      const visionSamples = sampleGenerator.getAllSamples().filter(s => s.category === 'vision');

      expect(visionSamples.length).toBeGreaterThan(0);

      visionSamples.forEach(sample => {
        expect(sample.inputs.images).toBeDefined();
        expect(Array.isArray(sample.inputs.images)).toBe(true);
        expect(sample.inputs.images!.length).toBeGreaterThan(0);
        expect(sample.expectedOutputs).toContain('React component');
      });
    });

    test('should have collaboration samples with file inputs', () => {
      const collaborationSamples = sampleGenerator.getAllSamples().filter(s => s.category === 'collaboration');

      expect(collaborationSamples.length).toBeGreaterThan(0);

      collaborationSamples.forEach(sample => {
        expect(sample.inputs.files).toBeDefined();
        expect(Array.isArray(sample.inputs.files)).toBe(true);
        expect(sample.inputs.files!.length).toBeGreaterThan(0);
      });
    });

    test('should have automation samples with appropriate complexity', () => {
      const automationSamples = sampleGenerator.getAllSamples().filter(s => s.category === 'automation');

      expect(automationSamples.length).toBeGreaterThan(0);

      automationSamples.forEach(sample => {
        expect(sample.complexity).toMatch(/^(intermediate|advanced)$/);
        expect(sample.estimatedTime).toBeGreaterThan(60); // Automation should take longer
      });
    });

    test('should have analysis samples with comprehensive outputs', () => {
      const analysisSamples = sampleGenerator.getAllSamples().filter(s => s.category === 'analysis');

      expect(analysisSamples.length).toBeGreaterThan(0);

      analysisSamples.forEach(sample => {
        expect(sample.expectedOutputs).toContain(expect.stringMatching(/report|analysis|audit/));
        expect(sample.inputs.files).toBeDefined();
      });
    });
  });

  describe('Sample Code Templates', () => {
    test('should have valid class component template', () => {
      const classComponent = sampleGenerator['getSampleClassComponent']();

      expect(classComponent).toContain('class UserDashboard extends Component');
      expect(classComponent).toContain('componentDidMount');
      expect(classComponent).toContain('fetchUsers');
      expect(classComponent).toContain('render()');
    });

    test('should have security-vulnerable auth code', () => {
      const authCode = sampleGenerator['getSampleAuthCode']();

      expect(authCode).toContain('user.password === password'); // Plain text comparison
      expect(authCode).toContain("'secret'"); // Hardcoded secret
      expect(authCode).toContain('email: email'); // SQL injection vulnerable
    });

    test('should have button component with proper TypeScript', () => {
      const buttonComponent = sampleGenerator['getSampleButtonComponent']();

      expect(buttonComponent).toContain('interface ButtonProps');
      expect(buttonComponent).toContain('React.forwardRef');
      expect(buttonComponent).toContain('VariantProps');
      expect(buttonComponent).toContain('buttonVariants');
    });

    test('should have todo component with full functionality', () => {
      const todoComponent = sampleGenerator['getSampleTodoComponent']();

      expect(todoComponent).toContain('interface Todo');
      expect(todoComponent).toContain('useState');
      expect(todoComponent).toContain('useEffect');
      expect(todoComponent).toContain('addTodo');
      expect(todoComponent).toContain('toggleTodo');
      expect(todoComponent).toContain('deleteTodo');
    });

    test('should have performance-problematic dashboard component', () => {
      const dashboardComponent = sampleGenerator['getSampleDashboardComponent']();

      // Should contain performance issues for analysis
      expect(dashboardComponent).toContain('useEffect(() => {'); // Missing dependencies
      expect(dashboardComponent).toContain('expensiveCalculation()'); // Uncached calculation
      expect(dashboardComponent).toContain('users.map(user =>'); // Large list without virtualization
    });

    test('should have accessibility-problematic contact form', () => {
      const contactForm = sampleGenerator['getSampleContactFormComponent']();

      // Should contain accessibility issues
      expect(contactForm).toContain('placeholder='); // Missing labels
      expect(contactForm).not.toContain('aria-label'); // Missing ARIA
      expect(contactForm).not.toContain('<label'); // Missing proper labels
      expect(contactForm).toContain('href="#"'); // Non-descriptive links
    });

    test('should have vulnerable package.json', () => {
      const vulnerablePackage = sampleGenerator['getSamplePackageJsonWithVulnerabilities']();
      const packageData = JSON.parse(vulnerablePackage);

      expect(packageData.dependencies.express).toBe('4.15.0'); // Old version
      expect(packageData.dependencies.lodash).toBe('4.17.4'); // Vulnerable version
      expect(packageData.dependencies.jsonwebtoken).toBe('7.4.3'); // Security issues
    });
  });

  describe('Sample Execution', () => {
    test('should run voice-to-code sample successfully', async () => {
      const mockResult = {
        id: 'test-response',
        role: 'assistant' as const,
        content: 'Created React component successfully',
        timestamp: new Date(),
        metadata: {
          model: 'test-model',
          tokens: 100,
          cost: 0.01,
          processingTime: 1000,
          confidence: 0.9
        }
      };

      mockAgent.processMultimodalInput.mockResolvedValue(mockResult);

      const result = await sampleGenerator.runSample('voice-react-component');

      expect(result).toBeDefined();
      expect(result.sample.id).toBe('voice-react-component');
      expect(result.result).toEqual(mockResult);
      expect(result.performance.duration).toBeGreaterThan(0);
      expect(mockAgent.processMultimodalInput).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('user profile card component'),
          voice: expect.objectContaining({
            enabled: true,
            language: 'en-US'
          })
        })
      );
    });

    test('should run vision sample with image analysis', async () => {
      const mockResult = {
        id: 'test-response',
        role: 'assistant' as const,
        content: 'Generated React component from design',
        timestamp: new Date(),
        metadata: {
          model: 'anthropic/claude-3.5-sonnet',
          tokens: 200,
          cost: 0.02,
          processingTime: 2000,
          confidence: 0.85
        }
      };

      mockAgent.processMultimodalInput.mockResolvedValue(mockResult);

      const result = await sampleGenerator.runSample('design-to-react');

      expect(result).toBeDefined();
      expect(result.sample.category).toBe('vision');
      expect(mockAgent.processMultimodalInput).toHaveBeenCalledWith(
        expect.objectContaining({
          images: expect.any(Array),
          text: expect.stringContaining('Convert this design mockup')
        })
      );
    });

    test('should run collaboration sample with file analysis', async () => {
      const mockResult = {
        id: 'test-response',
        role: 'assistant' as const,
        content: 'Refactored component to use hooks',
        timestamp: new Date(),
        metadata: {
          model: 'test-model',
          tokens: 300,
          cost: 0.03,
          processingTime: 3000,
          confidence: 0.88
        }
      };

      mockAgent.processMultimodalInput.mockResolvedValue(mockResult);

      const result = await sampleGenerator.runSample('pair-programming-session');

      expect(result).toBeDefined();
      expect(result.sample.category).toBe('collaboration');
      expect(mockAgent.processMultimodalInput).toHaveBeenCalledWith(
        expect.objectContaining({
          files: expect.arrayContaining([
            expect.objectContaining({
              path: 'src/components/UserDashboard.tsx',
              type: 'code',
              language: 'typescript'
            })
          ])
        })
      );
    });

    test('should handle sample execution errors', async () => {
      mockAgent.processMultimodalInput.mockRejectedValue(new Error('API Error'));

      await expect(sampleGenerator.runSample('voice-react-component')).rejects.toThrow('API Error');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('❌ Sample failed: API Error')
      );
    });

    test('should handle non-existent sample ID', async () => {
      await expect(sampleGenerator.runSample('non-existent-sample')).rejects.toThrow(
        'Sample non-existent-sample not found'
      );
    });
  });

  describe('Sample Context Creation', () => {
    test('should create valid context for different sample types', () => {
      const voiceContext = sampleGenerator['createSampleContext']('voice-interaction');
      const visionContext = sampleGenerator['createSampleContext']('design-analysis');
      const fileContext = sampleGenerator['createSampleContext']('codebase-analysis');

      [voiceContext, visionContext, fileContext].forEach(context => {
        expect(context).toMatchObject({
          workspaceId: expect.stringContaining('workspace_'),
          userId: 'sample_user',
          sessionId: expect.stringContaining('session_'),
          previousMessages: [],
          userPreferences: expect.objectContaining({
            codeStyle: 'typescript',
            framework: 'react',
            uiLibrary: 'shadcn',
            voiceSettings: expect.objectContaining({
              enabled: true,
              autoplay: false,
              speed: 1.0,
              voice: 'en-US-Standard-A'
            }),
            assistantPersonality: 'encouraging'
          }),
          projectMetadata: expect.objectContaining({
            name: expect.any(String),
            description: expect.any(String),
            type: 'web-app',
            technologies: expect.arrayContaining(['React', 'TypeScript']),
            complexity: 'intermediate',
            estimatedTime: 60,
            targetAudience: 'developers',
            features: expect.arrayContaining(['responsive design', 'accessibility'])
          })
        });
      });
    });
  });

  describe('Sample Validation', () => {
    test('all samples should have required fields', () => {
      const allSamples = sampleGenerator.getAllSamples();

      allSamples.forEach(sample => {
        expect(sample.id).toBeTruthy();
        expect(sample.title).toBeTruthy();
        expect(sample.description).toBeTruthy();
        expect(['voice', 'vision', 'collaboration', 'automation', 'analysis']).toContain(sample.category);
        expect(['beginner', 'intermediate', 'advanced']).toContain(sample.complexity);
        expect(sample.estimatedTime).toBeGreaterThan(0);
        expect(Array.isArray(sample.expectedOutputs)).toBe(true);
        expect(sample.expectedOutputs.length).toBeGreaterThan(0);
        expect(sample.inputs).toBeDefined();
      });
    });

    test('all sample IDs should be unique', () => {
      const allSamples = sampleGenerator.getAllSamples();
      const ids = allSamples.map(s => s.id);
      const uniqueIds = [...new Set(ids)];

      expect(ids.length).toBe(uniqueIds.length);
    });

    test('estimated times should be realistic', () => {
      const allSamples = sampleGenerator.getAllSamples();

      allSamples.forEach(sample => {
        expect(sample.estimatedTime).toBeGreaterThan(15); // At least 15 seconds
        expect(sample.estimatedTime).toBeLessThan(300); // Less than 5 minutes
      });
    });

    test('voice samples should have voice configuration', () => {
      const voiceSamples = sampleGenerator.getAllSamples().filter(s => s.category === 'voice');

      voiceSamples.forEach(sample => {
        expect(sample.inputs.voice).toBeDefined();
        expect(sample.inputs.voice!.enabled).toBe(true);
        expect(sample.inputs.voice!.language).toBeTruthy();
      });
    });

    test('vision samples should have appropriate expected outputs', () => {
      const visionSamples = sampleGenerator.getAllSamples().filter(s => s.category === 'vision');

      visionSamples.forEach(sample => {
        const outputsText = sample.expectedOutputs.join(' ').toLowerCase();
        expect(outputsText).toMatch(/react|component|styling|css/);
      });
    });
  });

  describe('Performance Expectations', () => {
    test('should track sample execution performance', async () => {
      const mockResult = {
        id: 'test-response',
        role: 'assistant' as const,
        content: 'Test response',
        timestamp: new Date(),
        metadata: {
          model: 'test-model',
          tokens: 50,
          cost: 0.005,
          processingTime: 800,
          confidence: 0.9
        }
      };

      mockAgent.processMultimodalInput.mockResolvedValue(mockResult);

      const result = await sampleGenerator.runSample('voice-react-component');

      expect(result.performance).toBeDefined();
      expect(result.performance.duration).toBeGreaterThan(0);
      expect(result.performance.estimatedTime).toBe(30000); // 30 seconds * 1000
      expect(result.performance.efficiency).toBeGreaterThan(0);
    });

    test('should log execution metrics', async () => {
      const mockResult = {
        id: 'test-response',
        role: 'assistant' as const,
        content: 'Test response',
        timestamp: new Date(),
        metadata: {
          model: 'test-model',
          tokens: 100,
          cost: 0.01,
          processingTime: 1200,
          confidence: 0.85
        }
      };

      mockAgent.processMultimodalInput.mockResolvedValue(mockResult);

      await sampleGenerator.runSample('voice-react-component');

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('🚀 Running sample: Voice-Driven React Component Creation')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('⏱️ Estimated time: 30s')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('✅ Sample completed in')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('📊 Confidence: 0.85')
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('💰 Cost: $0.0100')
      );
    });
  });
}); 