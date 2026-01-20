/**
 * IDE Session Store - Shared session management
 * 
 * NOTE: This is an in-memory implementation for development.
 * In production, replace with Redis, Database, or other persistent storage.
 */

import { IDESession } from '../types';

export interface SessionStore {
  get(sessionId: string): IDESession | undefined;
  set(sessionId: string, session: IDESession): void;
  delete(sessionId: string): boolean;
  list(): IDESession[];
  filter(predicate: (session: IDESession) => boolean): IDESession[];
  clear(): void;
}

/**
 * In-memory session store
 * For production, implement with Redis/Database
 */
class InMemorySessionStore implements SessionStore {
  private sessions: Map<string, IDESession> = new Map();

  get(sessionId: string): IDESession | undefined {
    return this.sessions.get(sessionId);
  }

  set(sessionId: string, session: IDESession): void {
    this.sessions.set(sessionId, session);
  }

  delete(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  list(): IDESession[] {
    return Array.from(this.sessions.values());
  }

  filter(predicate: (session: IDESession) => boolean): IDESession[] {
    return this.list().filter(predicate);
  }

  clear(): void {
    this.sessions.clear();
  }
}

// Singleton instance
let sessionStore: SessionStore | null = null;

/**
 * Get the session store instance
 * Creates a singleton instance on first call
 */
export function getSessionStore(): SessionStore {
  if (!sessionStore) {
    sessionStore = new InMemorySessionStore();
  }
  return sessionStore;
}

/**
 * Reset session store (for testing)
 */
export function resetSessionStore(): void {
  if (sessionStore) {
    sessionStore.clear();
  }
  sessionStore = null;
}
