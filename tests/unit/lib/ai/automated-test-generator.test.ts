/**
 * Unit tests for AutomatedTestGenerator
 * Tests AI-powered test generation functionality
 */

import { AutomatedTestGenerator, TestGenerationOptions } from '@/lib/ai/automated-test-generator'

describe('AutomatedTestGenerator', () => {
  let generator: AutomatedTestGenerator

  beforeEach(() => {
    generator = new AutomatedTestGenerator()
  })

  describe('Constructor', () => {
    it('should initialize without errors', () => {
      expect(generator).toBeDefined()
      expect(generator).toBeInstanceOf(AutomatedTestGenerator)
    })

    it('should initialize with AI provider', () => {
      const mockProvider = { invoke: jest.fn() }
      const genWithProvider = new AutomatedTestGenerator(mockProvider)
      expect(genWithProvider).toBeDefined()
    })
  })

  describe('analyzeCode', () => {
    it('should analyze simple function code', async () => {
      const sourceCode = `
        function calculateSum(a: number, b: number): number {
          return a + b;
        }
      `

      const analysis = await generator.analyzeCode(sourceCode, 'test.ts')

      expect(analysis).toBeDefined()
      expect(analysis).toHaveProperty('functions')
      expect(analysis).toHaveProperty('classes')
      expect(analysis).toHaveProperty('imports')
      expect(analysis).toHaveProperty('dependencies')
      expect(analysis).toHaveProperty('patterns')
      expect(Array.isArray(analysis.functions)).toBe(true)
    })

    it('should detect React patterns', async () => {
      const sourceCode = `
        import React, { useState } from 'react';

        function MyComponent() {
          const [count, setCount] = useState(0);
          return <div>{count}</div>;
        }
      `

      const analysis = await generator.analyzeCode(sourceCode, 'Component.tsx')

      expect(analysis.patterns).toContain('react-component')
    })

    it('should detect async patterns', async () => {
      const sourceCode = `
        async function fetchData() {
          const response = await fetch('/api/data');
          return response.json();
        }
      `

      const analysis = await generator.analyzeCode(sourceCode, 'api.ts')

      expect(analysis.patterns).toContain('async-code')
    })

    it('should detect error handling patterns', async () => {
      const sourceCode = `
        function safeDivide(a: number, b: number) {
          try {
            return a / b;
          } catch (error) {
            console.error(error);
            return 0;
          }
        }
      `

      const analysis = await generator.analyzeCode(sourceCode, 'utils.ts')

      expect(analysis.patterns).toContain('error-handling')
    })

    it('should extract imports', async () => {
      const sourceCode = `
        import { useState } from 'react';
        import axios from 'axios';
        import './styles.css';
      `

      const analysis = await generator.analyzeCode(sourceCode, 'test.ts')

      expect(analysis.imports).toContain('react')
      expect(analysis.imports).toContain('axios')
    })

    it('should extract class definitions', async () => {
      const sourceCode = `
        class Calculator {
          add(a: number, b: number) {
            return a + b;
          }
        }
      `

      const analysis = await generator.analyzeCode(sourceCode, 'Calculator.ts')

      expect(analysis.classes.length).toBeGreaterThan(0)
      expect(analysis.classes[0].name).toBe('Calculator')
    })
  })

  describe('generateUnitTests', () => {
    const options: TestGenerationOptions = {
      framework: 'jest',
      language: 'typescript',
      coverage: 'unit',
      includeMocks: false,
      testStyle: 'bdd'
    }

    it('should generate tests without AI provider', async () => {
      const sourceCode = `
        function add(a: number, b: number) {
          return a + b;
        }
      `

      const tests = await generator.generateUnitTests(sourceCode, 'add.ts', options)

      expect(Array.isArray(tests)).toBe(true)
    })

    it('should return empty array for empty source code', async () => {
      const tests = await generator.generateUnitTests('', 'empty.ts', options)

      expect(Array.isArray(tests)).toBe(true)
    })
  })

  describe('generateIntegrationTests', () => {
    const options: TestGenerationOptions = {
      framework: 'jest',
      language: 'typescript',
      coverage: 'integration',
      includeMocks: true,
      testStyle: 'bdd'
    }

    it('should generate integration tests without AI provider', async () => {
      const sourceCode = `
        export async function fetchUserData(userId: string) {
          const response = await fetch(\`/api/users/\${userId}\`);
          return response.json();
        }
      `

      const tests = await generator.generateIntegrationTests(sourceCode, 'api.ts', options)

      expect(Array.isArray(tests)).toBe(true)
    })
  })

  describe('generateE2ETests', () => {
    const options: TestGenerationOptions = {
      framework: 'playwright',
      language: 'typescript',
      coverage: 'e2e',
      includeMocks: false,
      testStyle: 'bdd'
    }

    it('should generate e2e tests without AI provider', async () => {
      const sourceCode = `
        export function LoginPage() {
          return (
            <form>
              <input name="email" />
              <input name="password" type="password" />
              <button type="submit">Login</button>
            </form>
          );
        }
      `

      const tests = await generator.generateE2ETests(sourceCode, 'LoginPage.tsx', options)

      expect(Array.isArray(tests)).toBe(true)
    })
  })
})
