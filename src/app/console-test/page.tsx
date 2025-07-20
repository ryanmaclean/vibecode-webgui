'use client';

import { ConsoleButton } from '@/components/console/ConsoleButton';

export default function ConsoleTestPage() {
  // Use a test workspace ID - in a real app, this would come from your data
  const testWorkspaceId = 'test-workspace-123';

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Console Mode Test</h1>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Test Console Integration</h2>
        <p className="mb-4">
          Click the button below to test the console mode with workspace ID: <code>{testWorkspaceId}</code>
        </p>
        <div className="flex items-center space-x-4">
          <ConsoleButton workspaceId={testWorkspaceId} />
          <span>Open Console</span>
        </div>
      </div>
    </div>
  );
}
