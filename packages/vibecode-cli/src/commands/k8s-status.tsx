import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import * as k8s from '@kubernetes/client-node';

interface PodStatus {
  name: string;
  status: string;
  restarts: number;
  age: string;
}

/**
 * Fetches the status of pods from a Kubernetes cluster.
 */
export const getK8sPodStatus = async (namespace = 'default'): Promise<PodStatus[]> => {
  try {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();

    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    const res = await k8sApi.listNamespacedPod(namespace);

    return res.body.items.map(pod => ({
      name: pod.metadata?.name || 'unknown',
      status: pod.status?.phase || 'unknown',
      restarts: pod.status?.containerStatuses?.reduce((acc, c) => acc + c.restartCount, 0) || 0,
      age: pod.metadata?.creationTimestamp ? `${Math.round((Date.now() - pod.metadata.creationTimestamp.getTime()) / (1000 * 60))}m` : 'n/a',
    }));
  } catch (error) {
    // In a real app, you'd want more robust error handling
    throw new Error('Failed to fetch pod status from Kubernetes.');
  }
};

const K8sStatus = () => {
  const [pods, setPods] = useState<PodStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStatuses = async () => {
      try {
        const podStatuses = await getK8sPodStatus();
        setPods(podStatuses);
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
      <Text>Kubernetes Pod Status (default namespace):</Text>
      <Box flexDirection="column" marginTop={1}>
        {pods.map(pod => (
          <Text key={pod.name}>
            - {pod.name} ({pod.status}, restarts: {pod.restarts}, age: {pod.age})
          </Text>
        ))}
      </Box>
    </Box>
  );
};

export default K8sStatus;
