/**
 * Type definitions for integrating OpenAI Agent Builder workflows.
 * These abstractions intentionally avoid leaking raw SDK types into the app layer.
 */

export type AgentBuilderStateValue = string | number | boolean;

/**
 * Payload expected when requesting a ChatKit session for a published workflow.
 */
export interface AgentBuilderSessionRequest {
  workflowId: string;
  version?: string;
  /**
   * Optional state variables exposed by Agent Builder workflows.
   * Keys must respect OpenAI constraints (<=64 chars) and values must be primitives.
   */
  stateVariables?: Record<string, AgentBuilderStateValue>;
  /**
   * Optional override for session expiration. Defaults to the ChatKit baseline (10 minutes).
   */
  expiresInSeconds?: number;
  /**
   * Optional override for per-minute rate limiting. Defaults to 10 in ChatKit.
   */
  rateLimitPerMinute?: number;
  /**
   * Session-scoped ChatKit configuration overrides.
   */
  chatkit?: {
    automaticThreadTitling?: {
      enabled?: boolean;
    };
    uploads?: {
      enabled?: boolean;
      maxFiles?: number;
      maxFileSizeMB?: number;
    };
    history?: {
      enabled?: boolean;
      recentThreads?: number | null;
    };
  };
}

/**
 * Normalised representation of a ChatKit session created for Agent Builder workflows.
 */
export interface AgentBuilderSession {
  sessionId: string;
  clientSecret: string;
  expiresAt: number;
  status: 'active' | 'expired' | 'cancelled';
  workflow: {
    id: string;
    version?: string | null;
  };
  maxRequestsPerMinute: number;
}

