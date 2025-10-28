import { NextRequest, NextResponse } from 'next/server';
import docsIndex from '@/data/docs-index.json';
// import { logger } from '@/lib/logger';
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim();
    const category = searchParams.get('category');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter "q" is required' },
        { status: 400 }
      );
    }

    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 2);
    const results: SearchResult[] = [];

    for (const doc of docsIndex.documents) {
      // Filter by category if specified
      if (category && doc.category.toLowerCase() !== category.toLowerCase()) {
        continue;
      }

      let score = 0;
      const keywords = doc.keywords.toLowerCase();

      // Calculate relevance score
      for (const term of queryTerms) {
        // Exact title match (highest weight)
        if (doc.title.toLowerCase() === term) score += 20;
        else if (doc.title.toLowerCase().includes(term)) score += 10;

        // Category match (high weight)
        if (doc.category.toLowerCase().includes(term)) score += 8;

        // Description match (medium-high weight)
        if (doc.description.toLowerCase().includes(term)) score += 6;

        // Heading match (medium weight)
        const headingMatch = doc.headings.find(h => 
          h.text.toLowerCase().includes(term)
        );
        if (headingMatch) {
          score += 4;
        }

        // Content match (low weight, but consider frequency)
        const termRegex = new RegExp(`\\b${term}\\b`, 'gi');
        const termCount = (keywords.match(termRegex) || []).length;
        score += Math.min(termCount, 5); // Cap at 5 points per term

        // Boost score for exact phrase matches
        if (doc.content.toLowerCase().includes(query.toLowerCase())) {
          score += 5;
        }
      }

      // Boost newer documents slightly
      const daysSinceModified = (Date.now() - new Date(doc.lastModified).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceModified < 30) score += 1;

      if (score > 0) {
        results.push({
          id: doc.id,
          title: doc.title,
          description: doc.description,
          category: doc.category,
          url: doc.url,
          content: doc.content,
          headings: doc.headings,
          score
        });
      }
    }

    // Sort by score (descending) and limit results
    results.sort((a, b) => b.score - a.score);
    const limitedResults = results.slice(0, limit);

    return NextResponse.json({
      query,
      total: results.length,
      results: limitedResults,
      categories: docsIndex.metadata.categories,
      metadata: {
        searchTime: Date.now(),
        totalDocuments: docsIndex.metadata.totalDocuments
      }
    });

  } catch (error) {
    console.error('Documentation search error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Optional: Add POST support for more complex search queries
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, filters = {}, options = {} } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // More complex search logic can be implemented here
    // For now, redirect to GET with query params
    const searchParams = new URLSearchParams({
      q: query,
      ...filters,
      limit: options.limit?.toString() || '10'
    });

    const url = new URL(`/api/docs/search?${searchParams}`, request.url);
    return GET(new NextRequest(url));

  } catch (error) {
    console.error('Documentation search POST error:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
