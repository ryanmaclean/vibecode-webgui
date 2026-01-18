import React from 'react';
import { render, screen, fireEvent, waitFor } from '../../../tests/test-utils';
import { ProjectGenerator } from '../ProjectGenerator';
import { useProjectGenerator } from '@/hooks/useProjectGenerator';

// Mock the useProjectGenerator hook
jest.mock('@/hooks/useProjectGenerator');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({
    push: jest.fn(),
  })),
}));

// Mock UI components
jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value, className }: any) => (
    <div className={className} role="progressbar" aria-valuenow={value}>
      {value}%
    </div>
  ),
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children, className }: any) => <div className={className}>{children}</div>,
  AlertTitle: ({ children }: any) => <div>{children}</div>,
  AlertDescription: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

const mockUseProjectGenerator = useProjectGenerator as jest.MockedFunction<typeof useProjectGenerator>;

describe('ProjectGenerator', () => {
  const mockGenerateProject = jest.fn();
  const mockCancelGeneration = jest.fn();
  const mockUpdateProgress = jest.fn();
  const mockHandleComplete = jest.fn();

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Default mock implementation
    mockUseProjectGenerator.mockReturnValue({
      isGenerating: false,
      progress: { status: 'idle', progress: 0, message: 'Ready to generate project' },
      generateProject: mockGenerateProject,
      cancelGeneration: mockCancelGeneration,
      updateProgress: mockUpdateProgress,
      handleComplete: mockHandleComplete,
    });

    // Mock generateProject to return a resolved promise
    mockGenerateProject.mockResolvedValue(undefined);
  });

  it('renders with initial state (no initialPrompt)', () => {
    render(<ProjectGenerator autoStart={false} />);

    // Check that the input field is rendered
    const input = screen.getByTestId('prompt-input') as HTMLInputElement;
    expect(input.value).toBe('');

    // Check that the generate button is rendered
    expect(screen.getByTestId('generate-button')).toBeInTheDocument();
  });

  it('calls generateProject when button is clicked', async () => {
    render(<ProjectGenerator autoStart={false} />);

    const input = screen.getByTestId('prompt-input');
    const button = screen.getByTestId('generate-button');

    fireEvent.change(input, { target: { value: 'test prompt' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockGenerateProject).toHaveBeenCalledWith('test prompt', {});
    });
  });

  it('updates prompt when input changes', () => {
    render(<ProjectGenerator autoStart={false} />);

    const input = screen.getByTestId('prompt-input');
    fireEvent.change(input, { target: { value: 'new prompt' } });

    expect((input as HTMLInputElement).value).toBe('new prompt');
  });

  it('shows progress when generating', () => {
    mockUseProjectGenerator.mockReturnValue({
      isGenerating: true,
      progress: {
        status: 'generating',
        progress: 42,
        message: 'Generating your project...'
      },
      generateProject: mockGenerateProject,
      cancelGeneration: mockCancelGeneration,
      updateProgress: mockUpdateProgress,
      handleComplete: mockHandleComplete,
    });

    render(<ProjectGenerator autoStart={false} />);

    // Check that progress is displayed
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getAllByText(/42%/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/generating your project.../i)).toBeInTheDocument();
  });

  it('shows error state when generation fails', () => {
    mockUseProjectGenerator.mockReturnValue({
      isGenerating: false,
      progress: {
        status: 'error',
        progress: 0,
        message: 'Failed to generate project',
        error: 'Link error',
      },
      generateProject: mockGenerateProject,
      cancelGeneration: mockCancelGeneration,
      updateProgress: mockUpdateProgress,
      handleComplete: mockHandleComplete,
    });

    render(<ProjectGenerator autoStart={false} />);

    // Check that error is displayed
    const errorTexts = screen.getAllByText(/error/i);
    expect(errorTexts.length).toBeGreaterThan(0);
    expect(screen.getByText(/failed to generate project/i)).toBeInTheDocument();
  });

  it('calls onComplete when generation is successful', async () => {
    const mockOnComplete = jest.fn();

    mockUseProjectGenerator.mockImplementation((options) => {
      // Simulate completion
      setTimeout(() => {
        options?.onComplete?.({ workspaceId: 'test-workspace', projectName: 'test-project' });
      }, 100);

      return {
        isGenerating: false,
        progress: {
          status: 'completed',
          progress: 100,
          message: 'Project generated successfully!',
        },
        generateProject: mockGenerateProject,
        cancelGeneration: mockCancelGeneration,
        updateProgress: mockUpdateProgress,
        handleComplete: mockHandleComplete,
      };
    });

    render(<ProjectGenerator onComplete={mockOnComplete} autoStart={false} />);

    // Wait for the onComplete callback to be called
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith({
        workspaceId: 'test-workspace',
        projectName: 'test-project',
      });
    }, { timeout: 3000 });
  });

  it('shows cancel button when generating', () => {
    mockUseProjectGenerator.mockReturnValue({
      isGenerating: true,
      progress: {
        status: 'generating',
        progress: 42,
        message: 'Generating...'
      },
      generateProject: mockGenerateProject,
      cancelGeneration: mockCancelGeneration,
      updateProgress: mockUpdateProgress,
      handleComplete: mockHandleComplete,
    });

    render(<ProjectGenerator autoStart={false} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockCancelGeneration).toHaveBeenCalled();
  });

  it('disables input and button when generating', () => {
    mockUseProjectGenerator.mockReturnValue({
      isGenerating: true,
      progress: {
        status: 'generating',
        progress: 42,
        message: 'Generating...'
      },
      generateProject: mockGenerateProject,
      cancelGeneration: mockCancelGeneration,
      updateProgress: mockUpdateProgress,
      handleComplete: mockHandleComplete,
    });

    render(<ProjectGenerator autoStart={false} />);

    const input = screen.getByTestId('prompt-input');
    const button = screen.getByTestId('generate-button');

    expect(input).toBeDisabled();
    expect(button).toBeDisabled();
  });

  it('shows error with recovery options', () => {
    mockUseProjectGenerator.mockReturnValue({
      isGenerating: false,
      progress: {
        status: 'error',
        progress: 0,
        message: 'Failed to generate project',
        error: 'Network error',
        recoveryOptions: [
          { label: 'Try Again', action: 'retry' },
          { label: 'Modify Prompt', action: 'modify' }
        ]
      },
      generateProject: mockGenerateProject,
      cancelGeneration: mockCancelGeneration,
      updateProgress: mockUpdateProgress,
      handleComplete: mockHandleComplete,
    });

    render(<ProjectGenerator autoStart={false} />);

    // Check that recovery options are displayed
    expect(screen.getByText(/try again/i)).toBeInTheDocument();
    expect(screen.getByText(/modify prompt/i)).toBeInTheDocument();
  });

  it('disables generate button when prompt is empty', () => {
    render(<ProjectGenerator autoStart={false} />);

    const button = screen.getByTestId('generate-button');
    expect(button).toBeDisabled();
  });

  it('shows different status icons for different states', () => {
    const statuses: Array<{ status: any, message: string }> = [
      { status: 'initializing', message: 'Starting...' },
      { status: 'seeding', message: 'Seeding data...' },
      { status: 'installing', message: 'Installing dependencies...' },
      { status: 'finalizing', message: 'Finalizing...' },
      { status: 'completed', message: 'Complete!' },
    ];

    statuses.forEach(({ status, message }) => {
      mockUseProjectGenerator.mockReturnValue({
        isGenerating: status !== 'completed',
        progress: { status, progress: 50, message },
        generateProject: mockGenerateProject,
        cancelGeneration: mockCancelGeneration,
        updateProgress: mockUpdateProgress,
        handleComplete: mockHandleComplete,
      });

      const { unmount } = render(<ProjectGenerator autoStart={false} />);

      // Verify status text is displayed
      const statusText = status.charAt(0).toUpperCase() + status.slice(1);
      expect(screen.getByText(statusText)).toBeInTheDocument();
      expect(screen.getByText(message)).toBeInTheDocument();

      unmount();
    });
  });
});
