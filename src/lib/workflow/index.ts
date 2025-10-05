/**
 * Workflow Orchestration Engine
 * Main entry point for workflow execution and management
 */

export * from './types';
export * from './engine';
export * from './parser';
export * from './templates';

import { WorkflowEngine, createWorkflowEngine } from './engine';
import type { WorkflowDefinition, AgentTaskConfig, WorkflowContext } from './types';
import { parseWorkflowYAML, serializeWorkflowYAML } from './parser';
import { workflowTemplates, getWorkflowTemplate, listWorkflowTemplates } from './templates';

/**
 * Default workflow engine instance
 */
let defaultEngine: WorkflowEngine | null = null;

/**
 * Get or create default workflow engine
 */
export function getWorkflowEngine(): WorkflowEngine {
  if (!defaultEngine) {
    defaultEngine = createWorkflowEngine();
  }
  return defaultEngine;
}

/**
 * Execute workflow from YAML definition
 */
export async function executeWorkflowFromYAML(
  yamlContent: string,
  inputs: Record<string, unknown> = {}
): Promise<any> {
  const definition = await parseWorkflowYAML(yamlContent);
  const engine = getWorkflowEngine();
  return await engine.executeWorkflow(definition, inputs);
}

/**
 * Execute workflow from template
 */
export async function executeWorkflowTemplate(
  templateName: string,
  inputs: Record<string, unknown> = {}
): Promise<any> {
  const template = getWorkflowTemplate(templateName);
  if (!template) {
    throw new Error(`Workflow template not found: ${templateName}`);
  }

  const engine = getWorkflowEngine();
  return await engine.executeWorkflow(template, inputs);
}

/**
 * Register agent executor with default engine
 */
export function registerAgentExecutor(
  executor: (config: AgentTaskConfig, context: WorkflowContext) => Promise<unknown>
): void {
  const engine = getWorkflowEngine();
  engine.registerAgentExecutor(executor);
}

// Export templates for easy access
export { workflowTemplates, getWorkflowTemplate, listWorkflowTemplates };
