import { z } from 'zod'

// Setup step status
export const setupStepStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'error', 'warning'])
export type SetupStepStatus = z.infer<typeof setupStepStatusSchema>

// Setup step identifiers
export const setupStepIdSchema = z.enum(['docker', 'kubernetes', 'database', 'ai-keys'])
export type SetupStepId = z.infer<typeof setupStepIdSchema>

// Individual check result
export const setupCheckResultSchema = z.object({
  status: setupStepStatusSchema,
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().optional(),
})
export type SetupCheckResult = z.infer<typeof setupCheckResultSchema>

// Docker check result
export const dockerCheckResultSchema = setupCheckResultSchema.extend({
  version: z.string().optional(),
  running: z.boolean().optional(),
})
export type DockerCheckResult = z.infer<typeof dockerCheckResultSchema>

// Kubernetes check result
export const kubernetesCheckResultSchema = setupCheckResultSchema.extend({
  connected: z.boolean().optional(),
  clusterName: z.string().optional(),
  version: z.string().optional(),
})
export type KubernetesCheckResult = z.infer<typeof kubernetesCheckResultSchema>

// Database check result
export const databaseCheckResultSchema = setupCheckResultSchema.extend({
  initialized: z.boolean().optional(),
  migrationsComplete: z.boolean().optional(),
})
export type DatabaseCheckResult = z.infer<typeof databaseCheckResultSchema>

// AI keys check result
export const aiKeysCheckResultSchema = setupCheckResultSchema.extend({
  validKeys: z.array(z.string()).optional(),
  missingKeys: z.array(z.string()).optional(),
})
export type AIKeysCheckResult = z.infer<typeof aiKeysCheckResultSchema>

// Overall setup status
export const setupStatusSchema = z.object({
  docker: dockerCheckResultSchema,
  kubernetes: kubernetesCheckResultSchema,
  database: databaseCheckResultSchema,
  aiKeys: aiKeysCheckResultSchema,
  overallStatus: setupStepStatusSchema,
  currentStep: setupStepIdSchema.optional(),
  completedSteps: z.array(setupStepIdSchema).default([]),
})
export type SetupStatus = z.infer<typeof setupStatusSchema>

// Setup wizard state
export const setupWizardStateSchema = z.object({
  currentStepIndex: z.number().min(0).default(0),
  completedSteps: z.array(setupStepIdSchema).default([]),
  setupCompleted: z.boolean().default(false),
  lastChecked: z.string().optional(),
})
export type SetupWizardState = z.infer<typeof setupWizardStateSchema>

// Default values
export const defaultSetupCheckResult: SetupCheckResult = {
  status: 'pending',
  message: 'Not checked yet',
}

export const defaultDockerCheckResult: DockerCheckResult = {
  status: 'pending',
  message: 'Docker check not run',
}

export const defaultKubernetesCheckResult: KubernetesCheckResult = {
  status: 'pending',
  message: 'Kubernetes check not run',
}

export const defaultDatabaseCheckResult: DatabaseCheckResult = {
  status: 'pending',
  message: 'Database check not run',
}

export const defaultAIKeysCheckResult: AIKeysCheckResult = {
  status: 'pending',
  message: 'AI keys check not run',
}

export const defaultSetupStatus: SetupStatus = {
  docker: defaultDockerCheckResult,
  kubernetes: defaultKubernetesCheckResult,
  database: defaultDatabaseCheckResult,
  aiKeys: defaultAIKeysCheckResult,
  overallStatus: 'pending',
  completedSteps: [],
}

export const defaultSetupWizardState: SetupWizardState = {
  currentStepIndex: 0,
  completedSteps: [],
  setupCompleted: false,
}

// Helper function to merge setup status with defaults
export function mergeWithDefaultSetupStatus(overrides: Partial<SetupStatus> | null | undefined): SetupStatus {
  if (!overrides) {
    return { ...defaultSetupStatus }
  }

  return {
    overallStatus: overrides.overallStatus ?? defaultSetupStatus.overallStatus,
    currentStep: overrides.currentStep ?? defaultSetupStatus.currentStep,
    docker: overrides.docker ?? defaultSetupStatus.docker,
    kubernetes: overrides.kubernetes ?? defaultSetupStatus.kubernetes,
    database: overrides.database ?? defaultSetupStatus.database,
    aiKeys: overrides.aiKeys ?? defaultSetupStatus.aiKeys,
    completedSteps: overrides.completedSteps ?? defaultSetupStatus.completedSteps,
  }
}

// Helper function to determine overall status based on individual checks
export function calculateOverallStatus(status: SetupStatus): SetupStepStatus {
  const checkStatuses = [status.docker.status, status.kubernetes.status, status.database.status, status.aiKeys.status]

  if (checkStatuses.some((s) => s === 'error')) {
    return 'error'
  }

  if (checkStatuses.some((s) => s === 'warning')) {
    return 'warning'
  }

  if (checkStatuses.some((s) => s === 'in_progress')) {
    return 'in_progress'
  }

  if (checkStatuses.every((s) => s === 'completed')) {
    return 'completed'
  }

  return 'pending'
}
