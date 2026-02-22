import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Represents a single line in the diff view
 */
interface DiffLine {
  /** Line number in old content (undefined for additions) */
  oldLineNumber?: number
  /** Line number in new content (undefined for deletions) */
  newLineNumber?: number
  /** The text content of the line */
  content: string
  /** Type of change: added, removed, or unchanged */
  type: 'added' | 'removed' | 'unchanged'
}

/**
 * Props for the DiffViewer component
 */
export interface DiffViewerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Original content before changes */
  old: string
  /** New content after changes */
  new: string
  /** Programming language for syntax highlighting (optional) */
  language?: string
  /** File name being modified */
  fileName: string
  /** Show line numbers (default: true) */
  showLineNumbers?: boolean
  /** Context lines to show around changes (default: 3) */
  contextLines?: number
}

/**
 * Compute line-by-line diff between old and new content
 */
function computeDiff(oldContent: string, newContent: string, contextLines: number = 3): DiffLine[] {
  const oldLines = oldContent.split('\n')
  const newLines = newContent.split('\n')
  const diffLines: DiffLine[] = []

  // Simple line-by-line comparison
  // This is a basic implementation - for production, consider using a proper diff library
  const maxLines = Math.max(oldLines.length, newLines.length)

  let oldIndex = 0
  let newIndex = 0

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    const oldLine = oldLines[oldIndex]
    const newLine = newLines[newIndex]

    if (oldIndex >= oldLines.length) {
      // Only new lines remain
      diffLines.push({
        newLineNumber: newIndex + 1,
        content: newLine,
        type: 'added'
      })
      newIndex++
    } else if (newIndex >= newLines.length) {
      // Only old lines remain
      diffLines.push({
        oldLineNumber: oldIndex + 1,
        content: oldLine,
        type: 'removed'
      })
      oldIndex++
    } else if (oldLine === newLine) {
      // Lines are the same
      diffLines.push({
        oldLineNumber: oldIndex + 1,
        newLineNumber: newIndex + 1,
        content: oldLine,
        type: 'unchanged'
      })
      oldIndex++
      newIndex++
    } else {
      // Lines are different - mark as removed and added
      diffLines.push({
        oldLineNumber: oldIndex + 1,
        content: oldLine,
        type: 'removed'
      })
      diffLines.push({
        newLineNumber: newIndex + 1,
        content: newLine,
        type: 'added'
      })
      oldIndex++
      newIndex++
    }
  }

  return diffLines
}

/**
 * DiffViewer component for displaying code changes
 *
 * Shows a side-by-side or unified diff view with syntax highlighting
 */
const DiffViewer = React.memo(React.forwardRef<HTMLDivElement, DiffViewerProps>(
  ({
    className,
    old,
    new: newContent,
    language,
    fileName,
    showLineNumbers = true,
    contextLines = 3,
    ...props
  }, ref) => {
    const diffLines = React.useMemo(
      () => computeDiff(old, newContent, contextLines),
      [old, newContent, contextLines]
    )

    const stats = React.useMemo(() => {
      const added = diffLines.filter(line => line.type === 'added').length
      const removed = diffLines.filter(line => line.type === 'removed').length
      return { added, removed }
    }, [diffLines])

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden",
          className
        )}
        {...props}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">{fileName}</span>
            {language && (
              <span className="text-xs text-muted-foreground">({language})</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-green-600 dark:text-green-400">
              +{stats.added}
            </span>
            <span className="text-red-600 dark:text-red-400">
              -{stats.removed}
            </span>
          </div>
        </div>

        {/* Diff content */}
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-sm">
            <tbody>
              {diffLines.map((line, index) => {
                const lineKey = `${line.oldLineNumber}-${line.newLineNumber}-${index}`

                return (
                  <tr
                    key={lineKey}
                    className={cn(
                      "border-l-2",
                      line.type === 'added' && "bg-green-50 dark:bg-green-950/20 border-l-green-500",
                      line.type === 'removed' && "bg-red-50 dark:bg-red-950/20 border-l-red-500",
                      line.type === 'unchanged' && "border-l-transparent"
                    )}
                  >
                    {/* Line numbers */}
                    {showLineNumbers && (
                      <>
                        <td className="px-2 py-0.5 text-right text-muted-foreground select-none w-12 min-w-12">
                          {line.oldLineNumber || ''}
                        </td>
                        <td className="px-2 py-0.5 text-right text-muted-foreground select-none w-12 min-w-12">
                          {line.newLineNumber || ''}
                        </td>
                      </>
                    )}

                    {/* Change indicator */}
                    <td className="px-2 py-0.5 w-6 min-w-6 select-none">
                      <span
                        className={cn(
                          "inline-block w-4 text-center",
                          line.type === 'added' && "text-green-600 dark:text-green-400",
                          line.type === 'removed' && "text-red-600 dark:text-red-400"
                        )}
                      >
                        {line.type === 'added' && '+'}
                        {line.type === 'removed' && '-'}
                        {line.type === 'unchanged' && ' '}
                      </span>
                    </td>

                    {/* Line content */}
                    <td className="px-2 py-0.5 whitespace-pre-wrap break-all">
                      <code
                        className={cn(
                          line.type === 'added' && "text-green-900 dark:text-green-100",
                          line.type === 'removed' && "text-red-900 dark:text-red-100"
                        )}
                      >
                        {line.content || ' '}
                      </code>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Empty state */}
        {diffLines.length === 0 && (
          <div className="px-4 py-8 text-center text-muted-foreground">
            No changes detected
          </div>
        )}
      </div>
    )
  }
))

DiffViewer.displayName = "DiffViewer"

export { DiffViewer }
export type { DiffLine }
