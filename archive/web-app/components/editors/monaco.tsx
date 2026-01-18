"use client";

import type { editor } from 'monaco-editor';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { ComponentProps } from 'react';

interface MonacoEditorProps {
  language: string;
  value: string;
  onChange: (value: string | undefined) => void;
  options?: editor.IStandaloneEditorConstructionOptions;
}

// Loading skeleton component
function MonacoLoadingSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted/30 animate-pulse">
      <div className="flex flex-col items-center gap-3">
        <div className="h-12 w-12 rounded-lg bg-muted-foreground/20 animate-bounce"></div>
        <span className="text-sm text-muted-foreground">Loading Monaco Editor...</span>
        <div className="flex gap-2">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse"></div>
          <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.2s]"></div>
          <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-pulse [animation-delay:0.4s]"></div>
        </div>
      </div>
    </div>
  );
}

// Dynamically import Monaco Editor with SSR disabled
const EditorComponent = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <MonacoLoadingSkeleton />,
});

export function Monaco({ language, value, onChange, options }: MonacoEditorProps) {
  const { theme } = useTheme();

  return (
    <EditorComponent
      height="100%"
      language={language}
      theme={theme === 'dark' ? 'vs-dark' : 'light'}
      value={value}
      onChange={onChange}
      options={{
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        ...options,
      }}
    />
  );
}

// Named export for the loading skeleton if needed elsewhere
export { MonacoLoadingSkeleton };
