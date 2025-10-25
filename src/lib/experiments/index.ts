/**
 * Experiment Data Warehouse - Main Exports
 *
 * PostgreSQL-based experimentation platform following Eppo's SQL-based
 * assignment logging pattern with statistical analysis capabilities.
 */

export {
  ExperimentWarehouse,
  experimentWarehouse,
  type Assignment,
  type MetricEvent,
  type ExperimentResults,
  type VariantMetricStats
} from './warehouse'

export {
  ExperimentQueries,
  experimentQueries,
  type VariantDistribution,
  type TimeSeriesPoint,
  type RetentionCohort,
  type SampleRatioCheck,
  type MetricAggregation
} from './queries'

// Lifecycle Management
export {
  transitionStatus,
  canTransition,
  getLifecycleHistory,
  getExperimentStatus,
  getValidNextStatuses,
  isActiveStatus,
  isTerminalStatus,
  bulkTransitionStatus,
  STATUS_TRANSITIONS,
  type ExperimentStatus,
  type StatusTransition,
  type LifecycleEvent
} from './lifecycle'

// Scheduler
export {
  scheduleStart,
  scheduleStop,
  scheduleTrafficRamp,
  scheduleWinnerChecks,
  getScheduledOperations,
  processScheduledOperations,
  startScheduler,
  cancelScheduledOperation,
  type ScheduledOperation,
  type OperationType
} from './scheduler'

// Winner Selection
export {
  detectWinner,
  selectWinner,
  startWinnerDetection,
  getWinnerHistory,
  storeWinnerCheck,
  estimateTimeToWinner,
  type WinnerResult,
  type WinnerMetric,
  type WinnerDetectionConfig
} from './winner-selection'

// Rollout Management
export {
  createRolloutSchedule,
  getRolloutSchedule,
  executeRolloutStage,
  evaluateRolloutGuardrails,
  pauseRollout,
  resumeRollout,
  startRolloutMonitoring,
  DEFAULT_ROLLOUT_STAGES,
  GUARDRAIL_TEMPLATES,
  type RolloutSchedule,
  type RolloutStage,
  type Guardrail
} from './rollout'

// Templates
export {
  createFromTemplate,
  getTemplate,
  listTemplates,
  getTemplateCategories,
  validateAgainstTemplate,
  getRecommendedSampleSize,
  EXPERIMENT_TEMPLATES,
  type ExperimentTemplate,
  type MetricConfig,
  type VariantConfig
} from './templates'

// Conflict Detection
export {
  detectConflicts,
  areExperimentsCompatible,
  getActiveExperiments,
  suggestResolutions,
  attemptAutoResolve,
  checkExperimentCapacity,
  type ExperimentConflict,
  type ConflictType,
  type ConflictSeverity,
  type TargetingRule
} from './conflict-detector'

// Guardrails
export {
  evaluateGuardrails,
  monitorGuardrails,
  snapshotGuardrailStatus,
  getGuardrailHistory,
  startGuardrailMonitoring,
  stopGuardrailMonitoring,
  getMonitoringStatus,
  type GuardrailResult,
  type GuardrailViolation
} from './guardrails'
