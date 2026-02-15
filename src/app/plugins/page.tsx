'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, Filter, RefreshCw, Package, AlertCircle } from 'lucide-react';
import { PluginCard } from '@/components/plugins/PluginCard';
import { PluginInstaller } from '@/components/plugins/PluginInstaller';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Plugin, PluginStatus, PluginType } from '@/types/plugin';

/**
 * API Response type for plugins list
 */
interface PluginsResponse {
  success: boolean;
  plugins: Plugin[];
  total: number;
}

/**
 * Plugin Manager Page
 * Main page for managing installed plugins and installing new ones
 */
export default function PluginsPage() {
  const router = useRouter();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [filteredPlugins, setFilteredPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PluginStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<PluginType | 'all'>('all');
  const [showInstaller, setShowInstaller] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  /**
   * Fetch plugins from API
   */
  const fetchPlugins = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/plugins');

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized - Please sign in');
        }
        throw new Error('Failed to fetch plugins');
      }

      const data: PluginsResponse = await response.json();

      if (data.success) {
        setPlugins(data.plugins);
        setFilteredPlugins(data.plugins);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load plugins';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Initial load
   */
  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  /**
   * Filter plugins based on search and filters
   */
  useEffect(() => {
    let filtered = plugins;

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    // Apply type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(p => p.manifest.type === typeFilter);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.manifest.name.toLowerCase().includes(query) ||
        p.manifest.description.toLowerCase().includes(query) ||
        p.manifest.author.name.toLowerCase().includes(query) ||
        p.manifest.id.toLowerCase().includes(query)
      );
    }

    setFilteredPlugins(filtered);
  }, [plugins, searchQuery, statusFilter, typeFilter]);

  /**
   * Handle plugin enable
   */
  const handleEnable = useCallback(async (pluginId: string) => {
    setActionInProgress(pluginId);
    try {
      const response = await fetch('/api/plugins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'enable',
          pluginId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to enable plugin');
      }

      // Refresh plugins list
      await fetchPlugins();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to enable plugin';
      setError(errorMessage);
    } finally {
      setActionInProgress(null);
    }
  }, [fetchPlugins]);

  /**
   * Handle plugin disable
   */
  const handleDisable = useCallback(async (pluginId: string) => {
    setActionInProgress(pluginId);
    try {
      const response = await fetch('/api/plugins', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'disable',
          pluginId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to disable plugin');
      }

      // Refresh plugins list
      await fetchPlugins();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to disable plugin';
      setError(errorMessage);
    } finally {
      setActionInProgress(null);
    }
  }, [fetchPlugins]);

  /**
   * Handle plugin uninstall
   */
  const handleUninstall = useCallback(async (pluginId: string) => {
    if (!window.confirm('Are you sure you want to uninstall this plugin?')) {
      return;
    }

    setActionInProgress(pluginId);
    try {
      const response = await fetch(`/api/plugins?pluginId=${encodeURIComponent(pluginId)}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to uninstall plugin');
      }

      // Refresh plugins list
      await fetchPlugins();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to uninstall plugin';
      setError(errorMessage);
    } finally {
      setActionInProgress(null);
    }
  }, [fetchPlugins]);

  /**
   * Handle install complete
   */
  const handleInstallComplete = useCallback((pluginId: string) => {
    setShowInstaller(false);
    fetchPlugins();
  }, [fetchPlugins]);

  /**
   * Handle refresh
   */
  const handleRefresh = useCallback(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  /**
   * Clear filters
   */
  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setTypeFilter('all');
  }, []);

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || typeFilter !== 'all';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                Plugin Manager
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Manage and install plugins to extend VibeCode functionality
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => setShowInstaller(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Install Plugin
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search plugins by name, description, or author..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="w-full sm:w-48">
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as PluginStatus | 'all')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="installing">Installing</SelectItem>
                  <SelectItem value="uninstalling">Uninstalling</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div className="w-full sm:w-48">
              <Select
                value={typeFilter}
                onValueChange={(value) => setTypeFilter(value as PluginType | 'all')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="ai-model">AI Model</SelectItem>
                  <SelectItem value="integration">Integration</SelectItem>
                  <SelectItem value="workflow">Workflow</SelectItem>
                  <SelectItem value="ui-extension">UI Extension</SelectItem>
                  <SelectItem value="code-generator">Code Generator</SelectItem>
                  <SelectItem value="linter">Linter</SelectItem>
                  <SelectItem value="formatter">Formatter</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active Filters */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Showing {filteredPlugins.length} of {plugins.length} plugins
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-7 text-xs"
              >
                Clear filters
              </Button>
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading plugins...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && plugins.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <Package className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No plugins installed
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Get started by installing your first plugin
            </p>
            <Button onClick={() => setShowInstaller(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Install Plugin
            </Button>
          </div>
        )}

        {/* No Results State */}
        {!loading && plugins.length > 0 && filteredPlugins.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <Search className="h-16 w-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              No plugins found
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Try adjusting your search or filters
            </p>
            <Button variant="outline" onClick={handleClearFilters}>
              Clear filters
            </Button>
          </div>
        )}

        {/* Plugin Grid */}
        {!loading && filteredPlugins.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlugins.map((plugin) => (
              <PluginCard
                key={plugin.manifest.id}
                plugin={plugin}
                onEnable={handleEnable}
                onDisable={handleDisable}
                onUninstall={handleUninstall}
                disabled={actionInProgress === plugin.manifest.id}
              />
            ))}
          </div>
        )}

        {/* Install Plugin Dialog */}
        <Dialog open={showInstaller} onOpenChange={setShowInstaller}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Install Plugin</DialogTitle>
              <DialogDescription>
                Install a new plugin from a URL or upload a plugin package
              </DialogDescription>
            </DialogHeader>
            <PluginInstaller
              onInstallComplete={handleInstallComplete}
              onClose={() => setShowInstaller(false)}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
