/**
 * Plugin marketplace page
 */

'use client'

import React, { useState, useEffect } from 'react'
import { PluginMarketplace } from '@/components/plugins/PluginMarketplace'
import { type PluginCardData } from '@/components/plugins/PluginCard'

/**
 * Plugin Marketplace Page
 * Browse and install plugins from the marketplace
 */
export default function PluginsPage() {
  const [installedPluginIds, setInstalledPluginIds] = useState<number[]>([])

  /**
   * Fetch installed plugins on mount to track which plugins are already installed
   */
  useEffect(() => {
    async function fetchInstalledPlugins() {
      try {
        const response = await fetch('/api/plugins')
        if (response.ok) {
          const data = await response.json()
          // Extract plugin IDs from installed plugins
          // Note: This mapping between marketplace IDs and installed plugin IDs
          // may need adjustment based on actual data structure
          const ids = data.plugins?.map((p: any) => p.id).filter(Boolean) || []
          setInstalledPluginIds(ids)
        }
      } catch (error) {
        // Silently fail - marketplace will just show all plugins as not installed
      }
    }

    fetchInstalledPlugins()
  }, [])

  /**
   * Handle plugin installation from marketplace
   */
  const handlePluginInstall = async (plugin: PluginCardData) => {
    try {
      // Install plugin using the repository URL or construct marketplace URL
      const source = plugin.repositoryUrl || `marketplace://${plugin.name}`

      const response = await fetch('/api/plugins/install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pluginId: plugin.name,
          source,
          autoEnable: true,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to install plugin')
      }

      // Update installed plugins list
      setInstalledPluginIds((prev) => [...prev, plugin.id])
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to install plugin')
    }
  }

  /**
   * Handle plugin uninstallation
   */
  const handlePluginUninstall = async (plugin: PluginCardData) => {
    try {
      const response = await fetch(`/api/plugins/${encodeURIComponent(plugin.name)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to uninstall plugin')
      }

      // Update installed plugins list
      setInstalledPluginIds((prev) => prev.filter((id) => id !== plugin.id))
    } catch (error) {
      throw error instanceof Error ? error : new Error('Failed to uninstall plugin')
    }
  }

  /**
   * Handle plugin selection (for viewing details)
   */
  const handlePluginSelect = (plugin: PluginCardData) => {
    // Future: Could open a detail modal or navigate to plugin detail page
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Plugin Marketplace
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Discover and install plugins to extend VibeCode functionality
          </p>
        </div>

        {/* Marketplace Component */}
        <PluginMarketplace
          onPluginInstall={handlePluginInstall}
          onPluginUninstall={handlePluginUninstall}
          onPluginSelect={handlePluginSelect}
          installedPluginIds={installedPluginIds}
        />
      </div>
    </div>
  )
}
