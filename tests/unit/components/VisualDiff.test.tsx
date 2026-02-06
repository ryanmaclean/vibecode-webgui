/**
 * VisualDiff Component Tests
 * 
 * Tests for the Visual Diff side-by-side file comparison component
 * 
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import '@testing-library/jest-dom';

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: jest.fn(() => ({ theme: 'light' })),
}));

// Mock @monaco-editor/react
jest.mock('@monaco-editor/react', () => ({
  __esModule: true,
  DiffEditor: jest.fn(({ original, modified, language, theme, options }) => (
    <div data-testid="diff-editor">
      <div data-testid="original-content">{original}</div>
      <div data-testid="modified-content">{modified}</div>
      <div data-testid="language">{language}</div>
      <div data-testid="theme">{theme}</div>
      <div data-testid="read-only">{options?.readOnly ? 'true' : 'false'}</div>
    </div>
  )),
}));

// Import after mocks
import { VisualDiff } from '@/components/editor/VisualDiff';

describe('VisualDiff Component', () => {
  const originalCode = 'const x = 1;';
  const modifiedCode = 'const x = 2;';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the diff editor with original and modified content', async () => {
    render(
      <VisualDiff
        original={originalCode}
        modified={modifiedCode}
        language="javascript"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('diff-editor')).toBeInTheDocument();
    });

    expect(screen.getByTestId('original-content')).toHaveTextContent(originalCode);
    expect(screen.getByTestId('modified-content')).toHaveTextContent(modifiedCode);
  });

  it('applies the correct language for syntax highlighting', async () => {
    render(
      <VisualDiff
        original={originalCode}
        modified={modifiedCode}
        language="typescript"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('language')).toHaveTextContent('typescript');
    });
  });

  it('uses light theme by default when system theme is light', async () => {
    const { useTheme } = require('next-themes');
    useTheme.mockReturnValue({ theme: 'light' });

    render(
      <VisualDiff
        original={originalCode}
        modified={modifiedCode}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('light');
    });
  });

  it('uses dark theme when system theme is dark', async () => {
    const { useTheme } = require('next-themes');
    useTheme.mockReturnValue({ theme: 'dark' });

    render(
      <VisualDiff
        original={originalCode}
        modified={modifiedCode}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('vs-dark');
    });
  });

  it('respects explicit theme prop over system theme', async () => {
    const { useTheme } = require('next-themes');
    useTheme.mockReturnValue({ theme: 'light' });

    render(
      <VisualDiff
        original={originalCode}
        modified={modifiedCode}
        theme="hc-black"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme')).toHaveTextContent('hc-black');
    });
  });

  it('renders in read-only mode by default', async () => {
    render(
      <VisualDiff
        original={originalCode}
        modified={modifiedCode}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('read-only')).toHaveTextContent('true');
    });
  });

  it('can be configured as editable', async () => {
    render(
      <VisualDiff
        original={originalCode}
        modified={modifiedCode}
        readOnly={false}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('read-only')).toHaveTextContent('false');
    });
  });

  it('defaults to plaintext language when not specified', async () => {
    render(
      <VisualDiff
        original={originalCode}
        modified={modifiedCode}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('language')).toHaveTextContent('plaintext');
    });
  });

  it('applies custom className when provided', () => {
    const { container } = render(
      <VisualDiff
        original={originalCode}
        modified={modifiedCode}
        className="custom-diff-class"
      />
    );

    const wrapper = container.querySelector('.custom-diff-class');
    expect(wrapper).toBeInTheDocument();
  });

  it('supports custom height and width', () => {
    const { container } = render(
      <VisualDiff
        original={originalCode}
        modified={modifiedCode}
        height="600px"
        width="800px"
      />
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.style.height).toBe('600px');
    expect(wrapper.style.width).toBe('800px');
  });

  it('handles empty content gracefully', async () => {
    render(
      <VisualDiff
        original=""
        modified=""
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('diff-editor')).toBeInTheDocument();
    });
  });

  it('handles large content differences', async () => {
    const largeOriginal = 'line 1\n'.repeat(1000);
    const largeModified = 'line 2\n'.repeat(1000);

    render(
      <VisualDiff
        original={largeOriginal}
        modified={largeModified}
        language="javascript"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('diff-editor')).toBeInTheDocument();
    });
  });
});

describe('VisualDiff Edge Cases', () => {
  it('handles special characters in content', async () => {
    const specialChars = 'const str = "Hello\\n\\t<>&\'";';
    
    render(
      <VisualDiff
        original={specialChars}
        modified={specialChars + ' // comment'}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('original-content')).toHaveTextContent(specialChars);
    });
  });

  it('handles multi-line content', async () => {
    const multiline = `function hello() {
  console.log("world");
  return true;
}`;

    render(
      <VisualDiff
        original={multiline}
        modified={multiline.replace('world', 'universe')}
        language="javascript"
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('diff-editor')).toBeInTheDocument();
    });
  });

  it('handles unicode characters', async () => {
    const unicode = 'const emoji = "🎉🚀✨";';
    
    render(
      <VisualDiff
        original={unicode}
        modified={unicode + '\nconst more = "🌟";'}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('diff-editor')).toBeInTheDocument();
    });
  });
});
