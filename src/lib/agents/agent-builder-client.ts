/**
 * Agent Builder Client
 * Thin wrapper around the OpenAI ChatKit beta endpoints to request sessions
 * for Agent Builder workflows while keeping logging & validation consistent.
 */

import OpenAI from 'openai';
import type { AgentBuilderSessionRequest, AgentBuilderSession } from '@/types/agent-builder';
// import { console } from '@/lib/logger';

const logger = createChildLogger({ module: 'agents', scope: 'agent-builder-client' });

interface AgentBuilderClientOptions {
  apiKey?: string;
  organization?: string;
}

export class AgentBuilderClient {
  private readonly client: OpenAI;

  constructor(options: AgentBuilderClientOptions = {}) {
    const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        'OpenAI API key is required. Set OPENAI_API_KEY or pass apiKey when constructing AgentBuilderClient.'
      );
    }

    this.client = new OpenAI({
      apiKey,
      organization: options.organization ?? process.env.OPENAI_ORGANIZATION,
    });
  }

  /**
   * Create a ChatKit session for a published Agent Builder workflow.
   */
  async createSession(userId: string, request: AgentBuilderSessionRequest): Promise<AgentBuilderSession> {
    console.info('Creating Agent Builder session', {
      userId,
      workflowId: request.workflowId,
      version: request.version,
    });

    try {
      const session = await this.client.beta.chatkit.sessions.create({
        user: userId,
        workflow: {
          id: request.workflowId,
          version: request.version,
          state_variables: request.stateVariables,
        },
        chatkit_configuration: request.chatkit
          ? {
              automatic_thread_titling: request.chatkit.automaticThreadTitling
                ? {
                    enabled: request.chatkit.automaticThreadTitling.enabled,
                  }
                : undefined,
              file_upload: request.chatkit.uploads
                ? {
                    enabled: request.chatkit.uploads.enabled,
                    max_files: request.chatkit.uploads.maxFiles,
                    max_file_size: request.chatkit.uploads.maxFileSizeMB,
                  }
                : undefined,
              history: request.chatkit.history
                ? {
                    enabled: request.chatkit.history.enabled,
                    recent_threads: request.chatkit.history.recentThreads ?? undefined,
                  }
                : undefined,
            }
          : undefined,
        expires_after: request.expiresInSeconds
          ? {
              anchor: 'created_at',
              seconds: request.expiresInSeconds,
            }
          : undefined,
        rate_limits: request.rateLimitPerMinute
          ? {
              max_requests_per_1_minute: request.rateLimitPerMinute,
            }
          : undefined,
      });

      return {
        sessionId: session.id,
        clientSecret: session.client_secret,
        expiresAt: session.expires_at,
        status: session.status,
        workflow: {
          id: session.workflow.id,
          version: session.workflow.version,
        },
        maxRequestsPerMinute: session.max_requests_per_1_minute,
      };
    } catch (error) {
      console.error('Failed to create Agent Builder session', {
        userId,
        workflowId: request.workflowId,
        error,
      });
      throw error;
    }
  }
}

let singletonClient: AgentBuilderClient | null = null;

/**
 * Singleton accessor to avoid recreating OpenAI client instances.
 */
export function getAgentBuilderClient(): AgentBuilderClient {
  if (!singletonClient) {
    singletonClient = new AgentBuilderClient();
  }
  return singletonClient;
}
