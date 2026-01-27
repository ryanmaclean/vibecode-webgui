/**
 * Self-Healing CI Types
 *
 * Type definitions for CI failure analysis and fix generation
 */

export type FailureCategory =
  | 'lint'
  | 'type-check'
  | 'test'
  | 'build'
  | 'dependency'
  | 'environment'
  | 'timeout'
  | 'flaky'
  | 'unknown'

export type FailureSeverity = 'critical' | 'high' | 'medium' | 'low'

export interface WorkflowRun {
  id: number
  name: string
  status: 'completed' | 'in_progress' | 'queued' | 'waiting'
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null
  headBranch: string
  headSha: string
  htmlUrl: string
  createdAt: string
  updatedAt: string
  runAttempt: number
}

export interface WorkflowJob {
  id: number
  name: string
  status: 'completed' | 'in_progress' | 'queued'
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null
  startedAt: string | null
  completedAt: string | null
  steps: WorkflowStep[]
}

export interface WorkflowStep {
  name: string
  status: 'completed' | 'in_progress' | 'queued'
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | null
  number: number
  startedAt?: string
  completedAt?: string
}

export interface LogLine {
  timestamp?: string
  content: string
  lineNumber: number
  isError: boolean
  isWarning: boolean
}

export interface ParsedLogs {
  raw: string
  lines: LogLine[]
  errorLines: LogLine[]
  warningLines: LogLine[]
}

export interface FailureLocation {
  file?: string
  line?: number
  column?: number
  endLine?: number
  endColumn?: number
}

export interface FailureDetail {
  message: string
  location?: FailureLocation
  stackTrace?: string
  context?: string[]
}

export interface AnalyzedFailure {
  id: string
  category: FailureCategory
  severity: FailureSeverity
  summary: string
  details: FailureDetail[]
  rootCause?: string
  affectedFiles: string[]
  relatedErrors: string[]
  suggestedActions: string[]
  confidence: number
}

export interface FailureAnalysisResult {
  workflowRun: WorkflowRun
  failedJobs: WorkflowJob[]
  failures: AnalyzedFailure[]
  overallSummary: string
  analyzedAt: string
}

export interface CodeFix {
  file: string
  description: string
  originalCode?: string
  fixedCode: string
  lineStart?: number
  lineEnd?: number
  diffPatch?: string
}

export interface FixSuggestion {
  failureId: string
  title: string
  description: string
  fixes: CodeFix[]
  confidence: number
  estimatedImpact: 'full' | 'partial' | 'uncertain'
  requiresReview: boolean
  testCommands?: string[]
}

export interface FixGenerationResult {
  analysisId: string
  suggestions: FixSuggestion[]
  generatedAt: string
  model: string
  tokensUsed?: number
}

export interface SelfHealingConfig {
  owner: string
  repo: string
  githubToken: string
  anthropicApiKey?: string
  maxLogsSize?: number
  analysisModel?: string
  fixModel?: string
  confidenceThreshold?: number
  autoFix?: boolean
  createPR?: boolean
  dryRun?: boolean
}

export interface PRCreationResult {
  prNumber: number
  prUrl: string
  branch: string
  title: string
  body: string
}
