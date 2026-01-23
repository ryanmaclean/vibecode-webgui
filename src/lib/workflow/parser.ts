/**
 * Workflow YAML Parser
 * Parse and validate YAML workflow definitions
 */

import type { 
  WorkflowDefinition, 
  WorkflowNode, 
  WorkflowEdge, 
  NodeConfig, 
  NodeType,
  SchemaDefinition,
  RetryPolicy
} from './types';

/**
 * Interface for parsed YAML workflow data
 */
interface ParsedWorkflowData {
  name?: string;
  version?: string;
  description?: string;
  author?: string;
  tags?: string[];
  nodes?: ParsedNode[];
  edges?: ParsedEdge[];
  config?: Record<string, unknown>;
  inputs?: Record<string, SchemaDefinition>;
  outputs?: Record<string, SchemaDefinition>;
}

/**
 * Interface for parsed node from YAML
 */
interface ParsedNode {
  id?: string;
  type?: string;
  name?: string;
  description?: string;
  config?: NodeConfig;
  retry?: RetryPolicy;
  timeout?: number;
  continueOnError?: boolean;
  position?: { x: number; y: number };
}

/**
 * Interface for parsed edge from YAML
 */
interface ParsedEdge {
  id?: string;
  source?: string;
  target?: string;
  condition?: string;
  label?: string;
}

/**
 * Valid node types for validation
 */
const VALID_NODE_TYPES: NodeType[] = [
  'agent-task', 'condition', 'parallel', 'merge', 
  'loop', 'transform', 'delay', 'webhook'
];

/**
 * Type guard to check if a string is a valid NodeType
 */
function isValidNodeType(type: string): type is NodeType {
  return VALID_NODE_TYPES.includes(type as NodeType);
}

/**
 * Type guard to check if parsed data is a valid workflow structure
 */
function isValidWorkflowData(data: unknown): data is ParsedWorkflowData {
  return typeof data === 'object' && data !== null;
}

/**
 * Type-safe accessor for node config properties
 */
function getConfigProperty<T>(config: NodeConfig, key: string): T | undefined {
  return (config as Record<string, unknown>)[key] as T | undefined;
}

/**
 * Parse YAML workflow definition
 */
export async function parseWorkflowYAML(yamlContent: string): Promise<WorkflowDefinition> {
  let parsed: unknown;

  try {
    // Dynamic import for YAML parsing (Next.js compatible)
    const yaml = await import('js-yaml');
    parsed = yaml.load(yamlContent);
  } catch (error) {
    throw new Error(`Failed to parse YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Validate that parsed data is an object
  if (!isValidWorkflowData(parsed)) {
    throw new Error('Invalid YAML: expected an object');
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
  const nodes: WorkflowNode[] = parsed.nodes.map((node: ParsedNode, index: number) => {
    if (!node.id) {
      throw new Error(`Node at index ${index} missing id`);
    }

    if (!node.type) {
      throw new Error(`Node ${node.id} missing type`);
    }

    if (!isValidNodeType(node.type)) {
      throw new Error(`Node ${node.id} has invalid type: ${node.type}`);
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
    };
  });

  // Parse edges
  const edges: WorkflowEdge[] = (parsed.edges || []).map((edge: ParsedEdge, index: number) => {
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
      case 'agent-task':
        if (!getConfigProperty<string>(node.config, 'agentType')) {
          errors.push(`Node ${node.id}: agent-task requires agentType`);
        }
        if (!getConfigProperty<string>(node.config, 'task')) {
          errors.push(`Node ${node.id}: agent-task requires task`);
        }
        if (!getConfigProperty<string>(node.config, 'model')) {
          errors.push(`Node ${node.id}: agent-task requires model`);
        }
        break;

      case 'condition':
        if (!getConfigProperty<string>(node.config, 'expression')) {
          errors.push(`Node ${node.id}: condition requires expression`);
        }
        break;

      case 'loop':
        if (!getConfigProperty<unknown>(node.config, 'items')) {
          errors.push(`Node ${node.id}: loop requires items`);
        }
        break;

      case 'transform':
        if (!getConfigProperty<string>(node.config, 'transform')) {
          errors.push(`Node ${node.id}: transform requires transform function`);
        }
        break;

      case 'delay':
        if (!getConfigProperty<number>(node.config, 'duration') && !getConfigProperty<string>(node.config, 'durationExpression')) {
          errors.push(`Node ${node.id}: delay requires duration or durationExpression`);
        }
        break;

      case 'webhook':
        if (!getConfigProperty<string>(node.config, 'url')) {
          errors.push(`Node ${node.id}: webhook requires url`);
        }
        if (!getConfigProperty<string>(node.config, 'method')) {
          errors.push(`Node ${node.id}: webhook requires method`);
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
