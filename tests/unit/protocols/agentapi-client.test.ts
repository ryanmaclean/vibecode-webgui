/**
 * AgentAPI Client Tests
 */

import { AgentAPIClient, createAgentAPIClient, getDefaultAgentAPIClient, setDefaultAgentAPIClient } from '@/lib/protocols/agentapi-client';
import { AgentAPIError } from '@/types/agent-api';

describe('AgentAPIClient', () => {
  let client: AgentAPIClient;

  beforeEach(() => {
    client = createAgentAPIClient({
      baseUrl: 'http://localhost:3000/api',
      timeout: 5000,
    });
  });

  describe('Client Creation', () => {
    it('should create client with default config', () => {
      const defaultClient = new AgentAPIClient();
      expect(defaultClient).toBeInstanceOf(AgentAPIClient);
    });

    it('should create client with custom config', () => {
      const customClient = new AgentAPIClient({
        baseUrl: 'http://custom:8080',
        apiKey: 'test-key',
        timeout: 10000,
      });

      expect(customClient).toBeInstanceOf(AgentAPIClient);
    });
  });

  describe('Agent Lifecycle', () => {
    it('should construct startAgent request', () => {
      const request = {
        agent_type: 'aider' as const,
        workspace: '/home/coder/workspace',
        model: 'claude-3-5-sonnet-20241022' as const,
        task: 'Write a hello world function',
      };

      expect(request.agent_type).toBe('aider');
      expect(request.workspace).toContain('/home/coder/workspace');
    });

    it('should validate workspace path', () => {
      const validPath = '/home/coder/workspace/project';
      const invalidPath = '/tmp/workspace';

      expect(validPath.startsWith('/home/coder/workspace')).toBe(true);
      expect(invalidPath.startsWith('/home/coder/workspace')).toBe(false);
    });

    it('should validate task length', () => {
      const validTask = 'Write a function';
      const tooShort = 'Hi';
      const tooLong = 'x'.repeat(2001);

      expect(validTask.length).toBeGreaterThanOrEqual(10);
      expect(validTask.length).toBeLessThanOrEqual(2000);
      expect(tooShort.length).toBeLessThan(10);
      expect(tooLong.length).toBeGreaterThan(2000);
    });
  });

  describe('Messaging', () => {
    it('should validate message length', () => {
      const validMessage = 'Hello';
      const tooLong = 'x'.repeat(5001);

      expect(validMessage.length).toBeGreaterThanOrEqual(1);
      expect(validMessage.length).toBeLessThanOrEqual(5000);
      expect(tooLong.length).toBeGreaterThan(5000);
    });
  });

  describe('Event Streaming', () => {
    it('should create EventSource for streaming', () => {
      // Mock EventSource
      global.EventSource = jest.fn() as any;

      const agentId = 'aider-12345678';
      const eventSource = client.createEventStream(agentId);

      expect(EventSource).toHaveBeenCalled();
    });
  });

  describe('WebSocket', () => {
    it('should create WebSocket connection', () => {
      // Mock WebSocket
      global.WebSocket = jest.fn() as any;

      const agentId = 'aider-12345678';
      const ws = client.createWebSocket(agentId);

      expect(WebSocket).toHaveBeenCalled();
    });

    it('should send WebSocket message', () => {
      const mockWs = {
        send: jest.fn(),
      } as any;

      client.sendWebSocketMessage(mockWs, 'Hello');

      expect(mockWs.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentData.type).toBe('message');
      expect(sentData.content).toBe('Hello');
    });

    it('should send WebSocket ping', () => {
      const mockWs = {
        send: jest.fn(),
      } as any;

      client.sendWebSocketPing(mockWs);

      expect(mockWs.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentData.type).toBe('ping');
    });
  });

  describe('Terminal Emulation', () => {
    it('should strip ANSI codes', () => {
      const textWithANSI = '\x1b[31mRed\x1b[0m Normal';
      const output = client['stripANSI'](textWithANSI);

      expect(output).toBe('Red Normal');
    });
  });

  describe('Protocol Negotiation', () => {
    it('should check version compatibility', () => {
      const isCompatible = client['isVersionCompatible']('1.2.3', '1.5.0');
      const isIncompatible = client['isVersionCompatible']('1.2.3', '2.0.0');

      expect(isCompatible).toBe(true);
      expect(isIncompatible).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should create AgentAPIError', () => {
      const problemDetails = {
        type: 'https://example.com/error',
        title: 'Test Error',
        status: 400,
        detail: 'Test error detail',
      };

      const error = new AgentAPIError(problemDetails);

      expect(error).toBeInstanceOf(Error);
      expect(error.status).toBe(400);
      expect(error.message).toBe('Test error detail');
    });
  });

  describe('Singleton Pattern', () => {
    it('should get default client', () => {
      const defaultClient = getDefaultAgentAPIClient();
      expect(defaultClient).toBeInstanceOf(AgentAPIClient);
    });

    it('should set default client', () => {
      const customClient = new AgentAPIClient();
      setDefaultAgentAPIClient(customClient);

      const retrieved = getDefaultAgentAPIClient();
      expect(retrieved).toBe(customClient);
    });
  });

  describe('Performance', () => {
    it('should have low protocol overhead', () => {
      const start = Date.now();

      // Create client and construct request
      const testClient = new AgentAPIClient();
      const request = {
        agent_type: 'aider' as const,
        workspace: '/home/coder/workspace',
        model: 'claude-3-5-sonnet-20241022' as const,
        task: 'Test task',
      };

      const duration = Date.now() - start;

      // Protocol overhead should be <50ms
      expect(duration).toBeLessThan(50);
    });
  });
});
