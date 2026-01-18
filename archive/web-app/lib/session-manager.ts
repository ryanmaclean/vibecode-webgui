/**
 * Session Manager - Chat history persistence utility
 * Manages saving, loading, listing, and deleting chat sessions using localStorage
 *
 * Storage Strategy: localStorage (client-side)
 * Reasoning:
 * - Simple implementation, no server dependencies
 * - Fast access for single-user scenarios
 * - Easy to upgrade to database later
 * - Suitable for MVP and local development
 * - Can be extended to sync with backend API in future
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  title?: string;
}

const STORAGE_PREFIX = 'vibecode_chat_session_';
const SESSION_LIST_KEY = 'vibecode_chat_sessions';
const CURRENT_SESSION_KEY = 'vibecode_current_session';

/**
 * Check if localStorage is available
 */
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get the list of all session IDs
 */
function getSessionList(): string[] {
  if (!isLocalStorageAvailable()) {
    return [];
  }

  try {
    const list = localStorage.getItem(SESSION_LIST_KEY);
    return list ? JSON.parse(list) : [];
  } catch {
    return [];
  }
}

/**
 * Update the session list
 */
function updateSessionList(sessionIds: string[]): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  try {
    localStorage.setItem(SESSION_LIST_KEY, JSON.stringify(sessionIds));
  } catch (error) {
    console.error('Failed to update session list:', error);
  }
}

/**
 * Save a chat session to localStorage
 */
export function saveSession(sessionId: string, messages: ChatMessage[]): boolean {
  if (!isLocalStorageAvailable()) {
    console.warn('localStorage not available, session not saved');
    return false;
  }

  try {
    const existingSession = loadSession(sessionId);
    const now = new Date();

    const session: ChatSession = {
      id: sessionId,
      messages: messages.map(msg => ({
        ...msg,
        // Ensure timestamp is Date object
        timestamp: msg.timestamp instanceof Date ? msg.timestamp : new Date(msg.timestamp),
      })),
      createdAt: existingSession?.createdAt || now,
      updatedAt: now,
      title: existingSession?.title || generateSessionTitle(messages),
    };

    const key = STORAGE_PREFIX + sessionId;
    localStorage.setItem(key, JSON.stringify(session));

    // Update session list if this is a new session
    const sessionList = getSessionList();
    if (!sessionList.includes(sessionId)) {
      updateSessionList([...sessionList, sessionId]);
    }

    return true;
  } catch (error) {
    console.error('Failed to save session:', error);
    return false;
  }
}

/**
 * Load a chat session from localStorage
 */
export function loadSession(sessionId: string): ChatSession | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  try {
    const key = STORAGE_PREFIX + sessionId;
    const data = localStorage.getItem(key);

    if (!data) {
      return null;
    }

    const session = JSON.parse(data);

    // Convert date strings back to Date objects
    return {
      ...session,
      messages: session.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      })),
      createdAt: new Date(session.createdAt),
      updatedAt: new Date(session.updatedAt),
    };
  } catch (error) {
    console.error('Failed to load session:', error);
    return null;
  }
}

/**
 * List all saved chat sessions
 */
export function listSessions(): ChatSession[] {
  if (!isLocalStorageAvailable()) {
    return [];
  }

  const sessionIds = getSessionList();
  const sessions: ChatSession[] = [];

  for (const sessionId of sessionIds) {
    const session = loadSession(sessionId);
    if (session) {
      sessions.push(session);
    }
  }

  // Sort by most recently updated first
  return sessions.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/**
 * Delete a chat session from localStorage
 */
export function deleteSession(sessionId: string): boolean {
  if (!isLocalStorageAvailable()) {
    return false;
  }

  try {
    const key = STORAGE_PREFIX + sessionId;
    localStorage.removeItem(key);

    // Remove from session list
    const sessionList = getSessionList();
    const updatedList = sessionList.filter(id => id !== sessionId);
    updateSessionList(updatedList);

    // Clear current session if it was deleted
    if (getCurrentSessionId() === sessionId) {
      clearCurrentSessionId();
    }

    return true;
  } catch (error) {
    console.error('Failed to delete session:', error);
    return false;
  }
}

/**
 * Delete all chat sessions
 */
export function deleteAllSessions(): boolean {
  if (!isLocalStorageAvailable()) {
    return false;
  }

  try {
    const sessionIds = getSessionList();

    for (const sessionId of sessionIds) {
      const key = STORAGE_PREFIX + sessionId;
      localStorage.removeItem(key);
    }

    updateSessionList([]);
    clearCurrentSessionId();

    return true;
  } catch (error) {
    console.error('Failed to delete all sessions:', error);
    return false;
  }
}

/**
 * Get the current active session ID
 */
export function getCurrentSessionId(): string | null {
  if (!isLocalStorageAvailable()) {
    return null;
  }

  return localStorage.getItem(CURRENT_SESSION_KEY);
}

/**
 * Set the current active session ID
 */
export function setCurrentSessionId(sessionId: string): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  localStorage.setItem(CURRENT_SESSION_KEY, sessionId);
}

/**
 * Clear the current active session ID
 */
export function clearCurrentSessionId(): void {
  if (!isLocalStorageAvailable()) {
    return;
  }

  localStorage.removeItem(CURRENT_SESSION_KEY);
}

/**
 * Generate a title for the session based on messages
 */
function generateSessionTitle(messages: ChatMessage[]): string {
  if (messages.length === 0) {
    return 'New Chat';
  }

  // Use the first user message as the title (truncated)
  const firstUserMessage = messages.find(msg => msg.role === 'user');
  if (firstUserMessage) {
    const content = firstUserMessage.content.trim();
    return content.length > 50 ? content.substring(0, 47) + '...' : content;
  }

  return 'New Chat';
}

/**
 * Export session data as JSON (for backup/export)
 */
export function exportSession(sessionId: string): string | null {
  const session = loadSession(sessionId);
  if (!session) {
    return null;
  }

  return JSON.stringify(session, null, 2);
}

/**
 * Import session data from JSON (for restore/import)
 */
export function importSession(jsonData: string): string | null {
  try {
    const session = JSON.parse(jsonData);

    // Validate session structure
    if (!session.id || !Array.isArray(session.messages)) {
      throw new Error('Invalid session data');
    }

    // Generate new ID to avoid conflicts
    const newSessionId = generateSessionId();
    const messages = session.messages.map((msg: any) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));

    saveSession(newSessionId, messages);
    return newSessionId;
  } catch (error) {
    console.error('Failed to import session:', error);
    return null;
  }
}
