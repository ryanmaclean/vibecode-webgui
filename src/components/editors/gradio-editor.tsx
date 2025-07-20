"use client";

import { useState } from 'react';
import { Monaco } from '@/components/editors/monaco';
import { Button } from '@/components/ui/button';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { PlayIcon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface GradioEditorProps {
  initialCode: string;
}

export function GradioEditor({ initialCode }: GradioEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleRunCode = async () => {
    setIsLoading(true);
    setPreviewUrl(null);
    toast({ title: 'Running code...', description: 'Starting the Gradio server.' });

    try {
      const response = await fetch('/api/gradio/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || 'Failed to start Gradio server.');
      }

      setPreviewUrl(result.url);
      toast({ title: 'Success!', description: 'Gradio app is running.' });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
      console.error('Failed to run Gradio code:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-end p-2 border-b">
        <Button onClick={handleRunCode} disabled={isLoading}>
          <PlayIcon className="mr-2 h-4 w-4" />
          {isLoading ? 'Running...' : 'Run'}
        </Button>
      </div>
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={50}>
          <Monaco
            language="python"
            value={code}
            onChange={(newCode) => setCode(newCode || '')}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={50}>
          <div className="flex h-full items-center justify-center bg-muted/20">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                className="h-full w-full border-0"
                title="Gradio Preview"
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              <div className="text-center text-muted-foreground">
                <p>Click the &quot;Run&quot; button to see your Gradio app preview.</p>
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
