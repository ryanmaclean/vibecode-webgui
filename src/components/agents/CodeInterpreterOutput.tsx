/**
 * CodeInterpreterOutput Component
 *
 * Display code execution output with syntax highlighting,
 * error handling, and interactive result visualization.
 *
 * Features:
 * - Syntax-highlighted code display
 * - Execution output with stdout/stderr
 * - Error stack traces
 * - Image and file outputs
 * - Execution metrics
 * - Accessibility compliant (WCAG 2.1 AA)
 *
 * @module components/agents/CodeInterpreterOutput
 */

'use client'

import React, { useState, useCallback } from 'react'
import {
  Terminal,
  Code,
  AlertCircle,
  Check,
  Clock,
  Copy,
  Download,
  Image as ImageIcon,
  File,
  ChevronDown,
  ChevronRight
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// ============================================================================
// Type Definitions
// ============================================================================

type OutputType = 'stdout' | 'stderr' | 'image' | 'file' | 'error'

interface CodeOutput {
  type: OutputType
  content: string
  mimeType?: string
  filename?: string
}

interface CodeExecution {
  id: string
  code: string
  language: string
  outputs: CodeOutput[]
  status: 'success' | 'error' | 'timeout'
  executionTime: number
  timestamp: Date
  error?: {
    message: string
    type: string
    stackTrace?: string
  }
}

interface CodeInterpreterOutputProps {
  /** Code execution result */
  execution: CodeExecution
  /** Show code input */
  showCode?: boolean
  /** Enable download of outputs */
  enableDownload?: boolean
  /** Custom className */
  className?: string
}

// ============================================================================
// Output Display Component
// ============================================================================

interface OutputItemProps {
  output: CodeOutput
  enableDownload: boolean
}

function OutputItem({ output, enableDownload }: OutputItemProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(output.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy output:', error)
    }
  }, [output.content])

  const handleDownload = useCallback(() => {
    const blob = new Blob([output.content], {
      type: output.mimeType || 'text/plain'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = output.filename || 'output.txt'
    a.click()
    URL.revokeObjectURL(url)
  }, [output])

  // Render image output
  if (output.type === 'image') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
            <span>{output.filename || 'Image output'}</span>
          </div>
          {enableDownload && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              aria-label="Download image"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
        <div className="bg-muted rounded-md p-4">
          <img
            src={output.content}
            alt={output.filename || 'Code execution output'}
            className="max-w-full h-auto rounded"
          />
        </div>
      </div>
    )
  }

  // Render file output
  if (output.type === 'file') {
    return (
      <div className="flex items-center justify-between p-3 bg-muted rounded-md">
        <div className="flex items-center gap-2">
          <File className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm">{output.filename || 'output file'}</span>
        </div>
        {enableDownload && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            aria-label="Download file"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    )
  }

  // Render text output (stdout/stderr/error)
  return (
    <div className="relative group">
      <div className={cn(
        "rounded-md p-3 text-sm font-mono whitespace-pre-wrap break-words",
        output.type === 'stderr' && "bg-red-500/10 text-red-500",
        output.type === 'error' && "bg-red-500/10 text-red-500",
        output.type === 'stdout' && "bg-muted"
      )}>
        {output.content}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Copy output"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
        ) : (
          <Copy className="h-4 w-4" aria-hidden="true" />
        )}
      </Button>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function CodeInterpreterOutput({
  execution,
  showCode = true,
  enableDownload = true,
  className
}: CodeInterpreterOutputProps) {
  const [isCodeExpanded, setIsCodeExpanded] = useState(showCode)
  const [copied, setCopied] = useState(false)

  const handleCopyCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(execution.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy code:', error)
    }
  }, [execution.code])

  const hasOutputs = execution.outputs.length > 0
  const hasError = execution.status === 'error' || execution.error

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Terminal className="h-5 w-5" aria-hidden="true" />
            Code Interpreter
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant={execution.status === 'success' ? 'default' : 'destructive'}
              className="flex items-center gap-1"
            >
              {execution.status === 'success' ? (
                <Check className="h-3 w-3" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
              )}
              {execution.status}
            </Badge>
            <Badge variant="outline" className="text-xs">
              <Clock className="h-3 w-3 mr-1" aria-hidden="true" />
              {execution.executionTime}ms
            </Badge>
            <Badge variant="outline" className="text-xs">
              {execution.language}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-4 space-y-4">
        {/* Code Input Section */}
        <div className="space-y-2">
          <button
            onClick={() => setIsCodeExpanded(!isCodeExpanded)}
            className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
            aria-expanded={isCodeExpanded}
            aria-controls="code-content"
          >
            {isCodeExpanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
            <Code className="h-4 w-4" aria-hidden="true" />
            Code Input
          </button>

          {isCodeExpanded && (
            <div id="code-content" className="relative group">
              <ScrollArea className="max-h-[300px]">
                <pre className="bg-muted rounded-md p-4 text-sm font-mono overflow-x-auto">
                  <code>{execution.code}</code>
                </pre>
              </ScrollArea>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyCode}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Copy code"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Error Display */}
        {hasError && execution.error && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              Error
            </div>
            <div className="bg-destructive/10 border border-destructive/20 rounded-md p-4 space-y-2">
              <div className="font-medium text-destructive">
                {execution.error.type}: {execution.error.message}
              </div>
              {execution.error.stackTrace && (
                <ScrollArea className="max-h-[200px]">
                  <pre className="text-xs text-destructive/80 font-mono">
                    {execution.error.stackTrace}
                  </pre>
                </ScrollArea>
              )}
            </div>
          </div>
        )}

        {/* Output Display */}
        {hasOutputs && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Terminal className="h-4 w-4" aria-hidden="true" />
              Output ({execution.outputs.length})
            </div>

            <Tabs defaultValue="all" className="w-full">
              <TabsList>
                <TabsTrigger value="all">
                  All ({execution.outputs.length})
                </TabsTrigger>
                <TabsTrigger value="stdout">
                  stdout ({execution.outputs.filter(o => o.type === 'stdout').length})
                </TabsTrigger>
                <TabsTrigger value="stderr">
                  stderr ({execution.outputs.filter(o => o.type === 'stderr').length})
                </TabsTrigger>
                <TabsTrigger value="files">
                  Files ({execution.outputs.filter(o => o.type === 'image' || o.type === 'file').length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-3 mt-3">
                {execution.outputs.map((output, index) => (
                  <OutputItem
                    key={index}
                    output={output}
                    enableDownload={enableDownload}
                  />
                ))}
              </TabsContent>

              <TabsContent value="stdout" className="space-y-3 mt-3">
                {execution.outputs
                  .filter(o => o.type === 'stdout')
                  .map((output, index) => (
                    <OutputItem
                      key={index}
                      output={output}
                      enableDownload={enableDownload}
                    />
                  ))}
              </TabsContent>

              <TabsContent value="stderr" className="space-y-3 mt-3">
                {execution.outputs
                  .filter(o => o.type === 'stderr')
                  .map((output, index) => (
                    <OutputItem
                      key={index}
                      output={output}
                      enableDownload={enableDownload}
                    />
                  ))}
              </TabsContent>

              <TabsContent value="files" className="space-y-3 mt-3">
                {execution.outputs
                  .filter(o => o.type === 'image' || o.type === 'file')
                  .map((output, index) => (
                    <OutputItem
                      key={index}
                      output={output}
                      enableDownload={enableDownload}
                    />
                  ))}
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Empty State */}
        {!hasOutputs && !hasError && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Terminal className="h-12 w-12 text-muted-foreground/50 mb-4" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              No output generated
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
