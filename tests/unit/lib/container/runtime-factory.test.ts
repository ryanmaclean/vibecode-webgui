/**
 * Unit tests for Runtime Factory
 */

import { createRuntime, detectRuntime, getRuntimeWithFallback } from '@/lib/container/runtime-factory';
import type { RuntimeConfig } from '@/lib/container/runtime-interface';

// Mock the runtime implementations
jest.mock('@/lib/container/runtimes/docker-runtime', () => ({
  DockerRuntime: jest.fn().mockImplementation(() => ({
    name: 'docker',
    isAvailable: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('@/lib/container/runtimes/podman-runtime', () => ({
  PodmanRuntime: jest.fn().mockImplementation(() => ({
    name: 'podman',
    isAvailable: jest.fn().mockResolvedValue(false),
  })),
}));

jest.mock('@/lib/container/runtimes/kubernetes-runtime', () => ({
  KubernetesRuntime: jest.fn().mockImplementation(() => ({
    name: 'kubernetes',
    isAvailable: jest.fn().mockResolvedValue(false),
  })),
}));

jest.mock('@/lib/container/runtimes/apple-runtime', () => ({
  AppleContainerRuntime: jest.fn().mockImplementation(() => ({
    name: 'apple',
    isAvailable: jest.fn().mockResolvedValue(false),
  })),
}));

describe('Runtime Factory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createRuntime', () => {
    it('should create Docker runtime', async () => {
      const config: RuntimeConfig = { runtime: 'docker' };
      const runtime = await createRuntime(config);

      expect(runtime.name).toBe('docker');
    });

    it('should create Podman runtime', async () => {
      const config: RuntimeConfig = { runtime: 'podman' };
      const runtime = await createRuntime(config);

      expect(runtime.name).toBe('podman');
    });

    it('should create Kubernetes runtime', async () => {
      const config: RuntimeConfig = { runtime: 'kubernetes' };
      const runtime = await createRuntime(config);

      expect(runtime.name).toBe('kubernetes');
    });

    it('should create Apple runtime', async () => {
      const config: RuntimeConfig = { runtime: 'apple' };
      const runtime = await createRuntime(config);

      expect(runtime.name).toBe('apple');
    });

    it('should throw error for unsupported runtime', async () => {
      const config = { runtime: 'invalid' } as any;

      await expect(createRuntime(config)).rejects.toThrow('Unsupported runtime type');
    });
  });

  describe('detectRuntime', () => {
    it('should detect available runtime', async () => {
      const runtimeType = await detectRuntime();

      expect(runtimeType).toBe('docker');
    });

    it('should return null when no runtime is available', async () => {
      // Mock all runtimes as unavailable
      const { DockerRuntime } = require('@/lib/container/runtimes/docker-runtime');
      DockerRuntime.mockImplementation(() => ({
        name: 'docker',
        isAvailable: jest.fn().mockResolvedValue(false),
      }));

      const runtimeType = await detectRuntime();

      expect(runtimeType).toBeNull();
    });
  });

  describe('getRuntimeWithFallback', () => {
    it('should return preferred runtime if available', async () => {
      const runtime = await getRuntimeWithFallback('docker');

      expect(runtime.name).toBe('docker');
    });

    it('should fallback to auto-detect if preferred not available', async () => {
      const { PodmanRuntime } = require('@/lib/container/runtimes/podman-runtime');
      PodmanRuntime.mockImplementation(() => ({
        name: 'podman',
        isAvailable: jest.fn().mockResolvedValue(false),
      }));

      const runtime = await getRuntimeWithFallback('podman');

      expect(runtime.name).toBe('docker');
    });

    it('should throw error if no runtime available', async () => {
      // Mock all runtimes as unavailable
      const { DockerRuntime } = require('@/lib/container/runtimes/docker-runtime');
      DockerRuntime.mockImplementation(() => ({
        name: 'docker',
        isAvailable: jest.fn().mockResolvedValue(false),
      }));

      await expect(getRuntimeWithFallback()).rejects.toThrow('No container runtime available');
    });
  });
});
