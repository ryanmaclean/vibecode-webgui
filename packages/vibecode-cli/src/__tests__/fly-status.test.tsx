import React from 'react';
import { render } from 'ink-testing-library';
import { glob } from 'glob';
import fs from 'fs';
import axios from 'axios';
import FlyStatus, { findFlyTomlFiles, parseFlyToml, getFlyAppStatus } from '../commands/fly-status';

// Mock libraries
jest.mock('glob', () => ({ glob: jest.fn() }));
jest.mock('fs');
jest.mock('axios');

const mockedGlob = glob as jest.Mock;
const mockedFs = fs as jest.Mocked<typeof fs>;
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('Fly Status Command', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, FLY_API_TOKEN: 'test-token' };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('getFlyAppStatus', () => {
    it('should return running status', async () => {
      mockedAxios.post.mockResolvedValue({ data: { data: { app: { status: 'running' } } } });
      const result = await getFlyAppStatus('my-app');
      expect(result).toEqual({ appName: 'my-app', status: 'running' });
    });

    it('should return stopped status', async () => {
      mockedAxios.post.mockResolvedValue({ data: { data: { app: { status: 'stopped' } } } });
      const result = await getFlyAppStatus('my-app');
      expect(result).toEqual({ appName: 'my-app', status: 'stopped' });
    });

    it('should return error on API failure', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));
      const result = await getFlyAppStatus('my-app');
      expect(result).toEqual({ appName: 'my-app', status: 'error', error: 'API request failed' });
    });

    it('should return error if token is not set', async () => {
      delete process.env.FLY_API_TOKEN;
      const result = await getFlyAppStatus('my-app');
      expect(result).toEqual({ appName: 'my-app', status: 'error', error: 'FLY_API_TOKEN not set' });
    });
  });

  describe('FlyStatus Component', () => {
    it('should render the live status of applications', async () => {
      mockedGlob.mockResolvedValue(['fly.toml']);
      mockedFs.readFileSync.mockReturnValue('app = "live-app"');
      mockedAxios.post.mockResolvedValue({ data: { data: { app: { status: 'running' } } } });

      const { lastFrame } = render(<FlyStatus />);

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(lastFrame()).toContain('live-app');
      expect(lastFrame()).toContain('running');
    });
  });
});
