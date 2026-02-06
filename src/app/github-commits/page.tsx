'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CommitHistoryViewer, CommitDetailsPanel, CommitSearchBar } from '@/components/github'
import { GitBranch, Settings, AlertCircle } from 'lucide-react'

export default function GitHubCommitsPage() {
  const [accessToken, setAccessToken] = useState('')
  const [repoName, setRepoName] = useState('')
  const [branch, setBranch] = useState('main')
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null)
  const [isConfigured, setIsConfigured] = useState(false)

  const handleConfigure = () => {
    if (accessToken && repoName) {
      setIsConfigured(true)
    }
  }

  const handleCommitClick = (commitSha: string) => {
    setSelectedCommit(commitSha)
  }

  if (!isConfigured) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-6 w-6" />
              GitHub Commit History Configuration
            </CardTitle>
            <CardDescription>
              Configure your GitHub access to browse and search commits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 p-4 rounded-lg flex gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">Setup Instructions:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Generate a GitHub Personal Access Token with <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">repo</code> scope</li>
                  <li>Enter your token and repository name below</li>
                  <li>Click "Start Browsing" to access commit history</li>
                </ol>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  GitHub Personal Access Token
                </label>
                <Input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">
                  Repository Name (e.g., owner/repo)
                </label>
                <Input
                  placeholder="octocat/Hello-World"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">
                  Branch (optional)
                </label>
                <Input
                  placeholder="main"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </div>

              <Button
                onClick={handleConfigure}
                disabled={!accessToken || !repoName}
                className="w-full"
              >
                Start Browsing
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">GitHub Commit History Browser</h1>
        <p className="text-gray-600 dark:text-gray-400">
          Browse, search, and explore commit history for {repoName}
        </p>
      </div>

      <Tabs defaultValue="history" className="space-y-6">
        <TabsList>
          <TabsTrigger value="history">Commit History</TabsTrigger>
          <TabsTrigger value="search">Search Commits</TabsTrigger>
          {selectedCommit && <TabsTrigger value="details">Commit Details</TabsTrigger>}
        </TabsList>

        <TabsContent value="history" className="space-y-6">
          <CommitHistoryViewer
            repoName={repoName}
            accessToken={accessToken}
            branch={branch}
            onCommitClick={handleCommitClick}
          />
        </TabsContent>

        <TabsContent value="search" className="space-y-6">
          <CommitSearchBar
            accessToken={accessToken}
            onCommitClick={(repo, sha) => {
              setRepoName(repo)
              handleCommitClick(sha)
            }}
          />
        </TabsContent>

        {selectedCommit && (
          <TabsContent value="details" className="space-y-6">
            <CommitDetailsPanel
              repoName={repoName}
              commitSha={selectedCommit}
              accessToken={accessToken}
              onClose={() => setSelectedCommit(null)}
            />
          </TabsContent>
        )}
      </Tabs>

      <div className="mt-6 flex items-center justify-between text-sm text-gray-500">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsConfigured(false)}
        >
          Change Configuration
        </Button>
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          <span>Connected to {repoName}</span>
        </div>
      </div>
    </div>
  )
}
