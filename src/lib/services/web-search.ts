import axios from 'axios'
// import { logger } from '@/lib/logger';
export interface WebSearchResult {
  title: string
  url: string
  snippet: string
  relevance: number
  timestamp?: string
  source?: string
}

export interface WebSearchOptions {
  maxResults?: number
  timeFilter?: 'day' | 'week' | 'month' | 'year'
  safeSearch?: boolean
  language?: string
  region?: string
}

export class WebSearchService {
  private readonly searchEngines = {
    duckduckgo: 'https://api.duckduckgo.com/',
    searx: process.env.SEARX_INSTANCE_URL || 'https://searx.org',
    bing: 'https://api.bing.microsoft.com/v7.0/search',
    google: 'https://www.googleapis.com/customsearch/v1'
  }

  async searchWeb(query: string, options: WebSearchOptions = {}): Promise<WebSearchResult[]> {
    const { 
      maxResults = 5, 
      timeFilter, 
      safeSearch = true, 
      language = 'en',
      region = 'us' 
    } = options

    try {
      // Try multiple search engines for better reliability
      const results = await this.searchWithFallback(query, {
        maxResults,
        timeFilter,
        safeSearch,
        language,
        region
      })

      // Filter and rank results
      return this.rankResults(results, query).slice(0, maxResults)
    } catch (error) {
      console.error('Web search failed:', error)
      return []
    }
  }

  private async searchWithFallback(query: string, options: WebSearchOptions): Promise<WebSearchResult[]> {
    const searchMethods = [
      () => this.searchDuckDuckGo(query, options),
      () => this.searchBing(query, options),
      () => this.searchSearx(query, options)
    ]

    for (const searchMethod of searchMethods) {
      try {
        const results = await searchMethod()
        if (results.length > 0) {
          return results
        }
      } catch (error) {
        console.warn('Search method failed, trying next:', error instanceof Error ? error.message : String(error))
        continue
      }
    }

    return []
  }

  private async searchDuckDuckGo(query: string, options: WebSearchOptions): Promise<WebSearchResult[]> {
    try {
      // DuckDuckGo Instant Answer API
      const response = await axios.get('https://api.duckduckgo.com/', {
        params: {
          q: query,
          format: 'json',
          no_html: '1',
          skip_disambig: '1'
        },
        timeout: 5000
      })

      const results: WebSearchResult[] = []
      const data = response.data

      // Process abstract
      if (data.Abstract) {
        results.push({
          title: data.Heading || 'DuckDuckGo Result',
          url: data.AbstractURL || 'https://duckduckgo.com',
          snippet: data.Abstract,
          relevance: 0.9,
          source: 'duckduckgo'
        })
      }

      // Process related topics
      if (data.RelatedTopics) {
        data.RelatedTopics.slice(0, 3).forEach((topic: any, index: number) => {
          if (topic.Text && topic.FirstURL) {
            results.push({
              title: topic.Text.split(' - ')[0] || 'Related Topic',
              url: topic.FirstURL,
              snippet: topic.Text,
              relevance: 0.8 - (index * 0.1),
              source: 'duckduckgo'
            })
          }
        })
      }

      return results
    } catch (error) {
      throw new Error(`DuckDuckGo search failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async searchBing(query: string, options: WebSearchOptions): Promise<WebSearchResult[]> {
    const apiKey = process.env.BING_SEARCH_API_KEY
    if (!apiKey) {
      throw new Error('Bing API key not configured')
    }

    try {
      const response = await axios.get('https://api.bing.microsoft.com/v7.0/search', {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey
        },
        params: {
          q: query,
          count: options.maxResults || 5,
          mkt: `${options.language || 'en'}-${options.region || 'US'}`,
          safeSearch: options.safeSearch ? 'Strict' : 'Off',
          freshness: options.timeFilter
        },
        timeout: 5000
      })

      const results: WebSearchResult[] = []
      
      if (response.data.webPages?.value) {
        response.data.webPages.value.forEach((item: any, index: number) => {
          results.push({
            title: item.name || 'Untitled',
            url: item.url,
            snippet: item.snippet || '',
            relevance: 1.0 - (index * 0.1),
            timestamp: item.dateLastCrawled,
            source: 'bing'
          })
        })
      }

      return results
    } catch (error) {
      throw new Error(`Bing search failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async searchSearx(query: string, options: WebSearchOptions): Promise<WebSearchResult[]> {
    const searxUrl = process.env.SEARX_INSTANCE_URL || 'https://searx.org'
    
    try {
      const response = await axios.get(`${searxUrl}/search`, {
        params: {
          q: query,
          format: 'json',
          categories: 'general',
          language: options.language || 'en',
          time_range: options.timeFilter,
          safesearch: options.safeSearch ? 2 : 0
        },
        timeout: 8000
      })

      const results: WebSearchResult[] = []
      
      if (response.data.results) {
        response.data.results.slice(0, options.maxResults || 5).forEach((item: any, index: number) => {
          results.push({
            title: item.title || 'Untitled',
            url: item.url,
            snippet: item.content || '',
            relevance: 1.0 - (index * 0.1),
            source: 'searx'
          })
        })
      }

      return results
    } catch (error) {
      throw new Error(`Searx search failed: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private rankResults(results: WebSearchResult[], query: string): WebSearchResult[] {
    const queryLower = query.toLowerCase()
    const queryTerms = queryLower.split(' ').filter(term => term.length > 2)

    return results.map(result => {
      let relevanceBoost = 0
      const titleLower = result.title.toLowerCase()
      const snippetLower = result.snippet.toLowerCase()
      
      // Boost relevance based on query term matches
      queryTerms.forEach(term => {
        if (titleLower.includes(term)) relevanceBoost += 0.3
        if (snippetLower.includes(term)) relevanceBoost += 0.1
      })

      // Boost based on URL quality indicators
      if (result.url.includes('https')) relevanceBoost += 0.05
      if (result.url.includes('wikipedia.org')) relevanceBoost += 0.1
      if (result.url.includes('.edu') || result.url.includes('.gov')) relevanceBoost += 0.1

      return {
        ...result,
        relevance: Math.min(1.0, result.relevance + relevanceBoost)
      }
    }).sort((a, b) => b.relevance - a.relevance)
  }

  async scrapeContent(url: string): Promise<{ content: string; title?: string; error?: string }> {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'VibeCode-RAG-Bot/1.0 (+https://vibecode.dev/bot)'
        }
      })

      const html = response.data
      
      // Basic HTML content extraction (could be enhanced with Cheerio/Puppeteer)
      const content = this.extractTextFromHTML(html)
      const title = this.extractTitleFromHTML(html)

      return {
        content: content.slice(0, 5000), // Limit content size
        title
      }
    } catch (error) {
      return {
        content: '',
        error: `Failed to scrape ${url}: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  private extractTextFromHTML(html: string): string {
    // Remove script and style elements
    let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    
    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ')
    
    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim()
    
    // Remove common navigation and footer content
    const cleaningPatterns = [
      /cookie policy/gi,
      /privacy policy/gi,
      /terms of service/gi,
      /subscribe to newsletter/gi,
      /follow us on/gi
    ]
    
    cleaningPatterns.forEach(pattern => {
      text = text.replace(pattern, '')
    })
    
    return text
  }

  private extractTitleFromHTML(html: string): string {
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    return titleMatch ? titleMatch[1].trim() : ''
  }
}

// Export singleton instance
export const webSearchService = new WebSearchService()