/**
 * Protocol Layer Index
 * MCP and AgentAPI protocol implementations
 * @module protocols
 */

// MCP Protocol
export * from './mcp-client';
export { createMCPClient } from './mcp-client';

// AgentAPI Protocol
export * from './agentapi-client';
export { createAgentAPIClient, getDefaultAgentAPIClient, setDefaultAgentAPIClient } from './agentapi-client';

// Agent Adapters
export * from './adapters';

// Protocol Negotiation
export * from './negotiation';
export {
  createProtocolDetector,
  createProtocolNegotiator,
  createCapabilityMatcher,
  createVersionChecker,
} from './negotiation';

// Re-export agent-api types
export * from '@/types/agent-api';
