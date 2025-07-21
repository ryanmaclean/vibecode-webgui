import React from 'react';
import { render } from 'ink-testing-library';
import K8sStatus, { getK8sPodStatus } from '../commands/k8s-status';
import * as k8s from '@kubernetes/client-node';

// Mock the entire @kubernetes/client-node library
jest.mock('@kubernetes/client-node');

const mockedK8s = k8s as jest.Mocked<typeof k8s>;

describe('K8s Status Command', () => {
  const mockListNamespacedPod = jest.fn();

  beforeEach(() => {
    // Mock the implementation of the KubeConfig class and its methods
    mockedK8s.KubeConfig.mockImplementation(() => ({
      loadFromDefault: jest.fn(),
      makeApiClient: jest.fn().mockImplementation(() => ({
        listNamespacedPod: mockListNamespacedPod,
      })),
    } as any));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getK8sPodStatus', () => {
    it('should return pod statuses on success', async () => {
      const mockPods = {
        body: {
          items: [
            { metadata: { name: 'pod-1', creationTimestamp: new Date() }, status: { phase: 'Running', containerStatuses: [{ restartCount: 0 }] } },
            { metadata: { name: 'pod-2', creationTimestamp: new Date() }, status: { phase: 'Succeeded', containerStatuses: [{ restartCount: 2 }] } },
          ],
        },
      };
      mockListNamespacedPod.mockResolvedValue(mockPods);

      const statuses = await getK8sPodStatus();
      expect(statuses).toHaveLength(2);
      expect(statuses[0].name).toBe('pod-1');
      expect(statuses[0].status).toBe('Running');
      expect(statuses[1].name).toBe('pod-2');
      expect(statuses[1].restarts).toBe(2);
    });

    it('should throw an error on API failure', async () => {
      mockListNamespacedPod.mockRejectedValue(new Error('API Error'));
      await expect(getK8sPodStatus()).rejects.toThrow('Failed to fetch pod status from Kubernetes.');
    });
  });

  describe('K8sStatus Component', () => {
    it('should render the list of pods', async () => {
      const mockPods = { body: { items: [{ metadata: { name: 'ui-pod-1' }, status: { phase: 'Running' } }] } };
      mockListNamespacedPod.mockResolvedValue(mockPods);

      const { lastFrame } = render(<K8sStatus />);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(lastFrame()).toContain('ui-pod-1');
      expect(lastFrame()).toContain('Running');
    });

    it('should render an error message on failure', async () => {
      mockListNamespacedPod.mockRejectedValue(new Error('API Error'));

      const { lastFrame } = render(<K8sStatus />);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(lastFrame()).toContain('Error: Failed to fetch pod status from Kubernetes.');
    });
  });
});
