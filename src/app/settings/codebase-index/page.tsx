'use client';

import { useCallback, useEffect, useState } from 'react';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import IndexCoverageDashboard from '@/components/index-coverage-dashboard';
import { RefreshCw, ArrowLeft, AlertCircle, Database } from 'lucide-react';

interface ReindexResponse {
  status: string;
  data: {
    projectId: number;
    totalFiles: number;
    successCount: number;
    failureCount: number;
  };
}

function CodebaseIndexPageContent() {
  const [isReindexing, setIsReindexing] = useState(false);
  const [reindexError, setReindexError] = useState<string | null>(null);
  const [reindexSuccess, setReindexSuccess] = useState<ReindexResponse | null>(null);
  const [projectId, setProjectId] = useState<number>(1); // Default project ID
  const [projectPath, setProjectPath] = useState<string>('');
  const [workspaceId, setWorkspaceId] = useState<number>(1);
  const [dashboardKey, setDashboardKey] = useState(0); // Used to force dashboard refresh

  // Fetch project information on mount
  useEffect(() => {
    // In a production system, this would fetch the current project from user's workspace
    // For now, we use defaults that can be configured via environment or API
    const storedProjectId = localStorage.getItem('codebase-index-project-id');
    const storedWorkspaceId = localStorage.getItem('codebase-index-workspace-id');
    const storedProjectPath = localStorage.getItem('codebase-index-project-path');

    if (storedProjectId) setProjectId(parseInt(storedProjectId, 10));
    if (storedWorkspaceId) setWorkspaceId(parseInt(storedWorkspaceId, 10));
    if (storedProjectPath) setProjectPath(storedProjectPath);
  }, []);

  const handleManualReindex = useCallback(async () => {
    if (!projectPath) {
      setReindexError('Project path is required. Please configure your project settings.');
      return;
    }

    setIsReindexing(true);
    setReindexError(null);
    setReindexSuccess(null);

    try {
      const response = await fetch('/api/codebase-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          workspaceId,
          projectPath,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: ReindexResponse = await response.json();
      setReindexSuccess(data);

      // Force dashboard to refresh by changing its key
      setTimeout(() => {
        setDashboardKey(prev => prev + 1);
      }, 1000);
    } catch (error) {
      setReindexError(error instanceof Error ? error.message : 'Failed to trigger reindexing');
    } finally {
      setIsReindexing(false);
    }
  }, [projectId, workspaceId, projectPath]);

  const handleSaveProjectSettings = useCallback(() => {
    localStorage.setItem('codebase-index-project-id', projectId.toString());
    localStorage.setItem('codebase-index-workspace-id', workspaceId.toString());
    localStorage.setItem('codebase-index-project-path', projectPath);
  }, [projectId, workspaceId, projectPath]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-4 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </a>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Codebase Indexing
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Monitor and manage semantic code indexing for AI-powered context
          </p>
        </div>

        {/* Project Configuration Card */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/30">
              <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Project Configuration
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Configure project settings for indexing
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="project-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Project ID
              </label>
              <input
                id="project-id"
                type="number"
                value={projectId}
                onChange={(e) => setProjectId(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="workspace-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Workspace ID
              </label>
              <input
                id="workspace-id"
                type="number"
                value={workspaceId}
                onChange={(e) => setWorkspaceId(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="project-path" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Project Path
              </label>
              <input
                id="project-path"
                type="text"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
                placeholder="/path/to/your/project"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <button
              onClick={handleSaveProjectSettings}
              className="inline-flex items-center gap-2 rounded-md bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Save Configuration
            </button>
          </div>
        </div>

        {/* Manual Reindex Card */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Manual Reindex
          </h2>

          {reindexError && (
            <div className="mb-4 flex items-start gap-3 rounded-md bg-red-50 dark:bg-red-900/20 p-4">
              <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  {reindexError}
                </p>
              </div>
            </div>
          )}

          {reindexSuccess && (
            <div className="mb-4 rounded-md bg-green-50 dark:bg-green-900/20 p-4">
              <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                Reindexing completed successfully!
              </p>
              <div className="text-xs text-green-700 dark:text-green-300 space-y-1">
                <p>Total files: {reindexSuccess.data.totalFiles}</p>
                <p>Successfully indexed: {reindexSuccess.data.successCount}</p>
                {reindexSuccess.data.failureCount > 0 && (
                  <p className="text-red-600 dark:text-red-400">
                    Failed: {reindexSuccess.data.failureCount}
                  </p>
                )}
              </div>
            </div>
          )}

          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Trigger a full reindex of your codebase. This will update all semantic embeddings
            and may take several minutes depending on project size.
          </p>

          <button
            onClick={handleManualReindex}
            disabled={isReindexing || !projectPath}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {isReindexing ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isReindexing ? 'Reindexing...' : 'Reindex Codebase'}
          </button>

          {!projectPath && (
            <p className="mt-2 text-xs text-red-500 dark:text-red-400">
              Please configure the project path above before reindexing.
            </p>
          )}
        </div>

        {/* Index Coverage Dashboard */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
          <IndexCoverageDashboard key={dashboardKey} projectId={projectId} />
        </div>
      </div>
    </div>
  );
}

export default function CodebaseIndexPage() {
  return (
    <ErrorBoundary>
      <CodebaseIndexPageContent />
    </ErrorBoundary>
  );
}
