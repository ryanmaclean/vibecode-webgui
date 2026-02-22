import React from 'react';
import { render, screen, waitFor } from '../../../tests/test-utils';
import { VisualDiff, DiffEditorLoadingSkeleton } from '@/components/editor/VisualDiff';
import { useTheme } from 'next-themes';

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: jest.fn(),
}));

// Mock next/dynamic
jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (importFn: any, options: any) => {
    const Component = (props: any) => {
      // Return loading component if specified
      if (options?.loading) {
        return options.loading();
      }
      // Return null for the actual diff editor since we're testing the wrapper
      return null;
    };
    Component.displayName = 'DynamicDiffEditor';
    return Component;
  },
}));

// Mock @monaco-editor/react
jest.mock('@monaco-editor/react', () => ({
  DiffEditor: ({ original, modified, language, theme, height, width, onMount, options }: any) => (
    <div
      data-testid="monaco-diff-editor"
      data-original={original}
      data-modified={modified}
      data-language={language}
      data-theme={theme}
      data-height={height}
      data-width={width}
      data-readonly={options?.readOnly}
      data-side-by-side={options?.renderSideBySide}
    >
      Monaco Diff Editor
    </div>
  ),
}));

// Mock DiffControls component
jest.mock('@/components/editor/DiffControls', () => ({
  DiffControls: ({ statistics, onAccept, onReject, disabled, level, label }: any) => (
    <div
      data-testid="diff-controls"
      data-statistics={JSON.stringify(statistics)}
      data-disabled={disabled}
      data-level={level}
      data-label={label}
    >
      <button onClick={onAccept} data-testid="accept-button">Accept</button>
      <button onClick={onReject} data-testid="reject-button">Reject</button>
    </div>
  ),
}));

const mockUseTheme = useTheme as jest.MockedFunction<typeof useTheme>;

describe('VisualDiff', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({
      theme: 'light',
      setTheme: jest.fn(),
      systemTheme: 'light',
      themes: ['light', 'dark'],
      resolvedTheme: 'light',
    });
  });

  describe('Basic rendering', () => {
    it('renders with required props', () => {
      render(
        <VisualDiff
          original="const a = 1;"
          modified="const a = 2;"
          language="javascript"
        />
      );

      const editor = screen.getByTestId('monaco-diff-editor');
      expect(editor).toBeInTheDocument();
      expect(editor).toHaveAttribute('data-original', 'const a = 1;');
      expect(editor).toHaveAttribute('data-modified', 'const a = 2;');
      expect(editor).toHaveAttribute('data-language', 'javascript');
    });

    it('renders with default height and width', () => {
      render(
        <VisualDiff
          original="old"
          modified="new"
          language="typescript"
        />
      );

      const editor = screen.getByTestId('monaco-diff-editor');
      expect(editor).toHaveAttribute('data-height', '100%');
      expect(editor).toHaveAttribute('data-width', '100%');
    });

    it('renders with custom height and width', () => {
      render(
        <VisualDiff
          original="old"
          modified="new"
          language="typescript"
          height="500px"
          width="800px"
        />
      );

      const editor = screen.getByTestId('monaco-diff-editor');
      expect(editor).toHaveAttribute('data-height', '500px');
      expect(editor).toHaveAttribute('data-width', '800px');
    });

    it('renders with numeric height and width', () => {
      render(
        <VisualDiff
          original="old"
          modified="new"
          language="typescript"
          height={600}
          width={1000}
        />
      );

      const editor = screen.getByTestId('monaco-diff-editor');
      expect(editor).toHaveAttribute('data-height', '600');
      expect(editor).toHaveAttribute('data-width', '1000');
    });
  });

  describe('Theme support', () => {
    it('uses light theme when theme is light', () => {
      mockUseTheme.mockReturnValue({
        theme: 'light',
        setTheme: jest.fn(),
        systemTheme: 'light',
        themes: ['light', 'dark'],
        resolvedTheme: 'light',
      });

      render(
        <VisualDiff
          original="old"
          modified="new"
          language="typescript"
        />
      );

      const editor = screen.getByTestId('monaco-diff-editor');
      expect(editor).toHaveAttribute('data-theme', 'light');
    });

    it('uses dark theme when theme is dark', () => {
      mockUseTheme.mockReturnValue({
        theme: 'dark',
        setTheme: jest.fn(),
        systemTheme: 'dark',
        themes: ['light', 'dark'],
        resolvedTheme: 'dark',
      });

      render(
        <VisualDiff
          original="old"
          modified="new"
          language="typescript"
        />
      );

      const editor = screen.getByTestId('monaco-diff-editor');
      expect(editor).toHaveAttribute('data-theme', 'vs-dark');
    });
  });

  describe('Language support', () => {
    it('supports javascript', () => {
      render(
        <VisualDiff
          original="var x = 1;"
          modified="let x = 1;"
          language="javascript"
        />
      );

      const editor = screen.getByTestId('monaco-diff-editor');
      expect(editor).toHaveAttribute('data-language', 'javascript');
    });

    it('supports typescript', () => {
      render(
        <VisualDiff
          original="const x: number = 1;"
          modified="const x: number = 2;"
          language="typescript"
        />
      );

      const editor = screen.getByTestId('monaco-diff-editor');
      expect(editor).toHaveAttribute('data-language', 'typescript');
    });

    it('supports python', () => {
      render(
        <VisualDiff
          original="x = 1"
          modified="x = 2"
          language="python"
        />
      );

      const editor = screen.getByTestId('monaco-diff-editor');
      expect(editor).toHaveAttribute('data-language', 'python');
    });
  });

  describe('Editor options', () => {
    it('sets readOnly to true when no onModifiedChange handler is provided', () => {
      render(
        <VisualDiff
          original="old"
          modified="new"
          language="typescript"
        />
      );

      const editor = screen.getByTestId('monaco-diff-editor');
      expect(editor).toHaveAttribute('data-readonly', 'true');
    });

    it('sets readOnly to false when onModifiedChange handler is provided', () => {
      const onModifiedChange = jest.fn();
      render(
        <VisualDiff
          original="old"
          modified="new"
          language="typescript"
          onModifiedChange={onModifiedChange}
        />
      );

      const editor = screen.getByTestId('monaco-diff-editor');
      expect(editor).toHaveAttribute('data-readonly', 'false');
    });

    it('renders side-by-side by default', () => {
      render(
        <VisualDiff
          original="old"
          modified="new"
          language="typescript"
        />
      );

      const editor = screen.getByTestId('monaco-diff-editor');
      expect(editor).toHaveAttribute('data-side-by-side', 'true');
    });

    it('accepts custom options', () => {
      render(
        <VisualDiff
          original="old"
          modified="new"
          language="typescript"
          options={{
            renderSideBySide: false,
            readOnly: true,
          }}
        />
      );

      const editor = screen.getByTestId('monaco-diff-editor');
      // Custom options should override defaults
      expect(editor).toHaveAttribute('data-side-by-side', 'false');
      expect(editor).toHaveAttribute('data-readonly', 'true');
    });
  });

  describe('Controls', () => {
    it('does not show controls by default', () => {
      render(
        <VisualDiff
          original="old"
          modified="new"
          language="typescript"
        />
      );

      expect(screen.queryByTestId('diff-controls')).not.toBeInTheDocument();
    });

    it('shows controls when showControls is true', () => {
      render(
        <VisualDiff
          original="old"
          modified="new"
          language="typescript"
          showControls={true}
        />
      );

      expect(screen.getByTestId('diff-controls')).toBeInTheDocument();
    });

    it('passes statistics to controls', () => {
      const statistics = {
        additions: 5,
        deletions: 2,
        modifications: 3,
      };

      render(
        <VisualDiff
          original="old"
          modified="new"
          language="typescript"
          showControls={true}
          statistics={statistics}
        />
      );

      const controls = screen.getByTestId('diff-controls');
      expect(controls).toHaveAttribute('data-statistics', JSON.stringify(statistics));
    });

    it('passes label to controls', () => {
      render(
        <VisualDiff
          original="old"
          modified="new"
          language="typescript"
          showControls={true}
          controlsLabel="Review changes"
        />
      );

      const controls = screen.getByTestId('diff-controls');
      expect(controls).toHaveAttribute('data-label', 'Review changes');
    });

    it('passes disabled state to controls', () => {
      render(
        <VisualDiff
          original="old"
          modified="new"
          language="typescript"
          showControls={true}
          controlsDisabled={true}
        />
      );

      const controls = screen.getByTestId('diff-controls');
      expect(controls).toHaveAttribute('data-disabled', 'true');
    });

    it('passes level to controls', () => {
      render(
        <VisualDiff
          original="old"
          modified="new"
          language="typescript"
          showControls={true}
        />
      );

      const controls = screen.getByTestId('diff-controls');
      expect(controls).toHaveAttribute('data-level', 'hunk');
    });
  });

  describe('Callbacks', () => {
    it('calls onAccept when accept button is clicked', () => {
      const onAccept = jest.fn();
      render(
        <VisualDiff
          original="old"
          modified="new"
          language="typescript"
          showControls={true}
          onAccept={onAccept}
        />
      );

      const acceptButton = screen.getByTestId('accept-button');
      acceptButton.click();

      expect(onAccept).toHaveBeenCalledTimes(1);
    });

    it('calls onReject when reject button is clicked', () => {
      const onReject = jest.fn();
      render(
        <VisualDiff
          original="old"
          modified="new"
          language="typescript"
          showControls={true}
          onReject={onReject}
        />
      );

      const rejectButton = screen.getByTestId('reject-button');
      rejectButton.click();

      expect(onReject).toHaveBeenCalledTimes(1);
    });
  });

  describe('Content variations', () => {
    it('handles empty strings', () => {
      render(
        <VisualDiff
          original=""
          modified=""
          language="typescript"
        />
      );

      const editor = screen.getByTestId('monaco-diff-editor');
      expect(editor).toHaveAttribute('data-original', '');
      expect(editor).toHaveAttribute('data-modified', '');
    });

    it('handles multiline content', () => {
      const original = `function hello() {
  console.log('Hello');
}`;
      const modified = `function hello() {
  console.log('Hello World');
}`;

      render(
        <VisualDiff
          original={original}
          modified={modified}
          language="javascript"
        />
      );

      const editor = screen.getByTestId('monaco-diff-editor');
      expect(editor).toHaveAttribute('data-original', original);
      expect(editor).toHaveAttribute('data-modified', modified);
    });

    it('handles special characters', () => {
      const original = 'const str = "Hello & <World>";';
      const modified = 'const str = "Hello & <Universe>";';

      render(
        <VisualDiff
          original={original}
          modified={modified}
          language="typescript"
        />
      );

      const editor = screen.getByTestId('monaco-diff-editor');
      expect(editor).toHaveAttribute('data-original', original);
      expect(editor).toHaveAttribute('data-modified', modified);
    });
  });

  describe('Layout', () => {
    it('has correct container classes without controls', () => {
      const { container } = render(
        <VisualDiff
          original="old"
          modified="new"
          language="typescript"
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('flex');
      expect(wrapper).toHaveClass('flex-col');
      expect(wrapper).toHaveClass('h-full');
      expect(wrapper).toHaveClass('w-full');
    });

    it('has correct container classes with controls', () => {
      const { container } = render(
        <VisualDiff
          original="old"
          modified="new"
          language="typescript"
          showControls={true}
        />
      );

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('flex');
      expect(wrapper).toHaveClass('flex-col');
      expect(wrapper).toHaveClass('h-full');
      expect(wrapper).toHaveClass('w-full');
    });
  });

  describe('Full composition', () => {
    it('renders complete diff view with all features', () => {
      const onAccept = jest.fn();
      const onReject = jest.fn();
      const onModifiedChange = jest.fn();
      const statistics = {
        additions: 10,
        deletions: 5,
        modifications: 2,
      };

      render(
        <VisualDiff
          original="const x = 1;"
          modified="const x = 2;"
          language="typescript"
          height="600px"
          width="100%"
          showControls={true}
          onAccept={onAccept}
          onReject={onReject}
          onModifiedChange={onModifiedChange}
          statistics={statistics}
          controlsLabel="Code Review"
          controlsDisabled={false}
        />
      );

      // Check editor is rendered
      const editor = screen.getByTestId('monaco-diff-editor');
      expect(editor).toBeInTheDocument();
      expect(editor).toHaveAttribute('data-original', 'const x = 1;');
      expect(editor).toHaveAttribute('data-modified', 'const x = 2;');
      expect(editor).toHaveAttribute('data-language', 'typescript');

      // Check controls are rendered
      const controls = screen.getByTestId('diff-controls');
      expect(controls).toBeInTheDocument();
      expect(controls).toHaveAttribute('data-label', 'Code Review');
      expect(controls).toHaveAttribute('data-statistics', JSON.stringify(statistics));

      // Check callbacks work
      screen.getByTestId('accept-button').click();
      expect(onAccept).toHaveBeenCalled();

      screen.getByTestId('reject-button').click();
      expect(onReject).toHaveBeenCalled();
    });
  });
});

describe('DiffEditorLoadingSkeleton', () => {
  it('renders loading skeleton', () => {
    render(<DiffEditorLoadingSkeleton />);
    expect(screen.getByText('Loading Diff Editor...')).toBeInTheDocument();
  });

  it('has correct loading animation classes', () => {
    const { container } = render(<DiffEditorLoadingSkeleton />);
    const skeleton = container.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('renders loading dots', () => {
    const { container } = render(<DiffEditorLoadingSkeleton />);
    const dots = container.querySelectorAll('.rounded-full');
    expect(dots.length).toBeGreaterThanOrEqual(3);
  });

  it('has proper accessibility structure', () => {
    const { container } = render(<DiffEditorLoadingSkeleton />);
    const skeleton = container.firstChild as HTMLElement;
    expect(skeleton).toHaveClass('flex');
    expect(skeleton).toHaveClass('h-full');
    expect(skeleton).toHaveClass('w-full');
  });
});
