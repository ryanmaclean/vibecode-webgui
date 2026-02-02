/**
 * Agent Identity & Coordination Protocol
 * Issue #887: Define agent identity, capabilities, and coordination messaging
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Unique agent identity with capabilities
 */
export interface AgentIdentity {
  id: string;
  name: string;
  type: AgentType;
  version: string;
  capabilities: string[];
  status: AgentStatus;
  createdAt: Date;
  lastHeartbeat: Date;
  metadata: Record<string, unknown>;
}

export type AgentType =
  | 'orchestrator'
  | 'worker'
  | 'specialist'
  | 'monitor'
  | 'gateway';

export type AgentStatus =
  | 'initializing'
  | 'ready'
  | 'busy'
  | 'paused'
  | 'error'
  | 'terminated';

/**
 * Coordination message between agents
 */
export interface CoordinationMessage {
  id: string;
  type: MessageType;
  senderId: string;
  recipientId: string | 'broadcast';
  payload: unknown;
  timestamp: Date;
  correlationId?: string;
  ttl?: number;
}

export type MessageType =
  | 'heartbeat'
  | 'task_request'
  | 'task_response'
  | 'status_update'
  | 'capability_query'
  | 'capability_response'
  | 'error'
  | 'shutdown';

/**
 * Create a new agent identity
 */
export function createAgentIdentity(
  name: string,
  type: AgentType,
  capabilities: string[] = []
): AgentIdentity {
  return {
    id: uuidv4(),
    name,
    type,
    version: '1.0.0',
    capabilities,
    status: 'initializing',
    createdAt: new Date(),
    lastHeartbeat: new Date(),
    metadata: {},
  };
}

/**
 * Create a coordination message
 */
export function createMessage(
  type: MessageType,
  senderId: string,
  recipientId: string | 'broadcast',
  payload: unknown,
  correlationId?: string
): CoordinationMessage {
  return {
    id: uuidv4(),
    type,
    senderId,
    recipientId,
    payload,
    timestamp: new Date(),
    correlationId,
  };
}

/**
 * Agent registry for tracking active agents
 */
export class AgentRegistry {
  private agents: Map<string, AgentIdentity> = new Map();

  register(agent: AgentIdentity): void {
    this.agents.set(agent.id, agent);
  }

  unregister(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  get(agentId: string): AgentIdentity | undefined {
    return this.agents.get(agentId);
  }

  findByCapability(capability: string): AgentIdentity[] {
    return Array.from(this.agents.values()).filter(
      agent => agent.capabilities.includes(capability) && agent.status === 'ready'
    );
  }

  findByType(type: AgentType): AgentIdentity[] {
    return Array.from(this.agents.values()).filter(
      agent => agent.type === type
    );
  }

  updateHeartbeat(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastHeartbeat = new Date();
    }
  }

  updateStatus(agentId: string, status: AgentStatus): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = status;
    }
  }

  getAll(): AgentIdentity[] {
    return Array.from(this.agents.values());
  }
}

export const globalAgentRegistry = new AgentRegistry();
