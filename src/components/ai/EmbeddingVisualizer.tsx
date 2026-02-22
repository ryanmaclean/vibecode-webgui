/**
 * Embedding Visualizer Component
 *
 * Displays vector embeddings and similarity scores with visual representations
 * - Shows embedding vector dimensions
 * - Renders similarity scores with visual indicators
 * - Supports comparison between multiple embeddings
 *
 * @module components/ai/EmbeddingVisualizer
 */

'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  Target,
  TrendingUp,
  BarChart3,
  Layers,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  Cell,
} from 'recharts';

// ============================================================================
// Types
// ============================================================================

export interface Embedding {
  /** Unique identifier for the embedding */
  id: string;
  /** The vector values */
  vector: number[];
  /** Optional label or description */
  label?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  /** Timestamp when created */
  timestamp?: string;
}

export interface SimilarityScore {
  /** ID of the first embedding */
  embedding1Id: string;
  /** ID of the second embedding */
  embedding2Id: string;
  /** Cosine similarity score (0-1) */
  score: number;
  /** Optional label for the comparison */
  label?: string;
}

interface EmbeddingVisualizerProps {
  /** The embeddings to display */
  embeddings: Embedding[];
  /** Optional similarity scores between embeddings */
  similarityScores?: SimilarityScore[];
  /** Custom CSS class name */
  className?: string;
  /** Compact mode for smaller displays */
  compact?: boolean;
  /** Show detailed vector values */
  showVectorValues?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate cosine similarity between two vectors
 */
const calculateCosineSimilarity = (vec1: number[], vec2: number[]): number => {
  if (vec1.length !== vec2.length) return 0;

  let dotProduct = 0;
  let mag1 = 0;
  let mag2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    mag1 += vec1[i] * vec1[i];
    mag2 += vec2[i] * vec2[i];
  }

  mag1 = Math.sqrt(mag1);
  mag2 = Math.sqrt(mag2);

  if (mag1 === 0 || mag2 === 0) return 0;

  return dotProduct / (mag1 * mag2);
};

/**
 * Get color based on similarity score
 */
const getSimilarityColor = (score: number): string => {
  if (score >= 0.8) return '#10B981'; // green
  if (score >= 0.6) return '#3B82F6'; // blue
  if (score >= 0.4) return '#F59E0B'; // amber
  return '#EF4444'; // red
};

/**
 * Get similarity category label
 */
const getSimilarityLabel = (score: number): string => {
  if (score >= 0.8) return 'Very High';
  if (score >= 0.6) return 'High';
  if (score >= 0.4) return 'Moderate';
  if (score >= 0.2) return 'Low';
  return 'Very Low';
};

// ============================================================================
// Main Component
// ============================================================================

export const EmbeddingVisualizer: React.FC<EmbeddingVisualizerProps> = ({
  embeddings,
  similarityScores = [],
  className = '',
  compact = false,
  showVectorValues = false,
}) => {
  // Prepare data for visualization
  const chartData = useMemo(() => {
    return embeddings.map((embedding, idx) => ({
      id: embedding.id,
      label: embedding.label || `Embedding ${idx + 1}`,
      dimensions: embedding.vector.length,
      magnitude: Math.sqrt(embedding.vector.reduce((sum, val) => sum + val * val, 0)),
      avgValue: embedding.vector.reduce((sum, val) => sum + val, 0) / embedding.vector.length,
    }));
  }, [embeddings]);

  // Prepare similarity matrix data
  const similarityData = useMemo(() => {
    const data = similarityScores.map((score) => {
      const emb1 = embeddings.find(e => e.id === score.embedding1Id);
      const emb2 = embeddings.find(e => e.id === score.embedding2Id);
      return {
        label: score.label || `${emb1?.label || score.embedding1Id} vs ${emb2?.label || score.embedding2Id}`,
        score: score.score,
        percentage: (score.score * 100).toFixed(1),
        color: getSimilarityColor(score.score),
        category: getSimilarityLabel(score.score),
      };
    });
    return data.sort((a, b) => b.score - a.score);
  }, [embeddings, similarityScores]);

  // Vector distribution data for the first embedding (sample)
  const vectorDistribution = useMemo(() => {
    if (embeddings.length === 0) return [];
    const embedding = embeddings[0];
    const sampleSize = Math.min(50, embedding.vector.length);
    const step = Math.floor(embedding.vector.length / sampleSize);

    return embedding.vector
      .filter((_, idx) => idx % step === 0)
      .slice(0, sampleSize)
      .map((value, idx) => ({
        dimension: idx * step,
        value,
      }));
  }, [embeddings]);

  if (embeddings.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center text-gray-500">
            <Layers className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No embedding data available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Embeddings</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{embeddings.length}</div>
            <p className="text-xs text-muted-foreground">
              Vector dimensions: {embeddings[0]?.vector.length || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Similarity Scores</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{similarityScores.length}</div>
            <p className="text-xs text-muted-foreground">
              {similarityScores.length > 0
                ? `Avg: ${(similarityScores.reduce((sum, s) => sum + s.score, 0) / similarityScores.length).toFixed(3)}`
                : 'No comparisons'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vector Magnitude</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {chartData.length > 0
                ? (chartData.reduce((sum, d) => sum + d.magnitude, 0) / chartData.length).toFixed(2)
                : '0.00'}
            </div>
            <p className="text-xs text-muted-foreground">
              Average across embeddings
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Visualization */}
      <Tabs defaultValue="embeddings" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="embeddings">Embeddings</TabsTrigger>
          <TabsTrigger value="similarity">Similarity Scores</TabsTrigger>
          <TabsTrigger value="distribution">Vector Distribution</TabsTrigger>
        </TabsList>

        {/* Embeddings Tab */}
        <TabsContent value="embeddings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Embedding Overview</CardTitle>
              <CardDescription>
                Vector properties and statistics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {embeddings.map((embedding, idx) => (
                  <div key={embedding.id} className="space-y-2 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{embedding.label || `Embedding ${idx + 1}`}</Badge>
                        <span className="text-sm text-gray-600">ID: {embedding.id}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {embedding.vector.length} dimensions
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Magnitude:</span>
                        <span className="ml-2 font-mono">
                          {Math.sqrt(embedding.vector.reduce((sum, val) => sum + val * val, 0)).toFixed(4)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Avg Value:</span>
                        <span className="ml-2 font-mono">
                          {(embedding.vector.reduce((sum, val) => sum + val, 0) / embedding.vector.length).toFixed(4)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Min:</span>
                        <span className="ml-2 font-mono">
                          {Math.min(...embedding.vector).toFixed(4)}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600">Max:</span>
                        <span className="ml-2 font-mono">
                          {Math.max(...embedding.vector).toFixed(4)}
                        </span>
                      </div>
                    </div>

                    {showVectorValues && (
                      <div className="mt-2">
                        <details className="text-xs">
                          <summary className="cursor-pointer text-blue-600 hover:text-blue-800">
                            Show vector values
                          </summary>
                          <pre className="mt-2 p-2 bg-gray-50 rounded overflow-x-auto">
                            {JSON.stringify(embedding.vector.slice(0, 20), null, 2)}
                            {embedding.vector.length > 20 && '\n... (truncated)'}
                          </pre>
                        </details>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {!compact && (
            <Card>
              <CardHeader>
                <CardTitle>Magnitude Comparison</CardTitle>
                <CardDescription>
                  Vector magnitudes across embeddings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="magnitude" fill="#3B82F6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Similarity Scores Tab */}
        <TabsContent value="similarity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Similarity Scores</CardTitle>
              <CardDescription>
                Cosine similarity between embedding pairs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {similarityData.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No similarity scores available</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {similarityData.map((item, idx) => (
                    <div key={idx} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{item.label}</span>
                        <div className="flex items-center space-x-2">
                          <Badge
                            variant="outline"
                            style={{ borderColor: item.color, color: item.color }}
                          >
                            {item.category}
                          </Badge>
                          <span className="font-mono font-bold" style={{ color: item.color }}>
                            {item.score.toFixed(4)}
                          </span>
                        </div>
                      </div>
                      <Progress
                        value={item.score * 100}
                        className="h-2"
                        style={{
                          // @ts-expect-error - CSS custom property
                          '--progress-background': item.color,
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {!compact && similarityData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Similarity Distribution</CardTitle>
                <CardDescription>
                  Visual comparison of similarity scores
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={similarityData} layout="horizontal">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 1]} />
                    <YAxis type="category" dataKey="label" width={150} />
                    <Tooltip />
                    <Bar dataKey="score">
                      {similarityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Vector Distribution Tab */}
        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Vector Value Distribution</CardTitle>
              <CardDescription>
                Sample of vector values across dimensions (first embedding)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {vectorDistribution.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No distribution data available</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={vectorDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="dimension"
                      label={{ value: 'Dimension', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis
                      label={{ value: 'Value', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmbeddingVisualizer;
