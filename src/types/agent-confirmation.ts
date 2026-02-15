/**
 * TypeScript type definitions for Agent Confirmation System
 * Used for preview and approval workflow before agent actions
 *
 * @see /docs/AGENT_CONFIRMATION.md
 */

// ============================================================================
// Confirmation Types
// ============================================================================

/**
 * Confirmation mode for agent actions
 */
export type ConfirmationMode = 'always' | 'never' | 'auto' | 'selective';

/**
 * Status of a confirmation request
 */
export type ConfirmationStatus = 'pending' | 'approved' | 'rejected' | 'expired';

/**
 * Type of action that requires confirmation
 */
export type ActionType =
  | 'file_write'
  | 'file_edit'
  | 'file_delete'
  | 'code_replace'
  | 'command_execute';

// ============================================================================
// Action Preview Types
// ============================================================================

/**
 * Diff information for code changes
 */
export interface DiffPreview {
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

/**
 * Preview of proposed action with metadata
 */
export interface ActionPreview {
  /** Unique identifier for this action */
  action_id: string;

  /** Type of action being performed */
  action_type: ActionType;

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

// ============================================================================
// Request Types
// ============================================================================

/**
 * Request for user confirmation before executing action
 */
export interface ConfirmationRequest {
  /** Unique identifier for this confirmation request */
  request_id: string;

  /** Agent ID that requested this action */
  agent_id: string;

  /** Preview of the action requiring approval */
  action: ActionPreview;

  /** Current status of this request */
  status: ConfirmationStatus;

  /** When this request was created (ISO 8601) */
  created_at: string;

  /** When this request will expire (ISO 8601, nullable) */
  expires_at: string | null;

  /** Whether this action can be bulk-approved with others */
  bulk_approvable: boolean;

  /** Risk level of this action (for auto-approval decisions) */
  risk_level?: 'low' | 'medium' | 'high';
}

/**
 * Request to approve or reject a confirmation
 */
export interface ConfirmationDecisionRequest {
  /** Unique identifier of the confirmation request */
  request_id: string;

  /** User's decision */
  decision: 'approve' | 'reject';

  /** Optional comment from user about their decision */
  comment?: string;
}

/**
 * Request to bulk approve multiple confirmations
 */
export interface BulkApprovalRequest {
  /** List of request IDs to approve */
  request_ids: string[];

  /** Optional comment for bulk approval */
  comment?: string;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Response after user makes a confirmation decision
 */
export interface ConfirmationResponse {
  /** Unique identifier of the confirmation request */
  request_id: string;

  /** Agent ID that requested this action */
  agent_id: string;

  /** User's decision */
  decision: 'approve' | 'reject';

  /** When the decision was made (ISO 8601) */
  decided_at: string;

  /** Optional comment from user */
  comment?: string;

  /** Whether the action was successfully executed (for approved actions) */
  executed?: boolean;

  /** Error message if execution failed */
  error?: string;
}

/**
 * Response for bulk approval operation
 */
export interface BulkApprovalResponse {
  /** Number of requests successfully approved */
  approved_count: number;

  /** Number of requests that failed to approve */
  failed_count: number;

  /** List of individual confirmation responses */
  results: ConfirmationResponse[];

  /** Overall success status */
  success: boolean;
}

/**
 * List of pending confirmation requests
 */
export interface PendingConfirmationsResponse {
  /** List of pending confirmation requests */
  confirmations: ConfirmationRequest[];

  /** Total number of pending requests */
  total: number;

  /** Whether there are more pending requests */
  has_more: boolean;
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Event emitted when confirmation is required
 */
export interface ConfirmationRequiredEvent {
  /** Event type identifier */
  type: 'confirmation_required';

  /** The confirmation request */
  confirmation: ConfirmationRequest;

  /** Timestamp when event was emitted (ISO 8601) */
  timestamp: string;
}

/**
 * Event emitted when confirmation is approved
 */
export interface ConfirmationApprovedEvent {
  /** Event type identifier */
  type: 'confirmation_approved';

  /** The confirmation response */
  response: ConfirmationResponse;

  /** Timestamp when event was emitted (ISO 8601) */
  timestamp: string;
}

/**
 * Event emitted when confirmation is rejected
 */
export interface ConfirmationRejectedEvent {
  /** Event type identifier */
  type: 'confirmation_rejected';

  /** The confirmation response */
  response: ConfirmationResponse;

  /** Timestamp when event was emitted (ISO 8601) */
  timestamp: string;
}

/**
 * Union type for all confirmation events
 */
export type ConfirmationEvent =
  | ConfirmationRequiredEvent
  | ConfirmationApprovedEvent
  | ConfirmationRejectedEvent;
