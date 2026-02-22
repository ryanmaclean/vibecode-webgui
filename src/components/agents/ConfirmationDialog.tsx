/**
 * ConfirmationDialog Component
 *
 * Modal dialog for approving or rejecting agent actions.
 * Displays action details, diff preview, and risk level.
 *
 * Features:
 * - Action metadata display (type, file path, explanation)
 * - Code diff viewer for file changes
 * - Risk level indicator
 * - Approve/Reject/Cancel buttons
 * - Optional comment input
 * - Accessibility compliant
 * - Dark mode support
 *
 * @module components/agents/ConfirmationDialog
 */

'use client';

import React, { useState, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  MessageSquare,
  Shield,
  XCircle,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

import { DiffViewer } from './DiffViewer';
import type { ConfirmationRequest } from '@/types/agent-confirmation';

// ============================================================================
// Types
// ============================================================================

export interface ConfirmationDialogProps {
  /** The confirmation request to display */
  confirmation: ConfirmationRequest | null;
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog close is requested */
  onOpenChange?: (open: boolean) => void;
  /** Callback when user approves the action */
  onApprove?: (requestId: string, comment?: string) => void | Promise<void>;
  /** Callback when user rejects the action */
  onReject?: (requestId: string, comment?: string) => void | Promise<void>;
  /** Whether approval/rejection is in progress */
  isProcessing?: boolean;
  /** Custom className */
  className?: string;
}

// ============================================================================
// Subcomponents
// ============================================================================

/**
 * Risk level badge with appropriate styling
 */
interface RiskBadgeProps {
  riskLevel: 'low' | 'medium' | 'high';
}

function RiskBadge({ riskLevel }: RiskBadgeProps) {
  return (
    <Badge
      variant={riskLevel === 'high' ? 'destructive' : 'secondary'}
      className={cn(
        'flex items-center gap-1',
        riskLevel === 'medium' && 'bg-yellow-100 text-yellow-900 dark:bg-yellow-900/20 dark:text-yellow-400',
        riskLevel === 'low' && 'bg-green-100 text-green-900 dark:bg-green-900/20 dark:text-green-400'
      )}
    >
      <Shield className="h-3 w-3" aria-hidden="true" />
      <span className="capitalize">{riskLevel} Risk</span>
    </Badge>
  );
}

/**
 * Action type badge with icon
 */
interface ActionTypeBadgeProps {
  actionType: string;
}

function ActionTypeBadge({ actionType }: ActionTypeBadgeProps) {
  const getActionIcon = () => {
    switch (actionType) {
      case 'file_delete':
        return <XCircle className="h-3 w-3" aria-hidden="true" />;
      case 'file_write':
      case 'file_edit':
      case 'code_replace':
        return <FileText className="h-3 w-3" aria-hidden="true" />;
      default:
        return <AlertTriangle className="h-3 w-3" aria-hidden="true" />;
    }
  };

  return (
    <Badge variant="outline" className="flex items-center gap-1">
      {getActionIcon()}
      <span className="capitalize">{actionType.replace(/_/g, ' ')}</span>
    </Badge>
  );
}

/**
 * Metadata section showing action details
 */
interface MetadataSectionProps {
  confirmation: ConfirmationRequest;
}

function MetadataSection({ confirmation }: MetadataSectionProps) {
  const { action, agent_id, created_at, expires_at, risk_level } = confirmation;

  const formatTimestamp = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="space-y-3">
      {/* Action Type and Risk Level */}
      <div className="flex items-center gap-2 flex-wrap">
        <ActionTypeBadge actionType={action.action_type} />
        {risk_level && <RiskBadge riskLevel={risk_level} />}
      </div>

      {/* File Path */}
      {action.file_path && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">File Path</Label>
          <p className="text-sm font-mono bg-muted px-3 py-2 rounded-md break-all">
            {action.file_path}
          </p>
        </div>
      )}

      {/* Explanation */}
      <div className="space-y-1">
        <Label className="text-xs text-muted-foreground">Explanation</Label>
        <p className="text-sm leading-relaxed">{action.explanation}</p>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Agent ID</Label>
          <p className="font-mono truncate" title={agent_id}>
            {agent_id}
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Tool</Label>
          <p className="font-mono truncate" title={action.tool_name}>
            {action.tool_name}
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            Created
          </Label>
          <p className="text-xs">{formatTimestamp(created_at)}</p>
        </div>
        {expires_at && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              Expires
            </Label>
            <p className="text-xs">{formatTimestamp(expires_at)}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * ConfirmationDialog component for approval workflow
 *
 * Displays detailed information about an agent action requiring approval
 * and provides approve/reject functionality with optional comments.
 *
 * @example
 * ```tsx
 * <ConfirmationDialog
 *   confirmation={confirmationRequest}
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   onApprove={handleApprove}
 *   onReject={handleReject}
 * />
 * ```
 */
export const ConfirmationDialog = React.memo(
  React.forwardRef<HTMLDivElement, ConfirmationDialogProps>(
    (
      {
        className,
        confirmation,
        open,
        onOpenChange,
        onApprove,
        onReject,
        isProcessing = false,
        ...props
      },
      ref
    ) => {
      const [comment, setComment] = useState('');

      // Reset comment when dialog opens/closes or confirmation changes
      React.useEffect(() => {
        if (!open || !confirmation) {
          setComment('');
        }
      }, [open, confirmation]);

      const handleApprove = useCallback(async () => {
        if (!confirmation || !onApprove) return;
        await onApprove(confirmation.request_id, comment || undefined);
        setComment('');
      }, [confirmation, comment, onApprove]);

      const handleReject = useCallback(async () => {
        if (!confirmation || !onReject) return;
        await onReject(confirmation.request_id, comment || undefined);
        setComment('');
      }, [confirmation, comment, onReject]);

      const handleCancel = useCallback(() => {
        if (!isProcessing && onOpenChange) {
          onOpenChange(false);
        }
      }, [isProcessing, onOpenChange]);

      if (!confirmation) {
        return null;
      }

      const { action, risk_level } = confirmation;
      const hasDiff = action.diff !== undefined && action.diff !== null;

      return (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent
            ref={ref}
            className={cn('max-w-4xl max-h-[90vh] overflow-y-auto', className)}
            {...props}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle
                  className={cn(
                    'h-5 w-5',
                    risk_level === 'high' && 'text-destructive',
                    risk_level === 'medium' && 'text-yellow-600 dark:text-yellow-400',
                    risk_level === 'low' && 'text-green-600 dark:text-green-400'
                  )}
                  aria-hidden="true"
                />
                Agent Action Approval Required
              </DialogTitle>
              <DialogDescription>
                Review the details below and approve or reject this agent action.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Metadata Section */}
              <MetadataSection confirmation={confirmation} />

              {/* Diff Viewer */}
              {hasDiff && action.diff && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Code Changes</Label>
                    <DiffViewer
                      oldContent={action.diff.old_content}
                      newContent={action.diff.new_content}
                      fileName={action.file_path}
                      language={action.diff.language}
                      showHeader={false}
                    />
                  </div>
                </>
              )}

              {/* Comment Input */}
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="comment" className="flex items-center gap-1.5 text-sm font-medium">
                  <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  Comment (Optional)
                </Label>
                <Textarea
                  id="comment"
                  placeholder="Add a comment about your decision..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={isProcessing}
                  className="resize-none"
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleReject}
                disabled={isProcessing}
                className="gap-1.5"
              >
                <XCircle className="h-4 w-4" aria-hidden="true" />
                Reject
              </Button>
              <Button
                type="button"
                variant="default"
                onClick={handleApprove}
                disabled={isProcessing}
                className="gap-1.5 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-800"
              >
                <CheckCircle className="h-4 w-4" aria-hidden="true" />
                Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    }
  )
);

ConfirmationDialog.displayName = 'ConfirmationDialog';

// ============================================================================
// Exports
// ============================================================================

export type { RiskBadgeProps, ActionTypeBadgeProps, MetadataSectionProps };
