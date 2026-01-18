/**
 * Visual Workflow Editor
 * React Flow-based drag-and-drop workflow builder
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import type {
  WorkflowDefinition,
  WorkflowNode as WFNode,
  WorkflowEdge as WFEdge,
  NodeType,
} from '@/lib/workflow/types';

// Node palette for drag-and-drop
const NODE_PALETTE: Array<{ type: NodeType; label: string; icon: string; description: string }> = [
  {
    type: 'agent-task',
    label: 'Agent Task',
    icon: '🤖',
    description: 'Execute AI agent task',
  },
  {
    type: 'condition',
    label: 'Condition',
    icon: '❓',
    description: 'Conditional branching',
  },
  {
    type: 'parallel',
    label: 'Parallel',
    icon: '⚡',
    description: 'Parallel execution',
  },
  {
    type: 'merge',
    label: 'Merge',
    icon: '🔀',
    description: 'Merge parallel branches',
  },
  {
    type: 'loop',
    label: 'Loop',
    icon: '🔁',
    description: 'Iterate over items',
  },
  {
    type: 'transform',
    label: 'Transform',
    icon: '⚙️',
    description: 'Transform data',
  },
  {
    type: 'delay',
    label: 'Delay',
    icon: '⏱️',
    description: 'Time delay',
  },
  {
    type: 'webhook',
    label: 'Webhook',
    icon: '🌐',
    description: 'HTTP webhook call',
  },
];

interface WorkflowEditorProps {
  /** Initial workflow definition */
  workflow?: WorkflowDefinition;

  /** Callback when workflow changes */
  onChange?: (workflow: WorkflowDefinition) => void;

  /** Callback when workflow is saved */
  onSave?: (workflow: WorkflowDefinition) => void;

  /** Callback when workflow is executed */
  onExecute?: (workflow: WorkflowDefinition, inputs: Record<string, unknown>) => void;

  /** Read-only mode */
  readOnly?: boolean;
}

export function WorkflowEditor({
  workflow: initialWorkflow,
  onChange,
  onSave,
  onExecute,
  readOnly = false,
}: WorkflowEditorProps) {
  const [workflow, setWorkflow] = useState<WorkflowDefinition>(
    initialWorkflow || {
      name: 'new-workflow',
      version: '1.0.0',
      description: '',
      nodes: [],
      edges: [],
      tags: [],
    }
  );

  const [selectedNode, setSelectedNode] = useState<WFNode | null>(null);
  const [showInputDialog, setShowInputDialog] = useState(false);
  const [executionInputs, setExecutionInputs] = useState<Record<string, unknown>>({});

  // Update workflow and notify parent
  const updateWorkflow = useCallback(
    (updates: Partial<WorkflowDefinition>) => {
      const updated = { ...workflow, ...updates };
      setWorkflow(updated);
      onChange?.(updated);
    },
    [workflow, onChange]
  );

  // Add node to workflow
  const addNode = useCallback(
    (type: NodeType, position: { x: number; y: number }) => {
      const nodeId = `node-${Date.now()}`;
      const newNode: WFNode = {
        id: nodeId,
        type,
        name: `${type}-${nodeId}`,
        config: getDefaultNodeConfig(type),
        position,
      };

      updateWorkflow({
        nodes: [...workflow.nodes, newNode],
      });
    },
    [workflow, updateWorkflow]
  );

  // Update node
  const updateNode = useCallback(
    (nodeId: string, updates: Partial<WFNode>) => {
      const nodes = workflow.nodes.map(node =>
        node.id === nodeId ? { ...node, ...updates } : node
      );
      updateWorkflow({ nodes });
    },
    [workflow, updateWorkflow]
  );

  // Delete node
  const deleteNode = useCallback(
    (nodeId: string) => {
      const nodes = workflow.nodes.filter(node => node.id !== nodeId);
      const edges = workflow.edges.filter(
        edge => edge.source !== nodeId && edge.target !== nodeId
      );
      updateWorkflow({ nodes, edges });
    },
    [workflow, updateWorkflow]
  );

  // Add edge
  const addEdge = useCallback(
    (source: string, target: string) => {
      const edgeId = `edge-${source}-${target}`;
      const newEdge: WFEdge = {
        id: edgeId,
        source,
        target,
      };

      updateWorkflow({
        edges: [...workflow.edges, newEdge],
      });
    },
    [workflow, updateWorkflow]
  );

  // Delete edge
  const deleteEdge = useCallback(
    (edgeId: string) => {
      const edges = workflow.edges.filter(edge => edge.id !== edgeId);
      updateWorkflow({ edges });
    },
    [workflow, updateWorkflow]
  );

  // Handle execute workflow
  const handleExecute = useCallback(() => {
    if (workflow.inputs && Object.keys(workflow.inputs).length > 0) {
      setShowInputDialog(true);
    } else {
      onExecute?.(workflow, {});
    }
  }, [workflow, onExecute]);

  // Handle execute with inputs
  const handleExecuteWithInputs = useCallback(() => {
    onExecute?.(workflow, executionInputs);
    setShowInputDialog(false);
    setExecutionInputs({});
  }, [workflow, executionInputs, onExecute]);

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b bg-white px-4 py-3">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold">{workflow.name}</h2>
          <span className="text-sm text-gray-500">v{workflow.version}</span>
        </div>

        <div className="flex items-center space-x-2">
          {!readOnly && (
            <>
              <button
                onClick={() => onSave?.(workflow)}
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={handleExecute}
                className="rounded bg-green-700 px-4 py-2 text-white hover:bg-green-800"
              >
                Execute
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Node Palette */}
        {!readOnly && (
          <div className="w-64 overflow-y-auto border-r bg-white p-4">
            <h3 className="mb-4 font-semibold">Node Palette</h3>

            <div className="space-y-2">
              {NODE_PALETTE.map(item => (
                <button
                  key={item.type}
                  onClick={() => addNode(item.type, { x: 100, y: 100 })}
                  className="flex w-full items-start rounded border p-3 text-left hover:bg-gray-50"
                >
                  <span className="mr-3 text-2xl">{item.icon}</span>
                  <div>
                    <div className="font-medium">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <WorkflowCanvas
            workflow={workflow}
            selectedNode={selectedNode}
            onNodeSelect={setSelectedNode}
            onNodeUpdate={updateNode}
            onNodeDelete={deleteNode}
            onEdgeAdd={addEdge}
            onEdgeDelete={deleteEdge}
            readOnly={readOnly}
          />
        </div>

        {/* Properties Panel */}
        {selectedNode && (
          <div className="w-80 overflow-y-auto border-l bg-white p-4">
            <h3 className="mb-4 font-semibold">Node Properties</h3>

            <NodePropertiesPanel
              node={selectedNode}
              onChange={updates => {
                updateNode(selectedNode.id, updates);
                setSelectedNode({ ...selectedNode, ...updates });
              }}
              readOnly={readOnly}
            />
          </div>
        )}
      </div>

      {/* Execution Input Dialog */}
      {showInputDialog && (
        <ExecutionInputDialog
          inputs={workflow.inputs || {}}
          values={executionInputs}
          onChange={setExecutionInputs}
          onExecute={handleExecuteWithInputs}
          onCancel={() => setShowInputDialog(false)}
        />
      )}
    </div>
  );
}

// Simplified workflow canvas (placeholder for React Flow integration)
function WorkflowCanvas({
  workflow,
  selectedNode,
  onNodeSelect,
  onNodeUpdate,
  onNodeDelete,
  onEdgeAdd,
  onEdgeDelete,
  readOnly,
}: {
  workflow: WorkflowDefinition;
  selectedNode: WFNode | null;
  onNodeSelect: (node: WFNode | null) => void;
  onNodeUpdate: (nodeId: string, updates: Partial<WFNode>) => void;
  onNodeDelete: (nodeId: string) => void;
  onEdgeAdd: (source: string, target: string) => void;
  onEdgeDelete: (edgeId: string) => void;
  readOnly: boolean;
}) {
  return (
    <div className="h-full w-full rounded bg-white p-8">
      <div className="grid gap-4">
        {workflow.nodes.map(node => (
          <div
            key={node.id}
            onClick={() => onNodeSelect(node)}
            className={`cursor-pointer rounded border-2 p-4 ${
              selectedNode?.id === node.id ? 'border-blue-500' : 'border-gray-300'
            } hover:border-blue-400`}
            style={{
              position: 'relative',
              left: node.position?.x || 0,
              top: node.position?.y || 0,
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{node.name}</div>
                <div className="text-xs text-gray-500">{node.type}</div>
              </div>

              {!readOnly && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onNodeDelete(node.id);
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 text-center text-sm text-gray-500">
        {workflow.nodes.length} nodes, {workflow.edges.length} edges
      </div>
    </div>
  );
}

// Node properties panel
function NodePropertiesPanel({
  node,
  onChange,
  readOnly,
}: {
  node: WFNode;
  onChange: (updates: Partial<WFNode>) => void;
  readOnly: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Name</label>
        <input
          type="text"
          value={node.name}
          onChange={e => onChange({ name: e.target.value })}
          disabled={readOnly}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Description</label>
        <textarea
          value={node.description || ''}
          onChange={e => onChange({ description: e.target.value })}
          disabled={readOnly}
          className="mt-1 w-full rounded border px-3 py-2"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-sm font-medium">Configuration</label>
        <pre className="mt-1 overflow-auto rounded bg-gray-100 p-3 text-xs">
          {JSON.stringify(node.config, null, 2)}
        </pre>
      </div>
    </div>
  );
}

// Execution input dialog
function ExecutionInputDialog({
  inputs,
  values,
  onChange,
  onExecute,
  onCancel,
}: {
  inputs: Record<string, any>;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  onExecute: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-lg rounded bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold">Workflow Inputs</h3>

        <div className="space-y-4">
          {Object.entries(inputs).map(([key, schema]) => (
            <div key={key}>
              <label className="block text-sm font-medium">{key}</label>
              <input
                type="text"
                value={String(values[key] || '')}
                onChange={e => onChange({ ...values, [key]: e.target.value })}
                className="mt-1 w-full rounded border px-3 py-2"
                placeholder={schema.description || ''}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end space-x-2">
          <button
            onClick={onCancel}
            className="rounded border px-4 py-2 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onExecute}
            className="rounded bg-green-700 px-4 py-2 text-white hover:bg-green-800"
          >
            Execute
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper: Get default config for node type
function getDefaultNodeConfig(type: NodeType): any {
  switch (type) {
    case 'agent-task':
      return {
        agentType: 'cline',
        model: 'claude-3-5-sonnet-20241022',
        task: '',
      };
    case 'condition':
      return {
        expression: '',
        branches: [],
      };
    case 'parallel':
      return {
        maxConcurrency: 5,
        waitForAll: true,
      };
    case 'merge':
      return {
        strategy: 'all',
      };
    case 'loop':
      return {
        items: '',
      };
    case 'transform':
      return {
        transform: '',
      };
    case 'delay':
      return {
        duration: 1000,
      };
    case 'webhook':
      return {
        url: '',
        method: 'POST',
      };
    default:
      return {};
  }
}
