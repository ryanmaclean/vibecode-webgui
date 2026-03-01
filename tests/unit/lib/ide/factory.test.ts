/**
 * Unit tests for IDE Factory
 * Tests IDE instance creation, singleton pattern, and type selection
 */

import { IDEFactory } from '@/lib/ide/factory';
import { OpenVSCodeServer } from '@/lib/ide/openvscode';
import { CodeServer } from '@/lib/ide/code-server';
import { EclipseTheia } from '@/lib/ide/theia';
import { IDEConfig, IDEType } from '@/lib/ide/types';

// Mock IDE implementations
jest.mock('@/lib/ide/openvscode');
jest.mock('@/lib/ide/code-server');
jest.mock('@/lib/ide/theia');
jest.mock('@/lib/logger');

describe('IDEFactory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    IDEFactory.clearInstances();
    delete process.env.DEFAULT_IDE_TYPE;
  });

  describe('getIDE', () => {
    it('should create OpenVSCode Server instance', () => {
      const ide = IDEFactory.getIDE('openvscode');

      expect(ide).toBeInstanceOf(OpenVSCodeServer);
      expect(OpenVSCodeServer).toHaveBeenCalledTimes(1);
    });

    it('should create Code-Server instance', () => {
      const ide = IDEFactory.getIDE('code-server');

      expect(ide).toBeInstanceOf(CodeServer);
      expect(CodeServer).toHaveBeenCalledTimes(1);
    });

    it('should create Eclipse Theia instance', () => {
      const ide = IDEFactory.getIDE('theia');

      expect(ide).toBeInstanceOf(EclipseTheia);
      expect(EclipseTheia).toHaveBeenCalledTimes(1);
    });

    it('should reuse existing instance (singleton pattern)', () => {
      const ide1 = IDEFactory.getIDE('openvscode');
      const ide2 = IDEFactory.getIDE('openvscode');

      expect(ide1).toBe(ide2);
      expect(OpenVSCodeServer).toHaveBeenCalledTimes(1);
    });

    it('should create separate instances for different IDE types', () => {
      const openvsIDE = IDEFactory.getIDE('openvscode');
      const codeServerIDE = IDEFactory.getIDE('code-server');
      const theiaIDE = IDEFactory.getIDE('theia');

      expect(openvsIDE).not.toBe(codeServerIDE);
      expect(openvsIDE).not.toBe(theiaIDE);
      expect(codeServerIDE).not.toBe(theiaIDE);
      expect(OpenVSCodeServer).toHaveBeenCalledTimes(1);
      expect(CodeServer).toHaveBeenCalledTimes(1);
      expect(EclipseTheia).toHaveBeenCalledTimes(1);
    });

    it('should throw error for unsupported IDE type', () => {
      expect(() => {
        IDEFactory.getIDE('unsupported' as IDEType);
      }).toThrow('Unsupported IDE type: unsupported');
    });
  });

  describe('startIDE', () => {
    it('should get IDE instance and call start', async () => {
      const config: IDEConfig = {
        type: 'openvscode',
        workspaceId: 'ws-123',
        userId: 'user-456',
        port: 8080,
      };

      const mockStart = jest.fn().mockResolvedValue({
        id: 'session-123',
        type: 'openvscode',
        url: 'http://localhost:8080',
        status: 'ready',
        workspaceId: 'ws-123',
        userId: 'user-456',
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      (OpenVSCodeServer as jest.Mock).mockImplementation(() => ({
        start: mockStart,
      }));

      const ide = await IDEFactory.startIDE(config);

      expect(mockStart).toHaveBeenCalledWith(config);
      expect(mockStart).toHaveBeenCalledTimes(1);
      expect(ide).toBeDefined();
    });

    it('should handle different IDE types', async () => {
      const configs: IDEConfig[] = [
        { type: 'openvscode', workspaceId: 'ws-1', userId: 'user-1' },
        { type: 'code-server', workspaceId: 'ws-2', userId: 'user-2' },
        { type: 'theia', workspaceId: 'ws-3', userId: 'user-3' },
      ];

      const mockStart = jest.fn().mockResolvedValue({
        id: 'session-123',
        url: 'http://localhost:8080',
        status: 'ready',
      });

      (OpenVSCodeServer as jest.Mock).mockImplementation(() => ({ start: mockStart }));
      (CodeServer as jest.Mock).mockImplementation(() => ({ start: mockStart }));
      (EclipseTheia as jest.Mock).mockImplementation(() => ({ start: mockStart }));

      for (const config of configs) {
        mockStart.mockClear();
        await IDEFactory.startIDE(config);
        expect(mockStart).toHaveBeenCalledWith(config);
      }
    });

    it('should propagate errors from IDE start', async () => {
      const config: IDEConfig = {
        type: 'openvscode',
        workspaceId: 'ws-123',
        userId: 'user-456',
      };

      const mockStart = jest.fn().mockRejectedValue(new Error('Failed to start IDE'));

      (OpenVSCodeServer as jest.Mock).mockImplementation(() => ({
        start: mockStart,
      }));

      await expect(IDEFactory.startIDE(config)).rejects.toThrow('Failed to start IDE');
    });
  });

  describe('getDefaultIDEType', () => {
    it('should return openvscode as default', () => {
      const defaultType = IDEFactory.getDefaultIDEType();

      expect(defaultType).toBe('openvscode');
    });

    it('should use environment variable if set and valid', () => {
      process.env.DEFAULT_IDE_TYPE = 'code-server';

      const defaultType = IDEFactory.getDefaultIDEType();

      expect(defaultType).toBe('code-server');
    });

    it('should support theia from environment', () => {
      process.env.DEFAULT_IDE_TYPE = 'theia';

      const defaultType = IDEFactory.getDefaultIDEType();

      expect(defaultType).toBe('theia');
    });

    it('should ignore invalid environment variable', () => {
      process.env.DEFAULT_IDE_TYPE = 'invalid-ide';

      const defaultType = IDEFactory.getDefaultIDEType();

      expect(defaultType).toBe('openvscode');
    });

    it('should ignore empty environment variable', () => {
      process.env.DEFAULT_IDE_TYPE = '';

      const defaultType = IDEFactory.getDefaultIDEType();

      expect(defaultType).toBe('openvscode');
    });
  });

  describe('getAvailableIDEs', () => {
    it('should return all available IDE types', () => {
      const availableIDEs = IDEFactory.getAvailableIDEs();

      expect(availableIDEs).toContain('openvscode');
      expect(availableIDEs).toContain('code-server');
      expect(availableIDEs).toContain('theia');
      expect(availableIDEs.length).toBe(3);
    });

    it('should return readonly array', () => {
      const availableIDEs = IDEFactory.getAvailableIDEs();

      // TypeScript ensures this is readonly, but we can verify it returns the same reference
      expect(availableIDEs).toBe(IDEFactory.getAvailableIDEs());
    });
  });

  describe('clearInstances', () => {
    it('should clear all cached IDE instances', () => {
      // Create some instances
      IDEFactory.getIDE('openvscode');
      IDEFactory.getIDE('code-server');

      expect(OpenVSCodeServer).toHaveBeenCalledTimes(1);
      expect(CodeServer).toHaveBeenCalledTimes(1);

      // Clear instances
      IDEFactory.clearInstances();

      // Getting IDE again should create new instances
      IDEFactory.getIDE('openvscode');
      IDEFactory.getIDE('code-server');

      expect(OpenVSCodeServer).toHaveBeenCalledTimes(2);
      expect(CodeServer).toHaveBeenCalledTimes(2);
    });

    it('should allow fresh instances after clear', () => {
      const ide1 = IDEFactory.getIDE('openvscode');

      IDEFactory.clearInstances();

      const ide2 = IDEFactory.getIDE('openvscode');

      expect(ide1).not.toBe(ide2);
    });
  });

  describe('integration scenarios', () => {
    it('should handle full IDE lifecycle', async () => {
      const mockStart = jest.fn().mockResolvedValue({
        id: 'session-123',
        type: 'openvscode',
        url: 'http://localhost:8080',
        status: 'ready',
        workspaceId: 'ws-123',
        userId: 'user-456',
        createdAt: new Date(),
        lastActivity: new Date(),
      });

      (OpenVSCodeServer as jest.Mock).mockImplementation(() => ({
        start: mockStart,
      }));

      const config: IDEConfig = {
        type: 'openvscode',
        workspaceId: 'ws-123',
        userId: 'user-456',
        port: 8080,
        extensions: ['ms-python.python'],
      };

      // Start IDE
      const ide = await IDEFactory.startIDE(config);

      expect(ide).toBeDefined();
      expect(mockStart).toHaveBeenCalledWith(config);

      // Verify singleton behavior
      const ide2 = IDEFactory.getIDE('openvscode');
      expect(ide).toBe(ide2);
    });

    it('should support multiple concurrent IDE sessions', async () => {
      const mockStartVSCode = jest.fn().mockResolvedValue({ id: 'vs-1', status: 'ready' });
      const mockStartCodeServer = jest.fn().mockResolvedValue({ id: 'cs-1', status: 'ready' });
      const mockStartTheia = jest.fn().mockResolvedValue({ id: 'th-1', status: 'ready' });

      (OpenVSCodeServer as jest.Mock).mockImplementation(() => ({ start: mockStartVSCode }));
      (CodeServer as jest.Mock).mockImplementation(() => ({ start: mockStartCodeServer }));
      (EclipseTheia as jest.Mock).mockImplementation(() => ({ start: mockStartTheia }));

      const configs: IDEConfig[] = [
        { type: 'openvscode', workspaceId: 'ws-1', userId: 'user-1' },
        { type: 'code-server', workspaceId: 'ws-2', userId: 'user-2' },
        { type: 'theia', workspaceId: 'ws-3', userId: 'user-3' },
      ];

      await Promise.all(configs.map(config => IDEFactory.startIDE(config)));

      expect(mockStartVSCode).toHaveBeenCalled();
      expect(mockStartCodeServer).toHaveBeenCalled();
      expect(mockStartTheia).toHaveBeenCalled();
    });
  });
});
