/**
 * Terminal Session Manager
 * Manages global terminal sessions and cleanup
 */

import { IPty } from 'node-pty';
import { ClaudeCliIntegration } from '@/lib/claude-cli-integration';
import { logger } from '@/lib/logger';

// Terminal session management
export const terminalSessions = new Map<string, {
  pty: IPty
  workspaceId: string
  userId: string
  claude?: ClaudeCliIntegration
  aiContext: string[]
  lastActivity: Date
}>();

// Cleanup inactive sessions every 30 minutes
setInterval(() => {
  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)

  for (const [sessionId, session] of terminalSessions.entries()) {
    if (session.lastActivity < thirtyMinutesAgo) {
      logger.info(`Cleaning up inactive terminal session: ${sessionId}`)
      session.pty.kill()
      terminalSessions.delete(sessionId)
    }
  }
}, 30 * 60 * 1000);

// Generate unique session ID
export function generateSessionId(): string {
  return `term_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}