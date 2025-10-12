'use client';

import { useState } from 'react';
import { discoverSessions, type DiscoveredSession } from '@/lib/tauri/mdns';
import { logger } from '@/lib/logger';

interface SessionBrowserProps {
  className?: string;
}

export function SessionBrowser({ className = '' }: SessionBrowserProps) {
  const [sessions, setSessions] = useState<DiscoveredSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const discovered = await discoverSessions();
      setSessions(discovered);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to discover sessions';
      setError(errorMessage);
      logger.error('Failed to discover sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const connectToSession = (session: DiscoveredSession) => {
    // Use the first address if available, otherwise use the hostname
    const host = session.addresses.length > 0 ? session.addresses[0] : session.host;
    const url = `http://${host}:${session.port}`;
    window.open(url, '_blank');
  };

  return (
    <div className={`rounded-lg border border-gray-700 bg-gray-800 p-6 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">
          Available VibeCode Sessions
        </h2>
        <button
          onClick={refreshSessions}
          disabled={loading}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-900/50 border border-red-700 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {sessions.length === 0 && !loading && !error && (
        <div className="py-8 text-center text-gray-400">
          No sessions found. Click "Refresh" to scan the network.
        </div>
      )}

      {sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((session, index) => (
            <div
              key={`${session.name}-${index}`}
              className="flex items-center justify-between rounded-md bg-gray-700/50 p-4 hover:bg-gray-700"
            >
              <div className="flex-1">
                <h3 className="font-medium text-white">{session.name}</h3>
                <p className="text-sm text-gray-400">
                  {session.host}:{session.port}
                </p>
                {session.addresses.length > 0 && (
                  <p className="mt-1 text-xs text-gray-500">
                    {session.addresses.join(', ')}
                  </p>
                )}
              </div>
              <button
                onClick={() => connectToSession(session)}
                className="ml-4 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Connect
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
