import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectGenerator } from '../ProjectGenerator';
import { useProjectGenerator } from '@/hooks/useProjectGenerator';

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
    
    // Default mock implementation
    mockUseProjectGenerator.mockReturnValue({
      isGenerating: false,
      progress: { status: 'idle', progress: 0, message: '' },
      generateProject: mockGenerateProject,
      cancelGeneration: mockCancelGeneration,
      updateProgress: mockUpdateProgress,
    });
  });

  it('renders with initial state', () => {
    render(<ProjectGenerator {...defaultProps} />);
    
    // Check that the input field is rendered with initial prompt
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('test prompt');
    
    // Check that the generate button is rendered
    expect(screen.getByRole('button', { name: /generate project/i })).toBeInTheDocument();
  });

  it('calls generateProject when form is submitted', () => {
    render(<ProjectGenerator {...defaultProps} />);
    
    const button = screen.getByRole('button', { name: /generate project/i });
    fireEvent.click(button);
    
    expect(mockGenerateProject).toHaveBeenCalledWith('test prompt');
  });

  it('updates prompt when input changes', () => {
    render(<ProjectGenerator {...defaultProps} />);
    
    const input = screen.getByRole('textbox');
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
    });

    render(<ProjectGenerator {...defaultProps} />);
    
    // Check that error is displayed
    expect(screen.getByText(/error/i)).toBeInTheDocument();
    expect(screen.getByText(/failed to generate project/i)).toBeInTheDocument();
  });

  it('calls onComplete when generation is successful', async () => {
    const mockOnComplete = jest.fn();
    
    mockUseProjectGenerator.mockImplementation(({ onComplete }) => {
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
    render(<ProjectGenerator {...defaultProps} autoStart={true} />);
    
    expect(mockGenerateProject).toHaveBeenCalledWith('test prompt');
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
    });

    render(<ProjectGenerator {...defaultProps} />);
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);
    
    expect(mockCancelGeneration).toHaveBeenCalled();
  });
});
