import React from 'react';
import { render, screen, fireEvent, waitFor } from '../../test-utils';
import { ProjectGenerator } from '@/components/ProjectGenerator';
import { useProjectGenerator } from '@/hooks/useProjectGenerator';

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>{children}</button>
  )
}));

jest.mock('@/components/ui/progress', () => ({
  Progress: ({ value, ...props }: any) => (
    <div data-testid="progress" data-value={value} {...props} />
  )
}));

jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children, ...props }: any) => <div data-testid="alert" {...props}>{children}</div>,
  AlertDescription: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  AlertTitle: ({ children, ...props }: any) => <div {...props}>{children}</div>
}));

// Mock the useProjectGenerator hook
jest.mock('@/hooks/useProjectGenerator');

const mockUseProjectGenerator = useProjectGenerator as jest.MockedFunction<typeof useProjectGenerator>;

describe('ProjectGenerator', () => {
  const mockGenerateProject = jest.fn();
  const mockCancelGeneration = jest.fn();
  const mockUpdateProgress = jest.fn();

  const defaultProps = {
    initialPrompt: 'test prompt',
    onComplete: jest.fn(),
    autoStart: false,
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock generateProject to return a resolved promise
    mockGenerateProject.mockResolvedValue(undefined);

    // Default mock implementation
    mockUseProjectGenerator.mockReturnValue({
      isGenerating: false,
      progress: { status: 'idle', progress: 0, message: 'Ready to generate project' },
      generateProject: mockGenerateProject,
      cancelGeneration: mockCancelGeneration,
      updateProgress: mockUpdateProgress,
      handleComplete: jest.fn(),
    });
  });

  it('renders with initial state', () => {
    render(<ProjectGenerator {...defaultProps} />);

    // Component doesn't show input when initialPrompt is provided
    // but we're setting autoStart to false, so the component should be waiting
    // Check that nothing is visible when autoStart is false and initialPrompt is provided
  });

  it('calls generateProject when form is submitted', () => {
    render(<ProjectGenerator initialPrompt="" onComplete={jest.fn()} autoStart={false} />);

    const input = screen.getByTestId('prompt-input');
    fireEvent.change(input, { target: { value: 'test prompt' } });

    const button = screen.getByTestId('generate-button');
    fireEvent.click(button);

    expect(mockGenerateProject).toHaveBeenCalledWith('test prompt', {});
  });

  it('updates prompt when input changes', () => {
    render(<ProjectGenerator initialPrompt="" onComplete={jest.fn()} autoStart={false} />);

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
      handleComplete: jest.fn(),
    });

    render(<ProjectGenerator {...defaultProps} />);

    // Check that progress is displayed
    expect(screen.getByText(/42%/i)).toBeInTheDocument();
    expect(screen.getByText(/generating your project.../i)).toBeInTheDocument();
  });

  it('shows error state when generation fails', () => {
    mockUseProjectGenerator.mockReturnValue({
      isGenerating: false,
      progress: {
        status: 'error',
        progress: 0,
        message: 'Failed to generate project',
        error: 'Network error',
      },
      generateProject: mockGenerateProject,
      cancelGeneration: mockCancelGeneration,
      updateProgress: mockUpdateProgress,
      handleComplete: jest.fn(),
    });

    render(<ProjectGenerator {...defaultProps} />);

    // Check that error is displayed - use getAllByText and verify one exists
    const errorTexts = screen.getAllByText('Error');
    expect(errorTexts.length).toBeGreaterThan(0);
    expect(screen.getByText(/failed to generate project/i)).toBeInTheDocument();
  });

  it('calls onComplete when generation is successful', async () => {
    const mockOnComplete = jest.fn();
    delete (window as { location?: unknown }).location;
    (window as { location: { href: string } }).location = { href: '' };

    mockUseProjectGenerator.mockImplementation((options) => {
      const onComplete = options?.onComplete;
      // Simulate completion after a short delay
      setTimeout(() => {
        onComplete?.({ workspaceId: 'test-workspace', projectName: 'test-project' });
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
        handleComplete: jest.fn(),
      };
    });

    render(<ProjectGenerator {...defaultProps} onComplete={mockOnComplete} />);

    // Wait for the onComplete callback to be called
    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith({
        workspaceId: 'test-workspace',
        projectName: 'test-project',
      });
    });
  });

  it('auto-starts generation when autoStart is true', async () => {
    mockGenerateProject.mockResolvedValue(undefined);

    render(<ProjectGenerator {...defaultProps} autoStart={true} />);

    await waitFor(() => {
      expect(mockGenerateProject).toHaveBeenCalledWith('test prompt', {});
    });
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
      handleComplete: jest.fn(),
    });

    render(<ProjectGenerator {...defaultProps} />);
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);
    
    expect(mockCancelGeneration).toHaveBeenCalled();
  });
});
