import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Toast } from '@/components/ui/toast';
import { codeServerClient } from '@/lib/code-server-client';

interface ConsoleModeProps {
  workspaceId: string;
  onClose: () => void;
}

interface CodeServerStatus {
  status: 'loading' | 'starting' | 'ready' | 'error';
  url?: string;
  error?: string;
}

export function ConsoleMode({ workspaceId, onClose }: ConsoleModeProps) {
  const [status, setStatus] = useState<CodeServerStatus>({ status: 'loading' });
  const [toastMessage, setToastMessage] = useState<{
    message: string;
    type: 'info' | 'success' | 'error';
    key: number;
  } | null>(null);

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToastMessage({
      message,
      type,
      key: Date.now(),
    });
  };

  useEffect(() => {
    let mounted = true;
    
    const initializeCodeServer = async () => {
      try {
        setStatus({ status: 'starting' });
        
        // Get or create a code-server session
        const session = await codeServerClient.getOrCreateSession(workspaceId);
        
        if (!mounted) return;
        
        if (session.status === 'ready') {
          setStatus({ status: 'ready', url: session.url });
        } else {
          // Poll for session status
          const checkStatus = async () => {
            try {
              const updatedSession = await codeServerClient.getSession(session.id);
              
              if (!mounted) return;
              
              if (updatedSession.status === 'ready') {
                setStatus({ status: 'ready', url: updatedSession.url });
              } else if (updatedSession.status === 'error') {
                setStatus({ 
                  status: 'error', 
                  error: 'Failed to start code-server session' 
                });
              } else {
                // Continue polling
                setTimeout(checkStatus, 2000);
              }
            } catch (error) {
              if (!mounted) return;
              console.error('Error checking session status:', error);
              setStatus({ 
                status: 'error', 
                error: 'Failed to check session status' 
              });
              showToast('Failed to check session status', 'error');
            }
          };
          
          // Initial check after a short delay
          setTimeout(checkStatus, 2000);
        }
      } catch (error) {
        console.error('Failed to initialize code-server:', error);
        if (!mounted) return;
        setStatus({ 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Failed to initialize console' 
        });
        
        showToast('Failed to start console: Could not initialize the development environment.', 'error');
      }
    };
    
    initializeCodeServer();
    
    return () => {
      mounted = false;
    };
  }, [workspaceId]);
  
  const renderContent = () => {
    switch (status.status) {
      case 'loading':
        return (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-gray-400">Initializing console...</p>
          </div>
        );
        
      case 'starting':
        return (
          <div className="flex flex-col items-center justify-center h-full space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            <p className="text-gray-400">Starting development environment...</p>
            <p className="text-sm text-gray-500">This may take a moment</p>
          </div>
        );
        
      case 'ready':
        return (
          <iframe
            src={status.url}
            className="w-full h-full border-0"
            title="Code Server Console"
            allowFullScreen
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        );
        
      case 'error':
        return (
          <div className="flex flex-col items-center justify-center h-full space-y-4 p-4 text-center">
            <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-lg max-w-md">
              <h3 className="font-medium text-red-800 dark:text-red-200">Failed to start console</h3>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {status.error || 'An unknown error occurred'}
              </p>
            </div>
            <Button 
              onClick={() => window.location.reload()}
              variant="outline"
              className="mt-4"
            >
              Try Again
            </Button>
          </div>
        );
    }
  };

  // Test toast notifications
  const testToasts = () => {
    showToast('This is an info message', 'info');
    setTimeout(() => showToast('Operation completed successfully!', 'success'), 1000);
    setTimeout(() => showToast('An error occurred while loading the console', 'error'), 2000);
  };

  return (
    <>
      <div className="fixed inset-0 bg-gray-900 flex flex-col">
        <div className="bg-gray-800 p-2 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h2 className="text-white font-mono">Development Console - Workspace {workspaceId}</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={testToasts}
              className="text-xs text-gray-300 hover:text-white hover:bg-gray-700 h-7"
              title="Test toast notifications"
            >
              Test Toasts
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-300 hover:text-white hover:bg-gray-700"
          >
            Close
          </Button>
        </div>
        <div className="flex-1 bg-gray-900">
          {renderContent()}
        </div>
      </div>
      {toastMessage && (
        <Toast
          key={toastMessage.key}
          message={toastMessage.message}
          type={toastMessage.type}
          onClose={() => setToastMessage(null)}
        />
      )}
    </>
  );
}
