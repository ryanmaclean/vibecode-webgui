/**
 * ConfirmationDialog Test Page
 *
 * Test page for the ConfirmationDialog component with various scenarios
 */

'use client';

import React, { useState } from 'react';
import { ConfirmationDialog } from '@/components/agents/ConfirmationDialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ConfirmationRequest } from '@/types/agent-confirmation';

// Sample confirmation requests for testing
const FILE_DELETE_REQUEST: ConfirmationRequest = {
  request_id: 'test-delete-1',
  agent_id: 'agent-test-123',
  status: 'pending',
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 300000).toISOString(), // 5 minutes
  bulk_approvable: false,
  risk_level: 'high',
  action: {
    action_id: 'action-delete-1',
    action_type: 'file_delete',
    tool_name: 'file_system',
    file_path: 'src/components/critical-component.tsx',
    explanation: 'Removing deprecated component that is no longer used in the application. This file has been replaced by the new modular component system.',
    created_at: new Date().toISOString(),
  },
};

const FILE_EDIT_REQUEST: ConfirmationRequest = {
  request_id: 'test-edit-1',
  agent_id: 'agent-test-456',
  status: 'pending',
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 300000).toISOString(),
  bulk_approvable: true,
  risk_level: 'medium',
  action: {
    action_id: 'action-edit-1',
    action_type: 'file_edit',
    tool_name: 'code_editor',
    file_path: 'src/utils/helpers.ts',
    explanation: 'Optimizing the helper function to use modern JavaScript features and improve performance.',
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
    created_at: new Date().toISOString(),
  },
};

const CODE_REPLACE_REQUEST: ConfirmationRequest = {
  request_id: 'test-replace-1',
  agent_id: 'agent-test-789',
  status: 'pending',
  created_at: new Date().toISOString(),
  expires_at: null,
  bulk_approvable: true,
  risk_level: 'low',
  action: {
    action_id: 'action-replace-1',
    action_type: 'code_replace',
    tool_name: 'refactor',
    file_path: 'src/config/database.ts',
    explanation: 'Updating database connection string to use environment variable for better security.',
    diff: {
      old_content: `const DATABASE_URL = "postgresql://localhost:5432/mydb";`,
      new_content: `const DATABASE_URL = process.env.DATABASE_URL || "postgresql://localhost:5432/mydb";`,
      language: 'typescript',
      lines_added: 1,
      lines_removed: 1,
    },
    created_at: new Date().toISOString(),
  },
};

const COMMAND_EXECUTE_REQUEST: ConfirmationRequest = {
  request_id: 'test-command-1',
  agent_id: 'agent-test-999',
  status: 'pending',
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 600000).toISOString(), // 10 minutes
  bulk_approvable: false,
  risk_level: 'high',
  action: {
    action_id: 'action-command-1',
    action_type: 'command_execute',
    tool_name: 'bash',
    explanation: 'Running database migration to update schema. This will modify the production database structure.',
    metadata: {
      command: 'npm run migrate:prod',
      working_directory: '/app',
    },
    created_at: new Date().toISOString(),
  },
};

export default function ConfirmationDialogTestPage() {
  const [currentRequest, setCurrentRequest] = useState<ConfirmationRequest | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<Array<{ type: string; message: string }>>([]);

  const handleOpenDialog = (request: ConfirmationRequest) => {
    setCurrentRequest(request);
    setIsOpen(true);
  };

  const handleApprove = async (requestId: string, comment?: string) => {
    setIsProcessing(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setResults((prev) => [
      { type: 'approve', message: `Approved request ${requestId}${comment ? ` with comment: "${comment}"` : ''}` },
      ...prev,
    ]);
    setIsProcessing(false);
    setIsOpen(false);
  };

  const handleReject = async (requestId: string, comment?: string) => {
    setIsProcessing(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setResults((prev) => [
      { type: 'reject', message: `Rejected request ${requestId}${comment ? ` with comment: "${comment}"` : ''}` },
      ...prev,
    ]);
    setIsProcessing(false);
    setIsOpen(false);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">ConfirmationDialog Component Test</h1>
        <p className="text-muted-foreground">
          Interactive test page for the ConfirmationDialog component
        </p>
      </div>

      <Tabs defaultValue="file-delete" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="file-delete">File Delete</TabsTrigger>
          <TabsTrigger value="file-edit">File Edit</TabsTrigger>
          <TabsTrigger value="code-replace">Code Replace</TabsTrigger>
          <TabsTrigger value="command">Command</TabsTrigger>
        </TabsList>

        <TabsContent value="file-delete" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>High Risk File Deletion</CardTitle>
              <CardDescription>
                Test dialog for a high-risk file deletion operation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => handleOpenDialog(FILE_DELETE_REQUEST)}>
                Open Delete Confirmation
              </Button>
              <div className="mt-4 p-4 bg-muted rounded-md">
                <p className="text-sm font-mono">
                  Request ID: {FILE_DELETE_REQUEST.request_id}
                  <br />
                  Risk Level: <span className="text-destructive font-bold">High</span>
                  <br />
                  File: {FILE_DELETE_REQUEST.action.file_path}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="file-edit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Medium Risk File Edit</CardTitle>
              <CardDescription>
                Test dialog for a medium-risk file edit with diff preview
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => handleOpenDialog(FILE_EDIT_REQUEST)}>
                Open Edit Confirmation
              </Button>
              <div className="mt-4 p-4 bg-muted rounded-md">
                <p className="text-sm font-mono">
                  Request ID: {FILE_EDIT_REQUEST.request_id}
                  <br />
                  Risk Level: <span className="text-yellow-600 dark:text-yellow-400 font-bold">Medium</span>
                  <br />
                  File: {FILE_EDIT_REQUEST.action.file_path}
                  <br />
                  Changes: +{FILE_EDIT_REQUEST.action.diff?.lines_added} -{FILE_EDIT_REQUEST.action.diff?.lines_removed}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="code-replace" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Low Risk Code Replace</CardTitle>
              <CardDescription>
                Test dialog for a low-risk code replacement
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => handleOpenDialog(CODE_REPLACE_REQUEST)}>
                Open Replace Confirmation
              </Button>
              <div className="mt-4 p-4 bg-muted rounded-md">
                <p className="text-sm font-mono">
                  Request ID: {CODE_REPLACE_REQUEST.request_id}
                  <br />
                  Risk Level: <span className="text-green-600 dark:text-green-400 font-bold">Low</span>
                  <br />
                  File: {CODE_REPLACE_REQUEST.action.file_path}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="command" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>High Risk Command Execution</CardTitle>
              <CardDescription>
                Test dialog for a high-risk command execution (no diff)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => handleOpenDialog(COMMAND_EXECUTE_REQUEST)}>
                Open Command Confirmation
              </Button>
              <div className="mt-4 p-4 bg-muted rounded-md">
                <p className="text-sm font-mono">
                  Request ID: {COMMAND_EXECUTE_REQUEST.request_id}
                  <br />
                  Risk Level: <span className="text-destructive font-bold">High</span>
                  <br />
                  Command: {COMMAND_EXECUTE_REQUEST.action.metadata?.command as string}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Results Section */}
      {results.length > 0 && (
        <Card className="mt-8">
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
                      : 'bg-red-50 dark:bg-red-950/20 text-red-900 dark:text-red-100'
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

      <div className="mt-8 p-6 border rounded-lg bg-muted/50">
        <h2 className="text-lg font-semibold mb-2">Component Features</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>Action metadata display (type, file path, explanation)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>Risk level indicator with color coding</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>Integrated DiffViewer for code changes</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>Optional comment input</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>Approve/Reject/Cancel buttons</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>Processing state with disabled interactions</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>Dark mode support</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>Responsive design with scrolling for large content</span>
          </li>
        </ul>
      </div>

      {/* Dialog Component */}
      <ConfirmationDialog
        confirmation={currentRequest}
        open={isOpen}
        onOpenChange={setIsOpen}
        onApprove={handleApprove}
        onReject={handleReject}
        isProcessing={isProcessing}
      />
    </div>
  );
}
