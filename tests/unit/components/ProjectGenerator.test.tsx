import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectGenerator } from '@/components/ProjectGenerator';
import { useProjectGenerator } from '@/hooks/useProjectGenerator';

// Mock UI components
jest.mock('@/components/ui/alert', () => ({
  Alert: ({ children, ...props }: any) => <div data-testid="alert" {...props}>{children}</div>,
  AlertTitle: ({ children, ...props }: any) => <div data-testid="alert-title" {...props}>{children}</div>,
  AlertDescription: ({ children, ...props }: any) => <div data-testid="alert-description" {...props}>{children}</div>,
}));

// Mock the useProjectGenerator hook
jest.mock('@/hooks/useProjectGenerator');

const mockUseProjectGenerator = useProjectGenerator as jest.MockedFunction<typeof useProjectGenerator>;

describe('ProjectGenerator', () => {
  const mockGenerateProject = jest.fn();
  const mockCancelGeneration = jest.fn();
  const mockUpdateProgress = jest.fn();

  const defaultProps = {
    onComplete: jest.fn(),
    autoStart: false,
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock generateProject to return a resolved promise by default
    mockGenerateProject.mockResolvedValue(undefined);

    // Default mock implementation
    mockUseProjectGenerator.mockReturnValue({
      isGenerating: false,
      progress: { status: 'idle', progress: 0, message: '' },
      generateProject: mockGenerateProject,
      cancelGeneration: mockCancelGeneration,
      updateProgress: mockUpdateProgress,
      handleComplete: jest.fn(),
    });
  });

  it('renders with initial state', () => {
    render(<ProjectGenerator {...defaultProps} />);

    // Check that the input field is rendered
    const input = screen.getByTestId('prompt-input') as HTMLInputElement;
    expect(input.value).toBe('');

    // Check that the generate button is rendered
    expect(screen.getByTestId('generate-button')).toBeInTheDocument();
    expect(screen.getByText('Generate a New Project')).toBeInTheDocument();
  });

  it('calls generateProject when form is submitted', () => {
    render(<ProjectGenerator {...defaultProps} />);

    const input = screen.getByTestId('prompt-input');
    const button = screen.getByTestId('generate-button');

    fireEvent.change(input, { target: { value: 'test prompt' } });
    fireEvent.click(button);

    expect(mockGenerateProject).toHaveBeenCalledWith('test prompt', expect.any(Object));
  });

  it('updates prompt when input changes', () => {
    render(<ProjectGenerator {...defaultProps} />);

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
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
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

    // Check that error is displayed (there are multiple matches due to title and icon)
    expect(screen.getAllByText(/error/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/failed to generate project/i)).toBeInTheDocument();
  });

  it('calls onComplete when generation is successful', async () => {
    const mockOnComplete = jest.fn();
    
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

  it('auto-starts generation when autoStart is true', () => {
    // Mock generateProject to return a resolved promise
    mockGenerateProject.mockResolvedValue(undefined);

    render(<ProjectGenerator {...defaultProps} initialPrompt="test prompt" autoStart={true} />);

    // Wait for useEffect to trigger
    expect(mockGenerateProject).toHaveBeenCalledWith('test prompt', expect.any(Object));
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

    const cancelButton = screen.getByText(/cancel/i);
    fireEvent.click(cancelButton);

    expect(mockCancelGeneration).toHaveBeenCalled();
  });
});
