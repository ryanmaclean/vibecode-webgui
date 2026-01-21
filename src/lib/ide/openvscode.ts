/**
 * OpenVSCode Server Implementation
 * Uses gitpod/openvscode-server Docker image
 */

import { WebIDE, IDEConfig, IDESession, IDEHealthCheck, IDEType } from './types';
import { v4 as uuidv4 } from 'uuid';

export class OpenVSCodeServer implements WebIDE {
  readonly name: IDEType = 'openvscode';
  private sessions: Map<string, IDESession> = new Map();
  private defaultImage = 'gitpod/openvscode-server:latest';
  private basePort = 3000;

  async start(config: IDEConfig): Promise<IDESession> {
    const sessionId = uuidv4();
    const port = config.port || this.basePort;
    
    const session: IDESession = {
      id: sessionId,
      type: this.name,
      url: `http://localhost:${port}`,
      status: 'starting',
      workspaceId: config.workspaceId,
      userId: config.userId,
      createdAt: new Date(),
      lastActivity: new Date(),
      metadata: {
        image: config.image || this.defaultImage,
        projectPath: config.projectPath || '/workspace',
        extensions: config.extensions || [],
      },
    };

    // In a real implementation, this would start a Docker container
    // For now, we'll simulate the session creation
    this.sessions.set(sessionId, session);

    // Simulate container startup
    setTimeout(() => {
      const updatedSession = this.sessions.get(sessionId);
      if (updatedSession) {
        updatedSession.status = 'ready';
        this.sessions.set(sessionId, updatedSession);
      }
    }, 2000);

    return session;
  }

  async stop(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = 'stopped';
    this.sessions.set(sessionId, session);
    
    // In a real implementation, this would stop the Docker container
    // For now, we'll just remove the session after a delay
    setTimeout(() => {
      this.sessions.delete(sessionId);
    }, 1000);
  }

  async getSession(sessionId: string): Promise<IDESession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async getURL(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    return session.url;
  }

  async healthCheck(sessionId: string): Promise<IDEHealthCheck> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return {
        healthy: false,
        status: 'error',
        message: 'Session not found',
        timestamp: new Date(),
      };
    }

    // In a real implementation, this would check container health
    // and perform HTTP health check on the IDE endpoint
    const healthy = session.status === 'ready';
    
    return {
      healthy,
      status: session.status,
      message: healthy ? 'IDE is healthy' : `IDE is ${session.status}`,
      timestamp: new Date(),
    };
  }

  async installExtension(sessionId: string, extensionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // In a real implementation, this would call the OpenVSCode Server API
    // to install the extension via the marketplace
    const extensions = (session.metadata?.extensions as string[]) || [];
    if (!extensions.includes(extensionId)) {
      extensions.push(extensionId);
      session.metadata = { ...session.metadata, extensions };
      this.sessions.set(sessionId, session);
    }
  }

  async listExtensions(sessionId: string): Promise<string[]> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    return (session.metadata?.extensions as string[]) || [];
  }
}
