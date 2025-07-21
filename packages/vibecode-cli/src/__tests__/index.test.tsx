import React from 'react';
import { render } from 'ink-testing-library';
import App from '../index';

describe('CLI App', () => {
  it('should render hello world', () => {
    const { lastFrame } = render(<App />);

    expect(lastFrame()).toContain('Hello, World!');
  });
});
