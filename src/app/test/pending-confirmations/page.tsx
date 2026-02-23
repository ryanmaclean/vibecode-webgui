/**
 * PendingConfirmations Test Page
 *
 * Test page for the PendingConfirmations component with various scenarios
 */

'use client';

import React, { useState } from 'react';
import { PendingConfirmations } from '@/components/agents/PendingConfirmations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ConfirmationRequest } from '@/types/agent-confirmation';

// Sample confirmation requests for testing
const SAMPLE_CONFIRMATIONS: ConfirmationRequest[] = [
  {
    request_id: 'test-delete-1',
    agent_id: 'agent-123',
    status: 'pending',
    created_at: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
    expires_at: new Date(Date.now() + 300000).toISOString(),
    bulk_approvable: false,
    risk_level: 'high',
    action: {
      action_id: 'action-delete-1',
      action_type: 'file_delete',
      tool_name: 'file_system',
      file_path: 'src/components/critical-component.tsx',
      explanation: 'Removing deprecated component that is no longer used in the application.',
      created_at: new Date(Date.now() - 120000).toISOString(),
    },
  },
  {
    request_id: 'test-edit-1',
    agent_id: 'agent-456',
    status: 'pending',
    created_at: new Date(Date.now() - 60000).toISOString(), // 1 minute ago
    expires_at: new Date(Date.now() + 300000).toISOString(),
    bulk_approvable: true,
    risk_level: 'medium',
    action: {
      action_id: 'action-edit-1',
      action_type: 'file_edit',
      tool_name: 'code_editor',
      file_path: 'src/utils/helpers.ts',
      explanation: 'Optimizing the helper function to use modern JavaScript features.',
      diff: {
        old_content: `function processData(items) {
  const result = [];
  for (let i = 0; i < items.length; i++) {
    if (items[i].active) {
      result.push(items[i].value);
    }
  }
  return result;
}`,
        new_content: `function processData(items) {
  return items
    .filter(item => item.active)
    .map(item => item.value);
}`,
        language: 'typescript',
        lines_added: 4,
        lines_removed: 7,
      },
      created_at: new Date(Date.now() - 60000).toISOString(),
    },
  },
  {
    request_id: 'test-replace-1',
    agent_id: 'agent-456',
    status: 'pending',
    created_at: new Date(Date.now() - 30000).toISOString(), // 30 seconds ago
    expires_at: null,
    bulk_approvable: true,
    risk_level: 'low',
    action: {
      action_id: 'action-replace-1',
      action_type: 'code_replace',
      tool_name: 'refactor',
      file_path: 'src/config/database.ts',
      explanation: 'Updating database connection string to use environment variable for security.',
      diff: {
        old_content: `const DATABASE_URL = "postgresql://localhost:5432/mydb";`,
        new_content: `const DATABASE_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/mydb";`,
        language: 'typescript',
        lines_added: 1,
        lines_removed: 1,
      },
      created_at: new Date(Date.now() - 30000).toISOString(),
    },
  },
  {
    request_id: 'test-command-1',
    agent_id: 'agent-789',
    status: 'pending',
    created_at: new Date(Date.now() - 10000).toISOString(), // 10 seconds ago
    expires_at: new Date(Date.now() + 600000).toISOString(),
    bulk_approvable: false,
    risk_level: 'high',
    action: {
      action_id: 'action-command-1',
      action_type: 'command_execute',
      tool_name: 'bash',
      explanation: 'Running database migration to update schema. This will modify the production database.',
      metadata: {
        command: 'npm run migrate:prod',
        working_directory: '/app',
      },
      created_at: new Date(Date.now() - 10000).toISOString(),
    },
  },
  {
    request_id: 'test-write-1',
    agent_id: 'agent-123',
    status: 'pending',
    created_at: new Date(Date.now() - 5000).toISOString(), // 5 seconds ago
    expires_at: new Date(Date.now() + 300000).toISOString(),
    bulk_approvable: true,
    risk_level: 'medium',
    action: {
      action_id: 'action-write-1',
      action_type: 'file_write',
      tool_name: 'file_system',
      file_path: 'docs/API.md',
      explanation: 'Creating API documentation based on recent code changes.',
      diff: {
        old_content: '',
        new_content: `# API Documentation

## Endpoints

### GET /api/users
Returns a list of users.

### POST /api/users
Creates a new user.`,
        language: 'markdown',
        lines_added: 9,
        lines_removed: 0,
      },
      created_at: new Date(Date.now() - 5000).toISOString(),
    },
  },
];

export default function PendingConfirmationsTestPage() {
  const [confirmations, setConfirmations] = useState<ConfirmationRequest[]>(SAMPLE_CONFIRMATIONS);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Array<{ type: string; message: string }>>([]);

  const handleRefresh = async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setResults((prev) => [
      { type: 'info', message: 'Refreshed confirmations list' },
      ...prev,
    ]);
    setIsLoading(false);
  };

  const handleApprove = async (requestId: string, comment?: string) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Remove the approved confirmation from the list
    setConfirmations((prev) => prev.filter((c) => c.request_id !== requestId));

    setResults((prev) => [
      {
        type: 'approve',
        message: `Approved request ${requestId}${comment ? ` with comment: "${comment}"` : ''}`
      },
      ...prev,
    ]);
  };

  const handleReject = async (requestId: string, comment?: string) => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Remove the rejected confirmation from the list
    setConfirmations((prev) => prev.filter((c) => c.request_id !== requestId));

    setResults((prev) => [
      {
        type: 'reject',
        message: `Rejected request ${requestId}${comment ? ` with comment: "${comment}"` : ''}`
      },
      ...prev,
    ]);
  };

  const handleReset = () => {
    setConfirmations(SAMPLE_CONFIRMATIONS);
    setResults([]);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">PendingConfirmations Component Test</h1>
        <p className="text-muted-foreground">
          Interactive test page for the PendingConfirmations list component
        </p>
      </div>

      <Tabs defaultValue="full-list" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="full-list">Full List</TabsTrigger>
          <TabsTrigger value="empty-state">Empty State</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="full-list" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Interactive Confirmation List</CardTitle>
                  <CardDescription>
                    Click on any item to open the approval dialog. Use filters to narrow down results.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                >
                  Reset List
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <PendingConfirmations
                confirmations={confirmations}
                onRefresh={handleRefresh}
                onApprove={handleApprove}
                onReject={handleReject}
                isLoading={isLoading}
                autoRefreshInterval={0} // Disabled for testing
              />
            </CardContent>
          </Card>

          {/* Results Section */}
          {results.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Action Results</CardTitle>
                <CardDescription>Log of approve/reject actions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {results.map((result, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-md text-sm font-mono ${
                        result.type === 'approve'
                          ? 'bg-green-50 dark:bg-green-950/20 text-green-900 dark:text-green-100'
                          : result.type === 'reject'
                          ? 'bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-100'
                          : 'bg-blue-50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-100'
                      }`}
                    >
                      {result.message}
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setResults([])}
                  className="mt-4"
                >
                  Clear Results
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="empty-state" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Empty State Test</CardTitle>
              <CardDescription>
                View the component when no confirmations are pending
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PendingConfirmations
                confirmations={[]}
                onRefresh={handleRefresh}
                onApprove={handleApprove}
                onReject={handleReject}
                isLoading={false}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Loading State Test</CardTitle>
              <CardDescription>
                View the component in loading state
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PendingConfirmations
                confirmations={[]}
                onRefresh={handleRefresh}
                onApprove={handleApprove}
                onReject={handleReject}
                isLoading={true}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Component Features</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400">✓</span>
                    <span>Filterable list by risk level, agent ID, and action type</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400">✓</span>
                    <span>Real-time updates via refresh button</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400">✓</span>
                    <span>Click-to-open dialog for approval workflow</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400">✓</span>
                    <span>Empty state handling with helpful message</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400">✓</span>
                    <span>Loading state with spinner</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400">✓</span>
                    <span>Responsive design for all screen sizes</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400">✓</span>
                    <span>Dark mode support</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400">✓</span>
                    <span>WCAG 2.1 AA compliant accessibility</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Filter Features</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400">•</span>
                    <span><strong>Risk Level Filter:</strong> Filter by low, medium, or high risk</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400">•</span>
                    <span><strong>Action Type Filter:</strong> Filter by file_delete, file_edit, code_replace, etc.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400">•</span>
                    <span><strong>Agent Filter:</strong> Filter by specific agent ID (shown when multiple agents present)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400">•</span>
                    <span><strong>Clear Filters:</strong> Quick button to reset all filters to default</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Interaction Features</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 dark:text-purple-400">•</span>
                    <span><strong>Clickable Items:</strong> Click any confirmation to open detailed approval dialog</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 dark:text-purple-400">•</span>
                    <span><strong>Hover Effects:</strong> Visual feedback on item hover</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 dark:text-purple-400">•</span>
                    <span><strong>Keyboard Navigation:</strong> Full keyboard support with focus indicators</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 dark:text-purple-400">•</span>
                    <span><strong>Auto-refresh:</strong> Optional auto-refresh with configurable interval</span>
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Visual Features</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-orange-600 dark:text-orange-400">•</span>
                    <span><strong>Risk Badges:</strong> Color-coded badges for quick risk assessment</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-600 dark:text-orange-400">•</span>
                    <span><strong>Action Type Badges:</strong> Icons and labels for action types</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-600 dark:text-orange-400">•</span>
                    <span><strong>Timestamp Display:</strong> Relative time display (e.g., "2m ago")</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-orange-600 dark:text-orange-400">•</span>
                    <span><strong>Visual Indicators:</strong> Colored dots for quick risk identification</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <div className="mt-8 p-6 border rounded-lg bg-muted/50">
        <h2 className="text-lg font-semibold mb-2">Test Scenarios</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="font-semibold">1.</span>
            <span>Open the "Full List" tab and verify all 5 confirmations are displayed</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">2.</span>
            <span>Click on any confirmation item to open the approval dialog</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">3.</span>
            <span>Use the risk level filter to show only "High Risk" items</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">4.</span>
            <span>Use the action type filter to show only "File Edit" items</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">5.</span>
            <span>Click "Clear Filters" to reset all filters</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">6.</span>
            <span>Approve or reject a confirmation and verify it's removed from the list</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">7.</span>
            <span>Click "Reset List" to restore all confirmations</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">8.</span>
            <span>Open the "Empty State" tab to see the component with no items</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-semibold">9.</span>
            <span>Verify the loading state shows a spinner</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
