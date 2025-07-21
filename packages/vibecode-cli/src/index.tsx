import React from 'react';
import { render, Text, Box } from 'ink';
import FlyStatus from './commands/fly-status';

export const App = ({ args }: { args: string[] }) => {
  const command = args[0];

  if (command === 'fly-status') {
    return <FlyStatus />;
  }

  return (
    <Box flexDirection="column">
      <Text>Welcome to VibeCode CLI!</Text>
      <Text>Available commands:</Text>
      <Text> - fly-status: Check the status of Fly.io applications in the project.</Text>
    </Box>
  );
};

// Pass command line arguments, excluding 'node' and the script path
render(<App args={process.argv.slice(2)} />);
