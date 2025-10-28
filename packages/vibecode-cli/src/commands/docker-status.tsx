import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import Docker from 'dockerode';

interface ContainerStatus {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
}

/**
 * Fetches the status of running Docker containers.
 */
export const getDockerContainerStatus = async (): Promise<ContainerStatus[]> => {
  try {
    const docker = new Docker(); // Connects to the local Docker daemon via socket
    const containers = await docker.listContainers();

    return containers.map(container => ({
      id: container.Id.substring(0, 12),
      name: container.Names[0].replace('/', ''),
      image: container.Image,
      state: container.State,
      status: container.Status,
    }));
  } catch (error) {
    // This will typically fail if the Docker daemon is not running or accessible
    throw new Error('Failed to connect to Docker daemon. Is it running?');
  }
};

const DockerStatus = () => {
  const [containers, setContainers] = useState<ContainerStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const containerStatuses = await getDockerContainerStatus();
        setContainers(containerStatuses);
      } catch (err: any) {
        setError(err.message);
      }
    };

    fetchStatuses();
  }, []);

  if (error) {
    return <Text color="red">Error: {error}</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text>Running Docker Containers:</Text>
      {containers.length === 0 ? (
        <Text>No running containers found.</Text>
      ) : (
        <Box flexDirection="column" marginTop={1}>
          {containers.map(container => (
            <Text key={container.id}>
              - {container.name} ({container.image}) - {container.state}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default DockerStatus;
