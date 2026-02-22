/**
 * Workflow Automation Plugin
 *
 * Example plugin demonstrating workflow automation capabilities:
 * - Scheduled task execution
 * - Event-driven workflows
 * - Multi-step task orchestration
 * - File watching and automated actions
 */

import {
  PluginAPI,
  PluginManifest,
  PluginCapabilities,
  PluginContext
} from '@/types/plugin';

// Import the manifest
import manifest from './plugin.json';

/**
 * Plugin capabilities
 */
const capabilities: PluginCapabilities = {
  providesAIModel: false,
  providesIntegration: false,
  providesCommands: true,
  providesUIComponents: false,
  providesCodeActions: false,
  providesWorkflows: true,      // This plugin provides workflow automation
  providesFormatters: false,
  providesLinters: false
};

/**
 * Plugin context (set during initialization)
 */
let context: PluginContext | null = null;

/**
 * Workflow definitions
 */
interface WorkflowTask {
  id: string;
  name: string;
  description: string;
  execute: () => Promise<void>;
  schedule?: string;  // Cron expression for scheduled tasks
}

interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  tasks: WorkflowTask[];
  triggers: WorkflowTrigger[];
}

interface WorkflowTrigger {
  type: 'schedule' | 'event' | 'manual';
  config: Record<string, unknown>;
}

/**
 * Active workflows registry
 */
const activeWorkflows: Map<string, WorkflowDefinition> = new Map();
const scheduledJobs: Map<string, NodeJS.Timeout> = new Map();

/**
 * Initialize the plugin
 */
async function initialize(ctx: PluginContext): Promise<void> {
  context = ctx;

  ctx.logger.info('Workflow Automation plugin initializing...');
  ctx.logger.info(`Plugin ID: ${ctx.pluginId}`);

  // Register example workflows
  registerExampleWorkflows();

  // Register workflow commands
  registerWorkflowCommands(ctx);

  ctx.logger.info('Workflow Automation plugin initialized successfully!');
  ctx.logger.info(`Registered ${activeWorkflows.size} workflows`);
}

/**
 * Cleanup when plugin is destroyed
 */
async function destroy(): Promise<void> {
  if (context) {
    context.logger.info('Workflow Automation plugin shutting down...');

    // Stop all scheduled jobs
    for (const [jobId, timer] of scheduledJobs.entries()) {
      clearInterval(timer);
      context.logger.debug(`Stopped scheduled job: ${jobId}`);
    }
    scheduledJobs.clear();

    // Clear workflows
    activeWorkflows.clear();

    context = null;
  }
}

/**
 * Called when plugin is installed
 */
async function onInstall(): Promise<void> {
  if (context) {
    context.logger.info('Workflow Automation plugin installed!');
    context.logger.info('Use "workflow list" to see available workflows');
  }
}

/**
 * Called when plugin is uninstalled
 */
async function onUninstall(): Promise<void> {
  if (context) {
    context.logger.info('Workflow Automation plugin uninstalled');
  }
}

/**
 * Called when plugin is enabled
 */
async function onEnable(): Promise<void> {
  if (context) {
    context.logger.info('Workflow Automation plugin enabled!');
    // Re-register workflows when enabled
    registerExampleWorkflows();
  }
}

/**
 * Called when plugin is disabled
 */
async function onDisable(): Promise<void> {
  if (context) {
    context.logger.info('Workflow Automation plugin disabled');
    // Stop all scheduled jobs when disabled
    for (const timer of scheduledJobs.values()) {
      clearInterval(timer);
    }
    scheduledJobs.clear();
  }
}

/**
 * Called when plugin is updated
 */
async function onUpdate(oldVersion: string, newVersion: string): Promise<void> {
  if (context) {
    context.logger.info(`Workflow Automation plugin updated from ${oldVersion} to ${newVersion}`);
    // Re-register workflows with new version
    activeWorkflows.clear();
    registerExampleWorkflows();
  }
}

/**
 * Register example workflows
 */
function registerExampleWorkflows(): void {
  if (!context) return;

  // Example 1: Daily cleanup workflow
  const dailyCleanup: WorkflowDefinition = {
    id: 'daily-cleanup',
    name: 'Daily Cleanup',
    description: 'Automated daily cleanup of temporary files and logs',
    tasks: [
      {
        id: 'cleanup-temp',
        name: 'Clean Temp Files',
        description: 'Remove old temporary files',
        execute: async () => {
          context?.logger.info('[Daily Cleanup] Cleaning temporary files...');
          // In a real implementation, this would actually clean temp files
          await new Promise(resolve => setTimeout(resolve, 100));
          context?.logger.info('[Daily Cleanup] Temp files cleaned');
        },
        schedule: '0 0 * * *' // Daily at midnight
      },
      {
        id: 'cleanup-logs',
        name: 'Clean Old Logs',
        description: 'Archive or delete old log files',
        execute: async () => {
          context?.logger.info('[Daily Cleanup] Archiving old logs...');
          await new Promise(resolve => setTimeout(resolve, 100));
          context?.logger.info('[Daily Cleanup] Logs archived');
        }
      }
    ],
    triggers: [
      { type: 'schedule', config: { cron: '0 0 * * *' } }
    ]
  };

  // Example 2: Code quality workflow
  const codeQualityCheck: WorkflowDefinition = {
    id: 'code-quality-check',
    name: 'Code Quality Check',
    description: 'Multi-step code quality verification workflow',
    tasks: [
      {
        id: 'lint-code',
        name: 'Lint Code',
        description: 'Run linting checks',
        execute: async () => {
          context?.logger.info('[Code Quality] Running linter...');
          await new Promise(resolve => setTimeout(resolve, 200));
          context?.logger.info('[Code Quality] Linting complete ✓');
        }
      },
      {
        id: 'run-tests',
        name: 'Run Tests',
        description: 'Execute test suite',
        execute: async () => {
          context?.logger.info('[Code Quality] Running tests...');
          await new Promise(resolve => setTimeout(resolve, 300));
          context?.logger.info('[Code Quality] Tests passed ✓');
        }
      },
      {
        id: 'check-coverage',
        name: 'Check Coverage',
        description: 'Verify code coverage threshold',
        execute: async () => {
          context?.logger.info('[Code Quality] Checking coverage...');
          await new Promise(resolve => setTimeout(resolve, 150));
          context?.logger.info('[Code Quality] Coverage: 85% ✓');
        }
      }
    ],
    triggers: [
      { type: 'manual', config: {} },
      { type: 'event', config: { event: 'pre-commit' } }
    ]
  };

  // Example 3: Backup workflow
  const backupWorkflow: WorkflowDefinition = {
    id: 'auto-backup',
    name: 'Auto Backup',
    description: 'Automated backup of important project files',
    tasks: [
      {
        id: 'collect-files',
        name: 'Collect Files',
        description: 'Gather files to backup',
        execute: async () => {
          context?.logger.info('[Backup] Collecting files...');
          await new Promise(resolve => setTimeout(resolve, 100));
          context?.logger.info('[Backup] Found 42 files to backup');
        }
      },
      {
        id: 'create-archive',
        name: 'Create Archive',
        description: 'Create compressed backup archive',
        execute: async () => {
          context?.logger.info('[Backup] Creating archive...');
          await new Promise(resolve => setTimeout(resolve, 250));
          context?.logger.info('[Backup] Archive created: backup-2026-02-14.tar.gz');
        }
      },
      {
        id: 'verify-backup',
        name: 'Verify Backup',
        description: 'Verify backup integrity',
        execute: async () => {
          context?.logger.info('[Backup] Verifying backup integrity...');
          await new Promise(resolve => setTimeout(resolve, 100));
          context?.logger.info('[Backup] Backup verified ✓');
        }
      }
    ],
    triggers: [
      { type: 'schedule', config: { cron: '0 */6 * * *' } }, // Every 6 hours
      { type: 'manual', config: {} }
    ]
  };

  // Register all workflows
  activeWorkflows.set(dailyCleanup.id, dailyCleanup);
  activeWorkflows.set(codeQualityCheck.id, codeQualityCheck);
  activeWorkflows.set(backupWorkflow.id, backupWorkflow);

  context.logger.debug(`Registered ${activeWorkflows.size} workflows`);
}

/**
 * Register workflow commands
 */
function registerWorkflowCommands(ctx: PluginContext): void {
  ctx.logger.debug('Registering workflow commands');

  // Commands that would be available:
  // - vibecode workflow list
  // - vibecode workflow run <workflow-id>
  // - vibecode workflow status <workflow-id>
  // - vibecode workflow schedule <workflow-id> <cron>
}

/**
 * Execute a workflow
 */
export async function executeWorkflow(workflowId: string): Promise<{
  success: boolean;
  workflowId: string;
  tasksExecuted: number;
  duration: number;
  errors?: string[];
}> {
  const startTime = Date.now();

  if (!context) {
    throw new Error('Plugin not initialized');
  }

  const workflow = activeWorkflows.get(workflowId);
  if (!workflow) {
    throw new Error(`Workflow not found: ${workflowId}`);
  }

  context.logger.info(`Executing workflow: ${workflow.name}`);

  const errors: string[] = [];
  let tasksExecuted = 0;

  // Execute each task in sequence
  for (const task of workflow.tasks) {
    try {
      context.logger.info(`  → Executing task: ${task.name}`);
      await task.execute();
      tasksExecuted++;
    } catch (error) {
      const errorMsg = `Task "${task.name}" failed: ${error instanceof Error ? error.message : String(error)}`;
      context.logger.error(errorMsg);
      errors.push(errorMsg);
    }
  }

  const duration = Date.now() - startTime;
  const success = errors.length === 0;

  context.logger.info(
    `Workflow "${workflow.name}" ${success ? 'completed' : 'completed with errors'} ` +
    `(${tasksExecuted}/${workflow.tasks.length} tasks, ${duration}ms)`
  );

  return {
    success,
    workflowId,
    tasksExecuted,
    duration,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * List all available workflows
 */
export function listWorkflows(): Array<{
  id: string;
  name: string;
  description: string;
  taskCount: number;
  triggers: string[];
}> {
  const workflows: Array<{
    id: string;
    name: string;
    description: string;
    taskCount: number;
    triggers: string[];
  }> = [];

  for (const workflow of activeWorkflows.values()) {
    workflows.push({
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      taskCount: workflow.tasks.length,
      triggers: workflow.triggers.map(t => t.type)
    });
  }

  return workflows;
}

/**
 * Get workflow details
 */
export function getWorkflowDetails(workflowId: string): WorkflowDefinition | null {
  return activeWorkflows.get(workflowId) || null;
}

/**
 * Schedule a workflow for automatic execution
 */
export function scheduleWorkflow(
  workflowId: string,
  intervalMs: number
): boolean {
  if (!context) {
    return false;
  }

  const workflow = activeWorkflows.get(workflowId);
  if (!workflow) {
    context.logger.error(`Cannot schedule unknown workflow: ${workflowId}`);
    return false;
  }

  // Clear existing schedule if any
  const existingJob = scheduledJobs.get(workflowId);
  if (existingJob) {
    clearInterval(existingJob);
  }

  // Schedule the workflow
  const timer = setInterval(() => {
    executeWorkflow(workflowId).catch(error => {
      context?.logger.error(`Scheduled workflow ${workflowId} failed: ${error}`);
    });
  }, intervalMs);

  scheduledJobs.set(workflowId, timer);

  context.logger.info(`Scheduled workflow "${workflow.name}" to run every ${intervalMs}ms`);
  return true;
}

/**
 * Unschedule a workflow
 */
export function unscheduleWorkflow(workflowId: string): boolean {
  const timer = scheduledJobs.get(workflowId);
  if (!timer) {
    return false;
  }

  clearInterval(timer);
  scheduledJobs.delete(workflowId);

  if (context) {
    context.logger.info(`Unscheduled workflow: ${workflowId}`);
  }

  return true;
}

/**
 * Get plugin information
 */
export function getPluginInfo(): Record<string, unknown> {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    author: manifest.author,
    capabilities,
    status: context ? 'initialized' : 'not-initialized',
    workflowsRegistered: activeWorkflows.size,
    scheduledJobs: scheduledJobs.size
  };
}

/**
 * Plugin API export
 *
 * This is the main interface that VibeCode uses to interact with the plugin
 */
const plugin: PluginAPI = {
  manifest: manifest as PluginManifest,
  capabilities,
  initialize,
  destroy,
  onInstall,
  onUninstall,
  onEnable,
  onDisable,
  onUpdate
};

export default plugin;
