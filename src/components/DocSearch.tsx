'use client';

import { useState, useEffect, useCallback } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { logger } from '@/lib/logger';

interface SearchResult {
  id: string;
  title: string;
  description: string;
  category: string;
  url: string;
  content: string;
  score: number;
  headings: Array<{
    level: number;
    text: string;
    id: string;
  }>;
}

interface SearchResponse {
  query: string;
  total: number;
  results: SearchResult[];
  categories: string[];
  metadata: {
    searchTime: number;
    totalDocuments: number;
  };
}

export default function DocSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [total, setTotal] = useState(0);

  const searchDocs = useCallback(async (searchQuery: string, category?: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        limit: '20'
      });
      
      if (category) {
        params.append('category', category);
      }

      const response = await fetch(`/api/docs/search?${params}`);
      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data: SearchResponse = await response.json();
      setResults(data.results);
      setCategories(data.categories);
      setTotal(data.total);
    } catch (error) {
      logger.error('Search error:', error);
      setResults([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query) {
        searchDocs(query, selectedCategory);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, selectedCategory, searchDocs]);

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    
    const regex = new RegExp(`(${query.split(' ').join('|')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 px-1 rounded">
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            VibeCode Documentation Search
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Search through our comprehensive documentation covering deployment, testing, AI integration, Kubernetes, security, and more. Over 246 documents indexed with 181,547 words of content.
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Documentation Search
          </h2>
          
          {/* Search Input */}
          <div className="relative mb-6">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documentation..."
              className="block w-full pl-10 pr-3 py-3 text-lg border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-800 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 dark:text-white"
            />
          </div>

        {/* Category Filter */}
        <div className="mb-4">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>

        {/* Results Summary */}
        {query && (
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {loading ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                Searching...
              </div>
            ) : (
              `Found ${total} results for "${query}"${selectedCategory ? ` in ${selectedCategory}` : ''}`
            )}
          </div>
        )}
      </div>

      {/* Search Results */}
      <div className="space-y-4">
        {results.map((result) => (
          <div key={result.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                <a 
                  href={result.url}
                  className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {highlightText(result.title, query)}
                </a>
              </h3>
              <div className="flex items-center space-x-2">
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                  {result.category}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Score: {result.score.toFixed(1)}
                </span>
              </div>
            </div>
            
            {result.description && (
              <p className="text-gray-600 dark:text-gray-300 mb-3">
                {highlightText(result.description, query)}
              </p>
            )}
            
            <p className="text-gray-700 dark:text-gray-300 mb-3">
              {highlightText(result.content, query)}
            </p>
            
            {result.headings.length > 0 && (
              <div className="mb-3">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Table of Contents:
                </h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  {result.headings.slice(0, 3).map((heading, index) => (
                    <li key={index} className={`ml-${(heading.level - 1) * 2}`}>
                      <a 
                        href={`${result.url}#${heading.id}`}
                        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {highlightText(heading.text, query)}
                      </a>
                    </li>
                  ))}
                  {result.headings.length > 3 && (
                    <li className="text-xs text-gray-500">
                      +{result.headings.length - 3} more sections...
                    </li>
                  )}
                </ul>
              </div>
            )}
            
            <div className="text-xs text-gray-500 dark:text-gray-400">
              <a 
                href={result.url}
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                {result.url}
              </a>
            </div>
          </div>
        ))}
        
        {query && !loading && results.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            No results found for &quot;{query}&quot;. Try different keywords or check spelling.
          </div>
        )}
      </div>

      {/* Search Tips */}
      <div className="mt-12 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Search Tips
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">
              Search Techniques
            </h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Use specific keywords like &quot;deployment&quot;, &quot;testing&quot;, &quot;kubernetes&quot;</li>
              <li>• Combine terms: &quot;production deployment guide&quot;</li>
              <li>• Filter by category for focused results</li>
              <li>• Search headings and content are both indexed</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-white mb-2">
              Available Categories
            </h3>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <li>• <strong>Deployment:</strong> Production guides, Helm, GitOps</li>
              <li>• <strong>Testing:</strong> Strategies, E2E, Unit tests</li>
              <li>• <strong>AI Integration:</strong> GenAI, embeddings, models</li>
              <li>• <strong>Kubernetes:</strong> KIND, secrets, monitoring</li>
              <li>• <strong>Security:</strong> Assessments, compliance</li>
              <li>• <strong>MCP Framework:</strong> Context7, Playwright, Serena</li>
            </ul>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
