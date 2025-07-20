import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ProjectGenerator } from '@/components/ProjectGenerator';
import { logEvent } from '@/lib/analytics';

// Mock next-auth and next/navigation
jest.mock('next-auth/react');
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock the analytics module
jest.mock('@/lib/analytics', () => ({
  logEvent: jest.fn(),
  trackTiming: jest.fn(),
  trackError: jest.fn(),
}));

// Mock the ProjectGenerator component to test the integration
jest.mock('@/components/ProjectGenerator', () => {
  const MockProjectGenerator = ({
    initialPrompt = '',
    onComplete,
    autoStart = false,
  }: {
    initialPrompt?: string;
    onComplete?: (data: { workspaceId: string; projectName: string }) => void;
    autoStart?: boolean;
  }) => {
    React.useEffect(() => {
      if (autoStart && initialPrompt) {
        // Simulate completion after a short delay
        const timer = setTimeout(() => {
          onComplete?.({
            workspaceId: 'test-workspace-123',
            projectName: 'Test Project',
          });
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [autoStart, initialPrompt, onComplete]);

    return (
      <div data-testid="mock-project-generator">
        <input 
          data-testid="prompt-input" 
          defaultValue={initialPrompt} 
          onChange={() => {}} 
        />
        <button 
          data-testid="generate-button"
          onClick={() => {
            onComplete?.({
              workspaceId: 'test-workspace-123',
              projectName: 'Test Project',
            });
          }}
        >
          Generate Project
        </button>
      </div>
    );
  };
  return MockProjectGenerator;
});

describe('App Generator Integration', () => {
  const mockPush = jest.fn();
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock useSession
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { id: 'test-user', email: 'test@example.com' } },
      status: 'authenticated',
    });
    
    // Mock useRouter
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    });
  });

  it('renders the project generator with initial prompt', () => {
    render(
      <ProjectGenerator 
        initialPrompt="Create a React app"
        onComplete={jest.fn()}
      />
    );
    
    const input = screen.getByTestId('prompt-input') as HTMLInputElement;
    expect(input.value).toBe('Create a React app');
    expect(screen.getByTestId('generate-button')).toBeInTheDocument();
  });

  it('calls onComplete with workspace details when generation is complete', async () => {
    const handleComplete = jest.fn();
    
    render(
      <ProjectGenerator 
        initialPrompt="Create a React app"
        onComplete={handleComplete}
        autoStart={true}
      />
    );
    
    // Wait for the auto-complete to happen
    await waitFor(() => {
      expect(handleComplete).toHaveBeenCalledWith({
        workspaceId: 'test-workspace-123',
        projectName: 'Test Project',
      });
    });
    
    // Verify navigation occurred
    expect(mockPush).toHaveBeenCalledWith('/workspace/test-workspace-123');
  });

  it('tracks analytics events during generation', async () => {
    render(
      <ProjectGenerator 
        initialPrompt="Create a React app"
        onComplete={jest.fn()}
        autoStart={true}
      />
    );
    
    // Wait for the auto-complete to happen
    await waitFor(() => {
      expect(logEvent).toHaveBeenCalledWith(
        'project_generation_complete',
        expect.objectContaining({
          workspaceId: 'test-workspace-123',
          projectName: 'Test Project',
        })
      );
    });
  });

  it('handles generation errors gracefully', async () => {
    // Mock the ProjectGenerator to throw an error
    jest.requireMock('@/components/ProjectGenerator').default = () => {
      throw new Error('Generation failed');
    };
    
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = jest.fn();
    
    try {
      render(
        <ProjectGenerator 
          initialPrompt="Create a React app"
          onComplete={jest.fn()}
          autoStart={true}
        />
      );
      
      // Verify error was tracked
      await waitFor(() => {
        expect(logEvent).toHaveBeenCalledWith(
          'project_generation_error',
          expect.objectContaining({
            error: 'Generation failed',
          })
        );
      });
    } finally {
      // Restore console.error
      console.error = originalError;
    }
  });

  it('requires authentication', () => {
    // Mock unauthenticated session
    (useSession as jest.Mock).mockReturnValue({
      data: null,
      status: 'unauthenticated',
    });
    
    render(
      <ProjectGenerator 
        initialPrompt="Create a React app"
        onComplete={jest.fn()}
      />
    );
    
    // Verify authentication prompt is shown
    expect(screen.getByText(/sign in to generate projects/i)).toBeInTheDocument();
  });
});
