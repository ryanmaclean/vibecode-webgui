/**
 * Workflow Execution Viewer
 * Real-time visualization of workflow execution state
 */

'use client';

import React, { useState, useEffect } from 'react';
import type {
  WorkflowExecution,
  NodeExecution,
  NodeStatus,
  WorkflowStatus,
  ExecutionLog,
} from '@/lib/workflow/types';

interface WorkflowExecutionViewerProps {
  /** Execution to display */
  execution: WorkflowExecution;

  /** Callback for execution updates */
  onUpdate?: (execution: WorkflowExecution) => void;

  /** Show detailed logs */
  showLogs?: boolean;
}

export function WorkflowExecutionViewer({
  execution,
  onUpdate,
  showLogs = true,
}: WorkflowExecutionViewerProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const selectedNode = selectedNodeId
    ? execution.nodes.get(selectedNodeId)
    : null;

  // Calculate execution statistics
  const stats = React.useMemo(() => {
    const nodes = Array.from(execution.nodes.values());
    return {
      total: nodes.length,
      pending: nodes.filter(n => n.status === 'pending').length,
      running: nodes.filter(n => n.status === 'running').length,
      completed: nodes.filter(n => n.status === 'completed').length,
      failed: nodes.filter(n => n.status === 'failed').length,
      skipped: nodes.filter(n => n.status === 'skipped').length,
    };
  }, [execution]);

  const toggleNodeExpansion = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Workflow Execution</h2>
            <div className="mt-1 flex items-center space-x-4 text-sm text-gray-600">
              <span>ID: {execution.id}</span>
              <span>•</span>
              <span>{execution.workflowId} v{execution.workflowVersion}</span>
              <span>•</span>
              <StatusBadge status={execution.status} />
            </div>
          </div>

          <div className="text-right">
            {execution.metadata.startedAt && (
              <div className="text-sm text-gray-600">
                Started: {new Date(execution.metadata.startedAt).toLocaleString()}
              </div>
            )}
            {execution.metadata.duration && (
              <div className="text-sm text-gray-600">
                Duration: {formatDuration(execution.metadata.duration)}
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex h-2 overflow-hidden rounded-full bg-gray-200">
            {stats.completed > 0 && (
              <div
                className="bg-green-500"
                style={{ width: `${(stats.completed / stats.total) * 100}%` }}
              />
            )}
            {stats.running > 0 && (
              <div
                className="bg-blue-500"
                style={{ width: `${(stats.running / stats.total) * 100}%` }}
              />
            )}
            {stats.failed > 0 && (
              <div
                className="bg-red-500"
                style={{ width: `${(stats.failed / stats.total) * 100}%` }}
              />
            )}
          </div>

          <div className="mt-2 flex justify-between text-xs text-gray-600">
            <span>{stats.completed} completed</span>
            <span>{stats.running} running</span>
            <span>{stats.failed} failed</span>
            <span>{stats.total} total</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Node List */}
        <div className="w-96 overflow-y-auto border-r bg-white">
          <div className="divide-y">
            {Array.from(execution.nodes.entries()).map(([nodeId, nodeExec]) => (
              <NodeExecutionItem
                key={nodeId}
                nodeId={nodeId}
                nodeExec={nodeExec}
                isSelected={selectedNodeId === nodeId}
                isExpanded={expandedNodes.has(nodeId)}
                onClick={() => setSelectedNodeId(nodeId)}
                onToggleExpand={() => toggleNodeExpansion(nodeId)}
              />
            ))}
          </div>
        </div>

        {/* Details Panel */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {selectedNode ? (
            <NodeExecutionDetails
              nodeExec={selectedNode}
              showLogs={showLogs}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-500">
              Select a node to view details
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {execution.error && (
        <div className="border-t bg-red-50 p-4">
          <div className="flex items-start">
            <span className="mr-2 text-red-600">⚠️</span>
            <div>
              <div className="font-medium text-red-900">Workflow Failed</div>
              <div className="mt-1 text-sm text-red-700">
                {execution.error.message}
              </div>
              {execution.error.nodeId && (
                <div className="mt-1 text-xs text-red-600">
                  Failed at node: {execution.error.nodeId}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Node execution item in list
function NodeExecutionItem({
  nodeId,
  nodeExec,
  isSelected,
  isExpanded,
  onClick,
  onToggleExpand,
}: {
  nodeId: string;
  nodeExec: NodeExecution;
  isSelected: boolean;
  isExpanded: boolean;
  onClick: () => void;
  onToggleExpand: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`cursor-pointer p-4 hover:bg-gray-50 ${
        isSelected ? 'bg-blue-50' : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center">
            <NodeStatusIcon status={nodeExec.status} />
            <span className="ml-2 font-medium">{nodeId}</span>
          </div>

          {nodeExec.duration !== undefined && (
            <div className="mt-1 text-xs text-gray-500">
              Duration: {formatDuration(nodeExec.duration)}
            </div>
          )}

          {nodeExec.error && (
            <div className="mt-1 text-xs text-red-600">
              Error: {nodeExec.error.message}
            </div>
          )}
        </div>

        {nodeExec.logs.length > 0 && (
          <button
            onClick={e => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="ml-2 text-gray-400 hover:text-gray-600"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}
      </div>

      {/* Expanded logs preview */}
      {isExpanded && nodeExec.logs.length > 0 && (
        <div className="mt-2 space-y-1 border-t pt-2">
          {nodeExec.logs.slice(-3).map((log, idx) => (
            <div key={idx} className="text-xs">
              <span className="text-gray-500">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span className="ml-2">{log.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Node execution details panel
function NodeExecutionDetails({
  nodeExec,
  showLogs,
}: {
  nodeExec: NodeExecution;
  showLogs: boolean;
}) {
  return (
    <div className="space-y-6">
      {/* Status */}
      <div>
        <h3 className="text-lg font-semibold">Status</h3>
        <div className="mt-2">
          <StatusBadge status={nodeExec.status} size="large" />
        </div>
      </div>

      {/* Timing */}
      <div>
        <h3 className="text-lg font-semibold">Timing</h3>
        <div className="mt-2 space-y-2 text-sm">
          {nodeExec.startedAt && (
            <div>
              <span className="text-gray-600">Started:</span>{' '}
              {new Date(nodeExec.startedAt).toLocaleString()}
            </div>
          )}
          {nodeExec.completedAt && (
            <div>
              <span className="text-gray-600">Completed:</span>{' '}
              {new Date(nodeExec.completedAt).toLocaleString()}
            </div>
          )}
          {nodeExec.duration !== undefined && (
            <div>
              <span className="text-gray-600">Duration:</span>{' '}
              {formatDuration(nodeExec.duration)}
            </div>
          )}
        </div>
      </div>

      {/* Input/Output */}
      {nodeExec.input !== undefined && (
        <div>
          <h3 className="text-lg font-semibold">Input</h3>
          <pre className="mt-2 overflow-auto rounded bg-gray-100 p-4 text-xs">
            {JSON.stringify(nodeExec.input, null, 2)}
          </pre>
        </div>
      )}

      {nodeExec.output !== undefined && (
        <div>
          <h3 className="text-lg font-semibold">Output</h3>
          <pre className="mt-2 overflow-auto rounded bg-gray-100 p-4 text-xs">
            {JSON.stringify(nodeExec.output, null, 2)}
          </pre>
        </div>
      )}

      {/* Error */}
      {nodeExec.error && (
        <div>
          <h3 className="text-lg font-semibold text-red-600">Error</h3>
          <div className="mt-2 rounded bg-red-50 p-4">
            <div className="font-medium text-red-900">
              {nodeExec.error.message}
            </div>
            {nodeExec.error.stack && (
              <pre className="mt-2 overflow-auto text-xs text-red-700">
                {nodeExec.error.stack}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* Logs */}
      {showLogs && nodeExec.logs.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold">Logs</h3>
          <div className="mt-2 space-y-1 rounded border bg-white p-4">
            {nodeExec.logs.map((log, idx) => (
              <LogEntry key={idx} log={log} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Log entry component
function LogEntry({ log }: { log: ExecutionLog }) {
  const levelColors = {
    debug: 'text-gray-600',
    info: 'text-blue-600',
    warn: 'text-yellow-600',
    error: 'text-red-600',
  };

  return (
    <div className="flex text-sm">
      <span className="w-24 text-gray-500">
        {new Date(log.timestamp).toLocaleTimeString()}
      </span>
      <span className={`w-16 ${levelColors[log.level]}`}>
        {log.level.toUpperCase()}
      </span>
      <span className="flex-1">{log.message}</span>
    </div>
  );
}

// Status badge component
function StatusBadge({
  status,
  size = 'normal',
}: {
  status: NodeStatus | WorkflowStatus;
  size?: 'normal' | 'large';
}) {
  const statusConfig = {
    pending: { label: 'Pending', color: 'bg-gray-200 text-gray-700' },
    running: { label: 'Running', color: 'bg-blue-500 text-white' },
    completed: { label: 'Completed', color: 'bg-green-500 text-white' },
    failed: { label: 'Failed', color: 'bg-red-500 text-white' },
    skipped: { label: 'Skipped', color: 'bg-gray-400 text-white' },
    cancelled: { label: 'Cancelled', color: 'bg-orange-500 text-white' },
    idle: { label: 'Idle', color: 'bg-gray-300 text-gray-700' },
    paused: { label: 'Paused', color: 'bg-yellow-500 text-white' },
  };

  const config = statusConfig[status as keyof typeof statusConfig];
  const sizeClass = size === 'large' ? 'px-4 py-2 text-base' : 'px-2 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.color} ${sizeClass}`}
    >
      {config.label}
    </span>
  );
}

// Node status icon
function NodeStatusIcon({ status }: { status: NodeStatus }) {
  const icons = {
    pending: '⏳',
    running: '▶️',
    completed: '✅',
    failed: '❌',
    skipped: '⏭️',
    cancelled: '🚫',
  };

  return <span className="text-lg">{icons[status]}</span>;
}

// Format duration in ms to human-readable string
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else if (ms < 3600000) {
    return `${(ms / 60000).toFixed(1)}m`;
  } else {
    return `${(ms / 3600000).toFixed(1)}h`;
  }
}
