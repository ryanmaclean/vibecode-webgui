/**
 * AgentFileBrowser Component
 *
 * File browser for agent-accessible files with tree view,
 * file upload, and access control.
 *
 * Features:
 * - Tree view with file hierarchy
 * - File upload and management
 * - File type indicators
 * - Size and date information
 * - Access control indicators
 * - Search and filter
 * - Accessibility compliant (WCAG 2.1 AA)
 *
 * @module components/agents/AgentFileBrowser
 */

'use client'

import React, { useState, useCallback, useMemo } from 'react'
import {
File,
  Folder,
  FolderOpen,
  Upload,
  Trash2,
  Download,
  Search,
  ChevronRight,
  ChevronDown,
  FileText,
  FileCode,
  FileImage,
  Lock,
  Unlock
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { logger } from '@/lib/logger';

// ============================================================================
// Type Definitions
// ============================================================================

type FileType = 'file' | 'directory'

interface AgentFile {
  id: string
  name: string
  type: FileType
  path: string
  size?: number
  mimeType?: string
  lastModified: Date
  isAccessible: boolean
  children?: AgentFile[]
}

interface AgentFileBrowserProps {
  /** Root files and directories */
  files: AgentFile[]
  /** Currently selected file IDs */
  selectedFiles?: string[]
  /** Callback when file is selected */
  onSelectFile?: (fileId: string) => void
  /** Callback when file is uploaded */
  onUploadFile?: (file: File) => Promise<void>
  /** Callback when file is deleted */
  onDeleteFile?: (fileId: string) => Promise<void>
  /** Callback when file is downloaded */
  onDownloadFile?: (fileId: string) => void
  /** Enable multi-select */
  multiSelect?: boolean
  /** Custom className */
  className?: string
}

// ============================================================================
// Utility Functions
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function getFileIcon(file: AgentFile) {
  if (file.type === 'directory') return FolderOpen

  if (file.mimeType) {
    if (file.mimeType.startsWith('image/')) return FileImage
    if (file.mimeType.startsWith('text/')) return FileText
    if (file.mimeType.includes('javascript') || file.mimeType.includes('typescript')) {
      return FileCode
    }
  }

  const ext = file.name.split('.').pop()?.toLowerCase()
  const codeExtensions = ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs']

  if (ext && codeExtensions.includes(ext)) return FileCode

  return File
}

// ============================================================================
// File Tree Item Component
// ============================================================================

interface FileTreeItemProps {
  file: AgentFile
  level: number
  isSelected: boolean
  onSelect: (fileId: string) => void
  onDelete?: (fileId: string) => Promise<void>
  onDownload?: (fileId: string) => void
  expandedDirs: Set<string>
  toggleDir: (dirId: string) => void
}

function FileTreeItem({
  file,
  level,
  isSelected,
  onSelect,
  onDelete,
  onDownload,
  expandedDirs,
  toggleDir
}: FileTreeItemProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const isExpanded = expandedDirs.has(file.id)
  const Icon = file.type === 'directory'
    ? (isExpanded ? FolderOpen : Folder)
    : getFileIcon(file)

  const handleDelete = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onDelete) return

    setIsDeleting(true)
    try {
      await onDelete(file.id)
    } catch (error) {
      logger.error('Failed to delete file:', error)
    } finally {
      setIsDeleting(false)
    }
  }, [file.id, onDelete])

  const handleDownload = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDownload) {
      onDownload(file.id)
    }
  }, [file.id, onDownload])

  return (
    <div>
      <button
        onClick={() => {
          if (file.type === 'directory') {
            toggleDir(file.id)
          }
          onSelect(file.id)
        }}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 hover:bg-accent rounded-md transition-colors group",
          isSelected && "bg-accent",
          !file.isAccessible && "opacity-50"
        )}
        style={{ paddingLeft: `${level * 1.5 + 0.75}rem` }}
        aria-expanded={file.type === 'directory' ? isExpanded : undefined}
        aria-label={`${file.type === 'directory' ? 'Folder' : 'File'}: ${file.name}`}
      >
        {file.type === 'directory' && (
          <div className="flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            )}
          </div>
        )}

        <Icon className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />

        <span className="flex-1 text-sm truncate text-left">{file.name}</span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {file.isAccessible ? (
            <Unlock className="h-3 w-3 text-green-500" aria-label="Accessible" />
          ) : (
            <Lock className="h-3 w-3 text-muted-foreground" aria-label="Not accessible" />
          )}

          {file.type === 'file' && file.size && (
            <span className="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </span>
          )}

          {file.type === 'file' && onDownload && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-6 w-6 p-0"
              aria-label="Download file"
            >
              <Download className="h-3 w-3" aria-hidden="true" />
            </Button>
          )}

          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
              className="h-6 w-6 p-0 text-destructive"
              aria-label="Delete file"
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
            </Button>
          )}
        </div>
      </button>

      {file.type === 'directory' && isExpanded && file.children && (
        <div role="group">
          {file.children.map((child) => (
            <FileTreeItem
              key={child.id}
              file={child}
              level={level + 1}
              isSelected={isSelected}
              onSelect={onSelect}
              onDelete={onDelete}
              onDownload={onDownload}
              expandedDirs={expandedDirs}
              toggleDir={toggleDir}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentFileBrowser({
  files,
  selectedFiles = [],
  onSelectFile,
  onUploadFile,
  onDeleteFile,
  onDownloadFile,
  multiSelect = false,
  className
}: AgentFileBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [isUploading, setIsUploading] = useState(false)

  const toggleDir = useCallback((dirId: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev)
      if (next.has(dirId)) {
        next.delete(dirId)
      } else {
        next.add(dirId)
      }
      return next
    })
  }, [])

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !onUploadFile) return

    setIsUploading(true)
    try {
      await onUploadFile(file)
      event.target.value = '' // Reset input
    } catch (error) {
      logger.error('Failed to upload file:', error)
    } finally {
      setIsUploading(false)
    }
  }, [onUploadFile])

  // Filter files based on search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files

    const filterRecursive = (items: AgentFile[]): AgentFile[] => {
      return items.reduce((acc, item) => {
        const matchesQuery = item.name.toLowerCase().includes(searchQuery.toLowerCase())

        if (item.type === 'directory' && item.children) {
          const filteredChildren = filterRecursive(item.children)
          if (filteredChildren.length > 0 || matchesQuery) {
            acc.push({ ...item, children: filteredChildren })
          }
        } else if (matchesQuery) {
          acc.push(item)
        }

        return acc
      }, [] as AgentFile[])
    }

    return filterRecursive(files)
  }, [files, searchQuery])

  const fileCount = useMemo(() => {
    const count = (items: AgentFile[]): number => {
      return items.reduce((total, item) => {
        if (item.type === 'file') return total + 1
        return total + (item.children ? count(item.children) : 0)
      }, 0)
    }
    return count(files)
  }, [files])

  const accessibleCount = useMemo(() => {
    const count = (items: AgentFile[]): number => {
      return items.reduce((total, item) => {
        if (item.type === 'file' && item.isAccessible) return total + 1
        return total + (item.children ? count(item.children) : 0)
      }, 0)
    }
    return count(files)
  }, [files])

  return (
    <Card className={cn("flex flex-col h-full", className)}>
      <CardHeader className="pb-3 border-b">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Folder className="h-5 w-5" aria-hidden="true" />
              Agent Files
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">
                {accessibleCount} / {fileCount} accessible
              </Badge>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Search files"
              />
            </div>

            {onUploadFile && (
              <div className="relative">
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  aria-label="Upload file"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  className="pointer-events-none"
                >
                  <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
                  {isUploading ? 'Uploading...' : 'Upload'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full">
          {filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Folder className="h-12 w-12 text-muted-foreground/50 mb-4" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? 'No files match your search' : 'No files available'}
              </p>
            </div>
          ) : (
            <div className="p-2">
              {filteredFiles.map((file) => (
                <FileTreeItem
                  key={file.id}
                  file={file}
                  level={0}
                  isSelected={selectedFiles.includes(file.id)}
                  onSelect={onSelectFile || (() => {})}
                  onDelete={onDeleteFile}
                  onDownload={onDownloadFile}
                  expandedDirs={expandedDirs}
                  toggleDir={toggleDir}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
