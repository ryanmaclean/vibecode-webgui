/**
 * Experiments Dashboard - Main List Page
 *
 * Displays all experiments with search, filter, and sort capabilities.
 * Following Datadog/Eppo UI patterns.
 */

'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ExperimentCard } from '@/components/experiments/ExperimentCard'
import { mockExperiments, MockExperiment } from '@/lib/experiments/mock-data'
import { DemoBanner } from '@/components/ui/DemoBanner'
import Link from 'next/link'

type ExperimentStatus = 'all' | 'draft' | 'running' | 'completed' | 'paused' | 'archived'
type SortOption = 'recent' | 'name' | 'status'

export default function ExperimentsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ExperimentStatus>('all')
  const [sortBy, setSortBy] = useState<SortOption>('recent')

  const filteredAndSortedExperiments = useMemo(() => {
    let filtered = mockExperiments

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(exp => exp.status === statusFilter)
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        exp =>
          exp.name.toLowerCase().includes(query) ||
          exp.hypothesis.toLowerCase().includes(query) ||
          exp.key.toLowerCase().includes(query)
      )
    }

    // Apply sorting
    const sorted = [...filtered]
    switch (sortBy) {
      case 'recent':
        sorted.sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
        break
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'status':
        sorted.sort((a, b) => a.status.localeCompare(b.status))
        break
    }

    return sorted
  }, [searchQuery, statusFilter, sortBy])

  const getStatusCount = (status: ExperimentStatus) => {
    if (status === 'all') return mockExperiments.length
    return mockExperiments.filter(exp => exp.status === status).length
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <DemoBanner />
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Experiments</h1>
            <p className="text-sm text-gray-600 mt-1">
              Manage and monitor your A/B tests and feature experiments
            </p>
          </div>
          <Link href="/experiments/new">
            <Button size="lg">
              <span className="mr-2">+</span>
              Create Experiment
            </Button>
          </Link>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg border p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <Input
                type="text"
                placeholder="Search experiments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Status Filter */}
            <div className="w-full md:w-48">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ExperimentStatus)}
                className="w-full h-10 px-3 border rounded-md text-sm"
              >
                <option value="all">All ({getStatusCount('all')})</option>
                <option value="running">Running ({getStatusCount('running')})</option>
                <option value="draft">Draft ({getStatusCount('draft')})</option>
                <option value="completed">Completed ({getStatusCount('completed')})</option>
                <option value="paused">Paused ({getStatusCount('paused')})</option>
                <option value="archived">Archived ({getStatusCount('archived')})</option>
              </select>
            </div>

            {/* Sort By */}
            <div className="w-full md:w-48">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="w-full h-10 px-3 border rounded-md text-sm"
              >
                <option value="recent">Recently Updated</option>
                <option value="name">Name (A-Z)</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>
        </div>

        {/* Status Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {(['all', 'running', 'draft', 'completed', 'paused', 'archived'] as ExperimentStatus[]).map(
            (status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
                  statusFilter === status
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-white border hover:bg-gray-50'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}{' '}
                <span className="text-xs opacity-70">({getStatusCount(status)})</span>
              </button>
            )
          )}
        </div>

        {/* Experiments Grid */}
        {filteredAndSortedExperiments.length === 0 ? (
          <div className="bg-white rounded-lg border p-12 text-center">
            <div className="max-w-md mx-auto space-y-4">
              <div className="text-4xl">🔬</div>
              <h2 className="text-xl font-semibold text-gray-900">
                {searchQuery || statusFilter !== 'all'
                  ? 'No experiments found'
                  : 'No experiments yet'}
              </h2>
              <p className="text-sm text-gray-600">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your filters or search query'
                  : 'Create your first experiment to start testing and optimizing'}
              </p>
              {!searchQuery && statusFilter === 'all' && (
                <Link href="/experiments/new">
                  <Button className="mt-4">Create Your First Experiment</Button>
                </Link>
              )}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAndSortedExperiments.map((experiment) => (
              <ExperimentCard key={experiment.id} experiment={experiment} />
            ))}
          </div>
        )}

        {/* Summary Stats */}
        {filteredAndSortedExperiments.length > 0 && (
          <div className="bg-white rounded-lg border p-4">
            <div className="text-sm text-gray-600">
              Showing {filteredAndSortedExperiments.length} of {mockExperiments.length}{' '}
              experiments
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
