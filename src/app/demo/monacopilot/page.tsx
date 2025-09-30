'use client';

import { useEffect, useRef, useState } from 'react';
import type * as Monaco from 'monaco-editor';

export default function MonacopilotDemo() {
  const editorRef = useRef<HTMLDivElement>(null);
  const [editor, setEditor] = useState<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const [status, setStatus] = useState<string>('Initializing...');
  const [apiStatus, setApiStatus] = useState<string>('Checking...');

  useEffect(() => {
    // Check API health
    fetch('/api/code-completion')
      .then(res => res.json())
      .then(data => {
        setApiStatus(`✅ API Ready (${data.provider}/${data.model})`);
      })
      .catch(err => {
        setApiStatus(`❌ API Error: ${err.message}`);
      });
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;

    let editorInstance: Monaco.editor.IStandaloneCodeEditor | null = null;

    // Dynamic import to avoid SSR issues
    const initializeEditor = async () => {
      try {
        const [monaco, { setupMonacopilot }] = await Promise.all([
          import('monaco-editor'),
          import('@/lib/monaco/monacopilot-integration'),
        ]);

        if (!editorRef.current) return;

        // Create Monaco editor
        editorInstance = monaco.editor.create(editorRef.current, {
        value: `// Type some code and wait for AI suggestions
// Try typing: function hello
// Or: const data = 

function example() {
  // Start typing here...
}
`,
        language: 'typescript',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        roundedSelection: false,
        scrollBeyondLastLine: false,
        readOnly: false,
      });

        setEditor(editorInstance);
        setStatus('✅ Monaco Editor loaded (v0.53.0)');

        // Setup Monacopilot
        try {
          setupMonacopilot(monaco, editorInstance, {
            endpoint: '/api/code-completion',
            language: 'typescript',
            debug: true,
          });
          setStatus('✅ Monacopilot AI completion enabled!');
        } catch (err) {
          setStatus(`⚠️ Monacopilot setup failed: ${err}`);
        }
      } catch (err) {
        setStatus(`❌ Error: ${err}`);
      }
    };

    initializeEditor();

    return () => {
      if (editorInstance) {
        editorInstance.dispose();
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white">
      <div className="p-4 bg-gray-800 border-b border-gray-700">
        <h1 className="text-2xl font-bold mb-2">Monacopilot Demo</h1>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold">Monaco Editor:</span>
            <span>{status}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">API Status:</span>
            <span>{apiStatus}</span>
          </div>
        </div>
        <div className="mt-3 p-3 bg-blue-900/30 border border-blue-700 rounded">
          <p className="text-sm">
            <strong>How to test:</strong>
          </p>
          <ol className="text-sm mt-2 space-y-1 list-decimal list-inside">
            <li>Start typing code in the editor below</li>
            <li>Wait 1-2 seconds for AI suggestions to appear</li>
            <li>Press <kbd className="px-2 py-1 bg-gray-700 rounded">Tab</kbd> to accept suggestions</li>
            <li>Try: <code className="bg-gray-700 px-1">function hello</code> or <code className="bg-gray-700 px-1">const data =</code></li>
          </ol>
        </div>
      </div>
      
      <div ref={editorRef} className="flex-1" />
      
      <div className="p-2 bg-gray-800 border-t border-gray-700 text-xs text-gray-400">
        Monaco Editor 0.53.0 + Monacopilot 1.2.7 | AI Provider: {apiStatus.includes('API Ready') ? apiStatus.split('(')[1]?.split(')')[0] : 'Unknown'}
      </div>
    </div>
  );
}
