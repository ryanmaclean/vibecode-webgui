/**
 * ModelStatusBadge Component
 *
 * Displays status badges for models indicating their health and state:
 * - Active: Normal operational state
 * - Deprecated: Model is deprecated (with optional replacement info)
 * - New: Recently added model
 * - Updated: Recently updated model
 * - Price Changed: Pricing has changed
 */

'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Check,
  Sparkles,
  Info,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { ModelProfile } from '@/types/model-comparison';
import type { ModelChangeType } from '@/lib/ai/models/model-sync-service';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export type ModelStatus =
  | 'active'
  | 'deprecated'
  | 'new'
  | 'updated'
  | 'price_changed';

interface ModelStatusBadgeProps {
  /** Model to show status for */
  model: ModelProfile;
  /** Optional recent change type to display */
  changeType?: ModelChangeType;
  /** Show detailed status (e.g., replacement model for deprecated) */
  showDetails?: boolean;
  /** Compact mode (smaller badge) */
  compact?: boolean;
  /** Custom className */
  className?: string;
  /** Price change direction if applicable */
  priceChangeDirection?: 'up' | 'down';
}

// ============================================================================
// Helper Functions
// ============================================================================

const getStatusFromChange = (changeType?: ModelChangeType): ModelStatus | null => {
  if (!changeType) return null;

  const changeToStatus: Record<ModelChangeType, ModelStatus | null> = {
    added: 'new',
    removed: null, // Removed models shouldn't show a badge
    updated: 'updated',
    price_changed: 'price_changed',
    deprecated: 'deprecated',
  };

  return changeToStatus[changeType];
};

const getStatusIcon = (status: ModelStatus, priceChangeDirection?: 'up' | 'down'): React.ReactNode => {
  const iconSize = 'h-3 w-3';

  const icons: Record<ModelStatus, React.ReactNode> = {
    active: <Check className={iconSize} />,
    deprecated: <AlertTriangle className={iconSize} />,
    new: <Sparkles className={iconSize} />,
    updated: <Info className={iconSize} />,
    price_changed: priceChangeDirection === 'up'
      ? <TrendingUp className={iconSize} />
      : priceChangeDirection === 'down'
      ? <TrendingDown className={iconSize} />
      : <DollarSign className={iconSize} />,
  };

  return icons[status];
};

const getStatusColor = (status: ModelStatus, priceChangeDirection?: 'up' | 'down'): string => {
  const colors: Record<ModelStatus, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200 border-green-300 dark:border-green-700',
    deprecated: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200 border-orange-300 dark:border-orange-700',
    new: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200 border-blue-300 dark:border-blue-700',
    updated: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200 border-purple-300 dark:border-purple-700',
    price_changed: priceChangeDirection === 'up'
      ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200 border-red-300 dark:border-red-700'
      : priceChangeDirection === 'down'
      ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200 border-green-300 dark:border-green-700'
      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-amber-300 dark:border-amber-700',
  };

  return colors[status];
};

const getStatusLabel = (status: ModelStatus, showDetails?: boolean): string => {
  const labels: Record<ModelStatus, string> = {
    active: 'Active',
    deprecated: showDetails ? 'Deprecated' : 'Deprecated',
    new: 'New',
    updated: 'Updated',
    price_changed: 'Price Changed',
  };

  return labels[status];
};

// ============================================================================
// Main Component
// ============================================================================

export const ModelStatusBadge: React.FC<ModelStatusBadgeProps> = React.memo(({
  model,
  changeType,
  showDetails = false,
  compact = false,
  className,
  priceChangeDirection,
}) => {
  // Determine status priority:
  // 1. Deprecated (always show if model is deprecated)
  // 2. Recent changes (new, updated, price_changed)
  // 3. Active (default)
  let status: ModelStatus = 'active';

  if (model.deprecated || model.deprecationWarning?.isDeprecated) {
    status = 'deprecated';
  } else if (changeType) {
    const changeStatus = getStatusFromChange(changeType);
    if (changeStatus) {
      status = changeStatus;
    }
  }

  // Don't show "Active" badge unless explicitly requested
  if (status === 'active' && !changeType) {
    return null;
  }

  const icon = getStatusIcon(status, priceChangeDirection);
  const color = getStatusColor(status, priceChangeDirection);
  const label = getStatusLabel(status, showDetails);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Badge
        variant="outline"
        className={cn(
          'flex items-center gap-1.5 border',
          color,
          compact ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'
        )}
      >
        {icon}
        <span className="font-medium">{label}</span>
      </Badge>

      {/* Show additional details for deprecated models */}
      {showDetails && status === 'deprecated' && model.deprecationWarning && (
        <span className="text-xs text-muted-foreground">
          {model.deprecationWarning.replacementModelName && (
            <>→ {model.deprecationWarning.replacementModelName}</>
          )}
        </span>
      )}

      {/* Show additional details for price changes */}
      {showDetails && status === 'price_changed' && priceChangeDirection && (
        <span className={cn(
          'text-xs font-medium',
          priceChangeDirection === 'up' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
        )}>
          {priceChangeDirection === 'up' ? '↑' : '↓'}
        </span>
      )}
    </div>
  );
});

ModelStatusBadge.displayName = 'ModelStatusBadge';

// ============================================================================
// Multi-Status Badge Component (optional - for showing multiple statuses)
// ============================================================================

interface ModelStatusBadgesProps {
  /** Model to show statuses for */
  model: ModelProfile;
  /** Optional recent changes to display */
  changes?: ModelChangeType[];
  /** Show detailed status information */
  showDetails?: boolean;
  /** Compact mode (smaller badges) */
  compact?: boolean;
  /** Custom className */
  className?: string;
  /** Price change direction if applicable */
  priceChangeDirection?: 'up' | 'down';
  /** Maximum number of badges to show */
  maxBadges?: number;
}

export const ModelStatusBadges: React.FC<ModelStatusBadgesProps> = React.memo(({
  model,
  changes = [],
  showDetails = false,
  compact = false,
  className,
  priceChangeDirection,
  maxBadges = 3,
}) => {
  const statuses: ModelStatus[] = [];

  // Add deprecated status first (highest priority)
  if (model.deprecated || model.deprecationWarning?.isDeprecated) {
    statuses.push('deprecated');
  }

  // Add change-based statuses
  changes.forEach(changeType => {
    const status = getStatusFromChange(changeType);
    if (status && !statuses.includes(status)) {
      statuses.push(status);
    }
  });

  // Limit badges
  const displayedStatuses = statuses.slice(0, maxBadges);

  // Don't render if no statuses
  if (displayedStatuses.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {displayedStatuses.map((status, index) => (
        <ModelStatusBadge
          key={`${status}-${index}`}
          model={model}
          changeType={changes.find(c => getStatusFromChange(c) === status)}
          showDetails={showDetails}
          compact={compact}
          priceChangeDirection={status === 'price_changed' ? priceChangeDirection : undefined}
        />
      ))}
      {statuses.length > maxBadges && (
        <Badge
          variant="outline"
          className={cn(
            'text-muted-foreground',
            compact ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1'
          )}
        >
          +{statuses.length - maxBadges} more
        </Badge>
      )}
    </div>
  );
});

ModelStatusBadges.displayName = 'ModelStatusBadges';
