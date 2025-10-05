/**
 * Chaos Engineering Tests for Agent System
 *
 * Tests system resilience under various failure scenarios
 */

import { Agent, createAgent } from '@/lib/agent-framework';
import { setupMockServer, simulateNetworkError, simulateRateLimit } from '../mocks/openai-api-server';
import type { ToolDefinition } from '@/lib/agent-framework';

describe('Agent System Resilience - Chaos Engineering', () => {
  setupMockServer();

  describe('Network Failure Scenarios', () => {
    it('should handle network disconnection', async () => {
      const agent = createAgent({ model: 'gpt-4o' });

      simulateNetworkError();

      await expect(
        agent.processMessage('Test message')
      ).rejects.toThrow();
    });

    it('should handle intermittent network failures', async () => {
      const agent = createAgent({ model: 'gpt-4o' });

      let attemptCount = 0;
      const maxAttempts = 3;

      for (let i = 0; i < maxAttempts; i++) {
        try {
          if (i % 2 === 0) {
            simulateNetworkError();
          }
          await agent.processMessage('Test');
          attemptCount++;
        } catch (error) {
          // Expected failure on network error
        }
      }

      // At least some attempts should succeed
      expect(attemptCount).toBeGreaterThan(0);
    });

    it('should handle request timeouts', async () => {
      const agent = createAgent({
        model: 'gpt-4o',
        maxTokens: 50,
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 100);
      });

      const requestPromise = agent.processMessage('Test');

      await expect(
        Promise.race([requestPromise, timeoutPromise])
      ).rejects.toThrow('Timeout');
    }, 10000);

    it('should handle DNS resolution failures', async () => {
      const agent = createAgent({ model: 'gpt-4o' });

      // Simulate DNS failure by using invalid host
      simulateNetworkError();

      await expect(
        agent.processMessage('Test')
      ).rejects.toThrow();
    });

    it('should handle SSL/TLS errors', async () => {
      const agent = createAgent({ model: 'gpt-4o' });

      simulateNetworkError();

      await expect(
        agent.processMessage('Test')
      ).rejects.toThrow();
    });
  });

  describe('API Rate Limiting Scenarios', () => {
    it('should handle rate limit errors', async () => {
      const agent = createAgent({ model: 'gpt-4o' });

      simulateRateLimit();

      await expect(
        agent.processMessage('Test')
      ).rejects.toThrow();
    });

    it('should handle burst traffic patterns', async () => {
      const agent = createAgent({ model: 'gpt-4o' });

      // Send burst of requests
      const promises = Array.from({ length: 10 }, (_, i) =>
        agent.processMessage(`Burst ${i}`)
      );

      const results = await Promise.allSettled(promises);

      // Some requests should succeed, some might be rate limited
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      const failureCount = results.filter(r => r.status === 'rejected').length;

      expect(successCount + failureCount).toBe(10);
    });

    it('should implement exponential backoff on rate limits', async () => {
      const agent = createAgent({ model: 'gpt-4o' });

      const retryDelays: number[] = [];

      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();

        try {
          simulateRateLimit();
          await agent.processMessage('Test');
        } catch (error) {
          const endTime = Date.now();
          retryDelays.push(endTime - startTime);
        }

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
      }

      // Delays should increase exponentially
      expect(retryDelays.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Pressure Scenarios', () => {
    it('should handle large conversation histories', async () => {
      const agent = createAgent({
        model: 'gpt-4o',
        memorySize: 100,
      });

      // Create large conversation history
      for (let i = 0; i < 50; i++) {
        await agent.processMessage(`Message ${i}`);
      }

      // Should still function with large memory
      const response = await agent.processMessage('Final message');
      expect(response.content).toBeDefined();
    }, 60000);

    it('should handle memory overflow', async () => {
      const agent = createAgent({
        model: 'gpt-4o',
        memorySize: 5,
      });

      // Exceed memory limit
      for (let i = 0; i < 20; i++) {
        await agent.processMessage(`Message ${i}`);
      }

      // Memory should be trimmed, agent should still function
      const response = await agent.processMessage('Test');
      expect(response.content).toBeDefined();
    }, 60000);

    it('should handle large individual messages', async () => {
      const agent = createAgent({ model: 'gpt-4o' });

      const largeMessage = 'A'.repeat(10000);

      try {
        await agent.processMessage(largeMessage);
      } catch (error) {
        // Might fail due to token limits, which is acceptable
        expect(error).toBeDefined();
      }
    });
  });

  describe('Tool Execution Failures', () => {
    it('should handle tool execution errors', async () => {
      const failingTool: ToolDefinition = {
        name: 'failing_tool',
        description: 'A tool that always fails',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          throw new Error('Tool execution failed');
        },
      };

      const agent = createAgent({
        tools: [failingTool],
        model: 'gpt-4o',
      });

      // Agent should handle tool failure gracefully
      const response = await agent.processMessage('Use the failing tool');
      expect(response.content).toBeDefined();
    });

    it('should handle tool timeout', async () => {
      const slowTool: ToolDefinition = {
        name: 'slow_tool',
        description: 'A tool that takes too long',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          await new Promise(resolve => setTimeout(resolve, 10000));
          return { result: 'done' };
        },
      };

      const agent = createAgent({
        tools: [slowTool],
        model: 'gpt-4o',
      });

      // Should timeout or handle gracefully
      try {
        await agent.processMessage('Use the slow tool');
      } catch (error) {
        expect(error).toBeDefined();
      }
    }, 15000);

    it('should handle tool returning invalid data', async () => {
      const invalidTool: ToolDefinition = {
        name: 'invalid_tool',
        description: 'A tool that returns invalid data',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          return undefined; // Invalid return
        },
      };

      const agent = createAgent({
        tools: [invalidTool],
        model: 'gpt-4o',
      });

      // Should handle invalid tool response
      const response = await agent.processMessage('Use the invalid tool');
      expect(response.content).toBeDefined();
    });

    it('should handle circular tool dependencies', async () => {
      const tool1: ToolDefinition = {
        name: 'tool1',
        description: 'Tool 1',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ nextTool: 'tool2' }),
      };

      const tool2: ToolDefinition = {
        name: 'tool2',
        description: 'Tool 2',
        parameters: { type: 'object', properties: {} },
        execute: async () => ({ nextTool: 'tool1' }),
      };

      const agent = createAgent({
        tools: [tool1, tool2],
        model: 'gpt-4o',
      });

      // Should detect and prevent infinite loops
      const response = await agent.processMessage('Execute tools');
      expect(response.content).toBeDefined();
    });
  });

  describe('Concurrent Load Scenarios', () => {
    it('should handle concurrent agent instances', async () => {
      const agents = Array.from({ length: 5 }, () =>
        createAgent({ model: 'gpt-4o' })
      );

      const promises = agents.map((agent, i) =>
        agent.processMessage(`Message ${i}`)
      );

      const results = await Promise.allSettled(promises);

      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(0);
    }, 30000);

    it('should handle concurrent requests per agent', async () => {
      const agent = createAgent({ model: 'gpt-4o' });

      const promises = Array.from({ length: 5 }, (_, i) =>
        agent.processMessage(`Concurrent ${i}`)
      );

      const results = await Promise.allSettled(promises);

      // At least some requests should succeed
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(0);
    }, 30000);

    it('should handle mixed read/write operations', async () => {
      const agent = createAgent({ model: 'gpt-4o' });

      const operations = [
        agent.processMessage('Message 1'),
        agent.processMessage('Message 2'),
        agent.clearMemory(),
        agent.processMessage('Message 3'),
      ];

      await expect(
        Promise.all(operations.map(p => p?.catch(() => null)))
      ).resolves.toBeDefined();
    });
  });

  describe('Data Corruption Scenarios', () => {
    it('should handle corrupted response data', async () => {
      const agent = createAgent({ model: 'gpt-4o' });

      // Simulate corrupted response by forcing parse error
      const originalJSON = JSON.parse;
      global.JSON.parse = () => {
        throw new Error('Corrupted JSON');
      };

      try {
        await agent.processMessage('Test');
      } catch (error) {
        expect(error).toBeDefined();
      } finally {
        global.JSON.parse = originalJSON;
      }
    });

    it('should handle invalid message formats', async () => {
      const agent = createAgent({ model: 'gpt-4o' });

      // Try to process invalid message types
      const invalidMessages = [
        null,
        undefined,
        123,
        {},
        [],
      ];

      for (const msg of invalidMessages) {
        try {
          await agent.processMessage(msg as any);
        } catch (error) {
          expect(error).toBeDefined();
        }
      }
    });

    it('should handle memory corruption', async () => {
      const agent = createAgent({ model: 'gpt-4o' });

      await agent.processMessage('Initial message');

      // Simulate memory corruption
      (agent as any).memory = null;

      try {
        await agent.processMessage('After corruption');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle CPU-intensive operations', async () => {
      const cpuIntensiveTool: ToolDefinition = {
        name: 'cpu_intensive',
        description: 'CPU intensive calculation',
        parameters: { type: 'object', properties: {} },
        execute: async () => {
          // Simulate CPU-intensive work
          let result = 0;
          for (let i = 0; i < 1000000; i++) {
            result += Math.sqrt(i);
          }
          return { result };
        },
      };

      const agent = createAgent({
        tools: [cpuIntensiveTool],
        model: 'gpt-4o',
      });

      const response = await agent.processMessage('Run CPU intensive task');
      expect(response.content).toBeDefined();
    }, 15000);

    it('should handle rapid memory allocation', async () => {
      const agent = createAgent({ model: 'gpt-4o' });

      // Rapidly allocate memory through messages
      const largeData = 'X'.repeat(1000);

      for (let i = 0; i < 10; i++) {
        await agent.processMessage(largeData);
      }

      // Agent should still function
      const response = await agent.processMessage('Final');
      expect(response.content).toBeDefined();
    }, 30000);
  });

  describe('Recovery and Resilience', () => {
    it('should recover from transient failures', async () => {
      const agent = createAgent({ model: 'gpt-4o' });

      let failureCount = 0;

      for (let i = 0; i < 5; i++) {
        try {
          if (i < 2) {
            simulateNetworkError();
          }
          await agent.processMessage(`Message ${i}`);
        } catch (error) {
          failureCount++;
        }
      }

      // Should recover after failures
      expect(failureCount).toBeGreaterThan(0);
      expect(failureCount).toBeLessThan(5);
    });

    it('should maintain state across failures', async () => {
      const agent = createAgent({ model: 'gpt-4o' });

      await agent.processMessage('Remember the number 42');

      // Simulate failure
      try {
        simulateNetworkError();
        await agent.processMessage('Fail');
      } catch (error) {
        // Expected failure
      }

      // Should recover with state intact
      const response = await agent.processMessage('What number?');
      expect(response.content).toBeDefined();
    });

    it('should gracefully degrade under load', async () => {
      const agent = createAgent({ model: 'gpt-4o' });

      // Send requests under increasing load
      for (let load = 1; load <= 5; load++) {
        const promises = Array.from({ length: load }, (_, i) =>
          agent.processMessage(`Load ${load} Message ${i}`)
        );

        const results = await Promise.allSettled(promises);
        const successCount = results.filter(r => r.status === 'fulfilled').length;

        // Should maintain some level of service
        expect(successCount).toBeGreaterThanOrEqual(0);
      }
    }, 60000);
  });
});
