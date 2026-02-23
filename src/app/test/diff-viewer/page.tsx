/**
 * DiffViewer Test Page
 *
 * Test page for the DiffViewer component with various scenarios
 */

'use client';

import React, { useState } from 'react';
import { DiffViewer } from '@/components/agents/DiffViewer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const SAMPLE_OLD_CODE = `function calculateTotal(items) {
  let total = 0;
  for (let i = 0; i < items.length; i++) {
    total += items[i].price;
  }
  return total;
}`;

const SAMPLE_NEW_CODE = `function calculateTotal(items) {
  return items.reduce((sum, item) => sum + item.price, 0);
}`;

const SAMPLE_OLD_TS = `interface User {
  id: number;
  name: string;
}

function getUser(id: number): User | null {
  // TODO: implement
  return null;
}`;

const SAMPLE_NEW_TS = `interface User {
  id: number;
  name: string;
  email: string;
}

async function getUser(id: number): Promise<User | null> {
  try {
    const response = await fetch(\`/api/users/\${id}\`);
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return null;
  }
}`;

const SAMPLE_OLD_PYTHON = `def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)`;

const SAMPLE_NEW_PYTHON = `def fibonacci(n, memo=None):
    """Calculate fibonacci number with memoization"""
    if memo is None:
        memo = {}
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fibonacci(n-1, memo) + fibonacci(n-2, memo)
    return memo[n]`;

const NO_CHANGES_CODE = `const greeting = "Hello, World!";
console.log(greeting);`;

export default function DiffViewerTestPage() {
  const [showLineNumbers, setShowLineNumbers] = useState(true);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">DiffViewer Component Test</h1>
        <p className="text-muted-foreground">
          Interactive test page for the DiffViewer component
        </p>
      </div>

      <div className="mb-6">
        <label className="flex items-center gap-2 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={showLineNumbers}
            onChange={(e) => setShowLineNumbers(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">Show line numbers</span>
        </label>
      </div>

      <Tabs defaultValue="simple" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="simple">Simple</TabsTrigger>
          <TabsTrigger value="typescript">TypeScript</TabsTrigger>
          <TabsTrigger value="python">Python</TabsTrigger>
          <TabsTrigger value="no-changes">No Changes</TabsTrigger>
          <TabsTrigger value="large">Large Diff</TabsTrigger>
        </TabsList>

        <TabsContent value="simple" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Simple JavaScript Refactor</CardTitle>
              <CardDescription>
                Converting a for loop to Array.reduce()
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DiffViewer
                oldContent={SAMPLE_OLD_CODE}
                newContent={SAMPLE_NEW_CODE}
                fileName="utils.js"
                language="javascript"
                showLineNumbers={showLineNumbers}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="typescript" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>TypeScript Enhancement</CardTitle>
              <CardDescription>
                Adding async/await and error handling
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DiffViewer
                oldContent={SAMPLE_OLD_TS}
                newContent={SAMPLE_NEW_TS}
                fileName="user-service.ts"
                language="typescript"
                showLineNumbers={showLineNumbers}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="python" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Python Optimization</CardTitle>
              <CardDescription>
                Adding memoization to fibonacci function
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DiffViewer
                oldContent={SAMPLE_OLD_PYTHON}
                newContent={SAMPLE_NEW_PYTHON}
                fileName="fibonacci.py"
                language="python"
                showLineNumbers={showLineNumbers}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="no-changes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>No Changes</CardTitle>
              <CardDescription>
                Test case with identical content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DiffViewer
                oldContent={NO_CHANGES_CODE}
                newContent={NO_CHANGES_CODE}
                fileName="greeting.js"
                language="javascript"
                showLineNumbers={showLineNumbers}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="large" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Large Diff</CardTitle>
              <CardDescription>
                Test with many lines changed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DiffViewer
                oldContent={Array(50)
                  .fill(0)
                  .map((_, i) => `Line ${i + 1}: Old content`)
                  .join('\n')}
                newContent={Array(50)
                  .fill(0)
                  .map((_, i) => `Line ${i + 1}: ${i % 3 === 0 ? 'Modified' : 'Old'} content`)
                  .join('\n')}
                fileName="large-file.txt"
                showLineNumbers={showLineNumbers}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 p-6 border rounded-lg bg-muted/50">
        <h2 className="text-lg font-semibold mb-2">Component Features</h2>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>Line-by-line diff comparison</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>Addition/deletion highlighting with colors</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>Toggle line numbers</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>Statistics display (additions/deletions)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>Dark mode support</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>Responsive design with scrolling for large diffs</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
