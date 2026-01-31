/**
 * Workflow YAML Parser
 * Parse and validate YAML workflow definitions
 */

import type {
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
  NodeConfig,
  AgentTaskConfig,
  ConditionConfig,
  LoopConfig,
  TransformConfig,
  DelayConfig,
  WebhookConfig
} from './types';

/**
 * Raw parsed node from YAML (before validation)
 */
interface RawYAMLNode {
  id?: string;
  type?: string;
  name?: string;
  description?: string;
  config?: NodeConfig;
  retry?: WorkflowNode['retry'];
  timeout?: number;
  continueOnError?: boolean;
  position?: { x: number; y: number };
}

/**
 * Raw parsed edge from YAML (before validation)
 */
interface RawYAMLEdge {
  id?: string;
  source?: string;
  target?: string;
  condition?: string;
  label?: string;
}

/**
 * Raw parsed YAML workflow structure (before validation)
 */
interface RawYAMLWorkflow {
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  tags?: string[];
  nodes?: RawYAMLNode[];
  edges?: RawYAMLEdge[];
  config?: WorkflowDefinition['config'];
  inputs?: WorkflowDefinition['inputs'];
  outputs?: WorkflowDefinition['outputs'];
}

/**
 * Parse YAML workflow definition
 */
export async function parseWorkflowYAML(yamlContent: string): Promise<WorkflowDefinition> {
  let parsed: RawYAMLWorkflow;

  try {
    // Dynamic import for YAML parsing (Next.js compatible)
    const yaml = await import('js-yaml');
    parsed = yaml.load(yamlContent) as RawYAMLWorkflow;
  } catch (error) {
    throw new Error(`Failed to parse YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Validate required fields
  if (!parsed.name) {
    throw new Error('Workflow must have a name');
  }

  if (!parsed.version) {
    throw new Error('Workflow must have a version');
  }

  if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
    throw new Error('Workflow must have nodes array');
  }

  // Parse nodes
  const nodes: WorkflowNode[] = parsed.nodes.map((node: RawYAMLNode, index: number) => {
    if (!node.id) {
      throw new Error(`Node at index ${index} missing id`);
    }

    if (!node.type) {
      throw new Error(`Node ${node.id} missing type`);
    }

    if (!node.config) {
      throw new Error(`Node ${node.id} missing config`);
    }

    return {
      id: node.id,
      type: node.type,
      name: node.name || node.id,
      description: node.description,
      config: node.config,
      retry: node.retry,
      timeout: node.timeout,
      continueOnError: node.continueOnError || false,
      position: node.position,
    } as WorkflowNode;
  });

  // Parse edges
  const edges: WorkflowEdge[] = (parsed.edges || []).map((edge: RawYAMLEdge, index: number) => {
    if (!edge.source) {
      throw new Error(`Edge at index ${index} missing source`);
    }

    if (!edge.target) {
      throw new Error(`Edge at index ${index} missing target`);
    }

    return {
      id: edge.id || `edge-${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      condition: edge.condition,
      label: edge.label,
    };
  });

  return {
    name: parsed.name,
    version: parsed.version,
    description: parsed.description,
    author: parsed.author,
    tags: parsed.tags || [],
    nodes,
    edges,
    config: parsed.config,
    inputs: parsed.inputs,
    outputs: parsed.outputs,
  };
}

/**
 * Serialize workflow definition to YAML
 */
export async function serializeWorkflowYAML(definition: WorkflowDefinition): Promise<string> {
  try {
    const yaml = await import('js-yaml');
    return yaml.dump(definition, {
      indent: 2,
      lineWidth: 100,
      noRefs: true,
    });
  } catch (error) {
    throw new Error(`Failed to serialize YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Type guard to check if config is an AgentTaskConfig
 */
function isAgentTaskConfig(config: NodeConfig): config is AgentTaskConfig {
  return 'agentType' in config || 'task' in config || 'model' in config;
}

/**
 * Type guard to check if config is a ConditionConfig
 */
function isConditionConfig(config: NodeConfig): config is ConditionConfig {
  return 'expression' in config || 'branches' in config;
}

/**
 * Type guard to check if config is a LoopConfig
 */
function isLoopConfig(config: NodeConfig): config is LoopConfig {
  return 'items' in config;
}

/**
 * Type guard to check if config is a TransformConfig
 */
function isTransformConfig(config: NodeConfig): config is TransformConfig {
  return 'transform' in config;
}

/**
 * Type guard to check if config is a DelayConfig
 */
function isDelayConfig(config: NodeConfig): config is DelayConfig {
  return 'duration' in config || 'durationExpression' in config;
}

/**
 * Type guard to check if config is a WebhookConfig
 */
function isWebhookConfig(config: NodeConfig): config is WebhookConfig {
  return 'url' in config || 'method' in config;
}

/**
 * Validate workflow definition structure
 */
export function validateWorkflowDefinition(definition: WorkflowDefinition): string[] {
  const errors: string[] = [];

  // Validate nodes
  const nodeIds = new Set<string>();
  for (const node of definition.nodes) {
    if (nodeIds.has(node.id)) {
      errors.push(`Duplicate node ID: ${node.id}`);
    }
    nodeIds.add(node.id);

    // Validate node config based on type
    switch (node.type) {
      case 'agent-task': {
        const config = node.config;
        if (!isAgentTaskConfig(config) || !config.agentType) {
          errors.push(`Node ${node.id}: agent-task requires agentType`);
        }
        if (!isAgentTaskConfig(config) || !config.task) {
          errors.push(`Node ${node.id}: agent-task requires task`);
        }
        if (!isAgentTaskConfig(config) || !config.model) {
          errors.push(`Node ${node.id}: agent-task requires model`);
        }
        break;
      }

      case 'condition': {
        const config = node.config;
        if (!isConditionConfig(config) || !config.expression) {
          errors.push(`Node ${node.id}: condition requires expression`);
        }
        break;
      }

      case 'loop': {
        const config = node.config;
        if (!isLoopConfig(config) || !config.items) {
          errors.push(`Node ${node.id}: loop requires items`);
        }
        break;
      }

      case 'transform': {
        const config = node.config;
        if (!isTransformConfig(config) || !config.transform) {
          errors.push(`Node ${node.id}: transform requires transform function`);
        }
        break;
      }

      case 'delay': {
        const config = node.config;
        if (!isDelayConfig(config) || (!config.duration && !config.durationExpression)) {
          errors.push(`Node ${node.id}: delay requires duration or durationExpression`);
        }
        break;
      }

      case 'webhook': {
        const config = node.config;
        if (!isWebhookConfig(config) || !config.url) {
          errors.push(`Node ${node.id}: webhook requires url`);
        }
        if (!isWebhookConfig(config) || !config.method) {
          errors.push(`Node ${node.id}: webhook requires method`);
        }
        break;
      }
    }
  }

  // Validate edges
  for (const edge of definition.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge ${edge.id}: source node not found: ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge ${edge.id}: target node not found: ${edge.target}`);
    }
  }

  return errors;
}
