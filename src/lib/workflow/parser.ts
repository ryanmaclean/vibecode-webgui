/**
 * Workflow YAML Parser
 * Parse and validate YAML workflow definitions
 */

import type { WorkflowDefinition, WorkflowNode, WorkflowEdge, NodeConfig } from './types';

/**
 * Parse YAML workflow definition
 */
export async function parseWorkflowYAML(yamlContent: string): Promise<WorkflowDefinition> {
  let parsed: any;

  try {
    // Dynamic import for YAML parsing (Next.js compatible)
    const yaml = await import('js-yaml');
    parsed = yaml.load(yamlContent);
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
  const nodes: WorkflowNode[] = parsed.nodes.map((node: any, index: number) => {
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
    };
  });

  // Parse edges
  const edges: WorkflowEdge[] = (parsed.edges || []).map((edge: any, index: number) => {
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
        if (!(node.config as any).agentType) {
          errors.push(`Node ${node.id}: agent-task requires agentType`);
        }
        if (!(node.config as any).task) {
          errors.push(`Node ${node.id}: agent-task requires task`);
        }
        if (!(node.config as any).model) {
          errors.push(`Node ${node.id}: agent-task requires model`);
        }
        break;

      case 'condition':
        if (!(node.config as any).expression) {
          errors.push(`Node ${node.id}: condition requires expression`);
        }
        break;

      case 'loop':
        if (!(node.config as any).items) {
          errors.push(`Node ${node.id}: loop requires items`);
        }
        break;

      case 'transform':
        if (!(node.config as any).transform) {
          errors.push(`Node ${node.id}: transform requires transform function`);
        }
        break;

      case 'delay':
        if (!(node.config as any).duration && !(node.config as any).durationExpression) {
          errors.push(`Node ${node.id}: delay requires duration or durationExpression`);
        }
        break;

      case 'webhook':
        if (!(node.config as any).url) {
          errors.push(`Node ${node.id}: webhook requires url`);
        }
        if (!(node.config as any).method) {
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
