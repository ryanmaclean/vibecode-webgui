"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export interface ChangeStatistics {
  /** Number of lines added */
  additions: number;
  /** Number of lines deleted */
  deletions: number;
  /** Number of lines modified */
  modifications: number;
}

export interface DiffControlsProps {
  /** Statistics about the changes */
  statistics?: ChangeStatistics;
  /** Callback when accept button is clicked */
  onAccept?: () => void;
  /** Callback when reject button is clicked */
  onReject?: () => void;
  /** Whether controls are disabled */
  disabled?: boolean;
  /** Control level: 'hunk' for block-level, 'line' for line-level */
  level?: "hunk" | "line";
  /** Optional label for the control group */
  label?: string;
  /** Additional className for customization */
  className?: string;
}

// ============================================================================
// DiffControls Component
// ============================================================================

export const DiffControls = React.memo<DiffControlsProps>(({
  statistics = { additions: 0, deletions: 0, modifications: 0 },
  onAccept,
  onReject,
  disabled = false,
  level = "hunk",
  label,
  className,
}) => {
  const hasChanges = statistics.additions > 0 ||
                     statistics.deletions > 0 ||
                     statistics.modifications > 0;

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        {label && (
          <div className="mb-4">
            <span className="text-sm font-medium text-muted-foreground">
              {label}
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {statistics.additions > 0 && (
            <Badge variant="default" className="bg-green-500 hover:bg-green-600">
              +{statistics.additions} {statistics.additions === 1 ? 'addition' : 'additions'}
            </Badge>
          )}

          {statistics.deletions > 0 && (
            <Badge variant="destructive">
              -{statistics.deletions} {statistics.deletions === 1 ? 'deletion' : 'deletions'}
            </Badge>
          )}

          {statistics.modifications > 0 && (
            <Badge variant="secondary">
              ~{statistics.modifications} {statistics.modifications === 1 ? 'modification' : 'modifications'}
            </Badge>
          )}

          {!hasChanges && (
            <Badge variant="outline">
              No changes
            </Badge>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onReject}
          disabled={disabled || !hasChanges}
          aria-label={`Reject ${level}`}
        >
          <X className="mr-2 h-4 w-4" />
          Reject
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={onAccept}
          disabled={disabled || !hasChanges}
          aria-label={`Accept ${level}`}
        >
          <Check className="mr-2 h-4 w-4" />
          Accept
        </Button>
      </CardFooter>
    </Card>
  );
});

DiffControls.displayName = "DiffControls";
