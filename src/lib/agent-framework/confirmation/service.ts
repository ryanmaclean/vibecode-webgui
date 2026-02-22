// Confirmation Service - Manages approval workflow for agent actions
// Provides confirmation request, approval, rejection, and bulk approval functionality

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';
import { prisma } from '../../prisma';
import type { ConfirmationRequest as PrismaConfirmationRequest } from '@prisma/client';
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
 * Helper function to map Prisma ConfirmationRequest to TypeScript ConfirmationRequest
 */
function mapPrismaToConfirmationRequest(
  prismaRequest: PrismaConfirmationRequest
): ConfirmationRequest {
  const metadata = prismaRequest.metadata as {
    action?: ActionPreview;
    bulk_approvable?: boolean;
  } | null;

  return {
    request_id: prismaRequest.request_id,
    agent_id: prismaRequest.agent_id,
    action: metadata?.action ?? {
      action_id: '',
      action_type: 'file_write',
      tool_name: 'unknown',
      explanation: '',
      created_at: prismaRequest.created_at.toISOString(),
    },
    status: prismaRequest.status as ConfirmationStatus,
    created_at: prismaRequest.created_at.toISOString(),
    expires_at: prismaRequest.expires_at?.toISOString() ?? null,
    bulk_approvable: metadata?.bulk_approvable ?? true,
    risk_level: prismaRequest.risk_level as 'low' | 'medium' | 'high' | undefined,
  };
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
  async requestConfirmation(
    agentId: string,
    action: ActionPreview,
    options: {
      timeout?: number;
      bulkApprovable?: boolean;
      riskLevel?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<ConfirmationRequest> {
    // Check if we've reached max pending confirmations
    const pendingCount = await prisma.confirmationRequest.count({
      where: { status: 'pending' },
    });

    if (pendingCount >= this.maxPendingConfirmations) {
      throw new Error(
        `Maximum pending confirmations (${this.maxPendingConfirmations}) reached. ` +
        'Please approve or reject existing confirmations first.'
      );
    }

    const requestId = randomUUID();
    const now = new Date();
    const timeout = options.timeout ?? this.defaultTimeout;
    const expiresAt = timeout > 0
      ? new Date(Date.now() + timeout)
      : new Date(Date.now() + this.defaultTimeout);

    // Store confirmation request in database
    const prismaRequest = await prisma.confirmationRequest.create({
      data: {
        id: randomUUID(),
        request_id: requestId,
        agent_id: agentId,
        action_type: action.action_type,
        file_path: action.file_path,
        status: 'pending',
        risk_level: options.riskLevel ?? 'medium',
        metadata: {
          action,
          bulk_approvable: options.bulkApprovable ?? true,
        },
        created_at: now,
        expires_at: expiresAt,
      },
    });

    const request = mapPrismaToConfirmationRequest(prismaRequest);

    // Emit confirmation required event
    const event: ConfirmationRequiredEvent = {
      type: 'confirmation_required',
      confirmation: request,
      timestamp: now.toISOString(),
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
   * @param userId - Optional user ID who approved the request
   * @returns The confirmation response
   */
  async approve(
    requestId: string,
    comment?: string,
    userId?: number
  ): Promise<ConfirmationResponse> {
    // Get request from database
    const prismaRequest = await prisma.confirmationRequest.findUnique({
      where: { request_id: requestId },
    });

    if (!prismaRequest) {
      throw new Error(`Confirmation request ${requestId} not found`);
    }

    if (prismaRequest.status !== 'pending') {
      throw new Error(
        `Cannot approve confirmation ${requestId}: status is ${prismaRequest.status}`
      );
    }

    const now = new Date();

    // Update request status in database
    await prisma.confirmationRequest.update({
      where: { request_id: requestId },
      data: {
        status: 'approved',
        approved_at: now,
        approved_by: userId,
      },
    });

    const response: ConfirmationResponse = {
      request_id: requestId,
      agent_id: prismaRequest.agent_id,
      decision: 'approve',
      decided_at: now.toISOString(),
      comment,
    };

    // Emit approval event
    const event: ConfirmationApprovedEvent = {
      type: 'confirmation_approved',
      response,
      timestamp: now.toISOString(),
    };

    this.emit(ConfirmationEvent.ConfirmationApproved, event);

    // Resolve the Promise if it exists in pending confirmations
    const pending = this.pendingConfirmations.get(requestId);
    if (pending) {
      // Clear timeout if exists
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }

      // Resolve the Promise
      pending.resolve(response);

      // Remove from pending map
      this.pendingConfirmations.delete(requestId);
    }

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
   * @param userId - Optional user ID who rejected the request
   * @returns The confirmation response
   */
  async reject(
    requestId: string,
    comment?: string,
    userId?: number
  ): Promise<ConfirmationResponse> {
    // Get request from database
    const prismaRequest = await prisma.confirmationRequest.findUnique({
      where: { request_id: requestId },
    });

    if (!prismaRequest) {
      throw new Error(`Confirmation request ${requestId} not found`);
    }

    if (prismaRequest.status !== 'pending') {
      throw new Error(
        `Cannot reject confirmation ${requestId}: status is ${prismaRequest.status}`
      );
    }

    const now = new Date();

    // Update request status in database
    await prisma.confirmationRequest.update({
      where: { request_id: requestId },
      data: {
        status: 'rejected',
        approved_at: now,
        approved_by: userId,
      },
    });

    const response: ConfirmationResponse = {
      request_id: requestId,
      agent_id: prismaRequest.agent_id,
      decision: 'reject',
      decided_at: now.toISOString(),
      comment,
    };

    // Emit rejection event
    const event: ConfirmationRejectedEvent = {
      type: 'confirmation_rejected',
      response,
      timestamp: now.toISOString(),
    };

    this.emit(ConfirmationEvent.ConfirmationRejected, event);

    // Reject the Promise if it exists in pending confirmations
    const pending = this.pendingConfirmations.get(requestId);
    if (pending) {
      // Clear timeout if exists
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }

      // Reject the Promise
      pending.reject(new Error('Confirmation request was rejected by user'));

      // Remove from pending map
      this.pendingConfirmations.delete(requestId);
    }

    return response;
  }

  /**
   * Approve multiple confirmation requests at once
   *
   * Processes multiple approvals in a single operation.
   * Only approves requests that are bulk_approvable.
   *
   * @param request - Bulk approval request with request IDs and optional comment
   * @param userId - Optional user ID who approved the requests
   * @returns Bulk approval response with results for each request
   */
  async bulkApprove(
    request: BulkApprovalRequest,
    userId?: number
  ): Promise<BulkApprovalResponse> {
    const results: ConfirmationResponse[] = [];
    let approvedCount = 0;
    let failedCount = 0;

    for (const requestId of request.request_ids) {
      try {
        // Get request from database
        const confirmationRequest = await this.getConfirmationRequest(requestId);

        if (!confirmationRequest) {
          failedCount++;
          continue;
        }

        // Check if request is bulk approvable
        if (!confirmationRequest.bulk_approvable) {
          failedCount++;
          continue;
        }

        const response = await this.approve(requestId, request.comment, userId);
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
   * @param options - Query options
   * @returns Array of pending confirmation requests
   */
  async getPendingConfirmations(options: {
    agentId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<ConfirmationRequest[]> {
    const limit = options.limit ?? 50;
    const offset = options.offset ?? 0;

    // Build where clause
    const where: {
      status: string;
      agent_id?: string;
    } = {
      status: 'pending',
    };

    if (options.agentId) {
      where.agent_id = options.agentId;
    }

    const prismaRequests = await prisma.confirmationRequest.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    });

    return prismaRequests.map(mapPrismaToConfirmationRequest);
  }

  /**
   * Get a specific confirmation request by ID
   *
   * @param requestId - ID of the confirmation request
   * @returns The confirmation request, or undefined if not found
   */
  async getConfirmationRequest(requestId: string): Promise<ConfirmationRequest | undefined> {
    const prismaRequest = await prisma.confirmationRequest.findUnique({
      where: { request_id: requestId },
    });

    if (!prismaRequest) {
      return undefined;
    }

    return mapPrismaToConfirmationRequest(prismaRequest);
  }

  /**
   * Clear all pending confirmations
   *
   * Marks all pending confirmations as expired and rejects pending Promises.
   */
  async clearPendingConfirmations(): Promise<number> {
    // Update all pending confirmations to expired in database
    const result = await prisma.confirmationRequest.updateMany({
      where: { status: 'pending' },
      data: { status: 'expired' },
    });

    // Clear all pending Promises
    for (const [requestId, pending] of this.pendingConfirmations.entries()) {
      if (pending.timeoutId) {
        clearTimeout(pending.timeoutId);
      }

      pending.reject(new Error('Pending confirmations were cleared'));
    }

    this.pendingConfirmations.clear();

    return result.count;
  }

  /**
   * Handle timeout for a confirmation request
   *
   * @param requestId - ID of the confirmation request that timed out
   */
  private async handleTimeout(requestId: string): Promise<void> {
    // Update status to expired in database
    try {
      await prisma.confirmationRequest.update({
        where: { request_id: requestId },
        data: { status: 'expired' },
      });
    } catch (error) {
      // Request may have already been approved/rejected
      return;
    }

    const pending = this.pendingConfirmations.get(requestId);

    if (!pending) {
      return;
    }

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
   * @param agentId - Optional agent ID to filter by
   * @returns Number of pending confirmation requests
   */
  async getPendingCount(agentId?: string): Promise<number> {
    const where: {
      status: string;
      agent_id?: string;
    } = {
      status: 'pending',
    };

    if (agentId) {
      where.agent_id = agentId;
    }

    return prisma.confirmationRequest.count({ where });
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
