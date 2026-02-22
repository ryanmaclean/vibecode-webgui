/**
 * Manual verification test for EmbeddingVisualizer component
 *
 * This file provides mock data for manual testing of the component.
 * To test: Import and render this component in a Next.js page.
 */

import React from 'react';
import { EmbeddingVisualizer, Embedding, SimilarityScore } from '../EmbeddingVisualizer';

// Mock embedding data for testing
export const mockEmbeddings: Embedding[] = [
  {
    id: 'emb-1',
    label: 'Product Description',
    vector: Array.from({ length: 1536 }, (_, i) => Math.sin(i * 0.1) * 0.5),
    metadata: { type: 'product', category: 'electronics' },
    timestamp: new Date().toISOString(),
  },
  {
    id: 'emb-2',
    label: 'User Query',
    vector: Array.from({ length: 1536 }, (_, i) => Math.cos(i * 0.1) * 0.5),
    metadata: { type: 'query', user: 'test-user' },
    timestamp: new Date().toISOString(),
  },
  {
    id: 'emb-3',
    label: 'Similar Product',
    vector: Array.from({ length: 1536 }, (_, i) => Math.sin(i * 0.1 + 0.2) * 0.5),
    metadata: { type: 'product', category: 'electronics' },
    timestamp: new Date().toISOString(),
  },
];

// Mock similarity scores
export const mockSimilarityScores: SimilarityScore[] = [
  {
    embedding1Id: 'emb-1',
    embedding2Id: 'emb-2',
    score: 0.85,
    label: 'Product vs Query',
  },
  {
    embedding1Id: 'emb-1',
    embedding2Id: 'emb-3',
    score: 0.92,
    label: 'Product vs Similar Product',
  },
  {
    embedding1Id: 'emb-2',
    embedding2Id: 'emb-3',
    score: 0.78,
    label: 'Query vs Similar Product',
  },
];

/**
 * Demo component for manual testing
 */
export const EmbeddingVisualizerDemo: React.FC = () => {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Embedding Visualizer Demo</h1>

      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">Full View</h2>
          <EmbeddingVisualizer
            embeddings={mockEmbeddings}
            similarityScores={mockSimilarityScores}
            showVectorValues={true}
          />
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Compact View</h2>
          <EmbeddingVisualizer
            embeddings={mockEmbeddings}
            similarityScores={mockSimilarityScores}
            compact={true}
          />
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Single Embedding (No Scores)</h2>
          <EmbeddingVisualizer
            embeddings={[mockEmbeddings[0]]}
          />
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Empty State</h2>
          <EmbeddingVisualizer
            embeddings={[]}
          />
        </section>
      </div>
    </div>
  );
};

export default EmbeddingVisualizerDemo;
