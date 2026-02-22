# Agent Action Preview & Confirmation

**Status:** Production Ready
**Version:** 1.0
**Created:** 2026-02-14
**Feature:** Agent Safety & Confirmation

---

## Executive Summary

The Agent Confirmation feature provides a safety mechanism to prevent unwanted or destructive code modifications by requiring explicit user approval before any agent executes file operations. This feature addresses a critical pain point where AI agents may edit wrong sections, remove code without permission, or make destructive changes.

### Key Benefits

- **🛡️ Safety First**: Preview all changes before they're applied
- **👁️ Full Visibility**: See exactly what will change with side-by-side diffs
- **✋ User Control**: Approve or reject each action individually
- **⚡ Bulk Operations**: Approve multiple trusted changes at once
- **📝 Explanations**: Understand why each change is being proposed
- **🎯 Risk Assessment**: Automatic categorization of action risk levels

### Quick Start

1. **Enable in Settings**: Navigate to Settings → Advanced → Agent Safety & Confirmation
2. **Configure Preferences**: Toggle confirmation settings based on your workflow
3. **Use with Agents**: When an agent attempts a file operation, you'll see a confirmation dialog
4. **Review & Approve**: View the diff, read the explanation, and approve or reject

---

## Table of Contents

1. [Overview](#overview)
2. [User Guide](#user-guide)
3. [Developer Guide](#developer-guide)
4. [API Reference](#api-reference)
5. [Architecture](#architecture)
6. [Examples & Use Cases](#examples--use-cases)
7. [Troubleshooting](#troubleshooting)
8. [FAQ](#faq)

---

## Overview

### What is Agent Confirmation?

Agent Confirmation is a safety feature that intercepts potentially destructive agent actions and presents them to the user for approval before execution. When enabled, any agent tool marked as requiring confirmation will:

1. **Pause execution** before making changes
2. **Generate a preview** showing what will change (diff for code changes)
3. **Emit a confirmation event** to the UI layer
4. **Display a modal dialog** with action details, diff preview, and explanation
5. **Wait for user decision** (approve or reject)
6. **Execute or abort** based on the user's choice

### When to Use Confirmation

**✅ Recommended for:**
- File write/edit/delete operations
- Code replacement and refactoring
- Database migrations
- Command execution (especially destructive commands)
- Production environment changes

**⚠️ Optional for:**
- Read-only operations (file reads, searches)
- Temporary file operations
- Safe exploratory commands

### Feature Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Settings UI** | `src/components/settings/SettingsPanel.tsx` | Configure confirmation preferences |
| **Type Definitions** | `src/types/agent-confirmation.ts` | TypeScript types for all confirmation objects |
| **Confirmation Service** | `src/lib/agent-framework/confirmation/service.ts` | Backend service managing approval workflow |
| **Agent Integration** | `src/lib/agent-framework/core.ts` | Integration point in agent execution |
| **DiffViewer** | `src/components/agent/DiffViewer.tsx` | Side-by-side code diff display |
| **ActionPreview** | `src/components/agent/ActionPreview.tsx` | Action metadata and preview component |
| **ConfirmationDialog** | `src/components/agent/ConfirmationDialog.tsx` | Modal dialog for user approval |
| **API Routes** | `src/app/api/agents/[...path]/route.ts` | REST API for confirmation operations |

---

## User Guide

### Enabling Agent Confirmation

#### Step 1: Open Settings

Navigate to the Settings panel:
- Click the **Settings** icon in the sidebar, or
- Press `Ctrl+,` (Windows/Linux) or `Cmd+,` (Mac)

#### Step 2: Navigate to Agent Safety

1. Click the **Advanced** tab
2. Scroll to the **Agent Safety & Confirmation** section

#### Step 3: Configure Preferences

Toggle the following settings based on your needs:

| Setting | Default | Description |
|---------|---------|-------------|
| **Enable Action Preview** | ✅ On | Show diff previews before applying changes |
| **Require Confirmation** | ✅ On | Require explicit approval for agent actions |
| **Bulk Approval Mode** | ❌ Off | Allow approving multiple changes at once |
| **Show Explanations** | ✅ On | Show why each change is proposed |
| **Auto-Approve Read-Only** | ❌ Off | Skip confirmation for read-only operations |

#### Recommended Configurations

**🔒 Maximum Safety (Default)**
```
✅ Enable Action Preview
✅ Require Confirmation
❌ Bulk Approval Mode
✅ Show Explanations
❌ Auto-Approve Read-Only
```
*Best for: Production environments, critical codebases, beginners*

**⚡ Balanced Workflow**
```
✅ Enable Action Preview
✅ Require Confirmation
✅ Bulk Approval Mode
✅ Show Explanations
✅ Auto-Approve Read-Only
```
*Best for: Development environments, experienced users*

**🚀 Trusted Agent Mode**
```
✅ Enable Action Preview
❌ Require Confirmation
❌ Bulk Approval Mode
✅ Show Explanations
✅ Auto-Approve Read-Only
```
*Best for: Fully trusted environments, automated workflows*

### Using the Confirmation Dialog

When an agent action requires confirmation, a modal dialog will appear with the following information:

#### Dialog Components

**1. Header**
- Total number of pending actions
- Close button (X)

**2. Action Preview Cards** (one per action)
Each card shows:
- **Action Type Badge**: Visual indicator of the operation type
  - `file_write` - Writing new content to a file
  - `file_edit` - Modifying existing file
  - `file_delete` - Deleting a file
  - `code_replace` - Replacing code sections
  - `command_execute` - Running shell commands

- **Risk Level Badge**: Automatic risk assessment
  - 🟢 **Low** - Safe operations (read, create new files)
  - 🟡 **Medium** - Modifications (edit existing files)
  - 🔴 **High** - Destructive operations (delete, replace)

- **Target File Path**: Which file will be affected
- **Explanation**: Why this change is needed (if enabled in settings)
- **Diff Preview**: Side-by-side comparison showing:
  - Red lines: Removed content
  - Green lines: Added content
  - White lines: Unchanged context
  - Line numbers for both old and new versions
  - Statistics (e.g., "+15 -3 lines")

**3. Action Buttons**
- **Approve** (green checkmark): Execute this specific action
- **Reject** (red X): Cancel this specific action
- **Approve All** (bulk mode only): Approve all bulk-approvable actions at once

**4. Footer**
- Keyboard shortcuts: `Enter` to approve (single action), `Esc` to close

#### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Approve (when only 1 pending action) |
| `Esc` | Close dialog (rejects all pending) |

#### Example Workflow

**Scenario**: Agent wants to update a configuration file

1. **Agent Action**: Agent calls `fileEditTool` to modify `config.json`
2. **Confirmation Triggered**: Execution pauses, dialog appears
3. **User Reviews**:
   - Sees filename: `config.json`
   - Reads explanation: "Update API endpoint URL to production server"
   - Views diff:
     ```diff
     - "api_url": "http://localhost:3000"
     + "api_url": "https://api.production.com"
     ```
   - Checks risk level: 🟡 Medium
4. **User Decides**:
   - ✅ Clicks **Approve** → File is updated, dialog closes
   - OR ❌ Clicks **Reject** → No changes made, dialog closes

### Bulk Approval

When **Bulk Approval Mode** is enabled and multiple actions are pending:

1. **Review All Actions**: Scroll through the list of pending actions
2. **Identify Bulk-Approvable**: Actions with `bulk_approvable: true` can be approved together
3. **Click "Approve All"**: Button shows count (e.g., "Approve All (3)")
4. **All Approved**: All eligible actions execute simultaneously

**⚠️ Warning**: Bulk approval should only be used for trusted, low-risk operations. Always review individual actions for high-risk changes.

---

## Developer Guide

### Marking Tools as Requiring Confirmation

To add confirmation to a custom tool, set the `requiresConfirmation` flag in the tool definition:

#### Example: Creating a Confirmed Tool

```typescript
import type { ToolDefinition } from '@/lib/agent-framework/types';

const myDestructiveTool: ToolDefinition = {
  name: 'delete_database',
  description: 'Deletes an entire database (DESTRUCTIVE)',

  // 🔑 Key configuration: mark as requiring confirmation
  requiresConfirmation: true,

  parameters: {
    type: 'object',
    properties: {
      database_name: {
        type: 'string',
        description: 'Name of the database to delete',
      },
    },
    required: ['database_name'],
  },

  async execute(args: { database_name: string }) {
    // This will only execute AFTER user approval
    await deleteDatabase(args.database_name);
    return { success: true };
  },
};
```

### Built-in Tools with Confirmation

The following tools have confirmation enabled by default:

| Tool Name | Action Type | Risk Level | Description |
|-----------|-------------|------------|-------------|
| `file_write` | `file_write` | Low-Medium | Write content to a file |
| `file_edit` | `file_edit` | Medium | Modify existing file |
| `file_delete` | `file_delete` | High | Delete a file |

### Providing Rich Action Previews

To provide a better user experience, include `old_content` and `new_content` in your tool arguments when possible:

```typescript
const fileEditTool: ToolDefinition = {
  name: 'file_edit',
  requiresConfirmation: true,
  parameters: {
    type: 'object',
    properties: {
      file_path: { type: 'string' },
      old_content: { type: 'string' }, // 🔑 For diff generation
      new_content: { type: 'string' }, // 🔑 For diff generation
    },
  },
  async execute(args) {
    // Agent framework automatically generates diff preview
    // before this function is called
    await fs.writeFile(args.file_path, args.new_content);
    return { success: true };
  },
};
```

### How Confirmation Works Internally

When an agent executes a tool marked with `requiresConfirmation: true`:

```typescript
// In Agent.executeToolCall() - simplified flow
async executeToolCall(toolName: string, args: any) {
  const tool = this.tools.get(toolName);

  // Check if confirmation is required
  if (tool.requiresConfirmation) {
    // 1. Create action preview
    const actionPreview: ActionPreview = {
      action_id: randomUUID(),
      action_type: mapToolToActionType(toolName),
      tool_name: toolName,
      file_path: args.file_path,
      explanation: generateExplanation(toolName, args),
      diff: generateDiff(args.old_content, args.new_content),
      metadata: { ...args },
      created_at: new Date().toISOString(),
    };

    // 2. Request confirmation from service
    const confirmationRequest = this.confirmationService.requestConfirmation(
      this.agentId,
      actionPreview,
      {
        timeout: 300000, // 5 minutes
        bulkApprovable: assessBulkApprovable(tool),
        riskLevel: assessRiskLevel(tool),
      }
    );

    // 3. Emit event to UI layer
    this.emit('confirmation_required', confirmationRequest);

    // 4. Wait for user decision
    const response = await this.confirmationService.awaitConfirmation(
      confirmationRequest.request_id
    );

    // 5. Check decision
    if (response.decision !== 'approve') {
      throw new Error(`Action rejected by user: ${response.comment || 'No reason provided'}`);
    }
  }

  // 6. Execute tool (only if approved or no confirmation needed)
  return await tool.execute(args);
}
```

### Listening to Confirmation Events

#### In React Components

```typescript
'use client';

import { useEffect, useState } from 'react';
import { ConfirmationDialog } from '@/components/agent/ConfirmationDialog';
import type { ConfirmationRequest } from '@/types/agent-confirmation';

export function MyAgentPage() {
  const [pendingConfirmations, setPendingConfirmations] = useState<ConfirmationRequest[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    // Listen for confirmation events from agent
    const handleConfirmationRequired = (event: ConfirmationRequiredEvent) => {
      setPendingConfirmations(prev => [...prev, event.confirmation]);
      setIsDialogOpen(true);
    };

    // Attach listener (agent instance required)
    agent.on('confirmation_required', handleConfirmationRequired);

    return () => {
      agent.off('confirmation_required', handleConfirmationRequired);
    };
  }, [agent]);

  const handleApprove = async (requestId: string) => {
    try {
      // Call API to approve
      await fetch(`/api/agents/${agentId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });

      // Remove from pending list
      setPendingConfirmations(prev =>
        prev.filter(c => c.request_id !== requestId)
      );
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      // Call API to reject
      await fetch(`/api/agents/${agentId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId }),
      });

      // Remove from pending list
      setPendingConfirmations(prev =>
        prev.filter(c => c.request_id !== requestId)
      );
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  return (
    <>
      {/* Your agent UI */}

      <ConfirmationDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        confirmations={pendingConfirmations}
        onApprove={handleApprove}
        onReject={handleReject}
        bulkApprovalEnabled={true}
      />
    </>
  );
}
```

### Customizing Risk Assessment

Override the default risk assessment for your tools:

```typescript
// In your tool definition
const myTool: ToolDefinition = {
  name: 'my_custom_tool',
  requiresConfirmation: true,

  // Add custom metadata for risk assessment
  metadata: {
    riskLevel: 'high', // Force high risk
    bulkApprovable: false, // Don't allow bulk approval
  },

  // ... rest of tool definition
};
```

---

## API Reference

### REST API Endpoints

#### POST `/api/agents/:id/confirm`

Approve a pending confirmation request.

**Request Body:**
```json
{
  "requestId": "uuid-of-confirmation-request",
  "comment": "Optional approval comment"
}
```

**Response:** `200 OK`
```json
{
  "request_id": "uuid-of-confirmation-request",
  "agent_id": "agent-uuid",
  "decision": "approve",
  "decided_at": "2026-02-14T12:34:56.789Z",
  "comment": "Optional approval comment",
  "executed": true
}
```

**Error Responses:**
- `400 Bad Request` - Invalid request body
- `404 Not Found` - Confirmation request not found
- `500 Internal Server Error` - Execution failed

#### POST `/api/agents/:id/reject`

Reject a pending confirmation request.

**Request Body:**
```json
{
  "requestId": "uuid-of-confirmation-request",
  "comment": "Optional rejection reason"
}
```

**Response:** `200 OK`
```json
{
  "request_id": "uuid-of-confirmation-request",
  "agent_id": "agent-uuid",
  "decision": "reject",
  "decided_at": "2026-02-14T12:34:56.789Z",
  "comment": "Optional rejection reason"
}
```

#### GET `/api/agents/:id/pending`

Get all pending confirmation requests for an agent.

**Query Parameters:**
- `agentId` (optional) - Filter by specific agent ID

**Response:** `200 OK`
```json
{
  "confirmations": [
    {
      "request_id": "uuid-1",
      "agent_id": "agent-uuid",
      "action": {
        "action_id": "action-uuid",
        "action_type": "file_edit",
        "tool_name": "file_edit",
        "file_path": "src/config.ts",
        "explanation": "Update API endpoint configuration",
        "diff": {
          "old_content": "...",
          "new_content": "...",
          "lines_added": 5,
          "lines_removed": 2
        },
        "created_at": "2026-02-14T12:34:56.789Z"
      },
      "status": "pending",
      "created_at": "2026-02-14T12:34:56.789Z",
      "expires_at": "2026-02-14T12:39:56.789Z",
      "bulk_approvable": true,
      "risk_level": "medium"
    }
  ],
  "total": 1,
  "has_more": false
}
```

### TypeScript Types

#### `ConfirmationRequest`

```typescript
interface ConfirmationRequest {
  /** Unique identifier for this confirmation request */
  request_id: string;

  /** Agent ID that requested this action */
  agent_id: string;

  /** Preview of the action requiring approval */
  action: ActionPreview;

  /** Current status of this request */
  status: ConfirmationStatus; // 'pending' | 'approved' | 'rejected' | 'expired'

  /** When this request was created (ISO 8601) */
  created_at: string;

  /** When this request will expire (ISO 8601, nullable) */
  expires_at: string | null;

  /** Whether this action can be bulk-approved with others */
  bulk_approvable: boolean;

  /** Risk level of this action */
  risk_level?: 'low' | 'medium' | 'high';
}
```

#### `ActionPreview`

```typescript
interface ActionPreview {
  /** Unique identifier for this action */
  action_id: string;

  /** Type of action being performed */
  action_type: ActionType; // 'file_write' | 'file_edit' | 'file_delete' | 'code_replace' | 'command_execute'

  /** Tool name that triggered this action */
  tool_name: string;

  /** Target file path (relative to workspace) */
  file_path?: string;

  /** Human-readable explanation of why this change is needed */
  explanation: string;

  /** Diff preview for code changes (null for non-code actions) */
  diff?: DiffPreview;

  /** Additional metadata about the action */
  metadata?: Record<string, unknown>;

  /** When this action was created (ISO 8601) */
  created_at: string;
}
```

#### `DiffPreview`

```typescript
interface DiffPreview {
  /** Original content before changes */
  old_content: string;

  /** New content after changes */
  new_content: string;

  /** Programming language for syntax highlighting */
  language?: string;

  /** Line number where change starts */
  start_line?: number;

  /** Line number where change ends */
  end_line?: number;

  /** Number of lines added */
  lines_added: number;

  /** Number of lines removed */
  lines_removed: number;
}
```

### ConfirmationService API

#### `requestConfirmation()`

```typescript
requestConfirmation(
  agentId: string,
  action: ActionPreview,
  options?: {
    timeout?: number; // milliseconds, default 300000 (5 min)
    bulkApprovable?: boolean; // default true
    riskLevel?: 'low' | 'medium' | 'high';
  }
): ConfirmationRequest
```

Creates a new confirmation request and emits `confirmation_required` event.

#### `awaitConfirmation()`

```typescript
async awaitConfirmation(requestId: string): Promise<ConfirmationResponse>
```

Returns a Promise that resolves when user approves/rejects, or rejects on timeout.

#### `approve()`

```typescript
async approve(
  requestId: string,
  comment?: string
): Promise<ConfirmationResponse>
```

Approves a pending confirmation request.

#### `reject()`

```typescript
async reject(
  requestId: string,
  comment?: string
): Promise<ConfirmationResponse>
```

Rejects a pending confirmation request.

#### `bulkApprove()`

```typescript
async bulkApprove(
  requestIds: string[],
  comment?: string
): Promise<BulkApprovalResponse>
```

Approves multiple confirmation requests at once.

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User Interface                        │
│  ┌──────────────────┐  ┌─────────────────────────────────┐  │
│  │ Settings Panel   │  │   ConfirmationDialog Modal      │  │
│  │ (Configuration)  │  │   - DiffViewer                  │  │
│  │                  │  │   - ActionPreview               │  │
│  └──────────────────┘  │   - Approve/Reject Buttons      │  │
│                        └─────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   API Routes    │
                    │  /api/agents/   │
                    │  - confirm      │
                    │  - reject       │
                    │  - pending      │
                    └────────┬────────┘
                             │
         ┌───────────────────┴───────────────────┐
         │                                       │
┌────────▼──────────┐              ┌────────────▼─────────────┐
│ ConfirmationService│              │      Agent Framework     │
│  - requestConfirm │              │  - executeToolCall       │
│  - awaitConfirm   │◄─────────────┤  - Tool Definitions      │
│  - approve/reject │              │  - Event Emitter         │
│  - bulkApprove    │              └──────────────────────────┘
└───────────────────┘
```

### Event Flow

```
1. Agent attempts tool execution
   └─► Agent.executeToolCall(toolName, args)

2. Check if confirmation required
   └─► if (tool.requiresConfirmation) { ... }

3. Create action preview
   └─► Generate diff, explanation, metadata

4. Request confirmation
   └─► confirmationService.requestConfirmation(agentId, actionPreview)

5. Emit event to UI
   └─► agent.emit('confirmation_required', confirmationRequest)

6. UI displays modal
   └─► ConfirmationDialog renders with ActionPreview

7. User makes decision
   ├─► Click "Approve" → API: POST /api/agents/:id/confirm
   └─► Click "Reject" → API: POST /api/agents/:id/reject

8. API calls service
   ├─► confirmationService.approve(requestId)
   └─► confirmationService.reject(requestId)

9. Service resolves promise
   └─► awaitConfirmation() promise resolves/rejects

10. Agent continues execution
    ├─► Approved: Execute tool.execute(args)
    └─► Rejected: Throw error, abort execution
```

### State Management

#### Confirmation Lifecycle

```
PENDING ──┬─► APPROVED ──► EXECUTED
          │
          ├─► REJECTED ──► ABORTED
          │
          └─► EXPIRED ──► TIMEOUT ERROR
```

#### Timeout Handling

- Default timeout: **5 minutes** (300,000 ms)
- Configurable per request
- Auto-cleanup of expired requests (if enabled)
- `confirmation_expired` event emitted on timeout

---

## Examples & Use Cases

### Use Case 1: Safe Database Migration

**Scenario**: Agent generates and applies a database migration script.

**Implementation**:
```typescript
const migrationTool: ToolDefinition = {
  name: 'apply_migration',
  description: 'Apply database migration script',
  requiresConfirmation: true, // ✅ Require confirmation

  parameters: {
    type: 'object',
    properties: {
      migration_name: { type: 'string' },
      sql_script: { type: 'string' },
      current_schema: { type: 'string' }, // For diff preview
    },
  },

  async execute(args) {
    // This only runs after user approval
    await db.runMigration(args.sql_script);
    return { success: true, migration: args.migration_name };
  },
};
```

**User Experience**:
1. Agent proposes migration: "Add user_preferences table"
2. Dialog shows SQL diff:
   ```diff
   + CREATE TABLE user_preferences (
   +   id SERIAL PRIMARY KEY,
   +   user_id INTEGER REFERENCES users(id),
   +   theme VARCHAR(20) DEFAULT 'dark',
   +   created_at TIMESTAMP DEFAULT NOW()
   + );
   ```
3. User reviews and approves ✅
4. Migration executes safely

### Use Case 2: Bulk Code Refactoring

**Scenario**: Agent refactors 10 files to use a new API pattern.

**Implementation**:
```typescript
// Enable bulk approval in settings
const settings = {
  bulkApprovalMode: true,
  requireConfirmation: true,
};

// Agent generates 10 file edits
for (const file of filesToRefactor) {
  await agent.executeTool('file_edit', {
    file_path: file.path,
    old_content: file.current,
    new_content: file.refactored,
  });
}
```

**User Experience**:
1. Dialog shows all 10 pending changes
2. User scrolls through previews, verifies pattern is consistent
3. Clicks "Approve All (10)" for bulk approval
4. All files updated simultaneously

### Use Case 3: Configuration File Update

**Scenario**: Agent updates environment configuration.

**Implementation**:
```typescript
await agent.executeTool('file_edit', {
  file_path: '.env.production',
  old_content: 'API_URL=http://staging.example.com',
  new_content: 'API_URL=https://production.example.com',
});
```

**User Experience**:
1. Dialog shows: "Update production API endpoint"
2. Risk level: 🟡 Medium
3. Diff preview shows environment variable change
4. User approves specific change
5. Only that file is updated

### Use Case 4: Emergency Rollback

**Scenario**: User needs to reject a destructive operation quickly.

**User Experience**:
1. Agent proposes: "Delete all temporary cache files"
2. Dialog shows: `file_delete` on `/cache/*`
3. User realizes critical files might be affected
4. Presses `Esc` to close dialog (rejects)
5. Agent operation aborted, no files deleted

---

## Troubleshooting

### Common Issues

#### 1. Confirmation Dialog Not Appearing

**Symptoms**: Agent executes tools without showing confirmation dialog.

**Possible Causes**:
- ✅ Check Settings: `Require Confirmation` might be disabled
- ✅ Check Tool Definition: Tool might not have `requiresConfirmation: true`
- ✅ Check Event Listener: React component might not be listening for `confirmation_required`

**Solution**:
```typescript
// 1. Verify settings
Settings → Advanced → Agent Safety & Confirmation
✅ Enable "Require Confirmation"

// 2. Verify tool definition
const myTool: ToolDefinition = {
  requiresConfirmation: true, // ← Must be set
  // ...
};

// 3. Verify event listener
useEffect(() => {
  agent.on('confirmation_required', handleConfirmation);
  return () => agent.off('confirmation_required', handleConfirmation);
}, [agent]);
```

#### 2. "Maximum Pending Confirmations Reached" Error

**Symptoms**: Error message when agent tries to request confirmation.

**Cause**: More than 50 pending confirmations queued.

**Solution**:
1. Approve or reject existing confirmations
2. Increase limit in service initialization:
   ```typescript
   const confirmationService = new ConfirmationService({
     maxPendingConfirmations: 100, // Increase from default 50
   });
   ```

#### 3. Confirmation Timeout

**Symptoms**: Action fails with "Confirmation request expired" error.

**Cause**: User didn't respond within 5-minute timeout.

**Solution**:
1. Increase timeout for long-running reviews:
   ```typescript
   confirmationService.requestConfirmation(agentId, action, {
     timeout: 600000, // 10 minutes
   });
   ```
2. Or disable timeout:
   ```typescript
   confirmationService.requestConfirmation(agentId, action, {
     timeout: 0, // No timeout
   });
   ```

#### 4. Diff Not Showing

**Symptoms**: Confirmation dialog shows action but no diff preview.

**Cause**: Tool arguments don't include `old_content` and `new_content`.

**Solution**:
```typescript
// ❌ Bad: No diff preview
await agent.executeTool('file_edit', {
  file_path: 'config.ts',
  content: newContent, // Only new content
});

// ✅ Good: Diff preview included
await agent.executeTool('file_edit', {
  file_path: 'config.ts',
  old_content: currentContent, // Include old content
  new_content: newContent,      // And new content
});
```

#### 5. Bulk Approve Button Not Visible

**Symptoms**: "Approve All" button doesn't appear with multiple actions.

**Cause**: Bulk approval mode disabled or no bulk-approvable actions.

**Solution**:
1. Enable in settings: `Settings → Advanced → Bulk Approval Mode`
2. Ensure actions are marked bulk-approvable:
   ```typescript
   confirmationService.requestConfirmation(agentId, action, {
     bulkApprovable: true, // ← Must be true
   });
   ```
3. Check ConfirmationDialog props:
   ```typescript
   <ConfirmationDialog
     bulkApprovalEnabled={true} // ← Must be true
     // ...
   />
   ```

### Debug Mode

Enable detailed logging for troubleshooting:

```typescript
// In ConfirmationService
confirmationService.on('confirmation_required', (event) => {
  console.log('[Confirmation] Required:', event);
});

confirmationService.on('confirmation_approved', (event) => {
  console.log('[Confirmation] Approved:', event);
});

confirmationService.on('confirmation_rejected', (event) => {
  console.log('[Confirmation] Rejected:', event);
});

confirmationService.on('confirmation_expired', (event) => {
  console.log('[Confirmation] Expired:', event);
});
```

### Getting Help

If you encounter issues not covered here:

1. **Check Logs**: Review browser console and server logs
2. **Verify Configuration**: Ensure all settings are correctly set
3. **Test in Isolation**: Try with a simple tool to isolate the issue
4. **Check Integration Tests**: Run `npm run test:integration -- agent-confirmation.test.ts`
5. **File an Issue**: Include error messages, logs, and reproduction steps

---

## FAQ

### General Questions

**Q: Does confirmation work with all tools?**
A: Only tools marked with `requiresConfirmation: true`. Read-only tools typically don't need confirmation.

**Q: Can I disable confirmation globally?**
A: Yes, go to Settings → Advanced → Agent Safety & Confirmation and toggle off "Require Confirmation".

**Q: What happens if I close the dialog without approving?**
A: The action is aborted and the agent receives a rejection error.

**Q: Can I approve actions programmatically?**
A: Yes, use the API: `POST /api/agents/:id/confirm` with the request ID.

**Q: Does confirmation affect performance?**
A: Minimal overhead (~10ms) for confirmation check. The main delay is waiting for user input.

### Security Questions

**Q: Can an agent bypass confirmation?**
A: No. Confirmation is enforced at the framework level before tool execution.

**Q: Are confirmations logged?**
A: Yes, all approval/rejection events are emitted and can be logged for audit trails.

**Q: Can I set different confirmation rules for different agents?**
A: Yes, configure `ConfirmationService` per agent instance with custom settings.

**Q: What's the recommended timeout for production?**
A: 5 minutes (default) for interactive use. Longer (10-30 min) for code reviews.

### Advanced Questions

**Q: Can I create custom risk assessment logic?**
A: Yes, override `assessRiskLevel()` in your Agent subclass or tool metadata.

**Q: How do I handle confirmation in headless/CI environments?**
A: Disable confirmation or use auto-approve mode. Set `requireConfirmation: false` in settings.

**Q: Can I show custom UI instead of the default dialog?**
A: Yes, listen for `confirmation_required` events and render your own component.

**Q: How do I test confirmation workflows?**
A: See `tests/integration/agent-confirmation.test.ts` for examples.

---

## Appendix

### Related Documentation

- [Agent Framework Core](../src/lib/agent-framework/README.md)
- [Tool Development Guide](../docs/TOOL_DEVELOPMENT.md)
- [Settings Management](../docs/SETTINGS.md)
- [E2E Testing](../docs/testing/E2E_TEST_PLAN.md)

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-14 | Initial release with full confirmation workflow |

### Contributing

To contribute improvements to the confirmation feature:

1. Read the [Contributing Guide](../CONTRIBUTING.md)
2. Review existing type definitions in `src/types/agent-confirmation.ts`
3. Follow patterns from `ConfirmationService` and `ConfirmationDialog`
4. Add tests to `tests/integration/agent-confirmation.test.ts`
5. Update this documentation with your changes

---

**Document Maintainers**: VibeCode Core Team
**Last Updated**: 2026-02-14
**Feedback**: [Open an issue](https://github.com/vibecode/vibecode/issues) with feedback or questions
