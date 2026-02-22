import * as React from "react"
import { cn } from "@/lib/utils"
import type { ActionPreview as ActionPreviewType } from "@/types/agent-confirmation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DiffViewer } from "./DiffViewer"

/**
 * Props for the ActionPreview component
 */
export interface ActionPreviewProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The action preview data to display */
  action: ActionPreviewType
  /** Callback when user approves the action */
  onApprove?: (actionId: string) => void
  /** Callback when user rejects the action */
  onReject?: (actionId: string) => void
  /** Whether approve/reject buttons are disabled */
  disabled?: boolean
  /** Hide action buttons (for read-only preview) */
  hideActions?: boolean
}

/**
 * Get badge variant based on risk level
 */
function getRiskVariant(riskLevel?: 'low' | 'medium' | 'high'): 'default' | 'secondary' | 'destructive' {
  switch (riskLevel) {
    case 'low':
      return 'secondary'
    case 'medium':
      return 'default'
    case 'high':
      return 'destructive'
    default:
      return 'default'
  }
}

/**
 * Format action type for display
 */
function formatActionType(actionType: string): string {
  return actionType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Format timestamp to relative or absolute time
 */
function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSec = Math.floor(diffMs / 1000)
    const diffMin = Math.floor(diffSec / 60)
    const diffHour = Math.floor(diffMin / 60)

    if (diffSec < 60) return 'just now'
    if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`
    if (diffHour < 24) return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`

    return date.toLocaleString()
  } catch {
    return isoString
  }
}

/**
 * ActionPreview component for displaying proposed agent actions
 *
 * Shows action metadata, explanation, diff preview, and approval controls
 */
const ActionPreview = React.memo(React.forwardRef<HTMLDivElement, ActionPreviewProps>(
  ({
    className,
    action,
    onApprove,
    onReject,
    disabled = false,
    hideActions = false,
    ...props
  }, ref) => {
    const handleApprove = React.useCallback(() => {
      onApprove?.(action.action_id)
    }, [onApprove, action.action_id])

    const handleReject = React.useCallback(() => {
      onReject?.(action.action_id)
    }, [onReject, action.action_id])

    // Extract risk level from metadata if available
    const riskLevel = action.metadata?.risk_level as 'low' | 'medium' | 'high' | undefined

    return (
      <Card
        ref={ref}
        className={cn("w-full", className)}
        {...props}
      >
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-xl">
                  {formatActionType(action.action_type)}
                </CardTitle>
                <Badge variant="outline" className="font-mono text-xs">
                  {action.tool_name}
                </Badge>
                {riskLevel && (
                  <Badge variant={getRiskVariant(riskLevel)} className="text-xs">
                    {riskLevel} risk
                  </Badge>
                )}
              </div>
              {action.file_path && (
                <CardDescription className="font-mono text-sm">
                  {action.file_path}
                </CardDescription>
              )}
            </div>
            <time
              className="text-xs text-muted-foreground whitespace-nowrap"
              dateTime={action.created_at}
              title={new Date(action.created_at).toLocaleString()}
            >
              {formatTimestamp(action.created_at)}
            </time>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Explanation */}
          <div className="rounded-lg bg-muted/50 p-4">
            <h4 className="text-sm font-semibold mb-2 text-muted-foreground">
              Why this change is needed
            </h4>
            <p className="text-sm leading-relaxed">
              {action.explanation}
            </p>
          </div>

          {/* Diff preview */}
          {action.diff && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground">
                Proposed changes
              </h4>
              <DiffViewer
                old={action.diff.old_content}
                new={action.diff.new_content}
                language={action.diff.language}
                fileName={action.file_path || 'unknown'}
              />
            </div>
          )}

          {/* Additional metadata */}
          {action.metadata && Object.keys(action.metadata).length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                Additional details
              </summary>
              <div className="mt-2 rounded-lg bg-muted/30 p-3 font-mono text-xs overflow-x-auto">
                <pre>{JSON.stringify(action.metadata, null, 2)}</pre>
              </div>
            </details>
          )}
        </CardContent>

        {/* Action buttons */}
        {!hideActions && (
          <CardFooter className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={handleReject}
              disabled={disabled}
              className="min-w-24"
            >
              Reject
            </Button>
            <Button
              variant="default"
              onClick={handleApprove}
              disabled={disabled}
              className="min-w-24"
            >
              Approve
            </Button>
          </CardFooter>
        )}
      </Card>
    )
  }
))

ActionPreview.displayName = "ActionPreview"

export { ActionPreview }
