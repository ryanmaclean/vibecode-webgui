'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  GitCommit,
  Calendar,
  User,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface Commit {
  sha: string
  message: string
  author: {
    name: string
    email: string
    date: string
  }
  committer: {
    name: string
    email: string
    date: string
  }
  htmlUrl: string
  stats?: {
    additions: number
    deletions: number
    total: number
  }
}

interface CommitHistoryViewerProps {
  repoName: string
  accessToken: string
  branch?: string
  onCommitClick?: (commitSha: string) => void
}

export function CommitHistoryViewer({
  repoName,
  accessToken,
  branch,
  onCommitClick,
}: CommitHistoryViewerProps) {
  const [commits, setCommits] = useState<Commit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [perPage] = useState(30)
  const [hasMore, setHasMore] = useState(true)
  const [filters, setFilters] = useState({
    author: '',
    since: '',
    until: '',
    path: '',
  })
  const [showFilters, setShowFilters] = useState(false)

  const fetchCommits = async (resetPage = false) => {
    setLoading(true)
    setError(null)

    try {
      const currentPage = resetPage ? 1 : page
      const response = await fetch('/api/github/commits/list', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repoName,
          accessToken,
          branch,
          page: currentPage,
          per_page: perPage,
          ...filters,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch commits')
      }

      const data = await response.json()
      
      if (resetPage) {
        setCommits(data.commits)
        setPage(1)
      } else {
        setCommits(data.commits)
      }

      setHasMore(data.commits.length === perPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load commits')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCommits(true)
  }, [repoName, accessToken, branch])

  const handleNextPage = () => {
    setPage(p => p + 1)
    fetchCommits()
  }

  const handlePrevPage = () => {
    if (page > 1) {
      setPage(p => p - 1)
      fetchCommits()
    }
  }

  const handleApplyFilters = () => {
    fetchCommits(true)
  }

  const handleClearFilters = () => {
    setFilters({
      author: '',
      since: '',
      until: '',
      path: '',
    })
    setTimeout(() => fetchCommits(true), 0)
  }

  const getCommitMessageTitle = (message: string) => {
    return message.split('\n')[0]
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <GitCommit className="h-5 w-5" />
              Commit History
            </CardTitle>
            <CardDescription>
              {repoName} {branch && `(${branch})`}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>
        </div>

        {showFilters && (
          <div className="mt-4 p-4 border rounded-lg space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Author</label>
                <Input
                  placeholder="Filter by author"
                  value={filters.author}
                  onChange={(e) => setFilters({ ...filters, author: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">File Path</label>
                <Input
                  placeholder="Filter by file path"
                  value={filters.path}
                  onChange={(e) => setFilters({ ...filters, path: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Since (ISO Date)</label>
                <Input
                  type="datetime-local"
                  value={filters.since}
                  onChange={(e) => setFilters({ ...filters, since: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Until (ISO Date)</label>
                <Input
                  type="datetime-local"
                  value={filters.until}
                  onChange={(e) => setFilters({ ...filters, until: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleApplyFilters} size="sm">
                Apply Filters
              </Button>
              <Button onClick={handleClearFilters} variant="outline" size="sm">
                Clear Filters
              </Button>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white" />
          </div>
        ) : (
          <>
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {commits.map((commit) => (
                  <div
                    key={commit.sha}
                    className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                    onClick={() => onCommitClick?.(commit.sha)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm mb-1">
                          {getCommitMessageTitle(commit.message)}
                        </h3>
                        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span>{commit.author.name}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>
                              {formatDistanceToNow(new Date(commit.author.date), {
                                addSuffix: true,
                              })}
                            </span>
                          </div>
                          {commit.stats && (
                            <div className="flex items-center gap-2">
                              <span className="text-green-600">+{commit.stats.additions}</span>
                              <span className="text-red-600">-{commit.stats.deletions}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {commit.sha.substring(0, 7)}
                        </Badge>
                        <a
                          href={commit.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevPage}
                disabled={page === 1 || loading}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <span className="text-sm text-gray-500">Page {page}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={!hasMore || loading}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
