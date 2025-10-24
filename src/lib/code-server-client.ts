import { getSession } from 'next-auth/react';

interface CodeServerSession {
  id: string;
  url: string;
  status: 'starting' | 'ready' | 'error' | 'stopped';
  workspaceId: string;
  userId: string;
  containerId?: string;
  createdAt: string;
  lastActivity: string;
}

export class CodeServerClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  private async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    const session = await getSession();
    const headers = new Headers(options.headers);
    
    // Use the session token if available in the session
    const token = session?.user?.email; // Using email as a fallback for demo
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    
    headers.set('Content-Type', 'application/json');
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to fetch');
    }

    return response.json();
  }

  async createSession(workspaceId: string, userId?: string): Promise<CodeServerSession> {
    return this.fetchWithAuth('/api/code-server/session', {
      method: 'POST',
      body: JSON.stringify({ workspaceId, userId }),
    });
  }

  async getSession(sessionId: string): Promise<CodeServerSession> {
    return this.fetchWithAuth(`/api/code-server/session/${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.fetchWithAuth(`/api/code-server/session/${sessionId}`, {
      method: 'DELETE',
    });
  }

  async listSessions(workspaceId?: string): Promise<{ sessions: CodeServerSession[] }> {
    const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    return this.fetchWithAuth(`/api/code-server/session${query}`);
  }

  async getOrCreateSession(workspaceId: string, userId?: string): Promise<CodeServerSession> {
    try {
      const { sessions } = await this.listSessions(workspaceId);
      const activeSession = sessions.find(s => s.status === 'ready' || s.status === 'starting');
      
      if (activeSession) {
        return activeSession;
      }
      
      return this.createSession(workspaceId, userId);
    } catch (error) {
      console.error('Failed to get or create session:', error);
      throw error;
    }
  }
}

export const codeServerClient = new CodeServerClient(process.env.NEXT_PUBLIC_API_URL || '');
