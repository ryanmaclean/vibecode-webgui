/**
 * Agent Store Tests
 */

import { renderHook, act } from '@testing-library/react';
import { useAgentStore } from '../agentStore';
import type { AgentStatusResponse, StartAgentRequest } from '@/types/agent-api';

// Mock fetch
global.fetch = jest.fn();

describe('AgentStore', () => {
  beforeEach(() => {
    // Clear store
    act(() => {
      useAgentStore.getState().clearAll();
    });

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('startAgent', () => {
    it('should start agent successfully', async () => {
      const mockResponse: AgentStatusResponse = {
        agent_id: 'aider-12345678',
        agent_type: 'aider',
        status: 'running',
        terminal_id: 'term-123',
        workspace: '/home/coder/workspace',
        created_at: '2025-10-02T00:00:00Z',
        uptime_seconds: 0,
        exit_code: null,
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { result } = renderHook(() => useAgentStore());

      const request: StartAgentRequest = {
        agent_type: 'aider',
        workspace: '/home/coder/workspace',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Implement authentication',
      };

      let session;
      await act(async () => {
        session = await result.current.startAgent(request);
      });

      expect(session).toBeDefined();
      expect(session?.agent_id).toBe('aider-12345678');
      expect(session?.status).toBe('running');

      // Check state
      const state = result.current;
      expect(state.sessions.size).toBe(1);
      expect(state.activeAgentId).toBe('aider-12345678');
      expect(state.stats.running).toBe(1);
      expect(state.stats.total).toBe(1);
    });

    it('should handle start agent error', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        statusText: 'Server Error',
      });

      const { result } = renderHook(() => useAgentStore());

      const request: StartAgentRequest = {
        agent_type: 'aider',
        workspace: '/home/coder/workspace',
        model: 'claude-3-5-sonnet-20241022',
        task: 'Test task',
      };

      await expect(async () => {
        await act(async () => {
          await result.current.startAgent(request);
        });
      }).rejects.toThrow();

      // Check error state
      expect(result.current.errors.size).toBeGreaterThan(0);
    });
  });

  describe('stopAgent', () => {
    it('should stop agent successfully', async () => {
      const { result } = renderHook(() => useAgentStore());

      // Add test agent
      act(() => {
        const testSession = {
          agent_id: 'test-agent',
          agent_type: 'aider' as const,
          status: 'running' as const,
          terminal_id: 'term-123',
          workspace: '/home/coder/workspace',
          model: 'claude-3-5-sonnet-20241022' as const,
          task: 'Test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          uptime_seconds: 10,
          exit_code: null,
          sse_connected: false,
          ws_connected: false,
        };
        result.current.sessions.set('test-agent', testSession);
        result.current.updateStats();
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'stopped' }),
      });

      await act(async () => {
        await result.current.stopAgent('test-agent');
      });

      const agent = result.current.getAgent('test-agent');
      expect(agent?.status).toBe('stopped');
    });
  });

  describe('updateAgent', () => {
    it('should update agent state', () => {
      const { result } = renderHook(() => useAgentStore());

      // Add test agent
      act(() => {
        const testSession = {
          agent_id: 'test-agent',
          agent_type: 'aider' as const,
          status: 'running' as const,
          terminal_id: 'term-123',
          workspace: '/home/coder/workspace',
          model: 'claude-3-5-sonnet-20241022' as const,
          task: 'Test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          uptime_seconds: 10,
          exit_code: null,
          sse_connected: false,
          ws_connected: false,
        };
        result.current.sessions.set('test-agent', testSession);
      });

      act(() => {
        result.current.updateAgent('test-agent', {
          status: 'completed',
          exit_code: 0,
        });
      });

      const agent = result.current.getAgent('test-agent');
      expect(agent?.status).toBe('completed');
      expect(agent?.exit_code).toBe(0);
    });
  });

  describe('SSE event handling', () => {
    it('should handle status event', () => {
      const { result } = renderHook(() => useAgentStore());

      // Add test agent
      act(() => {
        const testSession = {
          agent_id: 'test-agent',
          agent_type: 'aider' as const,
          status: 'running' as const,
          terminal_id: 'term-123',
          workspace: '/home/coder/workspace',
          model: 'claude-3-5-sonnet-20241022' as const,
          task: 'Test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          uptime_seconds: 10,
          exit_code: null,
          sse_connected: false,
          ws_connected: false,
        };
        result.current.sessions.set('test-agent', testSession);
      });

      act(() => {
        result.current.handleSSEEvent('test-agent', {
          id: '1',
          event: 'status',
          data: {
            timestamp: new Date().toISOString(),
            status: 'completed',
            progress: 1.0,
          },
        });
      });

      const agent = result.current.getAgent('test-agent');
      expect(agent?.status).toBe('completed');
      expect(agent?.progress).toBe(1.0);
    });

    it('should handle error event', () => {
      const { result } = renderHook(() => useAgentStore());

      // Add test agent
      act(() => {
        const testSession = {
          agent_id: 'test-agent',
          agent_type: 'aider' as const,
          status: 'running' as const,
          terminal_id: 'term-123',
          workspace: '/home/coder/workspace',
          model: 'claude-3-5-sonnet-20241022' as const,
          task: 'Test',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          uptime_seconds: 10,
          exit_code: null,
          sse_connected: false,
          ws_connected: false,
        };
        result.current.sessions.set('test-agent', testSession);
      });

      act(() => {
        result.current.handleSSEEvent('test-agent', {
          id: '1',
          event: 'error',
          data: {
            timestamp: new Date().toISOString(),
            error: 'Test error',
            code: 'ERR_TEST',
          },
        });
      });

      const agent = result.current.getAgent('test-agent');
      expect(agent?.status).toBe('error');
      expect(agent?.last_error).toBe('Test error');
      expect(result.current.errors.get('test-agent')).toBe('Test error');
    });
  });

  describe('selectors', () => {
    it('should get agents by status', () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        const sessions = [
          {
            agent_id: 'agent-1',
            agent_type: 'aider' as const,
            status: 'running' as const,
            terminal_id: 'term-1',
            workspace: '/workspace',
            model: 'claude-3-5-sonnet-20241022' as const,
            task: 'Task 1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            uptime_seconds: 10,
            exit_code: null,
            sse_connected: false,
            ws_connected: false,
          },
          {
            agent_id: 'agent-2',
            agent_type: 'goose' as const,
            status: 'completed' as const,
            terminal_id: 'term-2',
            workspace: '/workspace',
            model: 'claude-3-5-sonnet-20241022' as const,
            task: 'Task 2',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            uptime_seconds: 100,
            exit_code: 0,
            sse_connected: false,
            ws_connected: false,
          },
        ];

        sessions.forEach((s) => result.current.sessions.set(s.agent_id, s));
        result.current.updateStats();
      });

      const runningAgents = result.current.getAgentsByStatus('running');
      const completedAgents = result.current.getAgentsByStatus('completed');

      expect(runningAgents).toHaveLength(1);
      expect(runningAgents[0].agent_id).toBe('agent-1');
      expect(completedAgents).toHaveLength(1);
      expect(completedAgents[0].agent_id).toBe('agent-2');
    });

    it('should get agents by type', () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        const sessions = [
          {
            agent_id: 'agent-1',
            agent_type: 'aider' as const,
            status: 'running' as const,
            terminal_id: 'term-1',
            workspace: '/workspace',
            model: 'claude-3-5-sonnet-20241022' as const,
            task: 'Task 1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            uptime_seconds: 10,
            exit_code: null,
            sse_connected: false,
            ws_connected: false,
          },
          {
            agent_id: 'agent-2',
            agent_type: 'aider' as const,
            status: 'completed' as const,
            terminal_id: 'term-2',
            workspace: '/workspace',
            model: 'claude-3-5-sonnet-20241022' as const,
            task: 'Task 2',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            uptime_seconds: 100,
            exit_code: 0,
            sse_connected: false,
            ws_connected: false,
          },
        ];

        sessions.forEach((s) => result.current.sessions.set(s.agent_id, s));
      });

      const aiderAgents = result.current.getAgentsByType('aider');

      expect(aiderAgents).toHaveLength(2);
    });
  });

  describe('statistics', () => {
    it('should calculate correct statistics', () => {
      const { result } = renderHook(() => useAgentStore());

      act(() => {
        const sessions = [
          {
            agent_id: 'agent-1',
            agent_type: 'aider' as const,
            status: 'running' as const,
            terminal_id: 'term-1',
            workspace: '/workspace',
            model: 'claude-3-5-sonnet-20241022' as const,
            task: 'Task 1',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            uptime_seconds: 10,
            exit_code: null,
            sse_connected: false,
            ws_connected: false,
          },
          {
            agent_id: 'agent-2',
            agent_type: 'goose' as const,
            status: 'completed' as const,
            terminal_id: 'term-2',
            workspace: '/workspace',
            model: 'claude-3-5-sonnet-20241022' as const,
            task: 'Task 2',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            uptime_seconds: 100,
            exit_code: 0,
            sse_connected: false,
            ws_connected: false,
          },
          {
            agent_id: 'agent-3',
            agent_type: 'aider' as const,
            status: 'failed' as const,
            terminal_id: 'term-3',
            workspace: '/workspace',
            model: 'claude-3-5-sonnet-20241022' as const,
            task: 'Task 3',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            uptime_seconds: 50,
            exit_code: 1,
            sse_connected: false,
            ws_connected: false,
          },
        ];

        sessions.forEach((s) => result.current.sessions.set(s.agent_id, s));
        result.current.updateStats();
      });

      const stats = result.current.stats;

      expect(stats.total).toBe(3);
      expect(stats.running).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.by_type.aider).toBe(2);
      expect(stats.by_type.goose).toBe(1);
      expect(stats.by_type.cline).toBe(0);
    });
  });
});
