/**
 * API Route: /api/agent-builder/session
 * Creates ChatKit sessions against Agent Builder workflows to power embeds.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAgentBuilderClient } from '@/lib/agents/agent-builder-client';
import type { AgentBuilderSessionRequest } from '@/types/agent-builder';
// import { console } from '@/lib/logger';
import { z } from '@/lib/zod-compat';

const logger = console;

const stateValueSchema = z.union([z.string(), z.number(), z.boolean()]);

const sessionRequestSchema = z.object({
  workflowId: z.string().min(1, 'workflowId is required'),
  version: z.string().min(1).optional(),
  stateVariables: z.record(stateValueSchema).optional(),
  expiresInSeconds: z.number().int().positive().max(60 * 60 * 24).optional(),
  rateLimitPerMinute: z.number().int().positive().max(1000).optional(),
  chatkit: z
    .object({
      automaticThreadTitling: z
        .object({
          enabled: z.boolean().optional(),
        })
        .optional(),
      uploads: z
        .object({
          enabled: z.boolean().optional(),
          maxFiles: z.number().int().positive().max(100).optional(),
          maxFileSizeMB: z.number().int().positive().max(512).optional(),
        })
        .optional(),
      history: z
        .object({
          enabled: z.boolean().optional(),
          recentThreads: z.number().int().positive().nullable().optional(),
        })
        .optional(),
    })
    .optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json();
    const payload = sessionRequestSchema.parse(rawBody) as AgentBuilderSessionRequest;

    const userIdentifier =
      session.user.id?.toString() ||
      session.user.email ||
      session.user.name ||
      'anonymous';

    const agentBuilder = getAgentBuilderClient();
    const chatkitSession = await agentBuilder.createSession(userIdentifier, payload);

    console.info('Agent Builder session created', {
      userId: userIdentifier,
      workflowId: payload.workflowId,
      sessionId: chatkitSession.sessionId,
    });

    return NextResponse.json(chatkitSession, { status: 201 });
  } catch (error) {
    console.error('Failed to create Agent Builder session', { error });

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.flatten() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create Agent Builder session' },
      { status: 500 }
    );
  }
}

