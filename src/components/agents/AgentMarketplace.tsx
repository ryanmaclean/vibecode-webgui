/**
 * AgentMarketplace Component
 *
 * Marketplace for discovering and installing pre-built agents
 * with categories, search, and ratings.
 *
 * Features:
 * - Agent discovery with search/filter
 * - Category organization
 * - Rating and review system
 * - Installation workflow
 * - Agent previews
 * - Accessibility compliant (WCAG 2.1 AA)
 *
 * @module components/agents/AgentMarketplace
 */

'use client'

import React, { useState, useMemo, useCallback } from 'react'
import {
Store,
  Search,
  Star,
  Download,
  Eye,
  Filter,
  TrendingUp,
  Clock,
  Users,
  ChevronRight,
  Loader2
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
// import { logger } from '@/lib/logger';

// ============================================================================
// Type Definitions
// ============================================================================

interface MarketplaceAgent {
  id: string
  name: string
  description: string
  author: string
  category: string
  icon: string
  rating: number
  reviewCount: number
  downloadCount: number
  lastUpdated: Date
  tags: string[]
  isInstalled: boolean
  isFeatured: boolean
  previewUrl?: string
}

interface AgentMarketplaceProps {
  /** Available agents */
  agents: MarketplaceAgent[]
  /** Callback when agent is installed */
  onInstall?: (agentId: string) => Promise<void>
  /** Callback when agent preview is opened */
  onPreview?: (agent: MarketplaceAgent) => void
  /** Custom className */
  className?: string
}

// ============================================================================
// Constants
// ============================================================================

const CATEGORIES = [
  { id: 'all', name: 'All Agents', icon: Store },
  { id: 'productivity', name: 'Productivity', icon: TrendingUp },
  { id: 'development', name: 'Development', icon: Users },
  { id: 'creative', name: 'Creative', icon: Star },
  { id: 'research', name: 'Research', icon: Search }
]

const SORT_OPTIONS = [
  { id: 'featured', name: 'Featured', icon: Star },
  { id: 'popular', name: 'Most Popular', icon: TrendingUp },
  { id: 'recent', name: 'Recently Updated', icon: Clock },
  { id: 'rating', name: 'Highest Rated', icon: Star }
]

// ============================================================================
// Agent Card Component
// ============================================================================

interface AgentCardProps {
  agent: MarketplaceAgent
  onInstall?: (agentId: string) => Promise<void>
  onPreview?: () => void
}

function AgentCard({ agent, onInstall, onPreview }: AgentCardProps) {
  const [isInstalling, setIsInstalling] = useState(false)

  const handleInstall = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!onInstall || agent.isInstalled) return

    setIsInstalling(true)
    try {
      await onInstall(agent.id)
    } catch (error) {
      console.error('Failed to install agent:', error)
    } finally {
      setIsInstalling(false)
    }
  }, [agent.id, agent.isInstalled, onInstall])

  return (
    <Card className="group hover:shadow-lg transition-all">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl" role="img" aria-label={agent.name}>
                {agent.icon}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base mb-1 truncate">
                {agent.name}
              </CardTitle>
              <CardDescription className="text-xs">
                by {agent.author}
              </CardDescription>
            </div>
          </div>
          {agent.isFeatured && (
            <Badge variant="secondary" className="flex-shrink-0">
              Featured
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {agent.description}
        </p>

        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" aria-hidden="true" />
            <span>{agent.rating.toFixed(1)}</span>
            <span className="text-muted-foreground/60">({agent.reviewCount})</span>
          </div>
          <div className="flex items-center gap-1">
            <Download className="h-3 w-3" aria-hidden="true" />
            <span>{agent.downloadCount.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1">
          {agent.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {agent.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{agent.tags.length - 3}
            </Badge>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex gap-2">
        {onPreview && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPreview}
            className="flex-1"
            aria-label={`Preview ${agent.name}`}
          >
            <Eye className="h-4 w-4 mr-2" aria-hidden="true" />
            Preview
          </Button>
        )}
        <Button
          size="sm"
          onClick={handleInstall}
          disabled={agent.isInstalled || isInstalling}
          className="flex-1"
          aria-label={agent.isInstalled ? 'Already installed' : `Install ${agent.name}`}
        >
          {isInstalling ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
              Installing...
            </>
          ) : agent.isInstalled ? (
            'Installed'
          ) : (
            <>
              <Download className="h-4 w-4 mr-2" aria-hidden="true" />
              Install
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function AgentMarketplace({
  agents,
  onInstall,
  onPreview,
  className
}: AgentMarketplaceProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedSort, setSelectedSort] = useState('featured')

  // Filter and sort agents
  const filteredAgents = useMemo(() => {
    let filtered = [...agents]

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        agent =>
          agent.name.toLowerCase().includes(query) ||
          agent.description.toLowerCase().includes(query) ||
          agent.tags.some(tag => tag.toLowerCase().includes(query)) ||
          agent.author.toLowerCase().includes(query)
      )
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(agent => agent.category === selectedCategory)
    }

    // Apply sorting
    switch (selectedSort) {
      case 'featured':
        filtered.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured))
        break
      case 'popular':
        filtered.sort((a, b) => b.downloadCount - a.downloadCount)
        break
      case 'recent':
        filtered.sort(
          (a, b) => b.lastUpdated.getTime() - a.lastUpdated.getTime()
        )
        break
      case 'rating':
        filtered.sort((a, b) => b.rating - a.rating)
        break
    }

    return filtered
  }, [agents, searchQuery, selectedCategory, selectedSort])

  const featuredAgents = useMemo(
    () => agents.filter(agent => agent.isFeatured).slice(0, 3),
    [agents]
  )

  const stats = useMemo(() => ({
    total: agents.length,
    installed: agents.filter(a => a.isInstalled).length,
    featured: agents.filter(a => a.isFeatured).length
  }), [agents])

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Store className="h-5 w-5" aria-hidden="true" />
                Agent Marketplace
              </CardTitle>
              <CardDescription className="mt-1">
                Discover and install pre-built AI agents
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">
                {stats.total} agents
              </Badge>
              <Badge variant="outline">
                {stats.installed} installed
              </Badge>
            </div>
          </div>
        </CardHeader>

        {/* Featured Section */}
        {featuredAgents.length > 0 && (
          <CardContent className="pb-3">
            <div className="mb-3">
              <h3 className="text-sm font-medium flex items-center gap-2 mb-3">
                <Star className="h-4 w-4" aria-hidden="true" />
                Featured Agents
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {featuredAgents.map((agent) => (
                  <button
                    key={agent.id}
                    onClick={() => onPreview?.(agent)}
                    className="p-4 border rounded-lg text-left hover:bg-accent transition-colors group"
                  >
                    <div className="flex items-start gap-3 mb-2">
                      <span className="text-2xl" role="img" aria-label={agent.name}>
                        {agent.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {agent.name}
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" aria-hidden="true" />
                          <span>{agent.rating.toFixed(1)}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" aria-hidden="true" />
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {agent.description}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        )}

        {/* Search and Filter */}
        <CardContent className="border-t">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search agents..."
                className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label="Search agents"
              />
            </div>

            <Tabs value={selectedSort} onValueChange={setSelectedSort} className="w-full md:w-auto">
              <TabsList>
                {SORT_OPTIONS.map((option) => {
                  const Icon = option.icon
                  return (
                    <TabsTrigger key={option.id} value={option.id} className="gap-1">
                      <Icon className="h-3 w-3" aria-hidden="true" />
                      {option.name}
                    </TabsTrigger>
                  )
                })}
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-5">
          {CATEGORIES.map((category) => {
            const Icon = category.icon
            return (
              <TabsTrigger key={category.id} value={category.id} className="gap-1">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {category.name}
              </TabsTrigger>
            )
          })}
        </TabsList>

        {CATEGORIES.map((category) => (
          <TabsContent key={category.id} value={category.id} className="flex-1 mt-4">
            <ScrollArea className="h-[600px]">
              {filteredAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <Store className="h-12 w-12 text-muted-foreground/50 mb-4" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery
                      ? 'No agents match your search'
                      : 'No agents available in this category'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
                  {filteredAgents.map((agent) => (
                    <AgentCard
                      key={agent.id}
                      agent={agent}
                      onInstall={onInstall}
                      onPreview={onPreview ? () => onPreview(agent) : undefined}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
