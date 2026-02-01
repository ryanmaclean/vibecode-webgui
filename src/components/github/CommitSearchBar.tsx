'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search,
  GitCommit,
  ExternalLink,
  Calendar,
  User,
  Loader2,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

interface SearchResult {
  sha: string
  message: string
  author: {
    name: string
    email: string
    date: string
  }
  repository: {
    name: string
    fullName: string
    htmlUrl: string
  }
  htmlUrl: string
  score: number
}

interface CommitSearchBarProps {
  accessToken: string
  onCommitClick?: (repo: string, commitSha: string) => void
}

export function CommitSearchBar({ accessToken, onCommitClick }: CommitSearchBarProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [totalCount, setTotalCount] = useState(0)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!query.trim()) {
      return
    }

    setLoading(true)
    setError(null)
    setSearched(true)

    try {
      const response = await fetch('/api/github/commits/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query.trim(),
          accessToken,
          per_page: 20,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to search commits')
      }

      const data = await response.json()
      setResults(data.items)
      setTotalCount(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search commits')
    } finally {
      setLoading(false)
    }
  }

  const getCommitMessageTitle = (message: string) => {
    return message.split('\n')[0]
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Search Commits
        </CardTitle>
        <CardDescription>
          Search commits across all your repositories
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSearch} className="flex gap-2 mb-4">
          <Input
            placeholder="Search commits... (e.g., 'fix bug', 'author:username', 'repo:owner/name')"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
        </form>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg mb-4">
            {error}
          </div>
        )}

        {searched && !loading && (
          <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
            Found {totalCount} commit{totalCount !== 1 ? 's' : ''}
            {totalCount > results.length && ` (showing first ${results.length})`}
          </div>
        )}

        {searched && results.length === 0 && !loading && !error && (
          <div className="text-center py-8 text-gray-500">
            No commits found matching your search.
          </div>
        )}

        {results.length > 0 && (
          <ScrollArea className="h-[500px]">
            <div className="space-y-3">
              {results.map((result) => (
                <div
                  key={`${result.repository.fullName}-${result.sha}`}
                  className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer"
                  onClick={() => onCommitClick?.(result.repository.name, result.sha)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <a
                          href={result.repository.htmlUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-blue-600 hover:underline font-medium"
                        >
                          {result.repository.fullName}
                        </a>
                      </div>
                      <h3 className="font-medium text-sm mb-1">
                        {getCommitMessageTitle(result.message)}
                      </h3>
                      <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{result.author.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {formatDistanceToNow(new Date(result.author.date), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {result.sha.substring(0, 7)}
                      </Badge>
                      <a
                        href={result.htmlUrl}
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
        )}
      </CardContent>
    </Card>
  )
}
