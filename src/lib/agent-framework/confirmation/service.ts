// Confirmation Service - Manages approval workflow for agent actions
// Provides confirmation request, approval, rejection, and bulk approval functionality

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import type {
  ConfirmationRequest,
  ConfirmationResponse,
  ConfirmationStatus,
  ActionPreview,
  BulkApprovalRequest,
  BulkApprovalResponse,
  ConfirmationRequiredEvent,
  ConfirmationApprovedEvent,
  ConfirmationRejectedEvent,
} from '../../../types/agent-confirmation';

// Event types
export enum ConfirmationEvent {
  ConfirmationRequired = 'confirmation_required',
  ConfirmationApproved = 'confirmation_approved',
  ConfirmationRejected = 'confirmation_rejected',
  ConfirmationExpired = 'confirmation_expired',
}

export interface ConfirmationServiceOptions {
  /** Default timeout for confirmation requests in milliseconds */
  defaultTimeout?: number;

  /** Maximum number of pending confirmations to store */
  maxPendingConfirmations?: number;

  /** Whether to auto-cleanup expired confirmations */
  autoCleanupExpired?: boolean;
}

/**
 * Internal confirmation request with Promise resolvers
 */
interface PendingConfirmation {
  request: ConfirmationRequest;
  resolve: (response: ConfirmationResponse) => void;
  reject: (error: Error) => void;
  timeoutId?: NodeJS.Timeout;
}

/**
 * Confirmation Service for managing approval workflow
 *
 * Handles queuing actions for approval, waiting for user decisions,
 * and processing approve/reject/bulk approve operations.
 */
export class ConfirmationService extends EventEmitter {
  private pendingConfirmations: Map<string, PendingConfirmation>;
  private defaultTimeout: number;
  private maxPendingConfirmations: number;
  private autoCleanupExpired: boolean;

  constructor(options: ConfirmationServiceOptions = {}) {
    super();

    this.pendingConfirmations = new Map();
    this.defaultTimeout = options.defaultTimeout ?? 300000; // 5 minutes default
    this.maxPendingConfirmations = options.maxPendingConfirmations ?? 50;
    this.autoCleanupExpired = options.autoCleanupExpired ?? true;
  }

  /**
   * Request confirmation for an action
   *
   * Creates a confirmation request and adds it to the pending queue.
   * Emits a ConfirmationRequired event.
   *
   * @param agentId - ID of the agent requesting confirmation
   * @param action - Preview of the action requiring approval
   * @param options - Additional options for this request
   * @returns The created confirmation request
   */
  requestConfirmation(
    agentId: string,
    action: ActionPreview,
    options: {
      timeout?: number;
      bulkApprovable?: boolean;
      riskLevel?: 'low' | 'medium' | 'high';
    } = {}
  ): ConfirmationRequest {
    // Check if we've reached max pending confirmations
    if (this.pendingConfirmations.size >= this.maxPendingConfirmations) {
      throw new Error(
        `Maximum pending confirmations (${this.maxPendingConfirmations}) reached. ` +
        'Please approve or reject existing confirmations first.'
      );
    }

    const requestId = randomUUID();
    const now = new Date().toISOString();
    const timeout = options.timeout ?? this.defaultTimeout;
    const expiresAt = timeout > 0
      ? new Date(Date.now() + timeout).toISOString()
      : null;

    const request: ConfirmationRequest = {
      request_id: requestId,
      agent_id: agentId,
      action,
      status: 'pending',
      created_at: now,
      expires_at: expiresAt,
      bulk_approvable: options.bulkApprovable ?? true,
      risk_level: options.riskLevel,
    };

    // Emit confirmation required event
    const event: ConfirmationRequiredEvent = {
      type: 'confirmation_required',
      confirmation: request,
      timestamp: now,
    };

    this.emit(ConfirmationEvent.ConfirmationRequired, event);

    return request;
  }

  /**
   * Wait for user decision on a confirmation request
   *
   * Returns a Promise that resolves when the user approves or rejects,
   * or rejects if the request times out.
   *
   * @param requestId - ID of the confirmation request
   * @returns Promise that resolves with the confirmation response
   */
  async awaitConfirmation(requestId: string): Promise<ConfirmationResponse> {
    const pending = this.pendingConfirmations.get(requestId);

    if (!pending) {
      // If not in pending map, create a new pending entry
      const request = await this.getConfirmationRequest(requestId);

      if (!request) {
        throw new Error(`Confirmation request ${requestId} not found`);
      }

      if (request.status !== 'pending') {
        throw new Error(
          `Confirmation request ${requestId} is not pending (status: ${request.status})`
        );
      }

      return new Promise((resolve, reject) => {
        const pendingConfirmation: PendingConfirmation = {
          request,
          resolve,
          reject,
        };

        // Set up timeout if configured
        if (request.expires_at) {
          const expiresAt = new Date(request.expires_at).getTime();
          const timeoutMs = expiresAt - Date.now();

          if (timeoutMs > 0) {
            pendingConfirmation.timeoutId = setTimeout(() => {
              this.handleTimeout(requestId);
            }, timeoutMs);
          } else {
            // Already expired
            reject(new Error(`Confirmation request ${requestId} has expired`));
            return;
          }
        }

        this.pendingConfirmations.set(requestId, pendingConfirmation);
      });
    }

    // Return existing Promise
    return new Promise((resolve, reject) => {
      const existingResolve = pending.resolve;
      const existingReject = pending.reject;

      pending.resolve = (response) => {
        existingResolve(response);
        resolve(response);
      };

      pending.reject = (error) => {
        existingReject(error);
        reject(error);
      };
    });
  }

  /**
   * Approve a confirmation request
   *
   * Marks the request as approved and resolves any pending Promises.
   * Emits a ConfirmationApproved event.
   *
   * @param requestId - ID of the confirmation request to approve
   * @param comment - Optional comment about the approval
   * @returns The confirmation response
   */
  async approve(
    requestId: string,
    comment?: string
  ): Promise<ConfirmationResponse> {
    const pending = this.pendingConfirmations.get(requestId);

    if (!pending) {
      throw new Error(`Confirmation request ${requestId} not found in pending queue`);
    }

    if (pending.request.status !== 'pending') {
      throw new Error(
        `Cannot approve confirmation ${requestId}: status is ${pending.request.status}`
      );
    }

    // Clear timeout if exists
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    // Update request status
    pending.request.status = 'approved';

    const response: ConfirmationResponse = {
      request_id: requestId,
      agent_id: pending.request.agent_id,
      decision: 'approve',
      decided_at: new Date().toISOString(),
      comment,
    };

    // Emit approval event
    const event: ConfirmationApprovedEvent = {
      type: 'confirmation_approved',
      response,
      timestamp: new Date().toISOString(),
    };

    this.emit(ConfirmationEvent.ConfirmationApproved, event);

    // Resolve the Promise
    pending.resolve(response);

    // Remove from pending map
    this.pendingConfirmations.delete(requestId);

    return response;
  }

  /**
   * Reject a confirmation request
   *
   * Marks the request as rejected and rejects any pending Promises.
   * Emits a ConfirmationRejected event.
   *
   * @param requestId - ID of the confirmation request to reject
   * @param comment - Optional comment about the rejection
   * @returns The confirmation response
   */
  async reject(
    requestId: string,
    comment?: string
  ): Promise<ConfirmationResponse> {
    const pending = this.pendingConfirmations.get(requestId);

    if (!pending) {
      throw new Error(`Confirmation request ${requestId} not found in pending queue`);
    }

    if (pending.request.status !== 'pending') {
      throw new Error(
        `Cannot reject confirmation ${requestId}: status is ${pending.request.status}`
      );
    }

    // Clear timeout if exists
    if (pending.timeoutId) {
      clearTimeout(pending.timeoutId);
    }

    // Update request status
    pending.request.status = 'rejected';

    const response: ConfirmationResponse = {
      request_id: requestId,
      agent_id: pending.request.agent_id,
      decision: 'reject',
      decided_at: new Date().toISOString(),
      comment,
    };

    // Emit rejection event
    const event: ConfirmationRejectedEvent = {
      type: 'confirmation_rejected',
      response,
      timestamp: new Date().toISOString(),
    };

    this.emit(ConfirmationEvent.ConfirmationRejected, event);

    // Reject the Promise
    pending.reject(new Error('Confirmation request was rejected by user'));

    // Remove from pending map
    this.pendingConfirmations.delete(requestId);

    return response;
  }

  /**
   * Approve multiple confirmation requests at once
   *
   * Processes multiple approvals in a single operation.
   * Only approves requests that are bulk_approvable.
   *
   * @param request - Bulk approval request with request IDs and optional comment
   * @returns Bulk approval response with results for each request
   */
  async bulkApprove(request: BulkApprovalRequest): Promise<BulkApprovalResponse> {
    const results: ConfirmationResponse[] = [];
    let approvedCount = 0;
    let failedCount = 0;

    for (const requestId of request.request_ids) {
      try {
        const pending = this.pendingConfirmations.get(requestId);

        if (!pending) {
          failedCount++;
          continue;
        }

        // Check if request is bulk approvable
        if (!pending.request.bulk_approvable) {
          failedCount++;
          continue;
        }

        const response = await this.approve(requestId, request.comment);
        results.push(response);
        approvedCount++;
      } catch (error) {
        failedCount++;
        // Continue processing other requests
      }
    }

    return {
      approved_count: approvedCount,
      failed_count: failedCount,
      results,
      success: failedCount === 0,
    };
  }

  /**
   * Get all pending confirmation requests
   *
   * @returns Array of pending confirmation requests
   */
  getPendingConfirmations(): ConfirmationRequest[] {
    return Array.from(this.pendingConfirmations.values())
      .map(pending => pending.request)
      .filter(request => request.status === 'pending');
  }

  /**
   * Get a specific confirmation request by ID
   *
   * @param requestId - ID of the confirmation request
   * @returns The confirmation request, or undefined if not found
   */
  getConfirmationRequest(requestId: string): ConfirmationRequest | undefined {
    const pending = this.pendingConfirmations.get(requestId);
    return pending?.request;
  }

  /**
   * Clear all pending confirmations
   *
   * Rejects all pending Promises and clears the queue.
   */
  clearPendingConfirmations(): void {
    for (const [requestId, pending] of this.pendingConfirmations.entries()) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }

      pending.reject(new Error('Pending confirmations were cleared'));
    }

    this.pendingConfirmations.clear();
  }

  /**
   * Handle timeout for a confirmation request
   *
   * @param requestId - ID of the confirmation request that timed out
   */
  private handleTimeout(requestId: string): void {
    const pending = this.pendingConfirmations.get(requestId);

    if (!pending) {
      return;
    }

    // Update status to expired
    pending.request.status = 'expired';

    // Emit expired event
    this.emit(ConfirmationEvent.ConfirmationExpired, {
      request_id: requestId,
      agent_id: pending.request.agent_id,
      expired_at: new Date().toISOString(),
    });

    // Reject the Promise
    pending.reject(new Error(`Confirmation request ${requestId} has expired`));

    // Remove from pending map if auto-cleanup is enabled
    if (this.autoCleanupExpired) {
      this.pendingConfirmations.delete(requestId);
    }
  }

  /**
   * Get count of pending confirmations
   *
   * @returns Number of pending confirmation requests
   */
  getPendingCount(): number {
    return this.pendingConfirmations.size;
  }
}

/**
 * Create a new confirmation service with the specified options
 */
export function createConfirmationService(
  options: ConfirmationServiceOptions = {}
): ConfirmationService {
  return new ConfirmationService(options);
}
