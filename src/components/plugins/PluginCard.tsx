'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Plugin, PluginStatus, PluginType } from '@/types/plugin';

/**
 * Props for PluginCard component
 */
export interface PluginCardProps {
  /** Plugin instance data */
  plugin: Plugin;
  /** Handle enable action */
  onEnable?: (id: string) => void;
  /** Handle disable action */
  onDisable?: (id: string) => void;
  /** Handle uninstall action */
  onUninstall?: (id: string) => void;
  /** Handle configure action */
  onConfigure?: (id: string) => void;
  /** Handle view details action */
  onViewDetails?: (id: string) => void;
  /** Whether actions are disabled */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
}

/**
 * Status badge variant mapping
 */
const statusVariants: Record<PluginStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  inactive: 'secondary',
  error: 'destructive',
  installing: 'outline',
  uninstalling: 'outline'
};

/**
 * Status display text
 */
const statusText: Record<PluginStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  error: 'Error',
  installing: 'Installing...',
  uninstalling: 'Uninstalling...'
};

/**
 * Plugin type display text
 */
const typeText: Record<PluginType, string> = {
  'ai-model': 'AI Model',
  'integration': 'Integration',
  'workflow': 'Workflow',
  'ui-extension': 'UI Extension',
  'code-generator': 'Code Generator',
  'linter': 'Linter',
  'formatter': 'Formatter',
  'other': 'Other'
};

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date);
}

/**
 * Format relative time
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

/**
 * Get capability badges to display
 */
function getCapabilityBadges(plugin: Plugin): string[] {
  const badges: string[] = [];
  const { capabilities } = plugin;

  if (capabilities.providesAIModel) badges.push('AI Model');
  if (capabilities.providesIntegration) badges.push('Integration');
  if (capabilities.providesCommands) badges.push('Commands');
  if (capabilities.providesUIComponents) badges.push('UI');
  if (capabilities.providesCodeActions) badges.push('Code Actions');
  if (capabilities.providesWorkflows) badges.push('Workflows');
  if (capabilities.providesFormatters) badges.push('Formatter');
  if (capabilities.providesLinters) badges.push('Linter');

  return badges.slice(0, 3); // Limit to 3 badges
}

/**
 * Plugin Card Component
 * Displays a single plugin with status, metadata, and actions
 */
export const PluginCard = React.memo(function PluginCard({
  plugin,
  onEnable,
  onDisable,
  onUninstall,
  onConfigure,
  onViewDetails,
  disabled = false,
  className
}: PluginCardProps) {
  const isActive = plugin.status === 'active';
  const isInactive = plugin.status === 'inactive';
  const isTransitioning = plugin.status === 'installing' || plugin.status === 'uninstalling';
  const hasError = plugin.status === 'error';

  const handleEnable = React.useCallback(() => {
    onEnable?.(plugin.manifest.id);
  }, [plugin.manifest.id, onEnable]);

  const handleDisable = React.useCallback(() => {
    onDisable?.(plugin.manifest.id);
  }, [plugin.manifest.id, onDisable]);

  const handleUninstall = React.useCallback(() => {
    onUninstall?.(plugin.manifest.id);
  }, [plugin.manifest.id, onUninstall]);

  const handleConfigure = React.useCallback(() => {
    onConfigure?.(plugin.manifest.id);
  }, [plugin.manifest.id, onConfigure]);

  const handleViewDetails = React.useCallback(() => {
    onViewDetails?.(plugin.manifest.id);
  }, [plugin.manifest.id, onViewDetails]);

  const capabilityBadges = getCapabilityBadges(plugin);

  return (
    <Card
      className={cn(
        'relative transition-shadow hover:shadow-md',
        hasError && 'border-destructive',
        className
      )}
    >
      {/* Status indicator dot */}
      <div
        className={cn(
          'absolute top-4 right-4 w-3 h-3 rounded-full',
          isActive && 'bg-green-500 animate-pulse',
          isInactive && 'bg-gray-400',
          isTransitioning && 'bg-yellow-500 animate-pulse',
          hasError && 'bg-red-500'
        )}
      />

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between pr-6">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold">{plugin.manifest.name}</CardTitle>
            <CardDescription className="mt-1 line-clamp-2">
              {plugin.manifest.description}
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant={statusVariants[plugin.status]}>
            {statusText[plugin.status]}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {typeText[plugin.manifest.type]}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Metadata */}
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>v{plugin.manifest.version}</span>
            <span>•</span>
            <span>{plugin.manifest.author.name}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Installed {formatRelativeTime(plugin.installedAt)}</span>
            {plugin.enabledAt && isActive && (
              <>
                <span>•</span>
                <span>Enabled {formatRelativeTime(plugin.enabledAt)}</span>
              </>
            )}
          </div>
        </div>

        {/* Capabilities */}
        {capabilityBadges.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Capabilities</h4>
            <div className="flex flex-wrap gap-2">
              {capabilityBadges.map((badge) => (
                <Badge key={badge} variant="outline" className="text-xs font-normal">
                  {badge}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Permissions */}
        {plugin.manifest.permissions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Permissions</h4>
            <div className="flex flex-wrap gap-1">
              {plugin.manifest.permissions.slice(0, 3).map((permission) => (
                <Badge key={permission} variant="secondary" className="text-xs font-normal">
                  {permission.split(':')[0]}
                </Badge>
              ))}
              {plugin.manifest.permissions.length > 3 && (
                <span className="text-xs text-muted-foreground">
                  +{plugin.manifest.permissions.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Error Message */}
        {hasError && plugin.lastError && (
          <div className="p-2 bg-destructive/10 rounded text-sm text-destructive">
            {plugin.lastError}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2 pt-2">
        {isInactive && onEnable && (
          <Button
            size="sm"
            onClick={handleEnable}
            disabled={disabled || isTransitioning}
          >
            Enable
          </Button>
        )}
        {isActive && onDisable && (
          <Button
            size="sm"
            variant="secondary"
            onClick={handleDisable}
            disabled={disabled || isTransitioning}
          >
            Disable
          </Button>
        )}
        {onConfigure && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleConfigure}
            disabled={disabled || isTransitioning}
          >
            Configure
          </Button>
        )}
        {onViewDetails && (
          <Button
            size="sm"
            variant="ghost"
            onClick={handleViewDetails}
          >
            Details
          </Button>
        )}
        {onUninstall && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={handleUninstall}
            disabled={disabled || isTransitioning}
          >
            Uninstall
          </Button>
        )}
      </CardFooter>
    </Card>
  );
});

PluginCard.displayName = 'PluginCard';
