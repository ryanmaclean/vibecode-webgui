'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  GitCommit,
  Calendar,
  User,
  ExternalLink,
  FileText,
  Plus,
  Minus,
  Copy,
  Check,
} from 'lucide-react'
import { format } from 'date-fns'

interface CommitDetails {
  sha: string
  message: string
  author: {
    name: string
    email: string
    date: string
    avatarUrl?: string
  }
  committer: {
    name: string
    email: string
    date: string
  }
  htmlUrl: string
  stats: {
    additions: number
    deletions: number
    total: number
  }
  files: Array<{
    filename: string
    status: string
    additions: number
    deletions: number
    changes: number
    patch?: string
  }>
  parents: Array<{
    sha: string
    htmlUrl: string
  }>
}

interface CommitDetailsPanelProps {
  repoName: string
  commitSha: string
  accessToken: string
  onClose?: () => void
}

export function CommitDetailsPanel({
  repoName,
  commitSha,
  accessToken,
  onClose,
}: CommitDetailsPanelProps) {
  const [commit, setCommit] = useState<CommitDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedSha, setCopiedSha] = useState(false)

  useEffect(() => {
    const fetchCommitDetails = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/github/commits/details', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            repoName,
            commitSha,
            accessToken,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to fetch commit details')
        }

        const data = await response.json()
        setCommit(data.commit)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load commit details')
      } finally {
        setLoading(false)
      }
    }

    fetchCommitDetails()
  }, [repoName, commitSha, accessToken])

  const handleCopySha = () => {
    navigator.clipboard.writeText(commitSha)
    setCopiedSha(true)
    setTimeout(() => setCopiedSha(false), 2000)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'added':
        return 'text-green-600'
      case 'removed':
        return 'text-red-600'
      case 'modified':
        return 'text-blue-600'
      case 'renamed':
        return 'text-purple-600'
      default:
        return 'text-gray-600'
    }
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      added: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      removed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      modified: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      renamed: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    }
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardContent className="py-8">
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
            {error}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!commit) {
    return null
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2 mb-2">
              <GitCommit className="h-5 w-5" />
              Commit Details
            </CardTitle>
            <div className="space-y-2">
              <h3 className="font-medium text-base">{commit.message.split('\n')[0]}</h3>
              {commit.message.split('\n').length > 1 && (
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                  {commit.message.split('\n').slice(1).join('\n')}
                </p>
              )}
            </div>
          </div>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Badge variant="secondary" className="font-mono">
            {commit.sha.substring(0, 7)}
          </Badge>
          <Button variant="ghost" size="sm" onClick={handleCopySha}>
            {copiedSha ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
          <a
            href={commit.htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto"
          >
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              View on GitHub
            </Button>
          </a>
        </div>

        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-gray-500" />
            <span className="font-medium">{commit.author.name}</span>
            <span className="text-gray-500">&lt;{commit.author.email}&gt;</span>
            <span className="text-gray-500">authored</span>
            <span className="font-medium">
              {format(new Date(commit.author.date), 'PPpp')}
            </span>
          </div>
          {commit.parents.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span>Parent:</span>
              {commit.parents.map((parent) => (
                <a
                  key={parent.sha}
                  href={parent.htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-blue-600 hover:underline"
                >
                  {parent.sha.substring(0, 7)}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>{commit.files.length} files changed</span>
          </div>
          <div className="flex items-center gap-2 text-green-600">
            <Plus className="h-4 w-4" />
            <span>{commit.stats.additions} additions</span>
          </div>
          <div className="flex items-center gap-2 text-red-600">
            <Minus className="h-4 w-4" />
            <span>{commit.stats.deletions} deletions</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <h4 className="font-medium mb-3">Changed Files</h4>
        <ScrollArea className="h-[500px]">
          <div className="space-y-4">
            {commit.files.map((file, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusBadge(file.status)}>
                      {file.status}
                    </Badge>
                    <span className="font-mono text-sm">{file.filename}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-green-600">+{file.additions}</span>
                    <span className="text-red-600">-{file.deletions}</span>
                  </div>
                </div>
                {file.patch && (
                  <pre className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded text-xs overflow-x-auto">
                    <code>{file.patch}</code>
                  </pre>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
