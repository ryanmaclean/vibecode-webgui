/**
 * CI Failure Analyzer
 *
 * Fetches GitHub Actions workflow logs and analyzes failures
 * to identify root causes and affected files
 */

import { Octokit } from '@octokit/rest'
import { v4 as uuidv4 } from 'uuid'
import type {
  WorkflowRun,
  WorkflowJob,
  WorkflowStep,
  ParsedLogs,
  LogLine,
  AnalyzedFailure,
  FailureAnalysisResult,
  FailureCategory,
  FailureSeverity,
  FailureDetail,
  SelfHealingConfig,
} from './types'

// Error patterns for different failure categories
const ERROR_PATTERNS: Record<FailureCategory, RegExp[]> = {
  lint: [
    /error\s+.*eslint/i,
    /\d+:\d+\s+error\s+/,
    /ESLint:/i,
    /prettier.*error/i,
    /linting failed/i,
  ],
  'type-check': [
    /error TS\d+:/,
    /Type '.*' is not assignable to type/,
    /Property '.*' does not exist on type/,
    /Cannot find module/,
    /type-check.*failed/i,
    /tsc.*error/i,
  ],
  test: [
    /FAIL\s+.*\.test\./,
    /✕|✗|×/,
    /AssertionError/,
    /Expected.*but.*received/i,
    /test failed/i,
    /jest.*error/i,
    /\d+ failed,?\s*\d+ passed/,
  ],
  build: [
    /Build failed/i,
    /Compilation failed/i,
    /Module not found/,
    /Failed to compile/,
    /Build error/i,
    /webpack.*error/i,
    /next build.*failed/i,
  ],
  dependency: [
    /npm ERR!/,
    /ERESOLVE/,
    /peer dep/i,
    /Could not resolve dependency/,
    /npm install.*failed/i,
    /package.*not found/i,
  ],
  environment: [
    /ENOENT/,
    /Permission denied/,
    /Environment variable.*not set/i,
    /secret.*not found/i,
    /ENOMEM/,
    /disk space/i,
  ],
  timeout: [
    /timed out/i,
    /timeout/i,
    /exceeded.*time/i,
    /Job was cancelled/i,
  ],
  flaky: [
    /flaky/i,
    /intermittent/i,
    /retry/i,
    /connection reset/i,
    /ECONNRESET/,
    /socket hang up/i,
  ],
  unknown: [],
}

// File extraction patterns
const FILE_PATTERNS = [
  /(?:at\s+)?(?:[\w.]+\s+\()?((?:\/|\.\/|src\/|tests?\/)[\w\-./]+\.[a-z]+)(?::\d+(?::\d+)?)?/gi,
  /(?:in|from|at)\s+([\w\-./]+\.[a-z]{2,4})/gi,
  /Error:\s*([^\s:]+\.[a-z]{2,4})/gi,
]

export class FailureAnalyzer {
  private octokit: Octokit
  private config: SelfHealingConfig

  constructor(config: SelfHealingConfig) {
    this.config = config
    this.octokit = new Octokit({
      auth: config.githubToken,
    })
  }

  /**
   * Analyze failures for a specific workflow run
   */
  async analyzeWorkflowRun(runId: number): Promise<FailureAnalysisResult> {
    // Fetch workflow run details
    const workflowRun = await this.fetchWorkflowRun(runId)

    if (workflowRun.conclusion !== 'failure') {
      return {
        workflowRun,
        failedJobs: [],
        failures: [],
        overallSummary: 'Workflow did not fail',
        analyzedAt: new Date().toISOString(),
      }
    }

    // Fetch failed jobs
    const failedJobs = await this.fetchFailedJobs(runId)

    // Fetch and analyze logs for each failed job
    const failures: AnalyzedFailure[] = []

    for (const job of failedJobs) {
      const logs = await this.fetchJobLogs(job.id)
      const parsedLogs = this.parseLogs(logs)
      const jobFailures = this.analyzeJobLogs(parsedLogs, job)
      failures.push(...jobFailures)
    }

    // Deduplicate and rank failures
    const rankedFailures = this.rankFailures(failures)

    return {
      workflowRun,
      failedJobs,
      failures: rankedFailures,
      overallSummary: this.generateSummary(rankedFailures),
      analyzedAt: new Date().toISOString(),
    }
  }

  /**
   * Analyze the most recent failed workflow run
   */
  async analyzeLatestFailure(): Promise<FailureAnalysisResult | null> {
    const { data: runs } = await this.octokit.rest.actions.listWorkflowRunsForRepo({
      owner: this.config.owner,
      repo: this.config.repo,
      status: 'failure',
      per_page: 1,
    })

    if (runs.workflow_runs.length === 0) {
      return null
    }

    return this.analyzeWorkflowRun(runs.workflow_runs[0].id)
  }

  /**
   * Fetch workflow run details
   */
  private async fetchWorkflowRun(runId: number): Promise<WorkflowRun> {
    const { data } = await this.octokit.rest.actions.getWorkflowRun({
      owner: this.config.owner,
      repo: this.config.repo,
      run_id: runId,
    })

    return {
      id: data.id,
      name: data.name || 'Unknown',
      status: data.status as WorkflowRun['status'],
      conclusion: data.conclusion as WorkflowRun['conclusion'],
      headBranch: data.head_branch || 'unknown',
      headSha: data.head_sha,
      htmlUrl: data.html_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      runAttempt: data.run_attempt ?? 1,
    }
  }

  /**
   * Fetch failed jobs for a workflow run
   */
  private async fetchFailedJobs(runId: number): Promise<WorkflowJob[]> {
    const { data } = await this.octokit.rest.actions.listJobsForWorkflowRun({
      owner: this.config.owner,
      repo: this.config.repo,
      run_id: runId,
      filter: 'latest',
    })

    return data.jobs
      .filter((job) => job.conclusion === 'failure')
      .map((job) => ({
        id: job.id,
        name: job.name,
        status: job.status as WorkflowJob['status'],
        conclusion: job.conclusion as WorkflowJob['conclusion'],
        startedAt: job.started_at,
        completedAt: job.completed_at,
        steps: (job.steps || []).map((step) => ({
          name: step.name,
          status: step.status as WorkflowStep['status'],
          conclusion: step.conclusion as WorkflowStep['conclusion'],
          number: step.number,
          startedAt: step.started_at ?? undefined,
          completedAt: step.completed_at ?? undefined,
        })),
      }))
  }

  /**
   * Fetch logs for a specific job
   */
  private async fetchJobLogs(jobId: number): Promise<string> {
    try {
      const { data } = await this.octokit.rest.actions.downloadJobLogsForWorkflowRun({
        owner: this.config.owner,
        repo: this.config.repo,
        job_id: jobId,
      })

      // The response is a string when using the REST API
      const logs = typeof data === 'string' ? data : String(data)

      // Truncate if too large
      const maxSize = this.config.maxLogsSize || 500000
      if (logs.length > maxSize) {
        // Keep the end of the logs (where errors usually are)
        return logs.slice(-maxSize)
      }

      return logs
    } catch (error) {
      console.error(`Failed to fetch logs for job ${jobId}:`, error)
      return ''
    }
  }

  /**
   * Parse raw logs into structured format
   */
  private parseLogs(rawLogs: string): ParsedLogs {
    const lines: LogLine[] = []
    const rawLines = rawLogs.split('\n')

    for (let i = 0; i < rawLines.length; i++) {
      const content = rawLines[i]
      const isError = this.isErrorLine(content)
      const isWarning = this.isWarningLine(content)

      // Extract timestamp if present (GitHub Actions format)
      const timestampMatch = content.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z/)
      const timestamp = timestampMatch ? timestampMatch[0] : undefined

      lines.push({
        timestamp,
        content,
        lineNumber: i + 1,
        isError,
        isWarning,
      })
    }

    return {
      raw: rawLogs,
      lines,
      errorLines: lines.filter((l) => l.isError),
      warningLines: lines.filter((l) => l.isWarning),
    }
  }

  /**
   * Check if a line contains an error
   */
  private isErrorLine(content: string): boolean {
    const errorIndicators = [
      /\berror\b/i,
      /\bfailed\b/i,
      /\bfailure\b/i,
      /✕|✗|×/,
      /FAIL\s/,
      /ERR!/,
      /Error:/,
      /Exception:/,
    ]

    return errorIndicators.some((pattern) => pattern.test(content))
  }

  /**
   * Check if a line contains a warning
   */
  private isWarningLine(content: string): boolean {
    const warningIndicators = [/\bwarning\b/i, /\bwarn\b/i, /⚠/]

    return warningIndicators.some((pattern) => pattern.test(content))
  }

  /**
   * Analyze job logs and extract failures
   */
  private analyzeJobLogs(logs: ParsedLogs, job: WorkflowJob): AnalyzedFailure[] {
    const failures: AnalyzedFailure[] = []

    // Find the failed step
    const failedStep = job.steps.find((s) => s.conclusion === 'failure')

    // Categorize the failure based on error patterns
    const category = this.categorizeFailure(logs)

    // Extract failure details
    const details = this.extractFailureDetails(logs)

    // Extract affected files
    const affectedFiles = this.extractAffectedFiles(logs.raw)

    // Extract related errors (context around main error)
    const relatedErrors = this.extractRelatedErrors(logs)

    if (details.length > 0 || logs.errorLines.length > 0) {
      failures.push({
        id: uuidv4(),
        category,
        severity: this.determineSeverity(category, details.length),
        summary: this.generateFailureSummary(job, failedStep, category, details),
        details,
        rootCause: this.inferRootCause(category, details, logs),
        affectedFiles,
        relatedErrors,
        suggestedActions: this.suggestActions(category, details),
        confidence: this.calculateConfidence(category, details, affectedFiles),
      })
    }

    return failures
  }

  /**
   * Categorize the failure based on log content
   */
  private categorizeFailure(logs: ParsedLogs): FailureCategory {
    const logContent = logs.raw.toLowerCase()

    // Check each category's patterns
    for (const [category, patterns] of Object.entries(ERROR_PATTERNS)) {
      if (category === 'unknown') continue

      for (const pattern of patterns) {
        if (pattern.test(logContent) || pattern.test(logs.raw)) {
          return category as FailureCategory
        }
      }
    }

    return 'unknown'
  }

  /**
   * Extract detailed failure information from logs
   */
  private extractFailureDetails(logs: ParsedLogs): FailureDetail[] {
    const details: FailureDetail[] = []

    // Process error lines
    for (const errorLine of logs.errorLines) {
      const location = this.extractLocation(errorLine.content)
      const context = this.extractContext(logs.lines, errorLine.lineNumber)

      details.push({
        message: errorLine.content.trim(),
        location,
        context,
      })
    }

    // Look for stack traces
    const stackTraces = this.extractStackTraces(logs.raw)
    for (const stack of stackTraces) {
      const existingDetail = details.find((d) =>
        stack.includes(d.message.slice(0, 50))
      )
      if (existingDetail) {
        existingDetail.stackTrace = stack
      } else {
        details.push({
          message: stack.split('\n')[0],
          stackTrace: stack,
        })
      }
    }

    // Deduplicate and limit
    const uniqueDetails = this.deduplicateDetails(details)
    return uniqueDetails.slice(0, 20) // Limit to top 20 details
  }

  /**
   * Extract file location from an error message
   */
  private extractLocation(content: string): { file?: string; line?: number; column?: number } | undefined {
    // TypeScript/JavaScript error format: file.ts(line,column)
    const tsMatch = content.match(/([\w\-./]+\.[tj]sx?)\((\d+),(\d+)\)/)
    if (tsMatch) {
      return {
        file: tsMatch[1],
        line: parseInt(tsMatch[2]),
        column: parseInt(tsMatch[3]),
      }
    }

    // ESLint/standard format: file.ts:line:column
    const standardMatch = content.match(/([\w\-./]+\.[a-z]+):(\d+):(\d+)/)
    if (standardMatch) {
      return {
        file: standardMatch[1],
        line: parseInt(standardMatch[2]),
        column: parseInt(standardMatch[3]),
      }
    }

    // Simple format: file.ts:line
    const simpleMatch = content.match(/([\w\-./]+\.[a-z]+):(\d+)/)
    if (simpleMatch) {
      return {
        file: simpleMatch[1],
        line: parseInt(simpleMatch[2]),
      }
    }

    return undefined
  }

  /**
   * Extract context lines around an error
   */
  private extractContext(lines: LogLine[], errorLineNumber: number, contextSize: number = 3): string[] {
    const start = Math.max(0, errorLineNumber - contextSize - 1)
    const end = Math.min(lines.length, errorLineNumber + contextSize)

    return lines
      .slice(start, end)
      .map((l) => l.content)
      .filter((c) => c.trim().length > 0)
  }

  /**
   * Extract stack traces from logs
   */
  private extractStackTraces(logs: string): string[] {
    const stackTraces: string[] = []

    // Match common stack trace patterns
    const stackPatterns = [
      /(?:Error|Exception|TypeError|ReferenceError|SyntaxError)[^\n]*\n(?:\s+at\s+[^\n]+\n)+/g,
      /(?:Caused by:|Traceback)[^\n]*\n(?:[^\n]+\n)+/g,
    ]

    for (const pattern of stackPatterns) {
      const matches = logs.match(pattern)
      if (matches) {
        stackTraces.push(...matches)
      }
    }

    return stackTraces
  }

  /**
   * Extract affected files from logs
   */
  private extractAffectedFiles(logs: string): string[] {
    const files = new Set<string>()

    for (const pattern of FILE_PATTERNS) {
      let match
      while ((match = pattern.exec(logs)) !== null) {
        const file = match[1]
        // Filter out common false positives
        if (
          file &&
          !file.includes('node_modules') &&
          !file.includes('.cache') &&
          !file.startsWith('/usr') &&
          !file.startsWith('/tmp')
        ) {
          files.add(file)
        }
      }
    }

    return Array.from(files).slice(0, 20) // Limit to 20 files
  }

  /**
   * Extract related errors for additional context
   */
  private extractRelatedErrors(logs: ParsedLogs): string[] {
    const related: string[] = []

    // Look for warning lines that might be related
    for (const warning of logs.warningLines.slice(0, 10)) {
      if (warning.content.trim().length > 10) {
        related.push(warning.content.trim())
      }
    }

    return related
  }

  /**
   * Deduplicate failure details
   */
  private deduplicateDetails(details: FailureDetail[]): FailureDetail[] {
    const seen = new Set<string>()
    return details.filter((d) => {
      const key = d.message.slice(0, 100)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }

  /**
   * Determine severity based on failure category and details
   */
  private determineSeverity(category: FailureCategory, detailCount: number): FailureSeverity {
    if (category === 'build' || category === 'type-check') {
      return 'critical'
    }
    if (category === 'test' && detailCount > 5) {
      return 'critical'
    }
    if (category === 'lint' || category === 'test') {
      return 'high'
    }
    if (category === 'dependency' || category === 'environment') {
      return 'high'
    }
    if (category === 'flaky' || category === 'timeout') {
      return 'medium'
    }
    return 'medium'
  }

  /**
   * Generate a summary for a failure
   */
  private generateFailureSummary(
    job: WorkflowJob,
    failedStep: WorkflowStep | undefined,
    category: FailureCategory,
    details: FailureDetail[]
  ): string {
    const stepName = failedStep?.name || 'Unknown step'
    const categoryLabel = category.replace('-', ' ')
    const detailCount = details.length

    if (detailCount === 0) {
      return `${job.name}: ${stepName} failed (${categoryLabel})`
    }

    const firstError = details[0].message.slice(0, 100)
    if (detailCount === 1) {
      return `${job.name}: ${firstError}`
    }

    return `${job.name}: ${firstError}... (+${detailCount - 1} more errors)`
  }

  /**
   * Infer the root cause of the failure
   */
  private inferRootCause(
    category: FailureCategory,
    details: FailureDetail[],
    logs: ParsedLogs
  ): string | undefined {
    if (details.length === 0) return undefined

    const firstDetail = details[0]

    switch (category) {
      case 'type-check':
        if (firstDetail.location?.file) {
          return `Type error in ${firstDetail.location.file} at line ${firstDetail.location.line || 'unknown'}`
        }
        return 'TypeScript compilation error'

      case 'lint':
        if (firstDetail.location?.file) {
          return `Linting violation in ${firstDetail.location.file}`
        }
        return 'Code style or linting violations'

      case 'test':
        return `Test failure: ${firstDetail.message.slice(0, 100)}`

      case 'build':
        return `Build failure: ${firstDetail.message.slice(0, 100)}`

      case 'dependency':
        return 'Dependency resolution or installation failure'

      case 'environment':
        return 'Environment configuration issue'

      case 'timeout':
        return 'Job exceeded time limit'

      case 'flaky':
        return 'Intermittent or network-related failure'

      default:
        return firstDetail.message.slice(0, 100)
    }
  }

  /**
   * Suggest actions to fix the failure
   */
  private suggestActions(category: FailureCategory, details: FailureDetail[]): string[] {
    const actions: string[] = []

    switch (category) {
      case 'lint':
        actions.push('Run npm run lint:fix to auto-fix linting issues')
        actions.push('Review ESLint configuration for rule adjustments')
        break

      case 'type-check':
        actions.push('Fix TypeScript type errors in the affected files')
        actions.push('Check for missing type definitions or @types packages')
        break

      case 'test':
        actions.push('Run failing tests locally to reproduce the issue')
        actions.push('Check test assertions and expected values')
        actions.push('Look for recently changed code affecting tests')
        break

      case 'build':
        actions.push('Check import statements and module resolution')
        actions.push('Verify all dependencies are installed')
        actions.push('Review recent changes to build configuration')
        break

      case 'dependency':
        actions.push('Delete node_modules and package-lock.json, then reinstall')
        actions.push('Check for peer dependency conflicts')
        actions.push('Consider using --legacy-peer-deps flag')
        break

      case 'environment':
        actions.push('Verify all required environment variables are set')
        actions.push('Check GitHub Actions secrets configuration')
        break

      case 'timeout':
        actions.push('Increase timeout limit in workflow configuration')
        actions.push('Optimize slow operations')
        break

      case 'flaky':
        actions.push('Add retry logic or increase timeouts')
        actions.push('Check for race conditions in tests')
        break

      default:
        actions.push('Review the error logs for more details')
        actions.push('Check recent commits for related changes')
    }

    return actions
  }

  /**
   * Calculate confidence score for the analysis
   */
  private calculateConfidence(
    category: FailureCategory,
    details: FailureDetail[],
    affectedFiles: string[]
  ): number {
    let confidence = 0.5

    // Higher confidence if we identified the category
    if (category !== 'unknown') confidence += 0.2

    // Higher confidence with specific file locations
    if (details.some((d) => d.location?.file)) confidence += 0.15

    // Higher confidence with stack traces
    if (details.some((d) => d.stackTrace)) confidence += 0.1

    // Higher confidence with affected files identified
    if (affectedFiles.length > 0) confidence += 0.05

    return Math.min(1, confidence)
  }

  /**
   * Rank failures by severity and confidence
   */
  private rankFailures(failures: AnalyzedFailure[]): AnalyzedFailure[] {
    const severityOrder: Record<FailureSeverity, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    }

    return failures.sort((a, b) => {
      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity]
      if (severityDiff !== 0) return severityDiff
      return b.confidence - a.confidence
    })
  }

  /**
   * Generate overall summary of all failures
   */
  private generateSummary(failures: AnalyzedFailure[]): string {
    if (failures.length === 0) {
      return 'No specific failures identified'
    }

    const categories = Array.from(new Set(failures.map((f) => f.category)))
    const criticalCount = failures.filter((f) => f.severity === 'critical').length

    let summary = `Found ${failures.length} failure(s) in: ${categories.join(', ')}`

    if (criticalCount > 0) {
      summary += `. ${criticalCount} critical issue(s) require immediate attention.`
    }

    return summary
  }
}
