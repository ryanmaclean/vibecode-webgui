/**
 * Unit tests for AutomatedTestGenerator
 * Tests AI-powered test generation functionality
 */

// Mock LangChain dependencies before importing the module
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue('Mock LLM response'),
  })),
}))

jest.mock('@langchain/core/prompts', () => ({
  PromptTemplate: {
    fromTemplate: jest.fn().mockReturnValue({
      invoke: jest.fn().mockResolvedValue('Mock prompt'),
    }),
  },
}))

jest.mock('@langchain/core/output_parsers', () => ({
  StringOutputParser: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue('Mock parsed output'),
  })),
}))

jest.mock('@langchain/core/runnables', () => ({
  RunnableSequence: {
    from: jest.fn().mockReturnValue({
      invoke: jest.fn().mockResolvedValue('Mock chain response'),
    }),
  },
}))

import { AutomatedTestGenerator, TestGenerationOptions, GeneratedTest } from '../automated-test-generator'

describe('AutomatedTestGenerator', () => {
  let generator: AutomatedTestGenerator

  beforeEach(() => {
    // AutomatedTestGenerator takes an optional AI provider, not an API key
    generator = new AutomatedTestGenerator()
  })

  describe('Constructor', () => {
    it('should initialize without API key', () => {
      expect(generator).toBeDefined()
      expect(generator).toBeInstanceOf(AutomatedTestGenerator)
    })

    it('should initialize with optional AI provider', () => {
      const mockProvider = { invoke: jest.fn() }
      const generatorWithProvider = new AutomatedTestGenerator(mockProvider)
      expect(generatorWithProvider).toBeDefined()
      expect(generatorWithProvider).toBeInstanceOf(AutomatedTestGenerator)
    })
  })

  describe('analyzeCode', () => {
    const mockSourceCode = `
      function calculateSum(a: number, b: number): number {
        if (a < 0 || b < 0) {
          throw new Error('Negative numbers not allowed');
        }
        return a + b;
      }
    `

    it('should analyze code and return structured results', async () => {
      const result = await generator.analyzeCode(mockSourceCode, 'test.ts')

      expect(result).toHaveProperty('functions')
      expect(result).toHaveProperty('classes')
      expect(result).toHaveProperty('imports')
      expect(result).toHaveProperty('dependencies')
      expect(result).toHaveProperty('patterns')
      expect(Array.isArray(result.functions)).toBe(true)
      expect(Array.isArray(result.classes)).toBe(true)
      expect(Array.isArray(result.imports)).toBe(true)
      expect(Array.isArray(result.dependencies)).toBe(true)
      expect(Array.isArray(result.patterns)).toBe(true)
    })

    it('should extract functions from code', async () => {
      const result = await generator.analyzeCode(mockSourceCode, 'test.ts')

      expect(result.functions.length).toBeGreaterThan(0)
      expect(result.functions[0]).toHaveProperty('name')
      expect(result.functions[0]).toHaveProperty('parameters')
      expect(result.functions[0]).toHaveProperty('returnType')
      expect(result.functions[0]).toHaveProperty('complexity')
    })

    it('should detect code patterns', async () => {
      const reactCode = `
        import React, { useState } from 'react';
        function MyComponent() {
          const [count, setCount] = useState(0);
          return <div>{count}</div>;
        }
      `
      const result = await generator.analyzeCode(reactCode, 'component.tsx')

      expect(result.patterns).toContain('react-component')
    })

    it('should detect async patterns', async () => {
      const asyncCode = `
        async function fetchData() {
          const response = await fetch('/api/data');
          return response.json();
        }
      `
      const result = await generator.analyzeCode(asyncCode, 'api.ts')

      expect(result.patterns).toContain('async-code')
    })

    it('should detect error handling patterns', async () => {
      const errorCode = `
        function safeOperation() {
          try {
            doSomething();
          } catch (error) {
            console.error(error);
          }
        }
      `
      const result = await generator.analyzeCode(errorCode, 'safe.ts')

      expect(result.patterns).toContain('error-handling')
    })
  })

  describe('generateUnitTests', () => {
    const mockSourceCode = `
      class Calculator {
        add(a: number, b: number): number {
          return a + b;
        }
      }
    `

    const mockOptions: TestGenerationOptions = {
      framework: 'jest',
      coverage: 'unit',
      includeMocks: false,
      testStyle: 'bdd',
    }

    it('should generate unit tests', async () => {
      const result = await generator.generateUnitTests(mockSourceCode, 'calculator.ts', mockOptions)

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      expect(result[0]).toHaveProperty('fileName')
      expect(result[0]).toHaveProperty('content')
      expect(result[0]).toHaveProperty('framework')
      expect(result[0]).toHaveProperty('coverage')
      expect(result[0]).toHaveProperty('description')
      expect(result[0]).toHaveProperty('estimatedLines')
    })

    it('should use jest framework', async () => {
      const result = await generator.generateUnitTests(mockSourceCode, 'calculator.ts', mockOptions)

      expect(result[0].framework).toBe('jest')
      expect(result[0].content).toContain('describe')
      expect(result[0].content).toContain('test')
    })

    it('should use vitest framework', async () => {
      const vitestOptions = { ...mockOptions, framework: 'vitest' as const }
      const result = await generator.generateUnitTests(mockSourceCode, 'calculator.ts', vitestOptions)

      expect(result[0].framework).toBe('vitest')
      expect(result[0].content).toContain('describe')
    })
  })

  describe('generateIntegrationTests', () => {
    const mockSourceCode = `
      export class UserService {
        constructor(private db: Database) {}

        async createUser(userData: CreateUserData): Promise<User> {
          return await this.db.createUser(userData);
        }
      }
    `

    const mockOptions: TestGenerationOptions = {
      framework: 'jest',
      coverage: 'integration',
      includeMocks: true,
    }

    it('should generate integration tests', async () => {
      const result = await generator.generateIntegrationTests(mockSourceCode, 'user-service.ts', mockOptions)

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      expect(result[0].coverage).toBe('integration')
    })
  })

  describe('generateE2ETests', () => {
    const mockSourceCode = `
      export function LoginPage() {
        return <div>Login Form</div>;
      }
    `

    const mockOptions: TestGenerationOptions = {
      framework: 'playwright',
      coverage: 'e2e',
    }

    it('should generate E2E tests', async () => {
      const result = await generator.generateE2ETests(mockSourceCode, 'login.tsx', mockOptions)

      expect(Array.isArray(result)).toBe(true)
      expect(result.length).toBeGreaterThan(0)
      expect(result[0].framework).toBe('playwright')
      expect(result[0].coverage).toBe('e2e')
    })

    it('should use playwright framework', async () => {
      const result = await generator.generateE2ETests(mockSourceCode, 'login.tsx', mockOptions)

      expect(result[0].content).toContain('@playwright/test')
    })
  })

  describe('generateCoverageReport', () => {
    const mockSourceCode = `
      function divide(a: number, b: number): number {
        if (b === 0) {
          throw new Error('Division by zero');
        }
        return a / b;
      }
    `

    const mockGeneratedTests: GeneratedTest[] = [
      {
        fileName: 'test.test.ts',
        content: 'describe("divide", () => { test("works", () => {}) });',
        framework: 'jest',
        coverage: 'unit',
        description: 'Unit tests',
        estimatedLines: 3,
      },
    ]

    it('should generate coverage report', async () => {
      const result = await generator.generateCoverageReport(mockSourceCode, mockGeneratedTests)

      expect(result).toHaveProperty('coverage')
      expect(result).toHaveProperty('recommendations')
      expect(result.coverage).toHaveProperty('statements')
      expect(result.coverage).toHaveProperty('branches')
      expect(result.coverage).toHaveProperty('functions')
      expect(result.coverage).toHaveProperty('lines')
      expect(Array.isArray(result.recommendations)).toBe(true)
    })

    it('should provide coverage percentages', async () => {
      const result = await generator.generateCoverageReport(mockSourceCode, mockGeneratedTests)

      expect(typeof result.coverage.statements).toBe('number')
      expect(typeof result.coverage.branches).toBe('number')
      expect(typeof result.coverage.functions).toBe('number')
      expect(typeof result.coverage.lines).toBe('number')
      expect(result.coverage.statements).toBeGreaterThanOrEqual(0)
      expect(result.coverage.statements).toBeLessThanOrEqual(100)
    })

    it('should provide recommendations', async () => {
      const result = await generator.generateCoverageReport(mockSourceCode, mockGeneratedTests)

      expect(Array.isArray(result.recommendations)).toBe(true)
    })
  })

  describe('validateTests', () => {
    it('should validate test structure', async () => {
      const validTests: GeneratedTest[] = [
        {
          fileName: 'valid.test.ts',
          content: 'describe("test", () => { test("works", () => { expect(true).toBe(true); }) });',
          framework: 'jest',
          coverage: 'unit',
          description: 'Valid test',
          estimatedLines: 1,
        },
      ]

      const result = await generator.validateTests(validTests)

      expect(result).toHaveProperty('valid')
      expect(result).toHaveProperty('errors')
      expect(result).toHaveProperty('warnings')
      expect(typeof result.valid).toBe('boolean')
      expect(Array.isArray(result.errors)).toBe(true)
      expect(Array.isArray(result.warnings)).toBe(true)
    })

    it('should detect missing test structure', async () => {
      const invalidTests: GeneratedTest[] = [
        {
          fileName: 'invalid.test.ts',
          content: 'console.log("not a test");',
          framework: 'jest',
          coverage: 'unit',
          description: 'Invalid test',
          estimatedLines: 1,
        },
      ]

      const result = await generator.validateTests(invalidTests)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })

    it('should detect missing assertions in Jest tests', async () => {
      const testsWithoutAssertions: GeneratedTest[] = [
        {
          fileName: 'no-assertions.test.ts',
          content: 'describe("test", () => { test("works", () => { console.log("test"); }) });',
          framework: 'jest',
          coverage: 'unit',
          description: 'Test without assertions',
          estimatedLines: 1,
        },
      ]

      const result = await generator.validateTests(testsWithoutAssertions)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('assertions'))).toBe(true)
    })

    it('should warn about potentially problematic code', async () => {
      const testsWithWarnings: GeneratedTest[] = [
        {
          fileName: 'warnings.test.ts',
          content: 'describe("test", () => { test("works", () => { expect(undefined).toBe(null); }) });',
          framework: 'jest',
          coverage: 'unit',
          description: 'Test with warnings',
          estimatedLines: 1,
        },
      ]

      const result = await generator.validateTests(testsWithWarnings)

      expect(result.warnings.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should handle empty source code', async () => {
      const result = await generator.analyzeCode('', 'empty.ts')

      expect(result).toBeDefined()
      expect(result.functions).toEqual([])
      expect(result.classes).toEqual([])
    })

    it('should handle malformed code gracefully', async () => {
      const malformedCode = 'function ( { invalid syntax'
      const result = await generator.analyzeCode(malformedCode, 'malformed.ts')

      // Should not throw, should return some analysis
      expect(result).toBeDefined()
    })
  })
})
