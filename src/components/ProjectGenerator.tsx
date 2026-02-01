'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle, Terminal, File, Wrench, Send } from 'lucide-react';
import { useProjectGenerator } from '@/hooks/useProjectGenerator';

// Re-export types for external use
export type { GenerationStatus, ProgressData } from '@/hooks/useProjectGenerator';

const statusIcons = {
  idle: <Terminal className="h-4 w-4" />,
  initializing: <Wrench className="h-4 w-4 animate-spin" />,
  generating: <File className="h-4 w-4 animate-pulse" />,
  seeding: <File className="h-4 w-4 animate-pulse" />,
  installing: <Wrench className="h-4 w-4 animate-spin" />,
  finalizing: <Send className="h-4 w-4 animate-pulse" />,
  completed: <CheckCircle className="h-4 w-4 text-green-500" />,
  error: <AlertCircle className="h-4 w-4 text-red-500" />,
};

interface ProjectGeneratorProps {
  initialPrompt?: string;
  onComplete?: (data: { workspaceId: string; projectName: string }) => void;
  autoStart?: boolean;
}

function ProjectGeneratorInner({
  initialPrompt = '',
  onComplete,
  autoStart = false
}: ProjectGeneratorProps) {
  const [prompt, setPrompt] = useState(initialPrompt);

  // Memoize callbacks to prevent recreation
  const handleComplete = useCallback((data: { workspaceId: string; projectName: string }) => {
    onComplete?.(data);
    // Auto-redirect to workspace on completion
    setTimeout(() => {
      window.location.href = `/workspace/${data.workspaceId}`;
    }, 1500);
  }, [onComplete]);

  const {
    isGenerating,
    progress,
    generateProject,
    cancelGeneration,
    updateProgress
  } = useProjectGenerator({
    onComplete: handleComplete,
    onProgress: () => {
      // Debug log removed
    },
    onError: () => {
      // Generation error handled
    }
  });

  const handleGenerate = useCallback(() => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      updateProgress({
        status: 'error',
        message: 'Please enter a prompt',
        progress: 0,
      });
      return;
    }

    // Start project generation with the current prompt
    generateProject(trimmedPrompt, {
      // Add any generation options here
    }).catch(error => {
      // Failed to start project generation
      updateProgress({
        status: 'error',
        message: error.message || 'Failed to start project generation',
        progress: 0,
      });
    });
  }, [prompt, generateProject, updateProgress]);

  // Memoize input change handler
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPrompt(e.target.value);
  }, []);

  // Memoize keydown handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGenerate();
    }
  }, [handleGenerate]);

  // Auto-start generation if initialPrompt is provided and autoStart is true
  useEffect(() => {
    const shouldStart = autoStart && initialPrompt && !isGenerating && progress.status === 'idle';

    if (shouldStart) {
      const trimmedPrompt = prompt.trim();
      if (trimmedPrompt) {
        // Trigger generation with the current prompt
        generateProject(trimmedPrompt, {
          // Add any generation options here
        }).catch(error => {
          // Failed to start project generation
          updateProgress({
            status: 'error',
            message: error.message || 'Failed to start project generation',
            progress: 0,
          });
        });
      } else if (initialPrompt !== prompt) {
        // Only update prompt if it's different to prevent infinite loops
        setPrompt(initialPrompt);
      }
    }
  }, [autoStart, initialPrompt, isGenerating, progress.status, prompt, generateProject, updateProgress]);

  // Memoize status icon
  const currentStatusIcon = useMemo(() => {
    return statusIcons[progress.status] || statusIcons.idle;
  }, [progress.status]);

  // Memoize whether to show progress section
  const showProgress = useMemo(() => {
    return isGenerating || progress.status !== 'idle';
  }, [isGenerating, progress.status]);

  // Memoize button disabled state
  const isGenerateDisabled = useMemo(() => {
    return isGenerating || !prompt.trim();
  }, [isGenerating, prompt]);

  return (
    <div className="space-y-4 w-full max-w-2xl mx-auto">
      {!initialPrompt && (
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Terminal className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Generate a New Project</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Describe the project you want to create. Be as specific as possible for better results.
          </p>
          <div className="flex space-x-2">
            <input
              type="text"
              value={prompt}
              onChange={handleInputChange}
              placeholder="A modern React dashboard with dark mode..."
              className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isGenerating}
              onKeyDown={handleKeyDown}
              data-testid="prompt-input"
            />
            <Button
              onClick={handleGenerate}
              disabled={isGenerateDisabled}
              data-testid="generate-button"
            >
              {isGenerating ? 'Generating...' : 'Generate'}
            </Button>
          </div>
        </div>
      )}

      {showProgress && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {currentStatusIcon}
                <span className="text-sm font-medium">
                  {progress.status.charAt(0).toUpperCase() + progress.status.slice(1)}
                </span>
              </div>
              <span className="text-sm text-muted-foreground">
                {progress.progress}%
              </span>
            </div>
            <Progress value={progress.progress} className="h-2" />
          </div>

          <Alert className={progress.status === 'error' ? 'border-red-500' : ''}>
            {progress.status === 'error' ? (
              <>
                <AlertCircle className="h-4 w-4 text-red-500" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>{progress.message}</p>
                  {progress.recoveryOptions?.length ? (
                    <div className="flex space-x-2 mt-2">
                      {progress.recoveryOptions.map((option) => (
                        <Button
                          key={option.action}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (option.action === 'retry') {
                              // Use the current prompt for retry
                              generateProject(prompt, {
                                // Add any generation options here
                              }).catch(error => {
                                // Failed to retry project generation
                                updateProgress({
                                  status: 'error',
                                  message: error.message || 'Failed to retry project generation',
                                  progress: 0,
                                });
                              });
                            } else if (option.action === 'modify') {
                              updateProgress({
                                status: 'idle',
                                message: 'Modify your prompt and try again',
                                progress: 0,
                              });
                            }
                          }}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        updateProgress({
                          status: 'idle',
                          message: 'Enter a prompt to generate your project',
                          progress: 0,
                        });
                      }}
                    >
                      Try Again
                    </Button>
                  )}
                </AlertDescription>
              </>
            ) : (
              <>
                {currentStatusIcon}
                <AlertDescription>{progress.message}</AlertDescription>
              </>
            )}
          </Alert>

          {isGenerating && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={cancelGeneration}
                disabled={!isGenerating}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const ProjectGenerator = memo(ProjectGeneratorInner)
