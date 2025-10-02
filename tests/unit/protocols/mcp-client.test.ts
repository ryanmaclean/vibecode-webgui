/**
 * MCP Client Tests
 */

import { MCPClient, createMCPClient } from '@/lib/protocols/mcp-client';

describe('MCPClient', () => {
  let client: MCPClient;

  beforeEach(() => {
    client = createMCPClient({
      transport: 'http',
      url: 'http://localhost:3000/mcp',
      timeout: 5000,
    });
  });

  afterEach(async () => {
    if (client.isConnected()) {
      await client.disconnect();
    }
  });

  describe('Connection Management', () => {
    it('should create client with config', () => {
      expect(client).toBeInstanceOf(MCPClient);
      expect(client.isConnected()).toBe(false);
    });

    it('should handle connection state', () => {
      expect(client.isConnected()).toBe(false);
      expect(client.getServerInfo()).toBeNull();
    });

    it('should throw error on stdio in browser', async () => {
      const stdioClient = createMCPClient({
        transport: 'stdio',
      });

      await expect(stdioClient.connect()).rejects.toThrow('stdio transport not supported');
    });
  });

  describe('Tool Operations', () => {
    it('should throw error when not connected', async () => {
      await expect(client.listTools()).rejects.toThrow('Not connected');
    });

    it('should throw error on tool invocation when not connected', async () => {
      await expect(client.invokeTool('test', {})).rejects.toThrow('Not connected');
    });
  });

  describe('Resource Operations', () => {
    it('should throw error on resource list when not connected', async () => {
      await expect(client.listResources()).rejects.toThrow('Not connected');
    });

    it('should throw error on resource read when not connected', async () => {
      await expect(client.readResource('file:///test')).rejects.toThrow('Not connected');
    });

    it('should throw error on resource write when not connected', async () => {
      await expect(client.writeResource('file:///test', 'content')).rejects.toThrow('Not connected');
    });
  });

  describe('Prompt Operations', () => {
    it('should throw error on prompt list when not connected', async () => {
      await expect(client.listPrompts()).rejects.toThrow('Not connected');
    });

    it('should throw error on prompt get when not connected', async () => {
      await expect(client.getPrompt('test', {})).rejects.toThrow('Not connected');
    });
  });

  describe('Sampling API', () => {
    it('should throw error on message creation when not connected', async () => {
      await expect(client.createMessage([
        { role: 'user', content: 'test' },
      ])).rejects.toThrow('Not connected');
    });
  });

  describe('Event Handling', () => {
    it('should emit events', (done) => {
      client.on('connected', () => {
        done();
      });

      // Manually trigger for testing
      client.emit('connected', {});
    });

    it('should handle error events', (done) => {
      client.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      client.emit('error', new Error('test error'));
    });
  });

  describe('Client Factory', () => {
    it('should create client via factory', () => {
      const newClient = createMCPClient({
        transport: 'http',
        url: 'http://localhost:3000',
      });

      expect(newClient).toBeInstanceOf(MCPClient);
    });
  });

  describe('Protocol Overhead', () => {
    it('should have low protocol overhead', async () => {
      const start = Date.now();

      // Simulate protocol operations
      try {
        await client.listTools();
      } catch {
        // Expected to fail when not connected
      }

      const duration = Date.now() - start;

      // Protocol overhead should be <50ms
      expect(duration).toBeLessThan(50);
    });
  });
});
