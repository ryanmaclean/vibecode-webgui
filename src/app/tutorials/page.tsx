'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  BeakerIcon,
  ClockIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  MagnifyingGlassIcon,
  FunnelIcon
} from '@heroicons/react/24/outline'

interface Tutorial {
  id: string
  title: string
  description: string
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced'
  time: string
  prerequisites: string[]
  icon: any
  path: string
  wordCount: number
  tags: string[]
}

const tutorials: Tutorial[] = [
  {
    id: '01-first-ab-test',
    title: 'Your First A/B Test',
    description: 'Ship a button color experiment in 15 minutes. Learn the fundamentals of A/B testing with a hands-on example.',
    difficulty: 'Beginner',
    time: '15-20 min',
    prerequisites: ['Basic TypeScript', 'Node.js installed'],
    icon: BeakerIcon,
    path: '/docs/tutorials/01-first-ab-test.md',
    wordCount: 2156,
    tags: ['a/b-testing', 'fundamentals', 'button-test']
  },
  {
    id: '02-ai-model-comparison',
    title: 'AI Model Comparison',
    description: 'Compare GPT-4 vs Claude scientifically. Learn to measure quality, cost, and latency for AI models.',
    difficulty: 'Intermediate',
    time: '30-40 min',
    prerequisites: ['Tutorial 1', 'API knowledge', 'Basic statistics'],
    icon: ChartBarIcon,
    path: '/docs/tutorials/02-ai-model-comparison.md',
    wordCount: 3247,
    tags: ['ai', 'model-comparison', 'cost-optimization']
  },
  {
    id: '03-multi-armed-bandits',
    title: 'Multi-Armed Bandits',
    description: 'Implement Thompson Sampling for dynamic optimization. Automatically find the best model with minimal regret.',
    difficulty: 'Advanced',
    time: '45-60 min',
    prerequisites: ['Tutorials 1 & 2', 'Probability', 'Statistics'],
    icon: FunnelIcon,
    path: '/docs/tutorials/03-multi-armed-bandits.md',
    wordCount: 3982,
    tags: ['bandits', 'thompson-sampling', 'advanced']
  },
  {
    id: '04-experiment-guardrails',
    title: 'Experiment Guardrails',
    description: 'Prevent harmful experiments with automated safety checks. Set up monitoring and alerts to protect critical metrics.',
    difficulty: 'Intermediate',
    time: '25-35 min',
    prerequisites: ['Tutorial 1', 'Monitoring concepts'],
    icon: ShieldCheckIcon,
    path: '/docs/tutorials/04-experiment-guardrails.md',
    wordCount: 2847,
    tags: ['safety', 'monitoring', 'guardrails']
  }
]

const difficultyColors = {
  Beginner: 'bg-green-100 text-green-800',
  Intermediate: 'bg-yellow-100 text-yellow-800',
  Advanced: 'bg-red-100 text-red-800'
}

export default function TutorialsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all')
  const [selectedTag, setSelectedTag] = useState<string>('all')

  // Extract all unique tags
  const allTags = Array.from(
    new Set(tutorials.flatMap(t => t.tags))
  ).sort()

  // Filter tutorials
  const filteredTutorials = tutorials.filter(tutorial => {
    const matchesSearch =
      tutorial.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tutorial.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tutorial.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesDifficulty =
      selectedDifficulty === 'all' || tutorial.difficulty === selectedDifficulty

    const matchesTag =
      selectedTag === 'all' || tutorial.tags.includes(selectedTag)

    return matchesSearch && matchesDifficulty && matchesTag
  })

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Experimentation Tutorials
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Learn to run production-grade A/B tests and AI experiments with hands-on tutorials.
            From beginner to advanced, build real skills with working code examples.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-blue-600">{tutorials.length}</div>
            <div className="text-sm text-gray-600 mt-1">Tutorials</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-green-600">
              {tutorials.reduce((sum, t) => sum + t.wordCount, 0).toLocaleString()}
            </div>
            <div className="text-sm text-gray-600 mt-1">Total Words</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-purple-600">
              {tutorials.reduce((sum, t) => {
                const mins = parseInt(t.time.split('-')[1])
                return sum + mins
              }, 0)}
            </div>
            <div className="text-sm text-gray-600 mt-1">Total Minutes</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6 text-center">
            <div className="text-3xl font-bold text-orange-600">100%</div>
            <div className="text-sm text-gray-600 mt-1">Hands-On</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search
              </label>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search tutorials..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Difficulty Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Difficulty
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
              >
                <option value="all">All Levels</option>
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>

            {/* Tag Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Topic
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
              >
                <option value="all">All Topics</option>
                {allTags.map(tag => (
                  <option key={tag} value={tag}>
                    {tag.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active filters display */}
          {(searchQuery || selectedDifficulty !== 'all' || selectedTag !== 'all') && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-gray-600">Active filters:</span>
              {searchQuery && (
                <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                  Search: "{searchQuery}"
                  <button
                    onClick={() => setSearchQuery('')}
                    className="ml-1 hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {selectedDifficulty !== 'all' && (
                <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                  {selectedDifficulty}
                  <button
                    onClick={() => setSelectedDifficulty('all')}
                    className="ml-1 hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {selectedTag !== 'all' && (
                <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                  {selectedTag}
                  <button
                    onClick={() => setSelectedTag('all')}
                    className="ml-1 hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Results count */}
        <div className="mb-6 text-sm text-gray-600">
          Showing {filteredTutorials.length} of {tutorials.length} tutorials
        </div>

        {/* Tutorial Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredTutorials.map((tutorial) => {
            const Icon = tutorial.icon
            return (
              <div
                key={tutorial.id}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden"
              >
                <div className="p-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Icon className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">
                          {tutorial.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${difficultyColors[tutorial.difficulty]}`}>
                            {tutorial.difficulty}
                          </span>
                          <span className="flex items-center text-sm text-gray-500">
                            <ClockIcon className="h-4 w-4 mr-1" />
                            {tutorial.time}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-gray-600 mb-4">
                    {tutorial.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {tutorial.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded cursor-pointer hover:bg-gray-200"
                        onClick={() => setSelectedTag(tag)}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Prerequisites */}
                  <div className="mb-4">
                    <div className="text-xs font-medium text-gray-700 mb-2">Prerequisites:</div>
                    <div className="text-xs text-gray-600">
                      {tutorial.prerequisites.join(' • ')}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="text-xs text-gray-500">
                      {tutorial.wordCount.toLocaleString()} words
                    </div>
                    <Link
                      href={tutorial.path}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors duration-200"
                    >
                      Start Tutorial →
                    </Link>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* No results */}
        {filteredTutorials.length === 0 && (
          <div className="text-center py-12">
            <BeakerIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No tutorials found
            </h3>
            <p className="text-gray-600">
              Try adjusting your search or filters
            </p>
          </div>
        )}

        {/* Learning Path */}
        <div className="mt-16 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Recommended Learning Path
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 shadow">
              <div className="text-lg font-semibold text-blue-600 mb-2">1. Start Here</div>
              <div className="text-sm text-gray-700">
                Complete <strong>Your First A/B Test</strong> to learn the fundamentals
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow">
              <div className="text-lg font-semibold text-blue-600 mb-2">2. AI Models</div>
              <div className="text-sm text-gray-700">
                Learn <strong>AI Model Comparison</strong> for quality and cost trade-offs
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow">
              <div className="text-lg font-semibold text-blue-600 mb-2">3. Safety</div>
              <div className="text-sm text-gray-700">
                Master <strong>Experiment Guardrails</strong> to prevent disasters
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow">
              <div className="text-lg font-semibold text-blue-600 mb-2">4. Advanced</div>
              <div className="text-sm text-gray-700">
                Implement <strong>Multi-Armed Bandits</strong> for continuous optimization
              </div>
            </div>
          </div>
        </div>

        {/* Additional Resources */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Workshop
            </h3>
            <p className="text-gray-600 mb-4">
              Join our comprehensive 4.5-hour workshop on production A/B testing with statistical rigor.
            </p>
            <Link
              href="/docs/workshops/production-ab-testing-workshop.md"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              View Workshop →
            </Link>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              Code Examples
            </h3>
            <p className="text-gray-600 mb-4">
              Explore runnable TypeScript examples you can execute locally to practice concepts.
            </p>
            <Link
              href="/examples/experiments"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Browse Examples →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
