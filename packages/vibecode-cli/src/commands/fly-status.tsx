import React, { useState, useEffect } from 'react';
import { Text, Box } from 'ink';
import { glob } from 'glob';
import { TOML } from '@ltd/j-toml';
import fs from 'fs';
import axios from 'axios';

interface AppStatus {
  appName: string | null;
  status: 'loading' | 'running' | 'stopped' | 'error';
  error?: string;
}

export const findFlyTomlFiles = async (): Promise<string[]> => {
  return glob('**/fly.toml', { ignore: '**/node_modules/**' });
};

export const parseFlyToml = (filePath: string): string | null => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = TOML.parse(content);
    return typeof data.app === 'string' ? data.app : null;
  } catch (error) {
    return null;
  }
};

export const getFlyAppStatus = async (appName: string): Promise<AppStatus> => {
  const token = process.env.FLY_API_TOKEN;
  if (!token) {
    return { appName, status: 'error', error: 'FLY_API_TOKEN not set' };
  }

  try {
    const response = await axios.post(
      'https://api.fly.io/graphql',
      {
        query: `query($appName: String!) { app(name: $appName) { status } }`,
        variables: { appName },
      },
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const status = response.data?.data?.app?.status;
    if (status === 'running') {
      return { appName, status: 'running' };
    }
    return { appName, status: 'stopped' };
  } catch (err) {
    return { appName, status: 'error', error: 'API request failed' };
  }
};

const FlyStatus = () => {
  const [apps, setApps] = useState<Record<string, AppStatus>>({});

  useEffect(() => {
    const fetchStatuses = async () => {
      const foundFiles = await findFlyTomlFiles();
      const initialApps: Record<string, AppStatus> = {};
      for (const file of foundFiles) {
        const appName = parseFlyToml(file);
        initialApps[file] = { appName, status: appName ? 'loading' : 'error', error: appName ? undefined : 'App name not found' };
      }
      setApps(initialApps);

      for (const file in initialApps) {
        const app = initialApps[file];
        if (app.appName) {
          const status = await getFlyAppStatus(app.appName);
          setApps(prev => ({ ...prev, [file]: status }));
        }
      }
    };

    fetchStatuses();
  }, []);

  return (
    <Box flexDirection="column">
      <Text>Checking Fly.io application status...</Text>
      <Box flexDirection="column" marginTop={1}>
        {Object.entries(apps).map(([file, { appName, status, error }]) => (
          <Text key={file}>
            - {file} ({appName || 'N/A'}):{' '}
            {status === 'loading' && <Text color="yellow">loading...</Text>}
            {status === 'running' && <Text color="green">running</Text>}
            {status === 'stopped' && <Text color="gray">stopped</Text>}
            {status === 'error' && <Text color="red">{error || 'error'}</Text>}
          </Text>
        ))}
      </Box>
    </Box>
  );
};

export default FlyStatus;
