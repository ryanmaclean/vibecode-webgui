/**
 * Agent Capability Manifest - Issue #899
 * Schema for declaring agent capabilities and resources
 */

export interface AgentManifest {
  name: string;
  version: string;
  description: string;
  capabilities: Capability[];
  tools: ToolDefinition[];
  resources: ResourceRequirement[];
  dependencies: string[];
}

export interface Capability {
  name: string;
  description: string;
  enabled: boolean;
}

export interface ToolDefinition {
  name: string;
  type: 'read' | 'write' | 'execute' | 'network';
  permissions: string[];
}

export interface ResourceRequirement {
  type: 'memory' | 'cpu' | 'storage' | 'network';
  minimum: number;
  recommended: number;
  unit: string;
}

export function validateManifest(manifest: AgentManifest): boolean {
  return !!(manifest.name && manifest.version && manifest.capabilities?.length >= 0);
}
