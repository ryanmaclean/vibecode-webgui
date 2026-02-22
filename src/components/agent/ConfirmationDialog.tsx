import * as React from "react"
import { useEffect, useCallback } from "react"
import { X, Check, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { ActionPreview } from "./ActionPreview"
import type { ConfirmationRequest } from "@/types/agent-confirmation"

/**
 * Props for the ConfirmationDialog component
 */
export interface ConfirmationDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean
  /** Callback to close the dialog */
  onClose: () => void
  /** List of pending confirmation requests */
  confirmations: ConfirmationRequest[]
  /** Callback when user approves an action */
  onApprove: (requestId: string) => void
  /** Callback when user rejects an action */
  onReject: (requestId: string) => void
  /** Callback when user bulk approves all actions */
  onBulkApprove?: () => void
  /** Whether bulk approval is enabled */
  bulkApprovalEnabled?: boolean
  /** Whether actions are currently being processed */
  isProcessing?: boolean
}

/**
 * ConfirmationDialog component for agent action approval workflow
 *
 * Modal dialog that shows pending agent actions requiring user confirmation.
 * Supports individual approve/reject per action and optional bulk approval.
 */
export const ConfirmationDialog = React.memo(({
  isOpen,
  onClose,
  confirmations,
  onApprove,
  onReject,
  onBulkApprove,
  bulkApprovalEnabled = false,
  isProcessing = false,
}: ConfirmationDialogProps) => {
  // Handle keyboard shortcuts
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Only handle keyboard shortcuts when dialog is open
    if (!isOpen) return

    // Escape key closes the dialog
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }

    // Enter key approves the first pending action (if only one)
    if (event.key === 'Enter' && confirmations.length === 1 && !isProcessing) {
      event.preventDefault()
      onApprove(confirmations[0].request_id)
    }
  }, [isOpen, confirmations, onApprove, onClose, isProcessing])

  // Prevent body scroll when modal is open and add keyboard listener
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      document.addEventListener('keydown', handleKeyDown)
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.body.style.overflow = 'unset'
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  // Don't render if not open
  if (!isOpen) return null

  // Count bulk approvable actions
  const bulkApprovableCount = confirmations.filter(c => c.bulk_approvable).length

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirmation-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog container */}
      <div className="relative z-10 flex h-full w-full items-center justify-center p-2 sm:p-4">
        <div className="relative h-full sm:h-[90vh] w-full max-w-full sm:max-w-4xl overflow-hidden rounded-none sm:rounded-lg bg-background shadow-2xl border border-border">
          <div className="flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 sm:px-6 py-4">
              <div className="flex-1 min-w-0">
                <h2
                  id="confirmation-dialog-title"
                  className="text-lg font-semibold text-foreground truncate"
                >
                  Agent Action Confirmation
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {confirmations.length} action{confirmations.length !== 1 ? 's' : ''} requiring approval
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="flex-shrink-0 ml-4"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 px-4 sm:px-6 py-4">
              <div className="space-y-4">
                {confirmations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Check className="h-12 w-12 text-green-500 mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      All actions approved
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      No pending confirmations
                    </p>
                  </div>
                ) : (
                  confirmations.map((confirmation, index) => (
                    <React.Fragment key={confirmation.request_id}>
                      <ActionPreview
                        action={confirmation.action}
                        onApprove={() => onApprove(confirmation.request_id)}
                        onReject={() => onReject(confirmation.request_id)}
                        disabled={isProcessing}
                      />
                      {index < confirmations.length - 1 && (
                        <Separator className="my-4" />
                      )}
                    </React.Fragment>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="border-t border-border bg-muted/30 px-4 sm:px-6 py-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Keyboard hints */}
                <div className="text-xs text-muted-foreground">
                  {confirmations.length === 1 ? (
                    <span>Press <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-background border border-border rounded">Enter</kbd> to approve, <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-background border border-border rounded">Esc</kbd> to close</span>
                  ) : (
                    <span>Press <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-background border border-border rounded">Esc</kbd> to close</span>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-2 justify-end">
                  {bulkApprovalEnabled && bulkApprovableCount > 1 && onBulkApprove && (
                    <Button
                      variant="default"
                      onClick={onBulkApprove}
                      disabled={isProcessing || confirmations.length === 0}
                      className={cn(
                        "gap-2",
                        isProcessing && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Check className="h-4 w-4" />
                      Approve All ({bulkApprovableCount})
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={onClose}
                    disabled={isProcessing && confirmations.length > 0}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Close
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

ConfirmationDialog.displayName = "ConfirmationDialog"

export { ConfirmationDialog as default }
