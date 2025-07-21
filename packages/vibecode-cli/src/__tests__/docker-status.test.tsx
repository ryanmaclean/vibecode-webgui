import React from 'react';
import { render } from 'ink-testing-library';
import DockerStatus, { getDockerContainerStatus } from '../commands/docker-status';
import Docker from 'dockerode';

// Mock the dockerode library
jest.mock('dockerode');

const mockedDocker = Docker as jest.MockedClass<typeof Docker>;

describe('Docker Status Command', () => {
  const mockListContainers = jest.fn();

  beforeEach(() => {
    // Mock the implementation of the Docker class
    mockedDocker.mockImplementation(() => ({
      listContainers: mockListContainers,
    } as any));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getDockerContainerStatus', () => {
    it('should return container statuses on success', async () => {
      const mockContainers = [
        { Id: '12345', Names: ['/container-1'], Image: 'nginx:latest', State: 'running', Status: 'Up 2 hours' },
        { Id: '67890', Names: ['/container-2'], Image: 'redis:latest', State: 'running', Status: 'Up 3 hours' },
      ];
      mockListContainers.mockResolvedValue(mockContainers);

      const statuses = await getDockerContainerStatus();
      expect(statuses).toHaveLength(2);
      expect(statuses[0].name).toBe('container-1');
      expect(statuses[1].image).toBe('redis:latest');
    });

    it('should throw an error on API failure', async () => {
      mockListContainers.mockRejectedValue(new Error('Docker Error'));
      await expect(getDockerContainerStatus()).rejects.toThrow('Failed to connect to Docker daemon. Is it running?');
    });
  });

  describe('DockerStatus Component', () => {
    it('should render the list of containers', async () => {
      const mockContainers = [{ Id: 'abcde', Names: ['/my-container'], Image: 'node:18', State: 'running' }];
      mockListContainers.mockResolvedValue(mockContainers);

      const { lastFrame } = render(<DockerStatus />);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(lastFrame()).toContain('my-container');
      expect(lastFrame()).toContain('node:18');
    });

    it('should render an error message on failure', async () => {
      mockListContainers.mockRejectedValue(new Error('Docker Error'));

      const { lastFrame } = render(<DockerStatus />);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(lastFrame()).toContain('Error: Failed to connect to Docker daemon. Is it running?');
    });
  });
});
