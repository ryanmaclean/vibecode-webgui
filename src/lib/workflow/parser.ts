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
} from "./types";

/** Raw parsed YAML node structure */
interface ParsedYAMLNode {
  id?: string;
  type?: string;
  name?: string;
  description?: string;
  config?: Record<string, unknown>;
  retry?: {
    maxRetries?: number;
    backoffMs?: number;
  };
  timeout?: number;
  continueOnError?: boolean;
  position?: { x: number; y: number };
}

/** Raw parsed YAML edge structure */
interface ParsedYAMLEdge {
  id?: string;
  source?: string;
  target?: string;
  condition?: string;
  label?: string;
}

/** Raw parsed YAML workflow structure */
interface ParsedYAMLWorkflow {
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  tags?: string[];
  nodes?: ParsedYAMLNode[];
  edges?: ParsedYAMLEdge[];
  config?: Record<string, unknown>;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
}

/** Type guard for AgentTaskConfig */
function isAgentTaskConfig(config: Record<string, unknown>): config is AgentTaskConfig {
  return typeof config.agentType === "string" && 
         typeof config.task === "string" &&
         typeof config.model === "string";
}

/** Type guard for ConditionConfig */
function isConditionConfig(config: Record<string, unknown>): config is ConditionConfig {
  return typeof config.expression === "string";
}

/** Type guard for LoopConfig */
function isLoopConfig(config: Record<string, unknown>): config is LoopConfig {
  return typeof config.items === "string";
}

/** Type guard for TransformConfig */
function isTransformConfig(config: Record<string, unknown>): config is TransformConfig {
  return typeof config.transform === "string";
}

/** Type guard for DelayConfig */
function isDelayConfig(config: Record<string, unknown>): config is DelayConfig {
  return typeof config.duration === "number" || typeof config.durationExpression === "string";
}

/** Type guard for WebhookConfig */
function isWebhookConfig(config: Record<string, unknown>): config is WebhookConfig {
  return typeof config.url === "string" && typeof config.method === "string";
}

/**
 * Parse YAML workflow definition
 */
export async function parseWorkflowYAML(yamlContent: string): Promise<WorkflowDefinition> {
  let parsed: ParsedYAMLWorkflow;

  try {
    // Dynamic import for YAML parsing (Next.js compatible)
    const yaml = await import("js-yaml");
    parsed = yaml.load(yamlContent) as ParsedYAMLWorkflow;
  } catch (error) {
    throw new Error(`Failed to parse YAML: ${error instanceof Error ? error.message : "Unknown error"}`);
  }

  // Validate required fields
  if (!parsed.name) {
    throw new Error("Workflow must have a name");
  }

  if (!parsed.version) {
    throw new Error("Workflow must have a version");
  }

  if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
    throw new Error("Workflow must have nodes array");
  }

  // Parse nodes
  const nodes: WorkflowNode[] = parsed.nodes.map((node: ParsedYAMLNode, index: number) => {
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
      config: node.config as NodeConfig,
      retry: node.retry,
      timeout: node.timeout,
      continueOnError: node.continueOnError || false,
      position: node.position,
    } as WorkflowNode;
  });

  // Parse edges
  const edges: WorkflowEdge[] = (parsed.edges || []).map((edge: ParsedYAMLEdge, index: number) => {
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
  } as WorkflowDefinition;
}

/**
 * Serialize workflow definition to YAML
 */
export async function serializeWorkflowYAML(definition: WorkflowDefinition): Promise<string> {
  try {
    const yaml = await import("js-yaml");
    return yaml.dump(definition, {
      indent: 2,
      lineWidth: 100,
      noRefs: true,
    });
  } catch (error) {
    throw new Error(`Failed to serialize YAML: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
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
    const config = node.config as Record<string, unknown>;
    
    switch (node.type) {
      case "agent-task":
        if (!isAgentTaskConfig(config)) {
          if (!config.agentType) {
            errors.push(`Node ${node.id}: agent-task requires agentType`);
          }
          if (!config.task) {
            errors.push(`Node ${node.id}: agent-task requires task`);
          }
          if (!config.model) {
            errors.push(`Node ${node.id}: agent-task requires model`);
          }
        }
        break;

      case "condition":
        if (!isConditionConfig(config)) {
          errors.push(`Node ${node.id}: condition requires expression`);
        }
        break;

      case "loop":
        if (!isLoopConfig(config)) {
          errors.push(`Node ${node.id}: loop requires items`);
        }
        break;

      case "transform":
        if (!isTransformConfig(config)) {
          errors.push(`Node ${node.id}: transform requires transform function`);
        }
        break;

      case "delay":
        if (!isDelayConfig(config)) {
          errors.push(`Node ${node.id}: delay requires duration or durationExpression`);
        }
        break;

      case "webhook":
        if (!isWebhookConfig(config)) {
          if (!config.url) {
            errors.push(`Node ${node.id}: webhook requires url`);
          }
          if (!config.method) {
            errors.push(`Node ${node.id}: webhook requires method`);
          }
        }
        break;
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
