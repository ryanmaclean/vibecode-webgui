'use client'

import { Sparkles } from 'lucide-react'
import { VectorSimilarityExplorer } from '@/components/ai/VectorSimilarityExplorer'

export default function VectorExplorerPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-700 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Vector Similarity Explorer</h1>
        </div>
        <p className="text-gray-600">
          Search for semantically similar content using AI embeddings. Enter any text to find related code, documentation, or conversations.
        </p>
      </div>

      {/* Main Component */}
      <VectorSimilarityExplorer />
    </div>
  )
}
