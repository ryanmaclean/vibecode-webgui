import React from 'react';
import { render, Text, Box } from 'ink';
import FlyStatus from './commands/fly-status';
import K8sStatus from './commands/k8s-status';
import DockerStatus from './commands/docker-status';

export const App = ({ args }: { args: string[] }) => {
  const command = args[0];

  switch (command) {
    case 'fly-status':
      return <FlyStatus />;
    case 'k8s-status':
      return <K8sStatus />;
    case 'docker-status':
      return <DockerStatus />;
    default:
      return (
        <Box flexDirection="column">
          <Text>Welcome to VibeCode CLI!</Text>
          <Text>Available commands:</Text>
          <Text> - fly-status: Check the status of Fly.io applications.</Text>
          <Text> - k8s-status: Check the status of Kubernetes pods.</Text>
          <Text> - docker-status: Check the status of running Docker containers.</Text>
        </Box>
      );
  }
};

// Pass command line arguments, excluding 'node' and the script path
render(<App args={process.argv.slice(2)} />);
