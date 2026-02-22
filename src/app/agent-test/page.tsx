/**
 * Agent Action Preview Test Page
 *
 * Test page for demonstrating the ActionPreview and ConfirmationDialog components
 */

'use client';

import React from 'react';
import { ActionPreview } from '@/components/agent/ActionPreview';
import { ConfirmationDialog } from '@/components/agent/ConfirmationDialog';
import { Button } from '@/components/ui/button';
import type { ActionPreview as ActionPreviewType, ConfirmationRequest } from '@/types/agent-confirmation';

// Sample action data for testing
const sampleActions: ActionPreviewType[] = [
  {
    action_id: 'test-action-1',
    action_type: 'file_edit',
    tool_name: 'code_editor',
    file_path: 'src/components/Example.tsx',
    explanation: 'Adding a new prop to the Example component to support dark mode theming. This change enhances the component flexibility and allows it to integrate with the application theme system.',
    diff: {
      old_content: `import React from 'react';

export function Example() {
  return (
    <div className="container">
      <h1>Hello World</h1>
    </div>
  );
}`,
      new_content: `import React from 'react';

interface ExampleProps {
  theme?: 'light' | 'dark';
}

export function Example({ theme = 'light' }: ExampleProps) {
  return (
    <div className={\`container \${theme === 'dark' ? 'dark' : ''}\`}>
      <h1>Hello World</h1>
    </div>
  );
}`,
      language: 'typescript',
      lines_added: 5,
      lines_removed: 1,
    },
    metadata: {
      risk_level: 'low',
      category: 'enhancement',
    },
    created_at: new Date().toISOString(),
  },
  {
    action_id: 'test-action-2',
    action_type: 'file_write',
    tool_name: 'file_system',
    file_path: 'src/lib/utils/helper.ts',
    explanation: 'Creating a new utility function to handle date formatting across the application. This centralizes date formatting logic and ensures consistency.',
    diff: {
      old_content: '',
      new_content: `/**
 * Format date to readable string
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}`,
      language: 'typescript',
      lines_added: 8,
      lines_removed: 0,
    },
    metadata: {
      risk_level: 'low',
    },
    created_at: new Date(Date.now() - 120000).toISOString(),
  },
  {
    action_id: 'test-action-3',
    action_type: 'file_delete',
    tool_name: 'file_system',
    file_path: 'src/legacy/OldComponent.tsx',
    explanation: 'Removing deprecated component that has been replaced by the new modular architecture. This component is no longer used in the codebase.',
    metadata: {
      risk_level: 'high',
      reason: 'Deleting files can cause issues if references still exist',
    },
    created_at: new Date(Date.now() - 300000).toISOString(),
  },
];

export default function AgentTestPage() {
  const [approvedActions, setApprovedActions] = React.useState<Set<string>>(new Set());
  const [rejectedActions, setRejectedActions] = React.useState<Set<string>>(new Set());
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [bulkApprovalEnabled, setBulkApprovalEnabled] = React.useState(true);

  // Convert sample actions to confirmation requests
  const pendingConfirmations: ConfirmationRequest[] = React.useMemo(() => {
    return sampleActions
      .filter(action => !approvedActions.has(action.action_id) && !rejectedActions.has(action.action_id))
      .map(action => ({
        request_id: action.action_id,
        agent_id: 'test-agent',
        action,
        status: 'pending' as const,
        created_at: action.created_at,
        expires_at: new Date(Date.now() + 300000).toISOString(), // 5 minutes from now
        bulk_approvable: action.metadata?.risk_level !== 'high',
        risk_level: action.metadata?.risk_level as 'low' | 'medium' | 'high' | undefined,
      }));
  }, [approvedActions, rejectedActions]);

  const handleApprove = React.useCallback((actionId: string) => {
    setApprovedActions(prev => new Set(prev).add(actionId));
    setRejectedActions(prev => {
      const next = new Set(prev);
      next.delete(actionId);
      return next;
    });
  }, []);

  const handleReject = React.useCallback((actionId: string) => {
    setRejectedActions(prev => new Set(prev).add(actionId));
    setApprovedActions(prev => {
      const next = new Set(prev);
      next.delete(actionId);
      return next;
    });
  }, []);

  const handleBulkApprove = React.useCallback(() => {
    const bulkApprovableIds = pendingConfirmations
      .filter(c => c.bulk_approvable)
      .map(c => c.request_id);

    setApprovedActions(prev => {
      const next = new Set(prev);
      bulkApprovableIds.forEach(id => next.add(id));
      return next;
    });
  }, [pendingConfirmations]);

  const handleReset = React.useCallback(() => {
    setApprovedActions(new Set());
    setRejectedActions(new Set());
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Action Preview & Confirmation Test</h1>
          <p className="text-muted-foreground">
            Testing the ActionPreview and ConfirmationDialog components with sample agent actions
          </p>
        </div>

        {/* Test controls */}
        <div className="mb-6 p-4 rounded-lg border bg-card space-y-4">
          <h2 className="text-lg font-semibold">Test Controls</h2>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => setIsDialogOpen(true)}
              disabled={pendingConfirmations.length === 0}
            >
              Open Confirmation Dialog ({pendingConfirmations.length})
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={approvedActions.size === 0 && rejectedActions.size === 0}
            >
              Reset All
            </Button>
            <Button
              variant="outline"
              onClick={() => setBulkApprovalEnabled(!bulkApprovalEnabled)}
            >
              Bulk Approval: {bulkApprovalEnabled ? 'ON' : 'OFF'}
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          {sampleActions.map((action) => {
            const isApproved = approvedActions.has(action.action_id);
            const isRejected = rejectedActions.has(action.action_id);

            return (
              <div key={action.action_id} className="relative">
                {/* Status overlay */}
                {(isApproved || isRejected) && (
                  <div className="absolute top-4 right-4 z-10">
                    <div
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        isApproved
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                      }`}
                    >
                      {isApproved ? '✓ Approved' : '✗ Rejected'}
                    </div>
                  </div>
                )}

                <ActionPreview
                  action={action}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  disabled={isApproved || isRejected}
                />
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-8 p-6 rounded-lg border bg-muted/50">
          <h2 className="text-lg font-semibold mb-4">Test Summary</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Approved:</span>{' '}
              <span className="text-green-600 dark:text-green-400">
                {approvedActions.size}
              </span>
            </div>
            <div>
              <span className="font-medium">Rejected:</span>{' '}
              <span className="text-red-600 dark:text-red-400">
                {rejectedActions.size}
              </span>
            </div>
            <div>
              <span className="font-medium">Pending:</span>{' '}
              <span className="text-muted-foreground">
                {sampleActions.length - approvedActions.size - rejectedActions.size}
              </span>
            </div>
          </div>
        </div>

        {/* Verification checklist */}
        <div className="mt-8 p-6 rounded-lg border">
          <h2 className="text-lg font-semibold mb-4">Verification Checklist</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium mb-2">ActionPreview Component</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                  <span>Action metadata visible (tool name, action type, file path)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                  <span>Explanation text shown for each action</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                  <span>Diff viewer displays code changes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                  <span>Risk level badges displayed correctly</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                  <span>Approve/Reject buttons functional</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                  <span>Timestamps formatted correctly</span>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2">ConfirmationDialog Component</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">▢</span>
                  <span>Dialog opens when "Open Confirmation Dialog" button is clicked</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">▢</span>
                  <span>Shows all pending confirmations in scrollable area</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">▢</span>
                  <span>Individual Approve/Reject buttons work correctly</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">▢</span>
                  <span>Bulk Approve All button appears when enabled and multiple bulk-approvable items exist</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">▢</span>
                  <span>Escape key closes the dialog</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">▢</span>
                  <span>Enter key approves action when only one pending</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-0.5">▢</span>
                  <span>Dialog shows empty state when all confirmations are resolved</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ConfirmationDialog */}
      <ConfirmationDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        confirmations={pendingConfirmations}
        onApprove={handleApprove}
        onReject={handleReject}
        onBulkApprove={handleBulkApprove}
        bulkApprovalEnabled={bulkApprovalEnabled}
      />
    </div>
  );
}
