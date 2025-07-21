import React from 'react';
import { render } from 'ink-testing-library';
import { App } from '../index';
import { glob } from 'glob';

// Mock glob since the fly-status command uses it
jest.mock('glob', () => ({
  glob: jest.fn(),
}));

const mockedGlob = glob as jest.Mock;

describe('CLI App Routing', () => {
  it('should render the help message by default', () => {
    const { lastFrame } = render(<App args={[]} />);
    expect(lastFrame()).toContain('Welcome to VibeCode CLI!');
    expect(lastFrame()).toContain('fly-status');
  });

  it('should render the FlyStatus component when passed the fly-status argument', () => {
    mockedGlob.mockResolvedValue([]);
    const { lastFrame } = render(<App args={['fly-status']} />);
    expect(lastFrame()).toContain('Searching for fly.toml files...');
  });
});
