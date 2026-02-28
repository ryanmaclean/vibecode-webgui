/**
 * AuditLogViewer Test Page
 *
 * Test page for the AuditLogViewer component with various audit log scenarios
 */

'use client';

import React, { useState } from 'react';
import { AuditLogViewer } from '@/components/agents/AuditLogViewer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AuditLogEntry } from '@/lib/audit/types';
import {
  AuditAction,
  AuditSeverity,
  AuditCategory,
  AuditOutcome,
} from '@/lib/audit/types';

// Sample audit log entries for testing
const SAMPLE_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'audit-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    userId: 1,
    action: AuditAction.FILE_DELETED,
    resource: 'file:src/components/old-component.tsx',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    metadata: {
      fileName: 'old-component.tsx',
      fileSize: 2048,
      reason: 'Component deprecated and replaced',
    },
    hash: 'a1b2c3d4e5f6',
    previousHash: null,
    severity: AuditSeverity.CRITICAL,
    category: AuditCategory.DATA_ACCESS,
    outcome: AuditOutcome.SUCCESS,
    sessionId: 'session-abc123',
  },
  {
    id: 'audit-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 minutes ago
    userId: 2,
    action: AuditAction.AI_CODE_GENERATION,
    resource: 'agent:claude-agent-123',
    ipAddress: '192.168.1.101',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    metadata: {
      agentId: 'claude-agent-123',
      model: 'claude-3-5-sonnet-20241022',
      promptTokens: 1500,
      completionTokens: 800,
      generatedFiles: ['utils/helper.ts', 'utils/validator.ts'],
    },
    hash: 'b2c3d4e5f6a1',
    previousHash: 'a1b2c3d4e5f6',
    severity: AuditSeverity.INFO,
    category: AuditCategory.AI_OPERATIONS,
    outcome: AuditOutcome.SUCCESS,
    sessionId: 'session-def456',
  },
  {
    id: 'audit-3',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    userId: 1,
    action: AuditAction.USER_LOGIN_FAILED,
    resource: 'user:john.doe@example.com',
    ipAddress: '203.0.113.42',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
    metadata: {
      email: 'john.doe@example.com',
      failureReason: 'Invalid password',
      attemptCount: 3,
    },
    hash: 'c3d4e5f6a1b2',
    previousHash: 'b2c3d4e5f6a1',
    severity: AuditSeverity.WARNING,
    category: AuditCategory.AUTH,
    outcome: AuditOutcome.FAILURE,
    sessionId: null,
  },
  {
    id: 'audit-4',
    timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
    userId: 3,
    action: AuditAction.AI_SUGGESTION_ACCEPTED,
    resource: 'agent:copilot-789',
    ipAddress: '192.168.1.102',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
    metadata: {
      suggestionId: 'sugg-456',
      codeSnippet: 'const result = items.filter(i => i.active)',
      filePath: 'src/utils/array-helpers.ts',
      lineNumber: 42,
    },
    hash: 'd4e5f6a1b2c3',
    previousHash: 'c3d4e5f6a1b2',
    severity: AuditSeverity.INFO,
    category: AuditCategory.AI_OPERATIONS,
    outcome: AuditOutcome.SUCCESS,
    sessionId: 'session-ghi789',
  },
  {
    id: 'audit-5',
    timestamp: new Date(Date.now() - 1000 * 60 * 90), // 1.5 hours ago
    userId: null,
    action: AuditAction.SYSTEM_ERROR,
    resource: 'system:database-connection',
    ipAddress: null,
    userAgent: null,
    metadata: {
      errorMessage: 'Connection timeout to PostgreSQL database',
      errorCode: 'ETIMEDOUT',
      retryAttempts: 5,
      duration: 30000,
    },
    hash: 'e5f6a1b2c3d4',
    previousHash: 'd4e5f6a1b2c3',
    severity: AuditSeverity.CRITICAL,
    category: AuditCategory.SYSTEM,
    outcome: AuditOutcome.ERROR,
    sessionId: null,
  },
  {
    id: 'audit-6',
    timestamp: new Date(Date.now() - 1000 * 60 * 120), // 2 hours ago
    userId: 1,
    action: AuditAction.FILE_UPDATED,
    resource: 'file:src/config/settings.json',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    metadata: {
      fileName: 'settings.json',
      changedFields: ['theme', 'language', 'notifications'],
      before: { theme: 'light', language: 'en', notifications: true },
      after: { theme: 'dark', language: 'en', notifications: false },
    },
    hash: 'f6a1b2c3d4e5',
    previousHash: 'e5f6a1b2c3d4',
    severity: AuditSeverity.INFO,
    category: AuditCategory.DATA_ACCESS,
    outcome: AuditOutcome.SUCCESS,
    sessionId: 'session-abc123',
  },
  {
    id: 'audit-7',
    timestamp: new Date(Date.now() - 1000 * 60 * 180), // 3 hours ago
    userId: 2,
    action: AuditAction.ADMIN_SETTINGS_CHANGED,
    resource: 'settings:global-config',
    ipAddress: '192.168.1.105',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    metadata: {
      settingKey: 'ai.confirmationMode',
      oldValue: 'auto',
      newValue: 'always',
      reason: 'Enhanced security for production environment',
    },
    hash: 'a1b2c3d4e5f7',
    previousHash: 'f6a1b2c3d4e5',
    severity: AuditSeverity.CRITICAL,
    category: AuditCategory.ADMIN,
    outcome: AuditOutcome.SUCCESS,
    sessionId: 'session-jkl012',
  },
  {
    id: 'audit-8',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    userId: 3,
    action: AuditAction.PROJECT_CREATED,
    resource: 'project:new-microservice',
    ipAddress: '192.168.1.103',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    metadata: {
      projectName: 'new-microservice',
      projectType: 'backend',
      template: 'node-express',
      features: ['auth', 'database', 'api'],
    },
    hash: 'b2c3d4e5f7a1',
    previousHash: 'a1b2c3d4e5f7',
    severity: AuditSeverity.INFO,
    category: AuditCategory.DATA_ACCESS,
    outcome: AuditOutcome.SUCCESS,
    sessionId: 'session-mno345',
  },
  {
    id: 'audit-9',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    userId: 1,
    action: AuditAction.AI_CODE_REVIEW,
    resource: 'agent:reviewer-bot',
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    metadata: {
      pullRequestId: 'pr-42',
      filesReviewed: 8,
      issuesFound: 3,
      suggestions: [
        'Add error handling to async function',
        'Extract magic numbers to constants',
        'Improve variable naming',
      ],
    },
    hash: 'c3d4e5f7a1b2',
    previousHash: 'b2c3d4e5f7a1',
    severity: AuditSeverity.INFO,
    category: AuditCategory.AI_OPERATIONS,
    outcome: AuditOutcome.SUCCESS,
    sessionId: 'session-pqr678',
  },
  {
    id: 'audit-10',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
    userId: 2,
    action: AuditAction.USER_MFA_ENABLED,
    resource: 'user:alice.smith@example.com',
    ipAddress: '192.168.1.104',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    metadata: {
      mfaMethod: 'totp',
      deviceId: 'device-xyz789',
      backupCodesGenerated: true,
    },
    hash: 'd4e5f7a1b2c3',
    previousHash: 'c3d4e5f7a1b2',
    severity: AuditSeverity.INFO,
    category: AuditCategory.AUTH,
    outcome: AuditOutcome.SUCCESS,
    sessionId: 'session-stu901',
  },
];

export default function AuditLogTestPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>(SAMPLE_AUDIT_LOGS);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const handleLoadMore = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Generate additional sample logs
    const newLogs: AuditLogEntry[] = [
      {
        id: `audit-${logs.length + 1}`,
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
        userId: 1,
        action: AuditAction.API_KEY_CREATED,
        resource: 'api-key:prod-key-123',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
        metadata: { keyName: 'Production API Key', expiresIn: '90 days' },
        hash: `hash-${logs.length + 1}`,
        previousHash: `hash-${logs.length}`,
        severity: AuditSeverity.WARNING,
        category: AuditCategory.API,
        outcome: AuditOutcome.SUCCESS,
        sessionId: 'session-new',
      },
    ];

    setLogs([...logs, ...newLogs]);
    setLoading(false);

    // Disable load more after a few loads
    if (logs.length > 15) {
      setHasMore(false);
    }
  };

  const handleReset = () => {
    setLogs(SAMPLE_AUDIT_LOGS);
    setHasMore(true);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AuditLogViewer Component Test</h1>
        <p className="text-muted-foreground">
          Interactive test page for the AuditLogViewer component
        </p>
      </div>

      <div className="space-y-6">
        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Test Controls</CardTitle>
            <CardDescription>Manage test data and states</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Button onClick={handleReset} variant="outline">
              Reset Logs
            </Button>
            <Button
              onClick={() => {
                setLoading(true);
                setTimeout(() => setLoading(false), 2000);
              }}
              variant="outline"
            >
              Toggle Loading State
            </Button>
          </CardContent>
        </Card>

        {/* Component */}
        <AuditLogViewer
          logs={logs}
          loading={loading}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
        />

        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Log Statistics</CardTitle>
            <CardDescription>Overview of current audit log data</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Entries</p>
                <p className="text-2xl font-bold">{logs.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-red-500">
                  {logs.filter((l) => l.severity === AuditSeverity.CRITICAL).length}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Warnings</p>
                <p className="text-2xl font-bold text-yellow-500">
                  {logs.filter((l) => l.severity === AuditSeverity.WARNING).length}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Failures</p>
                <p className="text-2xl font-bold text-orange-500">
                  {logs.filter((l) => l.outcome === AuditOutcome.ERROR || l.outcome === AuditOutcome.FAILURE).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <div className="p-6 border rounded-lg bg-muted/50">
          <h2 className="text-lg font-semibold mb-2">Component Features</h2>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span>Displays timestamp, action, and user information</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span>Filtering by severity, outcome, and category</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span>Search functionality across all fields</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span>Expandable entries for metadata viewing</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span>Grouped by date for better organization</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span>Color-coded severity and outcome indicators</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span>Pagination support with load more</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span>Loading states and empty states</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span>Responsive design with scrollable areas</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span>Dark mode support</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span>Accessibility compliant (WCAG 2.1 AA)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 dark:text-green-400">✓</span>
              <span>Session ID and IP address display</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
