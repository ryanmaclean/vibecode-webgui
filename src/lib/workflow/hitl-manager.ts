/**
 * Human-in-the-Loop Workflow Management
 * Issue #889: Approval workflows and escalation handling
 */

/**
 * Approval request status
 */
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'escalated' | 'expired';

/**
 * Approval request for human review
 */
export interface ApprovalRequest {
  id: string;
  type: ApprovalType;
  title: string;
  description: string;
  agentId: string;
  taskId: string;
  payload: unknown;
  status: ApprovalStatus;
  priority: 'low' | 'medium' | 'high' | 'critical';
  requiredApprovers: string[];
  approvals: Approval[];
  createdAt: Date;
  expiresAt: Date;
  escalationChain: string[];
  currentEscalationLevel: number;
}

export type ApprovalType =
  | 'code_change'
  | 'deployment'
  | 'data_access'
  | 'cost_threshold'
  | 'security_action'
  | 'external_api'
  | 'custom';

/**
 * Individual approval decision
 */
export interface Approval {
  approverId: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  timestamp: Date;
}

/**
 * Escalation configuration
 */
export interface EscalationConfig {
  timeoutMinutes: number;
  maxEscalations: number;
  escalationChain: string[];
  notifyOnEscalation: boolean;
}

/**
 * HITL Manager - Manages human approval workflows
 */
export class HITLManager {
  private requests: Map<string, ApprovalRequest> = new Map();
  private defaultEscalationConfig: EscalationConfig = {
    timeoutMinutes: 30,
    maxEscalations: 3,
    escalationChain: [],
    notifyOnEscalation: true,
  };

  /**
   * Create a new approval request
   */
  createRequest(params: {
    type: ApprovalType;
    title: string;
    description: string;
    agentId: string;
    taskId: string;
    payload: unknown;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    requiredApprovers: string[];
    expiresInMinutes?: number;
    escalationChain?: string[];
  }): ApprovalRequest {
    const id = `approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const expiresInMinutes = params.expiresInMinutes || this.defaultEscalationConfig.timeoutMinutes;

    const request: ApprovalRequest = {
      id,
      type: params.type,
      title: params.title,
      description: params.description,
      agentId: params.agentId,
      taskId: params.taskId,
      payload: params.payload,
      status: 'pending',
      priority: params.priority || 'medium',
      requiredApprovers: params.requiredApprovers,
      approvals: [],
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + expiresInMinutes * 60 * 1000),
      escalationChain: params.escalationChain || this.defaultEscalationConfig.escalationChain,
      currentEscalationLevel: 0,
    };

    this.requests.set(id, request);
    return request;
  }

  /**
   * Submit an approval decision
   */
  submitApproval(
    requestId: string,
    approverId: string,
    decision: 'approved' | 'rejected',
    comment?: string
  ): ApprovalRequest | null {
    const request = this.requests.get(requestId);
    if (!request || request.status !== 'pending') {
      return null;
    }

    // Verify approver is authorized
    if (!request.requiredApprovers.includes(approverId)) {
      return null;
    }

    // Add approval
    request.approvals.push({
      approverId,
      decision,
      comment,
      timestamp: new Date(),
    });

    // Check if we have enough approvals
    const approvedCount = request.approvals.filter(a => a.decision === 'approved').length;
    const rejectedCount = request.approvals.filter(a => a.decision === 'rejected').length;

    if (rejectedCount > 0) {
      request.status = 'rejected';
    } else if (approvedCount >= request.requiredApprovers.length) {
      request.status = 'approved';
    }

    return request;
  }

  /**
   * Escalate a pending request
   */
  escalate(requestId: string): ApprovalRequest | null {
    const request = this.requests.get(requestId);
    if (!request || request.status !== 'pending') {
      return null;
    }

    if (request.currentEscalationLevel >= request.escalationChain.length) {
      request.status = 'expired';
      return request;
    }

    request.currentEscalationLevel++;
    const newApprover = request.escalationChain[request.currentEscalationLevel - 1];
    if (newApprover && !request.requiredApprovers.includes(newApprover)) {
      request.requiredApprovers.push(newApprover);
    }
    request.status = 'escalated';

    return request;
  }

  /**
   * Get pending requests for an approver
   */
  getPendingForApprover(approverId: string): ApprovalRequest[] {
    return Array.from(this.requests.values()).filter(
      r => r.status === 'pending' && r.requiredApprovers.includes(approverId)
    );
  }

  /**
   * Get request by ID
   */
  getRequest(requestId: string): ApprovalRequest | undefined {
    return this.requests.get(requestId);
  }

  /**
   * Check for expired requests and handle them
   */
  processExpiredRequests(): ApprovalRequest[] {
    const now = new Date();
    const expired: ApprovalRequest[] = [];

    this.requests.forEach(request => {
      if (request.status === 'pending' && request.expiresAt < now) {
        // Try to escalate first
        const escalated = this.escalate(request.id);
        if (escalated && escalated.status === 'expired') {
          expired.push(escalated);
        }
      }
    });

    return expired;
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    escalated: number;
  } {
    const requests = Array.from(this.requests.values());
    return {
      total: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      rejected: requests.filter(r => r.status === 'rejected').length,
      escalated: requests.filter(r => r.status === 'escalated').length,
    };
  }
}

export const globalHITLManager = new HITLManager();
