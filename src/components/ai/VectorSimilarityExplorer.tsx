/**
 * Vector Similarity Explorer Component
 *
 * Allows users to input text, generate embeddings, and search for similar content
 * - Text input for query
 * - Content type selection (code, documentation, chat)
 * - Real-time similarity search
 * - Visual results display with EmbeddingVisualizer
 *
 * @module components/ai/VectorSimilarityExplorer
 */

'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Loader2,
  AlertCircle,
  CheckCircle,
  Sparkles,
  Target,
  Code,
  FileText,
  MessageSquare,
} from 'lucide-react';
import { EmbeddingVisualizer, Embedding, SimilarityScore } from './EmbeddingVisualizer';

// ============================================================================
// Types
// ============================================================================

type ContentType = 'code' | 'documentation' | 'chat';

interface SearchResult {
  id: string;
  content: string;
  similarity_score: number;
  metadata?: {
    content_type?: string;
    language?: string;
    framework?: string;
    created_at?: string;
  };
  embedding?: number[];
}

interface SearchResponse {
  success: boolean;
  query: string;
  results: SearchResult[];
  total_results: number;
  search_params: {
    content_type?: string;
    language?: string;
    framework?: string;
    limit: number;
    similarity_threshold?: number;
  };
  embedding_from_cache?: boolean;
  from_cache?: boolean;
  cache_hit?: boolean;
}

interface VectorSimilarityExplorerProps {
  /** Custom CSS class name */
  className?: string;
  /** Default query text */
  defaultQuery?: string;
  /** Default content type */
  defaultContentType?: ContentType;
}

// ============================================================================
// Helper Functions
// ============================================================================

const contentTypeConfig = {
  code: {
    icon: Code,
    label: 'Code',
    color: 'from-blue-500 to-blue-700',
    description: 'Search for similar code snippets',
  },
  documentation: {
    icon: FileText,
    label: 'Documentation',
    color: 'from-green-500 to-green-700',
    description: 'Search for similar documentation',
  },
  chat: {
    icon: MessageSquare,
    label: 'Chat',
    color: 'from-purple-500 to-purple-700',
    description: 'Search for similar conversations',
  },
};

// ============================================================================
// Main Component
// ============================================================================

export const VectorSimilarityExplorer: React.FC<VectorSimilarityExplorerProps> = ({
  className = '',
  defaultQuery = '',
  defaultContentType = 'code',
}) => {
  const [query, setQuery] = useState(defaultQuery);
  const [contentType, setContentType] = useState<ContentType>(defaultContentType);
  const [limit, setLimit] = useState(10);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) {
      setError('Please enter a search query');
      return;
    }

    setLoading(true);
    setError(null);
    setSearchResults(null);

    try {
      const response = await fetch('/api/vector-search?action=search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          content_type: contentType,
          limit,
          similarity_threshold: similarityThreshold,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: SearchResponse = await response.json();
      setSearchResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to perform search');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSearch();
    }
  };

  // Convert search results to EmbeddingVisualizer format
  const embeddings: Embedding[] = searchResults
    ? [
        ...(searchResults.results
          .filter((r) => r.embedding)
          .map((result, idx) => ({
            id: result.id,
            vector: result.embedding!,
            label: `Result ${idx + 1} (${(result.similarity_score * 100).toFixed(1)}%)`,
            metadata: result.metadata,
            timestamp: result.metadata?.created_at,
          }))),
      ]
    : [];

  // Generate similarity scores (comparing query embedding with results if available)
  const similarityScores: SimilarityScore[] = searchResults
    ? searchResults.results
        .filter((r) => r.embedding)
        .map((result, idx) => ({
          embedding1Id: 'query',
          embedding2Id: result.id,
          score: result.similarity_score,
          label: `Query vs Result ${idx + 1}`,
        }))
    : [];

  const ContentTypeIcon = contentTypeConfig[contentType].icon;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${contentTypeConfig[contentType].color} flex items-center justify-center`}>
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle>Vector Similarity Explorer</CardTitle>
              <CardDescription>
                Search for semantically similar content using AI embeddings
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search Input */}
          <div className="space-y-2">
            <Label htmlFor="query">Search Query</Label>
            <Textarea
              id="query"
              placeholder="Enter text to find similar content... (Cmd/Ctrl + Enter to search)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[120px] resize-y"
              disabled={loading}
            />
            <p className="text-xs text-gray-500">
              Enter any text and we'll find semantically similar content in the database
            </p>
          </div>

          {/* Search Options */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="content-type">Content Type</Label>
              <Select
                value={contentType}
                onValueChange={(value) => setContentType(value as ContentType)}
                disabled={loading}
              >
                <SelectTrigger id="content-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(contentTypeConfig).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          <span>{config.label}</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="limit">Result Limit</Label>
              <Select
                value={limit.toString()}
                onValueChange={(value) => setLimit(parseInt(value))}
                disabled={loading}
              >
                <SelectTrigger id="limit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 results</SelectItem>
                  <SelectItem value="10">10 results</SelectItem>
                  <SelectItem value="20">20 results</SelectItem>
                  <SelectItem value="50">50 results</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="threshold">Similarity Threshold</Label>
              <Select
                value={similarityThreshold.toString()}
                onValueChange={(value) => setSimilarityThreshold(parseFloat(value))}
                disabled={loading}
              >
                <SelectTrigger id="threshold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">50% (Low)</SelectItem>
                  <SelectItem value="0.6">60% (Medium-Low)</SelectItem>
                  <SelectItem value="0.7">70% (Medium)</SelectItem>
                  <SelectItem value="0.8">80% (High)</SelectItem>
                  <SelectItem value="0.9">90% (Very High)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Search Button */}
          <Button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Search Similar Content
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">Error: {error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search Results Header */}
      {searchResults && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <CardTitle className="text-lg">Search Results</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {searchResults.from_cache && (
                  <Badge variant="outline" className="text-xs">
                    Cached
                  </Badge>
                )}
                {searchResults.embedding_from_cache && (
                  <Badge variant="outline" className="text-xs">
                    Embedding Cached
                  </Badge>
                )}
                <Badge variant="secondary">
                  {searchResults.total_results} results
                </Badge>
              </div>
            </div>
            <CardDescription>
              Found {searchResults.total_results} similar {contentType} item(s)
              {searchResults.total_results > 0 && ` with similarity ≥ ${(similarityThreshold * 100).toFixed(0)}%`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {searchResults.total_results === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Target className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="font-medium">No similar content found</p>
                <p className="text-sm mt-1">Try lowering the similarity threshold or changing the content type</p>
              </div>
            ) : (
              <>
                {searchResults.results.map((result, idx) => (
                  <div
                    key={result.id}
                    className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Result {idx + 1}</Badge>
                        <Badge
                          variant="secondary"
                          style={{
                            backgroundColor:
                              result.similarity_score >= 0.8
                                ? '#10B981'
                                : result.similarity_score >= 0.6
                                ? '#3B82F6'
                                : '#F59E0B',
                            color: 'white',
                          }}
                        >
                          {(result.similarity_score * 100).toFixed(1)}% match
                        </Badge>
                      </div>
                      {result.metadata?.content_type && (
                        <Badge variant="outline">{result.metadata.content_type}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {result.content.length > 500
                        ? `${result.content.substring(0, 500)}...`
                        : result.content}
                    </p>
                    {result.metadata && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                        {result.metadata.language && (
                          <span>Language: {result.metadata.language}</span>
                        )}
                        {result.metadata.framework && (
                          <span>Framework: {result.metadata.framework}</span>
                        )}
                        {result.metadata.created_at && (
                          <span>Created: {new Date(result.metadata.created_at).toLocaleDateString()}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Embedding Visualizer */}
      {searchResults && searchResults.total_results > 0 && embeddings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Embedding Analysis</CardTitle>
            <CardDescription>
              Visual representation of vector embeddings and similarity scores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmbeddingVisualizer
              embeddings={embeddings}
              similarityScores={similarityScores}
              showVectorValues={false}
            />
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      {!searchResults && !loading && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <ContentTypeIcon className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">How it works:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>Enter your search query in the text area above</li>
                  <li>Select the content type you want to search (code, documentation, or chat)</li>
                  <li>Adjust the result limit and similarity threshold as needed</li>
                  <li>Click "Search" or press Cmd/Ctrl + Enter to find similar content</li>
                  <li>View detailed results with similarity scores and embedding visualizations</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VectorSimilarityExplorer;
