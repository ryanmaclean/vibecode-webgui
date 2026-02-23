/**
 * ModelChangeNotification Component
 *
 * Displays notifications for model changes including:
 * - New models available
 * - Deprecated models
 * - Price changes
 * - Model updates
 * - Removed models
 */

'use client';

import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertTriangle,
  Info,
  Sparkles,
  DollarSign,
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useModelChangeDetection } from '@/hooks/useModelChangeDetection';
import type { ModelChangeType, ModelChange } from '@/lib/ai/models/model-sync-service';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface ModelChangeNotificationItem {
  id: string;
  change: ModelChange;
  timestamp: number;
  dismissed: boolean;
  seen: boolean;
}

interface ModelChangeNotificationProps {
  /** Show detailed change information */
  showDetails?: boolean;
  /** Maximum number of notifications to display */
  maxNotifications?: number;
  /** Auto-collapse notifications after this many items */
  collapseAfter?: number;
  /** Show refresh button */
  showRefreshButton?: boolean;
  /** Callback when refresh is clicked */
  onRefresh?: () => void;
  /** Custom className */
  className?: string;
  /** Compact mode (smaller UI) */
  compact?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getChangeIcon = (type: ModelChangeType): React.ReactNode => {
  const icons: Record<ModelChangeType, React.ReactNode> = {
    added: <Sparkles className="h-4 w-4" />,
    removed: <AlertTriangle className="h-4 w-4" />,
    updated: <Info className="h-4 w-4" />,
    price_changed: <DollarSign className="h-4 w-4" />,
    deprecated: <AlertTriangle className="h-4 w-4" />,
  };
  return icons[type];
};

const getChangeColor = (type: ModelChangeType): string => {
  const colors: Record<ModelChangeType, string> = {
    added: 'border-green-300 bg-green-50 text-green-800 dark:border-green-700 dark:bg-green-950 dark:text-green-200',
    removed: 'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200',
    updated: 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200',
    price_changed: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200',
    deprecated: 'border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-200',
  };
  return colors[type];
};

const getChangeTitle = (type: ModelChangeType, count: number): string => {
  const titles: Record<ModelChangeType, string> = {
    added: count === 1 ? 'New Model Available' : `${count} New Models Available`,
    removed: count === 1 ? 'Model Removed' : `${count} Models Removed`,
    updated: count === 1 ? 'Model Updated' : `${count} Models Updated`,
    price_changed: count === 1 ? 'Price Change' : `${count} Price Changes`,
    deprecated: count === 1 ? 'Model Deprecated' : `${count} Models Deprecated`,
  };
  return titles[type];
};

const getChangeDescription = (type: ModelChangeType): string => {
  const descriptions: Record<ModelChangeType, string> = {
    added: 'Explore new models and their capabilities',
    removed: 'These models are no longer available',
    updated: 'Models have been updated with improvements',
    price_changed: 'Review updated pricing information',
    deprecated: 'Consider switching to recommended alternatives',
  };
  return descriptions[type];
};

const formatPrice = (price: number): string => {
  if (price === 0) return 'Free';
  if (price < 0.001) return `$${(price * 1000).toFixed(2)}/M`;
  return `$${price.toFixed(4)}/1K`;
};

const getPriceChangeIndicator = (oldPrice: number, newPrice: number): React.ReactNode => {
  const isIncrease = newPrice > oldPrice;
  const Icon = isIncrease ? TrendingUp : TrendingDown;
  const color = isIncrease ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';

  const percentChange = oldPrice === 0
    ? 0
    : Math.abs(((newPrice - oldPrice) / oldPrice) * 100);

  return (
    <span className={cn('flex items-center gap-1 text-xs font-medium', color)}>
      <Icon className="h-3 w-3" />
      {percentChange > 0 && `${percentChange.toFixed(0)}%`}
    </span>
  );
};

// ============================================================================
// Notification Group Component
// ============================================================================

interface NotificationGroupProps {
  type: ModelChangeType;
  notifications: ModelChangeNotificationItem[];
  showDetails: boolean;
  compact: boolean;
  onDismiss: (id: string) => void;
  onDismissAll: (type: ModelChangeType) => void;
}

const NotificationGroup: React.FC<NotificationGroupProps> = React.memo(({
  type,
  notifications,
  showDetails,
  compact,
  onDismiss,
  onDismissAll,
}) => {
  const [isExpanded, setIsExpanded] = React.useState(true);

  if (notifications.length === 0) return null;

  const colorClass = getChangeColor(type);
  const title = getChangeTitle(type, notifications.length);
  const description = getChangeDescription(type);
  const icon = getChangeIcon(type);

  return (
    <Card className={cn('border', colorClass)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="flex-shrink-0 mt-0.5">{icon}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}>
                  {title}
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {notifications.length}
                </Badge>
              </div>
              <p className={cn('text-sm opacity-90', compact && 'text-xs')}>
                {description}
              </p>

              {/* Notification List */}
              {showDetails && isExpanded && (
                <div className="mt-3 space-y-2">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="flex items-start justify-between gap-3 p-2 rounded bg-background/50 border border-current/10"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {notification.change.model?.name || notification.change.modelId}
                        </p>

                        {/* Price Change Details */}
                        {type === 'price_changed' && notification.change.oldModel && notification.change.model && (
                          <div className="mt-1 space-y-0.5 text-xs">
                            {notification.change.changes?.map((change: { field: string; oldValue: unknown; newValue: unknown }, idx: number) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="opacity-70">{change.field.split('.')[1]}:</span>
                                <span className="line-through opacity-60">
                                  {formatPrice(change.oldValue as number)}
                                </span>
                                <span>→</span>
                                <span className="font-medium">
                                  {formatPrice(change.newValue as number)}
                                </span>
                                {getPriceChangeIndicator(change.oldValue as number, change.newValue as number)}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Deprecation Details */}
                        {type === 'deprecated' && notification.change.model?.replacementModelId && (
                          <p className="mt-1 text-xs opacity-80">
                            Recommended: <span className="font-medium">{notification.change.model.replacementModelId}</span>
                          </p>
                        )}

                        {/* Updated Model Details */}
                        {type === 'updated' && notification.change.changes && notification.change.changes.length > 0 && (
                          <p className="mt-1 text-xs opacity-80">
                            {notification.change.changes.length} {notification.change.changes.length === 1 ? 'change' : 'changes'}
                          </p>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 flex-shrink-0"
                        onClick={() => onDismiss(notification.id)}
                        aria-label="Dismiss notification"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {showDetails && notifications.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onDismissAll(type)}
              aria-label="Dismiss all"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

NotificationGroup.displayName = 'NotificationGroup';

// ============================================================================
// Main Component
// ============================================================================

export const ModelChangeNotification: React.FC<ModelChangeNotificationProps> = React.memo(({
  showDetails = true,
  maxNotifications,
  collapseAfter = 5,
  showRefreshButton = false,
  onRefresh,
  className,
  compact = false,
}) => {
  const {
    activeNotifications,
    unseenCount,
    newModels,
    deprecatedModels,
    priceChanges,
    updatedModels,
    removedModels,
    dismissNotification,
    clearAll,
    isSyncing,
  } = useModelChangeDetection({
    enableSync: true,
    autoSave: true,
  });

  // Group notifications by type
  const notificationsByType = useMemo(() => {
    return {
      added: newModels,
      deprecated: deprecatedModels,
      price_changed: priceChanges,
      updated: updatedModels,
      removed: removedModels,
    };
  }, [newModels, deprecatedModels, priceChanges, updatedModels, removedModels]);

  // Limit notifications if maxNotifications is set
  const limitedNotifications = useMemo(() => {
    if (!maxNotifications) return notificationsByType;

    let remaining = maxNotifications;
    const limited: typeof notificationsByType = {
      added: [],
      deprecated: [],
      price_changed: [],
      updated: [],
      removed: [],
    };

    // Prioritize: deprecated > price_changed > added > updated > removed
    const priorities: ModelChangeType[] = ['deprecated', 'price_changed', 'added', 'updated', 'removed'];

    for (const type of priorities) {
      const notifications = notificationsByType[type];
      const take = Math.min(notifications.length, remaining);
      limited[type] = notifications.slice(0, take);
      remaining -= take;
      if (remaining === 0) break;
    }

    return limited;
  }, [notificationsByType, maxNotifications]);

  const handleDismissAll = (type: ModelChangeType) => {
    notificationsByType[type].forEach(n => dismissNotification(n.id));
  };

  // If no active notifications, don't render
  if (activeNotifications.length === 0) {
    return null;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header with stats and actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}>
            Model Updates
          </h2>
          {unseenCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {unseenCount} new
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {showRefreshButton && (
            <Button
              variant="outline"
              size={compact ? 'sm' : 'default'}
              onClick={onRefresh}
              disabled={isSyncing}
              aria-label="Refresh models"
            >
              <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} />
              <span className="ml-2">Refresh</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size={compact ? 'sm' : 'default'}
            onClick={clearAll}
            aria-label="Dismiss all notifications"
          >
            Dismiss All
          </Button>
        </div>
      </div>

      {/* Notification Groups */}
      <div className="space-y-3">
        {(Object.keys(limitedNotifications) as ModelChangeType[]).map((type) => (
          <NotificationGroup
            key={type}
            type={type}
            notifications={limitedNotifications[type]}
            showDetails={showDetails}
            compact={compact}
            onDismiss={dismissNotification}
            onDismissAll={handleDismissAll}
          />
        ))}
      </div>
    </div>
  );
});

ModelChangeNotification.displayName = 'ModelChangeNotification';
