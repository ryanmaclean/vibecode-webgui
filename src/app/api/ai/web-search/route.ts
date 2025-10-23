import { NextRequest, NextResponse } from 'next/server'
import { webSearchService } from '@/lib/services/web-search'
import { z } from '@/lib/zod-compat'
import { webSearchSchema } from '@/lib/api/validation/schemas'
import { logger } from '@/lib/logger'

// Extended schema with additional fields
const extendedWebSearchSchema = webSearchSchema.extend({
  timeFilter: z.enum(['day', 'week', 'month', 'year']).optional(),
  includeContent: z.boolean().optional().default(false)
});

interface WebSearchRequest {
  query: string
  maxResults?: number
  timeFilter?: 'day' | 'week' | 'month' | 'year'
  safeSearch?: boolean
  language?: string
  region?: string
  includeContent?: boolean
}

export async function POST(request: NextRequest) {
  try {
    // Validate request body
    let validatedData;
    try {
      const body = await request.json();
      validatedData = extendedWebSearchSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Web search validation failed', { errors: error.errors });
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid request parameters',
            details: error.errors.map(e => ({
              field: e.path.join('.'),
              message: e.message
            }))
          },
          { status: 400 }
        );
      }
      throw error;
    }

    const {
      query,
      maxResults = 5,
      timeFilter,
      safeSearch = true,
      language = 'en',
      region = 'us',
      includeContent = false
    } = validatedData;

    const startTime = Date.now()
    
    // Perform web search
    const searchResults = await webSearchService.searchWeb(query, {
      maxResults,
      timeFilter,
      safeSearch,
      language,
      region
    })

    // Optionally scrape content from top results
    let enhancedResults = searchResults
    if (includeContent && searchResults.length > 0) {
      const contentPromises = searchResults.slice(0, 3).map(async (result) => {
        try {
          const scraped = await webSearchService.scrapeContent(result.url)
          return {
            ...result,
            content: scraped.content,
            contentTitle: scraped.title,
            contentError: scraped.error
          }
        } catch (error) {
          return {
            ...result,
            contentError: `Scraping failed: ${error.message}`
          }
        }
      })

      const scrapedResults = await Promise.all(contentPromises)
      
      // Merge scraped content with remaining results
      enhancedResults = [
        ...scrapedResults,
        ...searchResults.slice(3)
      ]
    }

    const responseTime = Date.now() - startTime

    // Log search for monitoring
    // Debug log removed`)

    return NextResponse.json({
      success: true,
      query,
      results: enhancedResults,
      metadata: {
        totalResults: enhancedResults.length,
        responseTime,
        searchEngines: ['duckduckgo', 'bing', 'searx'],
        options: {
          maxResults,
          timeFilter,
          safeSearch,
          language,
          region,
          includeContent
        }
      }
    })

  } catch (error: any) {
    // Server error logged
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Web search failed',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || searchParams.get('query')
  const maxResults = parseInt(searchParams.get('maxResults') || '5')
  const includeContent = searchParams.get('includeContent') === 'true'

  if (!query) {
    return NextResponse.json({
      success: false,
      error: 'Query parameter (q or query) is required'
    }, { status: 400 })
  }

  try {
    const results = await webSearchService.searchWeb(query, { maxResults })
    
    return NextResponse.json({
      success: true,
      query,
      results,
      metadata: {
        totalResults: results.length,
        method: 'GET'
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Web search failed'
    }, { status: 500 })
  }
}