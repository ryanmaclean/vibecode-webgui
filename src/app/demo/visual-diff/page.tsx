/**
 * Visual Diff Demo Page
 * 
 * Demonstrates the VisualDiff component with various examples
 */

"use client";

import { useState } from 'react';
import { VisualDiff } from '@/components/editor/VisualDiff';

const examples = [
  {
    id: 'javascript',
    name: 'JavaScript Code',
    language: 'javascript',
    original: `function greet(name) {
  console.log("Hello, " + name);
  return true;
}

const user = "World";
greet(user);`,
    modified: `function greet(name) {
  console.log(\`Hello, \${name}!\`);
  return name.length > 0;
}

const user = "World";
const result = greet(user);
console.log('Result:', result);`,
  },
  {
    id: 'typescript',
    name: 'TypeScript Interface',
    language: 'typescript',
    original: `interface User {
  id: number;
  name: string;
  email: string;
}

function getUser(id: number): User {
  // Implementation
  return null;
}`,
    modified: `interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  isActive: boolean;
}

function getUser(id: string): Promise<User | null> {
  // Implementation
  return Promise.resolve(null);
}`,
  },
  {
    id: 'json',
    name: 'JSON Configuration',
    language: 'json',
    original: `{
  "name": "my-app",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0"
  }
}`,
    modified: `{
  "name": "my-app",
  "version": "1.1.0",
  "description": "My awesome application",
  "dependencies": {
    "react": "^19.0.0",
    "next": "^15.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}`,
  },
];

export default function VisualDiffDemo() {
  const [selectedExample, setSelectedExample] = useState(examples[0]);
  const [theme, setTheme] = useState<'light' | 'vs-dark'>('vs-dark');

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Visual Diff Demo</h1>
          <p className="text-muted-foreground">
            Side-by-side file comparison with syntax highlighting
          </p>
        </div>

        <div className="mb-6 flex flex-wrap gap-4">
          <div className="flex gap-2">
            <label className="font-medium">Example:</label>
            {examples.map((example) => (
              <button
                key={example.id}
                onClick={() => setSelectedExample(example)}
                className={`px-4 py-2 rounded-md transition-colors ${
                  selectedExample.id === example.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                {example.name}
              </button>
            ))}
          </div>

          <div className="flex gap-2 ml-auto">
            <label className="font-medium">Theme:</label>
            <button
              onClick={() => setTheme(theme === 'light' ? 'vs-dark' : 'light')}
              className="px-4 py-2 rounded-md bg-muted hover:bg-muted/80 transition-colors"
            >
              {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <div className="bg-muted px-4 py-2 border-b border-border">
            <div className="flex justify-between items-center">
              <span className="font-medium">
                Original ↔️ Modified
              </span>
              <span className="text-sm text-muted-foreground">
                Language: {selectedExample.language}
              </span>
            </div>
          </div>
          <div className="bg-background">
            <VisualDiff
              original={selectedExample.original}
              modified={selectedExample.modified}
              language={selectedExample.language}
              theme={theme}
              height="600px"
              readOnly={true}
            />
          </div>
        </div>

        <div className="mt-8 p-6 rounded-lg bg-muted/50">
          <h2 className="text-2xl font-bold mb-4">Usage</h2>
          <pre className="bg-background p-4 rounded-md overflow-x-auto">
            <code>{`import { VisualDiff } from '@/components/editor/VisualDiff';

function MyComponent() {
  return (
    <VisualDiff
      original="const x = 1;"
      modified="const x = 2;"
      language="javascript"
      height="500px"
      readOnly={true}
    />
  );
}`}</code>
          </pre>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <h3 className="font-semibold mb-2">Features</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Side-by-side comparison</li>
                <li>Syntax highlighting</li>
                <li>Inline change indicators</li>
                <li>Theme support</li>
                <li>Read-only and editable modes</li>
                <li>Resizable split view</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Supported Languages</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>JavaScript / TypeScript</li>
                <li>Python, Go, Rust</li>
                <li>HTML, CSS, JSON</li>
                <li>Markdown</li>
                <li>And many more...</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
