'use client';

/**
 * ContextPinning - Component for manually pinning files/functions to context
 *
 * Features:
 * - Pin files by path to force inclusion in context
 * - Pin specific functions/symbols from files
 * - View and manage pinned items
 * - Remove individual pins or clear all
 * - Visual feedback for pinning state
 * - Integration with context management API
 * - Persistent storage of pinned items
 *
 * @module components/ai/ContextPinning
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Pin,
  X,
  Plus,
  FileText,
  Code,
  AlertCircle,
  CheckCircle,
  Loader2,
  Trash2,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface PinnedItem {
  /** Unique identifier */
  id: string;
  /** Type of pinned item */
  type: 'file' | 'function' | 'symbol';
  /** File path */
  path: string;
  /** Function or symbol name (if applicable) */
  symbol?: string;
  /** Display name */
  displayName: string;
  /** When the item was pinned */
  pinnedAt: Date;
  /** Optional description or reason for pinning */
  description?: string;
}

export interface ContextPinningProps {
  /** Workspace or session ID */
  workspaceId?: string;
  /** Custom CSS class name */
  className?: string;
  /** Callback when pinned items change */
  onPinnedItemsChange?: (items: PinnedItem[]) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Maximum number of pinned items allowed */
  maxPinnedItems?: number;
  /** Whether the component is disabled */
  disabled?: boolean;
}

interface PinItemFormData {
  type: 'file' | 'function';
  path: string;
  symbol: string;
}

// ============================================================================
// Main Component
// ============================================================================

export const ContextPinning: React.FC<ContextPinningProps> = ({
  workspaceId,
  className = '',
  onPinnedItemsChange,
  onError,
  maxPinnedItems = 20,
  disabled = false,
}) => {
  const [pinnedItems, setPinnedItems] = useState<PinnedItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<PinItemFormData>({
    type: 'file',
    path: '',
    symbol: '',
  });

  /**
   * Load pinned items from API
   */
  const loadPinnedItems = useCallback(async () => {
    try {
      setError(null);
      const url = workspaceId
        ? `/api/ai/context/pinned?workspaceId=${workspaceId}`
        : '/api/ai/context/pinned';

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to load pinned items: ${response.statusText}`);
      }

      const data = await response.json();
      const items = data.items || [];
      setPinnedItems(items);

      if (onPinnedItemsChange) {
        onPinnedItemsChange(items);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load pinned items';
      setError(errorMessage);
      if (onError) {
        onError(new Error(errorMessage));
      }
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, onPinnedItemsChange, onError]);

  /**
   * Initial load
   */
  useEffect(() => {
    loadPinnedItems();
  }, [loadPinnedItems]);

  /**
   * Clear success message after delay
   */
  useEffect(() => {
    if (successMessage) {
      const timeout = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [successMessage]);

  /**
   * Pin a new item
   */
  const handlePinItem = async () => {
    if (!formData.path.trim()) {
      setError('Please enter a file path');
      return;
    }

    if (formData.type === 'function' && !formData.symbol.trim()) {
      setError('Please enter a function or symbol name');
      return;
    }

    if (pinnedItems.length >= maxPinnedItems) {
      setError(`Maximum ${maxPinnedItems} pinned items allowed`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const url = workspaceId
        ? `/api/ai/context/pinned?workspaceId=${workspaceId}`
        : '/api/ai/context/pinned';

      const body: Record<string, string> = {
        action: 'pin',
        path: formData.path.trim(),
        type: formData.type,
      };

      if (formData.type === 'function' && formData.symbol.trim()) {
        body.symbol = formData.symbol.trim();
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to pin item: ${response.statusText}`);
      }

      const data = await response.json();

      // Reload pinned items
      await loadPinnedItems();

      // Clear form
      setFormData({
        type: 'file',
        path: '',
        symbol: '',
      });

      setSuccessMessage(
        formData.type === 'function'
          ? `Pinned function ${formData.symbol} from ${formData.path}`
          : `Pinned file ${formData.path}`
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pin item';
      setError(errorMessage);
      if (onError) {
        onError(new Error(errorMessage));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Unpin an item
   */
  const handleUnpinItem = async (itemId: string) => {
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const url = workspaceId
        ? `/api/ai/context/pinned?workspaceId=${workspaceId}`
        : '/api/ai/context/pinned';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'unpin',
          id: itemId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to unpin item: ${response.statusText}`);
      }

      // Reload pinned items
      await loadPinnedItems();
      setSuccessMessage('Item unpinned successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to unpin item';
      setError(errorMessage);
      if (onError) {
        onError(new Error(errorMessage));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Clear all pinned items
   */
  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to remove all pinned items?')) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const url = workspaceId
        ? `/api/ai/context/pinned?workspaceId=${workspaceId}`
        : '/api/ai/context/pinned';

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'clear',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to clear pinned items: ${response.statusText}`);
      }

      // Reload pinned items
      await loadPinnedItems();
      setSuccessMessage('All pinned items cleared');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear pinned items';
      setError(errorMessage);
      if (onError) {
        onError(new Error(errorMessage));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle form input changes
   */
  const handleInputChange = (field: keyof PinItemFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  /**
   * Get icon for pinned item type
   */
  const getItemIcon = (type: string) => {
    switch (type) {
      case 'file':
        return <FileText className="h-4 w-4" />;
      case 'function':
      case 'symbol':
        return <Code className="h-4 w-4" />;
      default:
        return <Pin className="h-4 w-4" />;
    }
  };

  /**
   * Get display text for pinned item
   */
  const getItemDisplayText = (item: PinnedItem): string => {
    if (item.symbol) {
      return `${item.symbol} (${item.path})`;
    }
    return item.path;
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Pin className="h-5 w-5" />
              Context Pinning
            </CardTitle>
            <CardDescription>
              Pin files and functions to force inclusion in AI context
            </CardDescription>
          </div>
          {pinnedItems.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={disabled || isSubmitting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Pin New Item Form */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pin-type">Type</Label>
            <div className="flex gap-2">
              <Button
                variant={formData.type === 'file' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleInputChange('type', 'file')}
                disabled={disabled || isSubmitting}
                type="button"
              >
                <FileText className="h-4 w-4 mr-2" />
                File
              </Button>
              <Button
                variant={formData.type === 'function' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleInputChange('type', 'function')}
                disabled={disabled || isSubmitting}
                type="button"
              >
                <Code className="h-4 w-4 mr-2" />
                Function
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="pin-path">File Path</Label>
            <Input
              id="pin-path"
              placeholder="e.g., /src/components/MyComponent.tsx"
              value={formData.path}
              onChange={(e) => handleInputChange('path', e.target.value)}
              disabled={disabled || isSubmitting}
            />
          </div>

          {formData.type === 'function' && (
            <div className="space-y-2">
              <Label htmlFor="pin-symbol">Function/Symbol Name</Label>
              <Input
                id="pin-symbol"
                placeholder="e.g., MyComponent"
                value={formData.symbol}
                onChange={(e) => handleInputChange('symbol', e.target.value)}
                disabled={disabled || isSubmitting}
              />
            </div>
          )}

          <Button
            onClick={handlePinItem}
            disabled={disabled || isSubmitting || !formData.path.trim()}
            className="w-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Pinning...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Pin Item
              </>
            )}
          </Button>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md text-green-700">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">{successMessage}</p>
          </div>
        )}

        <Separator />

        {/* Pinned Items List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">
              Pinned Items ({pinnedItems.length}/{maxPinnedItems})
            </h4>
            {isLoading && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {pinnedItems.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Pin className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No pinned items</p>
              <p className="text-xs text-muted-foreground mt-1">
                Pin files or functions to keep them in context
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {pinnedItems.map((item) => (
                  <Card key={item.id} className="bg-muted/50">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <div className="mt-1">{getItemIcon(item.type)}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {item.displayName || getItemDisplayText(item)}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {item.type}
                              </Badge>
                              {item.symbol && (
                                <span className="text-xs text-muted-foreground">
                                  {item.symbol}
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnpinItem(item.id)}
                          disabled={disabled || isSubmitting}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ContextPinning;
