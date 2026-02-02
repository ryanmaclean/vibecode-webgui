/**
 * Self-Healing CI Tests
 *
 * Tests for CI failure analysis and fix generation
 */

import { FailureAnalyzer } from '../../src/lib/ci-self-healing/failure-analyzer'
import { FixGenerator } from '../../src/lib/ci-self-healing/fix-generator'
import { SelfHealingCI, createSelfHealingCI } from '../../src/lib/ci-self-healing'
import type {
  SelfHealingConfig,
  WorkflowRun,
  WorkflowJob,
  AnalyzedFailure,
  FailureAnalysisResult,
} from '../../src/lib/ci-self-healing/types'

// Mock Octokit
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      actions: {
        listWorkflowRunsForRepo: jest.fn(),
        getWorkflowRun: jest.fn(),
        listJobsForWorkflowRun: jest.fn(),
        downloadJobLogsForWorkflowRun: jest.fn(),
      },
      repos: {
        getContent: jest.fn(),
        createOrUpdateFileContents: jest.fn(),
      },
      git: {
        getRef: jest.fn(),
        createRef: jest.fn(),
      },
      pulls: {
        create: jest.fn(),
      },
    },
  })),
}))

// Mock Anthropic - use doMock to avoid module resolution issues when SDK is not installed
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn(),
    },
  })),
}), { virtual: true })

describe('Self-Healing CI Module', () => {
  const mockConfig: SelfHealingConfig = {
    owner: 'test-owner',
    repo: 'test-repo',
    githubToken: 'mock-token',
    anthropicApiKey: 'mock-api-key',
    confidenceThreshold: 0.3,
    dryRun: true,
  }

  describe('FailureAnalyzer', () => {
    let analyzer: FailureAnalyzer

    beforeEach(() => {
      analyzer = new FailureAnalyzer(mockConfig)
    })

    describe('Log Parsing', () => {
      it('should identify TypeScript errors', () => {
        const logs = `
2024-01-15T10:00:00.000Z Running TypeScript check...
src/lib/utils.ts(42,10): error TS2322: Type 'string' is not assignable to type 'number'.
src/lib/api.ts(15,5): error TS2339: Property 'foo' does not exist on type 'Bar'.
        `

        // Access private method through any cast for testing
        const parsedLogs = (analyzer as any).parseLogs(logs)
        const category = (analyzer as any).categorizeFailure(parsedLogs)

        expect(category).toBe('type-check')
        expect(parsedLogs.errorLines.length).toBeGreaterThan(0)
      })

      it('should identify lint errors', () => {
        const logs = `
Running ESLint...
src/components/Button.tsx
  15:10  error  'unused' is defined but never used  @typescript-eslint/no-unused-vars
  22:5   error  Unexpected console statement        no-console

✖ 2 problems (2 errors, 0 warnings)
        `

        const parsedLogs = (analyzer as any).parseLogs(logs)
        const category = (analyzer as any).categorizeFailure(parsedLogs)

        expect(category).toBe('lint')
      })

      it('should identify test failures', () => {
        const logs = `
FAIL src/tests/api.test.ts
  ● API Tests › should return user data

    expect(received).toEqual(expected)

    Expected: {"id": 1, "name": "John"}
    Received: undefined

      15 |   it('should return user data', async () => {
      16 |     const result = await getUser(1)
    > 17 |     expect(result).toEqual({ id: 1, name: 'John' })
         |                    ^

Test Suites: 1 failed, 5 passed, 6 total
Tests:       1 failed, 20 passed, 21 total
        `

        const parsedLogs = (analyzer as any).parseLogs(logs)
        const category = (analyzer as any).categorizeFailure(parsedLogs)

        expect(category).toBe('test')
      })

      it('should identify build errors', () => {
        const logs = `
> next build

Failed to compile.

./src/app/page.tsx
Module not found: Can't resolve './components/Missing'

Build failed because of webpack errors
        `

        const parsedLogs = (analyzer as any).parseLogs(logs)
        const category = (analyzer as any).categorizeFailure(parsedLogs)

        expect(category).toBe('build')
      })

      it('should identify dependency errors', () => {
        const logs = `
npm ERR! code ERESOLVE
npm ERR! ERESOLVE could not resolve
npm ERR!
npm ERR! While resolving: test-package@1.0.0
npm ERR! Found: react@18.0.0
npm ERR! peer dep missing: react@^17.0.0, required by some-library@2.0.0
        `

        const parsedLogs = (analyzer as any).parseLogs(logs)
        const category = (analyzer as any).categorizeFailure(parsedLogs)

        expect(category).toBe('dependency')
      })

      it('should identify timeout errors', () => {
        const logs = `
Error: Job exceeded time limit
The job running on runner GitHub Actions 2 has exceeded the maximum execution time of 60 minutes.
        `

        const parsedLogs = (analyzer as any).parseLogs(logs)
        const category = (analyzer as any).categorizeFailure(parsedLogs)

        expect(category).toBe('timeout')
      })
    })

    describe('File Extraction', () => {
      it('should extract file paths from error messages', () => {
        const logs = `
Error in src/lib/utils.ts:42:10
  at processFile (./src/processors/main.ts:15:5)
  at tests/unit/api.test.ts:22
        `

        const files = (analyzer as any).extractAffectedFiles(logs)

        expect(files).toContain('src/lib/utils.ts')
        // The implementation preserves the './' prefix from stack traces
        expect(files).toContain('./src/processors/main.ts')
        expect(files).toContain('tests/unit/api.test.ts')
      })

      it('should exclude node_modules paths', () => {
        const logs = `
Error at node_modules/some-package/index.js:10
Error at src/lib/api.ts:42
        `

        const files = (analyzer as any).extractAffectedFiles(logs)

        expect(files).not.toContain('node_modules/some-package/index.js')
        expect(files).toContain('src/lib/api.ts')
      })
    })

    describe('Location Extraction', () => {
      it('should extract TypeScript error locations', () => {
        const content = 'src/lib/utils.ts(42,10): error TS2322: Type mismatch'

        const location = (analyzer as any).extractLocation(content)

        expect(location).toEqual({
          file: 'src/lib/utils.ts',
          line: 42,
          column: 10,
        })
      })

      it('should extract ESLint error locations', () => {
        const content = '  src/components/Button.tsx:15:10  error  Some lint error'

        const location = (analyzer as any).extractLocation(content)

        expect(location).toEqual({
          file: 'src/components/Button.tsx',
          line: 15,
          column: 10,
        })
      })
    })

    describe('Severity Determination', () => {
      it('should mark build errors as critical', () => {
        const severity = (analyzer as any).determineSeverity('build', 1)
        expect(severity).toBe('critical')
      })

      it('should mark type-check errors as critical', () => {
        const severity = (analyzer as any).determineSeverity('type-check', 1)
        expect(severity).toBe('critical')
      })

      it('should mark many test failures as critical', () => {
        const severity = (analyzer as any).determineSeverity('test', 10)
        expect(severity).toBe('critical')
      })

      it('should mark few test failures as high', () => {
        const severity = (analyzer as any).determineSeverity('test', 2)
        expect(severity).toBe('high')
      })

      it('should mark timeout errors as medium', () => {
        const severity = (analyzer as any).determineSeverity('timeout', 1)
        expect(severity).toBe('medium')
      })
    })

    describe('Suggested Actions', () => {
      it('should suggest lint:fix for lint errors', () => {
        const actions = (analyzer as any).suggestActions('lint', [])

        expect(actions.some((a: string) => a.includes('lint:fix'))).toBe(true)
      })

      it('should suggest running tests locally for test failures', () => {
        const actions = (analyzer as any).suggestActions('test', [])

        expect(actions.some((a: string) => a.includes('locally'))).toBe(true)
      })

      it('should suggest reinstalling for dependency errors', () => {
        const actions = (analyzer as any).suggestActions('dependency', [])

        expect(actions.some((a: string) => a.includes('node_modules'))).toBe(true)
      })
    })
  })

  describe('FixGenerator', () => {
    let generator: FixGenerator

    beforeEach(() => {
      generator = new FixGenerator(mockConfig)
    })

    describe('Fix Response Parsing', () => {
      it('should parse valid JSON response', () => {
        const response = JSON.stringify({
          title: 'Fix type error',
          description: 'Changed string to number',
          fixes: [
            {
              file: 'src/lib/utils.ts',
              description: 'Fix type annotation',
              originalCode: 'const x: string = 42',
              fixedCode: 'const x: number = 42',
              lineStart: 10,
              lineEnd: 10,
            },
          ],
          confidence: 0.9,
          estimatedImpact: 'full',
          requiresReview: true,
          testCommands: ['npm test'],
        })

        const mockFailure: AnalyzedFailure = {
          id: 'test-id',
          category: 'type-check',
          severity: 'high',
          summary: 'Type error',
          details: [],
          affectedFiles: [],
          relatedErrors: [],
          suggestedActions: [],
          confidence: 0.8,
        }

        const result = (generator as any).parseFixResponse(response, mockFailure)

        expect(result).not.toBeNull()
        expect(result.title).toBe('Fix type error')
        expect(result.fixes).toHaveLength(1)
        expect(result.fixes[0].file).toBe('src/lib/utils.ts')
        expect(result.confidence).toBe(0.9)
      })

      it('should handle JSON wrapped in markdown code block', () => {
        const response = '```json\n{"title": "Fix", "fixes": [], "confidence": 0.5}\n```'

        const mockFailure: AnalyzedFailure = {
          id: 'test-id',
          category: 'lint',
          severity: 'medium',
          summary: 'Lint error',
          details: [],
          affectedFiles: [],
          relatedErrors: [],
          suggestedActions: [],
          confidence: 0.7,
        }

        const result = (generator as any).parseFixResponse(response, mockFailure)

        expect(result).not.toBeNull()
        expect(result.title).toBe('Fix')
      })

      it('should return null for invalid JSON', () => {
        const response = 'This is not valid JSON'

        const mockFailure: AnalyzedFailure = {
          id: 'test-id',
          category: 'unknown',
          severity: 'low',
          summary: 'Unknown error',
          details: [],
          affectedFiles: [],
          relatedErrors: [],
          suggestedActions: [],
          confidence: 0.5,
        }

        const result = (generator as any).parseFixResponse(response, mockFailure)

        expect(result).toBeNull()
      })

      it('should return null for missing required fields', () => {
        const response = JSON.stringify({
          description: 'No title or fixes',
        })

        const mockFailure: AnalyzedFailure = {
          id: 'test-id',
          category: 'unknown',
          severity: 'low',
          summary: 'Error',
          details: [],
          affectedFiles: [],
          relatedErrors: [],
          suggestedActions: [],
          confidence: 0.5,
        }

        const result = (generator as any).parseFixResponse(response, mockFailure)

        expect(result).toBeNull()
      })
    })

    describe('PR Body Generation', () => {
      it('should generate proper PR body', () => {
        const mockAnalysis: FailureAnalysisResult = {
          workflowRun: {
            id: 12345,
            name: 'CI',
            status: 'completed',
            conclusion: 'failure',
            headBranch: 'main',
            headSha: 'abc123def456',
            htmlUrl: 'https://github.com/test/repo/actions/runs/12345',
            createdAt: '2024-01-15T10:00:00Z',
            updatedAt: '2024-01-15T10:05:00Z',
            runAttempt: 1,
          },
          failedJobs: [],
          failures: [],
          overallSummary: 'Build failed due to type errors',
          analyzedAt: '2024-01-15T10:10:00Z',
        }

        const mockFixes = {
          analysisId: '12345',
          suggestions: [
            {
              failureId: 'fail-1',
              title: 'Fix type error in utils',
              description: 'Changed string to number type',
              fixes: [
                {
                  file: 'src/lib/utils.ts',
                  description: 'Fix type annotation',
                  fixedCode: 'const x: number = 42',
                },
              ],
              confidence: 0.85,
              estimatedImpact: 'full' as const,
              requiresReview: true,
              testCommands: ['npm test'],
            },
          ],
          generatedAt: '2024-01-15T10:15:00Z',
          model: 'claude-sonnet-4-20250514',
        }

        const body = (generator as any).generatePRBody(mockAnalysis, mockFixes)

        expect(body).toContain('Self-Healing CI Fix')
        expect(body).toContain('#12345')
        expect(body).toContain('Fix type error in utils')
        expect(body).toContain('85%')
        expect(body).toContain('npm test')
        expect(body).toContain('Review Required')
      })
    })
  })

  describe('SelfHealingCI Integration', () => {
    it('should create instance with config', () => {
      const healer = new SelfHealingCI(mockConfig)
      expect(healer).toBeDefined()
    })

    it('should create instance with createSelfHealingCI helper', () => {
      const healer = createSelfHealingCI('owner', 'repo', {
        githubToken: 'token',
        dryRun: true,
      })
      expect(healer).toBeDefined()
    })
  })

  describe('Type Definitions', () => {
    it('should export all required types', () => {
      // This test verifies that types are properly exported
      const mockWorkflowRun: WorkflowRun = {
        id: 1,
        name: 'CI',
        status: 'completed',
        conclusion: 'failure',
        headBranch: 'main',
        headSha: 'abc123',
        htmlUrl: 'https://github.com',
        createdAt: '2024-01-15T10:00:00Z',
        updatedAt: '2024-01-15T10:05:00Z',
        runAttempt: 1,
      }

      expect(mockWorkflowRun.id).toBe(1)
      expect(mockWorkflowRun.conclusion).toBe('failure')
    })

    it('should support all failure categories', () => {
      const categories = [
        'lint',
        'type-check',
        'test',
        'build',
        'dependency',
        'environment',
        'timeout',
        'flaky',
        'unknown',
      ]

      categories.forEach((category) => {
        const failure: AnalyzedFailure = {
          id: 'test',
          category: category as any,
          severity: 'medium',
          summary: 'Test',
          details: [],
          affectedFiles: [],
          relatedErrors: [],
          suggestedActions: [],
          confidence: 0.5,
        }
        expect(failure.category).toBe(category)
      })
    })

    it('should support all severity levels', () => {
      const severities = ['critical', 'high', 'medium', 'low']

      severities.forEach((severity) => {
        const failure: AnalyzedFailure = {
          id: 'test',
          category: 'unknown',
          severity: severity as any,
          summary: 'Test',
          details: [],
          affectedFiles: [],
          relatedErrors: [],
          suggestedActions: [],
          confidence: 0.5,
        }
        expect(failure.severity).toBe(severity)
      })
    })
  })
})
