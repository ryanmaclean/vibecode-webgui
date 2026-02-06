/**
 * SnapshotManager Component
 *
 * UI for managing VM snapshots - create, restore, delete, export/import.
 *
 * Features:
 * - List snapshots with preview and details
 * - Create snapshot with name input
 * - Restore with confirmation dialog
 * - Delete with confirmation
 * - Export/download snapshots
 * - Import snapshots
 * - Size estimation before creation
 *
 * @module components/vm/SnapshotManager
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Camera,
  RotateCcw,
  Trash2,
  Download,
  Upload,
  HardDrive,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Plus,
  Info,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import type {
  SnapshotInfo,
  SnapshotState,
  SnapshotOptions,
  SnapshotSizeEstimate,
} from '@/types/vm-snapshot';

// ============================================================================
// Types
// ============================================================================

export interface SnapshotManagerProps {
  /** Current VM ID */
  vmId: string;
  /** VM name for display */
  vmName?: string;
  /** Whether the VM is currently running */
  vmRunning?: boolean;
  /** Custom className */
  className?: string;
  /** Callback when snapshot is created */
  onSnapshotCreated?: (snapshot: SnapshotInfo) => void;
  /** Callback when snapshot is restored */
  onSnapshotRestored?: (snapshotId: string) => void;
  /** Callback when snapshot is deleted */
  onSnapshotDeleted?: (snapshotId: string) => void;
}

interface DialogState {
  type: 'create' | 'restore' | 'delete' | 'export' | 'import' | null;
  snapshotId?: string;
  snapshot?: SnapshotInfo;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format bytes to human-readable size
 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format date to relative time
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return new Date(date).toLocaleDateString();
}

/**
 * Get state badge variant
 */
function getStateBadge(state: SnapshotState): { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string } {
  switch (state) {
    case 'ready':
      return { variant: 'default', label: 'Ready' };
    case 'creating':
      return { variant: 'secondary', label: 'Creating...' };
    case 'restoring':
      return { variant: 'secondary', label: 'Restoring...' };
    case 'error':
      return { variant: 'destructive', label: 'Error' };
    default:
      return { variant: 'outline', label: state };
  }
}

// ============================================================================
// Subcomponents
// ============================================================================

/**
 * Snapshot list item
 */
interface SnapshotItemProps {
  snapshot: SnapshotInfo;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onExport: () => void;
  disabled?: boolean;
}

function SnapshotItem({
  snapshot,
  isExpanded,
  onToggleExpand,
  onRestore,
  onDelete,
  onExport,
  disabled,
}: SnapshotItemProps) {
  const stateBadge = getStateBadge(snapshot.state);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors',
          isExpanded && 'bg-muted/30'
        )}
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onToggleExpand()}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-3">
          <Camera className="h-5 w-5 text-muted-foreground" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{snapshot.name}</span>
              <Badge variant={stateBadge.variant}>{stateBadge.label}</Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(snapshot.createdAt)}
              </span>
              <span className="flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                {formatSize(snapshot.size)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {snapshot.state === 'ready' && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore();
                }}
                disabled={disabled}
                title="Restore snapshot"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onExport();
                }}
                disabled={disabled}
                title="Export snapshot"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                disabled={disabled}
                title="Delete snapshot"
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t p-4 bg-muted/20 space-y-4">
          {snapshot.description && (
            <p className="text-sm text-muted-foreground">{snapshot.description}</p>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">ID:</span>
              <span className="ml-2 font-mono text-xs">{snapshot.id}</span>
            </div>
            <div>
              <span className="text-muted-foreground">VM:</span>
              <span className="ml-2">{snapshot.vmName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Includes Disk:</span>
              <span className="ml-2">{snapshot.includesDisk ? 'Yes' : 'No'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Includes Memory:</span>
              <span className="ml-2">{snapshot.includesMemory ? 'Yes' : 'No'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Compressed:</span>
              <span className="ml-2">
                {snapshot.compressed
                  ? `Yes (${snapshot.compressionAlgorithm?.toUpperCase()})`
                  : 'No'}
              </span>
            </div>
            {snapshot.checksum && (
              <div>
                <span className="text-muted-foreground">Checksum:</span>
                <span className="ml-2 font-mono text-xs">{snapshot.checksum.slice(0, 16)}...</span>
              </div>
            )}
          </div>

          {/* Services at snapshot time */}
          {snapshot.metadata.services.length > 0 && (
            <div>
              <span className="text-sm text-muted-foreground">Running Services:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {snapshot.metadata.services.map((service) => (
                  <Badge key={service.name} variant="outline" className="text-xs">
                    {service.name}
                    {service.port && `:${service.port}`}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {snapshot.error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              <span>{snapshot.error}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Create snapshot dialog content
 */
interface CreateDialogProps {
  vmId: string;
  vmName?: string;
  sizeEstimate: SnapshotSizeEstimate | null;
  isEstimating: boolean;
  onEstimate: (options: Partial<SnapshotOptions>) => void;
  onCreate: (name: string, description: string, options: Partial<SnapshotOptions>) => void;
  onCancel: () => void;
  isCreating: boolean;
  progress: number;
}

function CreateDialog({
  vmId,
  vmName,
  sizeEstimate,
  isEstimating,
  onEstimate,
  onCreate,
  onCancel,
  isCreating,
  progress,
}: CreateDialogProps) {
  const [name, setName] = useState(`${vmName || vmId}-${new Date().toISOString().slice(0, 10)}`);
  const [description, setDescription] = useState('');
  const [includeDisk, setIncludeDisk] = useState(true);
  const [includeMemory, setIncludeMemory] = useState(true);
  const [compress, setCompress] = useState(true);

  useEffect(() => {
    onEstimate({ includeDisk, includeMemory, compress });
  }, [includeDisk, includeMemory, compress, onEstimate]);

  const handleCreate = () => {
    onCreate(name, description, { includeDisk, includeMemory, compress });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="snapshot-name">Snapshot Name</Label>
        <Input
          id="snapshot-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter snapshot name"
          disabled={isCreating}
        />
      </div>

      <div>
        <Label htmlFor="snapshot-description">Description (optional)</Label>
        <Input
          id="snapshot-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Enter description"
          disabled={isCreating}
        />
      </div>

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="include-disk">Include Disk Image</Label>
            <p className="text-xs text-muted-foreground">Save the full disk state</p>
          </div>
          <Switch
            id="include-disk"
            checked={includeDisk}
            onCheckedChange={setIncludeDisk}
            disabled={isCreating}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="include-memory">Include Memory State</Label>
            <p className="text-xs text-muted-foreground">Save running processes (if supported)</p>
          </div>
          <Switch
            id="include-memory"
            checked={includeMemory}
            onCheckedChange={setIncludeMemory}
            disabled={isCreating}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="compress">Compress Snapshot</Label>
            <p className="text-xs text-muted-foreground">Use zstd compression to save space</p>
          </div>
          <Switch
            id="compress"
            checked={compress}
            onCheckedChange={setCompress}
            disabled={isCreating}
          />
        </div>
      </div>

      {/* Size Estimate */}
      {(isEstimating || sizeEstimate) && (
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          {isEstimating ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Estimating size...
            </div>
          ) : sizeEstimate && (
            <>
              <div className="flex justify-between text-sm">
                <span>Estimated Size:</span>
                <span className="font-medium">
                  {formatSize(compress ? sizeEstimate.compressedSize : sizeEstimate.uncompressedSize)}
                </span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Available Space:</span>
                <span>{formatSize(sizeEstimate.availableSpace)}</span>
              </div>
              {!sizeEstimate.hasEnoughSpace && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Not enough disk space
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Progress */}
      {isCreating && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Creating snapshot...</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isCreating}>
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          disabled={isCreating || !name.trim() || (sizeEstimate && !sizeEstimate.hasEnoughSpace)}
        >
          {isCreating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Camera className="h-4 w-4 mr-2" />
              Create Snapshot
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Confirmation dialog for restore/delete
 */
interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: 'default' | 'destructive';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  confirmVariant = 'default',
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmDialogProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button variant={confirmVariant} onClick={onConfirm} disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SnapshotManager({
  vmId,
  vmName,
  vmRunning = false,
  className,
  onSnapshotCreated,
  onSnapshotRestored,
  onSnapshotDeleted,
}: SnapshotManagerProps) {
  // State
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialog, setDialog] = useState<DialogState>({ type: null });
  const [sizeEstimate, setSizeEstimate] = useState<SnapshotSizeEstimate | null>(null);
  const [isEstimating, setIsEstimating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState(0);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch snapshots
  const fetchSnapshots = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/vm/snapshots?vmId=${vmId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch snapshots');
      }

      setSnapshots(data.data.snapshots || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load snapshots');
    } finally {
      setIsLoading(false);
    }
  }, [vmId]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  // Filter snapshots
  const filteredSnapshots = useMemo(() => {
    if (!searchQuery) return snapshots;
    const query = searchQuery.toLowerCase();
    return snapshots.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query)
    );
  }, [snapshots, searchQuery]);

  // Estimate size for new snapshot
  const estimateSize = useCallback(
    async (options: Partial<SnapshotOptions>) => {
      try {
        setIsEstimating(true);

        const response = await fetch('/api/vm/snapshots/estimate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vmId, options }),
        });
        const data = await response.json();

        if (data.success) {
          setSizeEstimate(data.data);
        }
      } catch {
        // Ignore estimation errors
      } finally {
        setIsEstimating(false);
      }
    },
    [vmId]
  );

  // Create snapshot
  const handleCreate = useCallback(
    async (name: string, description: string, options: Partial<SnapshotOptions>) => {
      try {
        setIsCreating(true);
        setCreateProgress(0);

        const response = await fetch('/api/vm/snapshots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ vmId, name, description, options }),
        });

        // Simulate progress (real implementation would use SSE or WebSocket)
        const progressInterval = setInterval(() => {
          setCreateProgress((prev) => Math.min(prev + 10, 90));
        }, 500);

        const data = await response.json();
        clearInterval(progressInterval);

        if (!data.success) {
          throw new Error(data.error || 'Failed to create snapshot');
        }

        setCreateProgress(100);
        setDialog({ type: null });
        await fetchSnapshots();
        onSnapshotCreated?.(data.data.snapshot);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create snapshot');
      } finally {
        setIsCreating(false);
        setCreateProgress(0);
      }
    },
    [vmId, fetchSnapshots, onSnapshotCreated]
  );

  // Restore snapshot
  const handleRestore = useCallback(async () => {
    if (!dialog.snapshotId) return;

    try {
      setIsRestoring(true);

      const response = await fetch(`/api/vm/snapshots/${dialog.snapshotId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vmId }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to restore snapshot');
      }

      setDialog({ type: null });
      onSnapshotRestored?.(dialog.snapshotId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore snapshot');
    } finally {
      setIsRestoring(false);
    }
  }, [dialog.snapshotId, vmId, onSnapshotRestored]);

  // Delete snapshot
  const handleDelete = useCallback(async () => {
    if (!dialog.snapshotId) return;

    try {
      setIsDeleting(true);

      const response = await fetch(`/api/vm/snapshots/${dialog.snapshotId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to delete snapshot');
      }

      setDialog({ type: null });
      await fetchSnapshots();
      onSnapshotDeleted?.(dialog.snapshotId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete snapshot');
    } finally {
      setIsDeleting(false);
    }
  }, [dialog.snapshotId, fetchSnapshots, onSnapshotDeleted]);

  // Export snapshot
  const handleExport = useCallback(async () => {
    if (!dialog.snapshotId) return;

    try {
      // Trigger download
      window.location.href = `/api/vm/snapshots/${dialog.snapshotId}/export`;
      setDialog({ type: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export snapshot');
    }
  }, [dialog.snapshotId]);

  // Render loading state
  if (isLoading && snapshots.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Snapshots
            </CardTitle>
            <CardDescription>
              Save and restore VM state for {vmName || vmId}
            </CardDescription>
          </div>
          <Button onClick={() => setDialog({ type: 'create' })}>
            <Plus className="h-4 w-4 mr-2" />
            New Snapshot
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
            <XCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setError(null)}
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Search */}
        {snapshots.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search snapshots..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        )}

        {/* Snapshot List */}
        {filteredSnapshots.length > 0 ? (
          <div className="space-y-2">
            {filteredSnapshots.map((snapshot) => (
              <SnapshotItem
                key={snapshot.id}
                snapshot={snapshot}
                isExpanded={expandedId === snapshot.id}
                onToggleExpand={() =>
                  setExpandedId(expandedId === snapshot.id ? null : snapshot.id)
                }
                onRestore={() =>
                  setDialog({ type: 'restore', snapshotId: snapshot.id, snapshot })
                }
                onDelete={() =>
                  setDialog({ type: 'delete', snapshotId: snapshot.id, snapshot })
                }
                onExport={() =>
                  setDialog({ type: 'export', snapshotId: snapshot.id, snapshot })
                }
                disabled={isRestoring || isDeleting}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {snapshots.length === 0 ? (
              <div className="space-y-2">
                <Camera className="h-12 w-12 mx-auto opacity-50" />
                <p>No snapshots yet</p>
                <p className="text-sm">Create your first snapshot to save VM state</p>
              </div>
            ) : (
              <p>No snapshots match your search</p>
            )}
          </div>
        )}

        {/* Storage Info */}
        {snapshots.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground pt-4 border-t">
            <span>
              {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''}
            </span>
            <span>
              Total: {formatSize(snapshots.reduce((sum, s) => sum + s.size, 0))}
            </span>
          </div>
        )}

        {/* Import Button */}
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialog({ type: 'import' })}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Snapshot
          </Button>
        </div>
      </CardContent>

      {/* Dialogs */}
      {dialog.type && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>
                {dialog.type === 'create' && 'Create Snapshot'}
                {dialog.type === 'restore' && 'Restore Snapshot'}
                {dialog.type === 'delete' && 'Delete Snapshot'}
                {dialog.type === 'export' && 'Export Snapshot'}
                {dialog.type === 'import' && 'Import Snapshot'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {dialog.type === 'create' && (
                <CreateDialog
                  vmId={vmId}
                  vmName={vmName}
                  sizeEstimate={sizeEstimate}
                  isEstimating={isEstimating}
                  onEstimate={estimateSize}
                  onCreate={handleCreate}
                  onCancel={() => setDialog({ type: null })}
                  isCreating={isCreating}
                  progress={createProgress}
                />
              )}

              {dialog.type === 'restore' && dialog.snapshot && (
                <ConfirmDialog
                  title={`Restore "${dialog.snapshot.name}"?`}
                  description={
                    vmRunning
                      ? 'The VM will be stopped and restored to this snapshot. Any unsaved data will be lost.'
                      : 'The VM will be restored to this snapshot state.'
                  }
                  confirmLabel="Restore"
                  onConfirm={handleRestore}
                  onCancel={() => setDialog({ type: null })}
                  isLoading={isRestoring}
                />
              )}

              {dialog.type === 'delete' && dialog.snapshot && (
                <ConfirmDialog
                  title={`Delete "${dialog.snapshot.name}"?`}
                  description="This action cannot be undone. The snapshot and all its data will be permanently deleted."
                  confirmLabel="Delete"
                  confirmVariant="destructive"
                  onConfirm={handleDelete}
                  onCancel={() => setDialog({ type: null })}
                  isLoading={isDeleting}
                />
              )}

              {dialog.type === 'export' && dialog.snapshot && (
                <ConfirmDialog
                  title={`Export "${dialog.snapshot.name}"?`}
                  description={`This will download the snapshot as a compressed archive (${formatSize(dialog.snapshot.size)}).`}
                  confirmLabel="Download"
                  onConfirm={handleExport}
                  onCancel={() => setDialog({ type: null })}
                />
              )}

              {dialog.type === 'import' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Select a snapshot archive file to import.
                  </p>
                  <Input
                    type="file"
                    accept=".tar.gz,.tgz"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        // Handle file upload
                        const formData = new FormData();
                        formData.append('file', file);

                        try {
                          const response = await fetch('/api/vm/snapshots/import', {
                            method: 'POST',
                            body: formData,
                          });
                          const data = await response.json();

                          if (data.success) {
                            setDialog({ type: null });
                            await fetchSnapshots();
                          } else {
                            setError(data.error || 'Failed to import snapshot');
                          }
                        } catch (err) {
                          setError('Failed to import snapshot');
                        }
                      }
                    }}
                  />
                  <div className="flex justify-end">
                    <Button variant="outline" onClick={() => setDialog({ type: null })}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </Card>
  );
}

export default SnapshotManager;
