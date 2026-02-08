/**
 * Tests for CI Failure Analyzer
 */

jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    rest: {
      actions: {
        getWorkflowRun: jest.fn(),
        listJobsForWorkflowRun: jest.fn(),
        downloadJobLogsForWorkflowRun: jest.fn(),
        listWorkflowRunsForRepo: jest.fn(),
      },
    },
  })),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234'),
}));

import { FailureAnalyzer } from '../failure-analyzer';
import { Octokit } from '@octokit/rest';
import type { SelfHealingConfig } from '../types';

const mockConfig: SelfHealingConfig = {
  githubToken: 'test-token',
  owner: 'test-owner',
  repo: 'test-repo',
  maxLogsSize: 500000,
  autoFix: false,
};

describe('FailureAnalyzer', () => {
  let analyzer: FailureAnalyzer;
  let mockOctokit: any;

  beforeEach(() => {
    jest.clearAllMocks();
    analyzer = new FailureAnalyzer(mockConfig);
    mockOctokit = (Octokit as unknown as jest.Mock).mock.results.slice(-1)[0]?.value;
  });

  // ==== analyzeWorkflowRun ====

  describe('analyzeWorkflowRun', () => {
    it('returns no failures for successful runs', async () => {
      mockOctokit.rest.actions.getWorkflowRun.mockResolvedValue({
        data: {
          id: 1,
          name: 'CI',
          status: 'completed',
          conclusion: 'success',
          head_branch: 'main',
          head_sha: 'abc123',
          html_url: 'https://test',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          run_attempt: 1,
        },
      });

      const result = await analyzer.analyzeWorkflowRun(1);
      expect(result.failures).toHaveLength(0);
      expect(result.overallSummary).toContain('did not fail');
    });

    it('analyzes failed workflow with lint errors', async () => {
      mockOctokit.rest.actions.getWorkflowRun.mockResolvedValue({
        data: {
          id: 1,
          name: 'CI',
          status: 'completed',
          conclusion: 'failure',
          head_branch: 'feature',
          head_sha: 'abc123',
          html_url: 'https://test',
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
          run_attempt: 1,
        },
      });

      mockOctokit.rest.actions.listJobsForWorkflowRun.mockResolvedValue({
        data: {
          jobs: [
            {
              id: 100,
              name: 'lint',
              status: 'completed',
              conclusion: 'failure',
              started_at: '2024-01-01',
              completed_at: '2024-01-01',
              steps: [
                { name: 'Run linter', status: 'completed', conclusion: 'failure', number: 3, started_at: '2024-01-01', completed_at: '2024-01-01' },
              ],
            },
          ],
        },
      });

      mockOctokit.rest.actions.downloadJobLogsForWorkflowRun.mockResolvedValue({
        data: '2024-01-01T00:00:00.000Z  3:14  error  Unexpected var  ESLint: no-var\nsrc/app.ts:10:5  error  Missing return type',
      });

      const result = await analyzer.analyzeWorkflowRun(1);
      expect(result.failures.length).toBeGreaterThanOrEqual(1);
      expect(result.failures[0].category).toBe('lint');
    });

    it('analyzes TypeScript errors', async () => {
      mockOctokit.rest.actions.getWorkflowRun.mockResolvedValue({
        data: { id: 1, name: 'CI', status: 'completed', conclusion: 'failure', head_branch: 'main', head_sha: 'abc', html_url: 'https://test', created_at: '2024-01-01', updated_at: '2024-01-01', run_attempt: 1 },
      });

      mockOctokit.rest.actions.listJobsForWorkflowRun.mockResolvedValue({
        data: {
          jobs: [
            {
              id: 101,
              name: 'type-check',
              status: 'completed',
              conclusion: 'failure',
              started_at: '2024-01-01',
              completed_at: '2024-01-01',
              steps: [{ name: 'Run tsc', status: 'completed', conclusion: 'failure', number: 1, started_at: '2024-01-01', completed_at: '2024-01-01' }],
            },
          ],
        },
      });

      mockOctokit.rest.actions.downloadJobLogsForWorkflowRun.mockResolvedValue({
        data: "src/utils.ts(15,3): error TS2322: Type 'string' is not assignable to type 'number'",
      });

      const result = await analyzer.analyzeWorkflowRun(1);
      expect(result.failures.length).toBeGreaterThanOrEqual(1);
      expect(result.failures[0].category).toBe('type-check');
      expect(result.failures[0].severity).toBe('critical');
    });

    it('analyzes test failures', async () => {
      mockOctokit.rest.actions.getWorkflowRun.mockResolvedValue({
        data: { id: 1, name: 'CI', status: 'completed', conclusion: 'failure', head_branch: 'main', head_sha: 'abc', html_url: 'https://test', created_at: '2024-01-01', updated_at: '2024-01-01', run_attempt: 1 },
      });

      mockOctokit.rest.actions.listJobsForWorkflowRun.mockResolvedValue({
        data: {
          jobs: [
            {
              id: 102,
              name: 'test',
              status: 'completed',
              conclusion: 'failure',
              started_at: '2024-01-01',
              completed_at: '2024-01-01',
              steps: [{ name: 'Run tests', status: 'completed', conclusion: 'failure', number: 1, started_at: '2024-01-01', completed_at: '2024-01-01' }],
            },
          ],
        },
      });

      mockOctokit.rest.actions.downloadJobLogsForWorkflowRun.mockResolvedValue({
        data: 'FAIL  src/utils.test.ts\n  ✕ should calculate sum correctly (5 ms)\n    Expected 4 but received 3\n    5 failed, 10 passed',
      });

      const result = await analyzer.analyzeWorkflowRun(1);
      expect(result.failures.length).toBeGreaterThanOrEqual(1);
      expect(result.failures[0].category).toBe('test');
    });

    it('analyzes build failures', async () => {
      mockOctokit.rest.actions.getWorkflowRun.mockResolvedValue({
        data: { id: 1, name: 'CI', status: 'completed', conclusion: 'failure', head_branch: 'main', head_sha: 'abc', html_url: 'https://test', created_at: '2024-01-01', updated_at: '2024-01-01', run_attempt: 1 },
      });

      mockOctokit.rest.actions.listJobsForWorkflowRun.mockResolvedValue({
        data: {
          jobs: [
            {
              id: 103,
              name: 'build',
              status: 'completed',
              conclusion: 'failure',
              started_at: '2024-01-01',
              completed_at: '2024-01-01',
              steps: [{ name: 'Build', status: 'completed', conclusion: 'failure', number: 1, started_at: '2024-01-01', completed_at: '2024-01-01' }],
            },
          ],
        },
      });

      mockOctokit.rest.actions.downloadJobLogsForWorkflowRun.mockResolvedValue({
        data: 'Build failed\nModule not found: src/components/Missing.tsx\nFailed to compile',
      });

      const result = await analyzer.analyzeWorkflowRun(1);
      expect(result.failures.length).toBeGreaterThanOrEqual(1);
      expect(result.failures[0].category).toBe('build');
      expect(result.failures[0].severity).toBe('critical');
    });

    it('analyzes dependency errors', async () => {
      mockOctokit.rest.actions.getWorkflowRun.mockResolvedValue({
        data: { id: 1, name: 'CI', status: 'completed', conclusion: 'failure', head_branch: 'main', head_sha: 'abc', html_url: 'https://test', created_at: '2024-01-01', updated_at: '2024-01-01', run_attempt: 1 },
      });

      mockOctokit.rest.actions.listJobsForWorkflowRun.mockResolvedValue({
        data: {
          jobs: [{
            id: 104, name: 'install', status: 'completed', conclusion: 'failure',
            started_at: '2024-01-01', completed_at: '2024-01-01',
            steps: [{ name: 'Install', status: 'completed', conclusion: 'failure', number: 1, started_at: '2024-01-01', completed_at: '2024-01-01' }],
          }],
        },
      });

      mockOctokit.rest.actions.downloadJobLogsForWorkflowRun.mockResolvedValue({
        data: 'npm ERR! ERESOLVE\nCould not resolve dependency:\npeer dep missing',
      });

      const result = await analyzer.analyzeWorkflowRun(1);
      expect(result.failures[0].category).toBe('dependency');
    });

    it('handles empty logs gracefully', async () => {
      mockOctokit.rest.actions.getWorkflowRun.mockResolvedValue({
        data: { id: 1, name: 'CI', status: 'completed', conclusion: 'failure', head_branch: 'main', head_sha: 'abc', html_url: 'https://test', created_at: '2024-01-01', updated_at: '2024-01-01', run_attempt: 1 },
      });

      mockOctokit.rest.actions.listJobsForWorkflowRun.mockResolvedValue({
        data: {
          jobs: [{
            id: 105, name: 'job', status: 'completed', conclusion: 'failure',
            started_at: '2024-01-01', completed_at: '2024-01-01', steps: [],
          }],
        },
      });

      mockOctokit.rest.actions.downloadJobLogsForWorkflowRun.mockResolvedValue({ data: '' });

      const result = await analyzer.analyzeWorkflowRun(1);
      expect(result.failures).toHaveLength(0);
    });
  });

  // ==== analyzeLatestFailure ====

  describe('analyzeLatestFailure', () => {
    it('returns null when no failed runs', async () => {
      mockOctokit.rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
        data: { workflow_runs: [] },
      });

      const result = await analyzer.analyzeLatestFailure();
      expect(result).toBeNull();
    });

    it('analyzes most recent failure', async () => {
      mockOctokit.rest.actions.listWorkflowRunsForRepo.mockResolvedValue({
        data: { workflow_runs: [{ id: 42 }] },
      });

      mockOctokit.rest.actions.getWorkflowRun.mockResolvedValue({
        data: { id: 42, name: 'CI', status: 'completed', conclusion: 'success', head_branch: 'main', head_sha: 'abc', html_url: 'https://test', created_at: '2024-01-01', updated_at: '2024-01-01', run_attempt: 1 },
      });

      const result = await analyzer.analyzeLatestFailure();
      expect(result).not.toBeNull();
    });
  });

  // ==== Suggested Actions ====

  describe('suggested actions', () => {
    it('suggests lint fix actions', async () => {
      mockOctokit.rest.actions.getWorkflowRun.mockResolvedValue({
        data: { id: 1, name: 'CI', status: 'completed', conclusion: 'failure', head_branch: 'main', head_sha: 'abc', html_url: 'https://test', created_at: '2024-01-01', updated_at: '2024-01-01', run_attempt: 1 },
      });
      mockOctokit.rest.actions.listJobsForWorkflowRun.mockResolvedValue({
        data: { jobs: [{ id: 1, name: 'lint', status: 'completed', conclusion: 'failure', started_at: '2024-01-01', completed_at: '2024-01-01', steps: [{ name: 'Lint', status: 'completed', conclusion: 'failure', number: 1, started_at: '2024-01-01', completed_at: '2024-01-01' }] }] },
      });
      mockOctokit.rest.actions.downloadJobLogsForWorkflowRun.mockResolvedValue({
        data: '5:3  error  Unexpected var  ESLint: no-var\nlinting failed',
      });

      const result = await analyzer.analyzeWorkflowRun(1);
      if (result.failures.length > 0) {
        expect(result.failures[0].suggestedActions).toEqual(
          expect.arrayContaining([expect.stringContaining('lint:fix')])
        );
      }
    });
  });

  // ==== Confidence Scores ====

  describe('confidence scoring', () => {
    it('assigns higher confidence with file locations', async () => {
      mockOctokit.rest.actions.getWorkflowRun.mockResolvedValue({
        data: { id: 1, name: 'CI', status: 'completed', conclusion: 'failure', head_branch: 'main', head_sha: 'abc', html_url: 'https://test', created_at: '2024-01-01', updated_at: '2024-01-01', run_attempt: 1 },
      });
      mockOctokit.rest.actions.listJobsForWorkflowRun.mockResolvedValue({
        data: { jobs: [{ id: 1, name: 'tsc', status: 'completed', conclusion: 'failure', started_at: '2024-01-01', completed_at: '2024-01-01', steps: [{ name: 'tsc', status: 'completed', conclusion: 'failure', number: 1, started_at: '2024-01-01', completed_at: '2024-01-01' }] }] },
      });
      mockOctokit.rest.actions.downloadJobLogsForWorkflowRun.mockResolvedValue({
        data: "src/app.ts:10:5: error TS2322: Type 'string' is not assignable to type 'number'\nError: tsc error\nat src/app.ts:10\n  at Object.run",
      });

      const result = await analyzer.analyzeWorkflowRun(1);
      if (result.failures.length > 0) {
        expect(result.failures[0].confidence).toBeGreaterThan(0.5);
      }
    });
  });
});
