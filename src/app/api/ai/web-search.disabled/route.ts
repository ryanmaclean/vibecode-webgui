import { NextRequest, NextResponse } from 'next/server'
import { webSearchService } from '@/lib/services/web-search'
import { z } from '@/lib/zod-compat'

// Zod validation schema for web search requests
const webSearchRequestSchema = z.object({
  query: z.string()
    .min(1, 'Query is required')
    .max(500, 'Query too long')
    .regex(/^[^\x00-\x1F\x7F]*$/, 'Query contains invalid characters'),
  maxResults: z.number().int().min(1).max(20).optional().default(5),
  timeFilter: z.enum(['day', 'week', 'month', 'year']).optional(),
  safeSearch: z.boolean().optional().default(true),
  language: z.string().length(2).optional().default('en'),
  region: z.string().length(2).optional().default('us'),
  includeContent: z.boolean().optional().default(false)
}).strict()

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    // Validate request body with Zod
    const validation = webSearchRequestSchema.safeParse(body)
    
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: 'Invalid request format',
        details: validation.error.issues.map(err => ({
          field: err.path.join('.'),
          message: err.message
        }))
      }, { status: 400 })
    }

    const { 
      query, 
      maxResults, 
      timeFilter,
      safeSearch,
      language,
      region,
      includeContent
    } = validation.data

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
            contentError: `Scraping failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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

  // Validate query parameter
  if (!query || query.trim().length === 0) {
    return NextResponse.json({
      success: false,
      error: 'Query parameter (q or query) is required'
    }, { status: 400 })
  }

  // Validate maxResults
  if (isNaN(maxResults) || maxResults < 1 || maxResults > 20) {
    return NextResponse.json({
      success: false,
      error: 'maxResults must be a number between 1 and 20'
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