import { AzureFunction, Context, HttpRequest } from "@azure/functions";
import { Pool } from 'pg';
import { OpenAIApi, Configuration } from 'openai';
import tracer from 'dd-trace';

// Initialize Datadog tracing for Azure Functions to mirror the LLM observability guide
tracer.init({
  service: process.env.DD_SERVICE || 'vibecode-docs-search',
  env: process.env.DD_ENV || 'production',
  version: process.env.DD_VERSION || '1.0.0',
  logInjection: true,
  runtimeMetrics: true,
  profiling: process.env.NODE_ENV === 'production',
  sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  tags: {
    'ml.app': process.env.DD_LLMOBS_ML_APP || 'vibecode-ai'
  }
});

// Cached connections for performance
let cachedDbConnection: Pool;
let cachedOpenAI: OpenAIApi;

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

// Initialize database connection with connection pooling
async function getDbConnection(): Promise<Pool> {
  if (!cachedDbConnection) {
    cachedDbConnection = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3, // Limit connections per function instance
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: { rejectUnauthorized: false }
    });
  }
  return cachedDbConnection;
}

// Initialize OpenAI client
async function getOpenAIClient(): Promise<OpenAIApi> {
  if (!cachedOpenAI) {
    const configuration = new Configuration({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      basePath: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.EMBEDDINGS_DEPLOYMENT_NAME}`,
      baseOptions: {
        headers: {
          'api-key': process.env.AZURE_OPENAI_API_KEY,
        },
        params: {
          'api-version': '2023-12-01-preview',
        },
      },
    });
    cachedOpenAI = new OpenAIApi(configuration);
  }
  return cachedOpenAI;
}

// Generate embeddings for search query
async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const openai = await getOpenAIClient();
    const response = await openai.createEmbedding({
      model: process.env.EMBEDDINGS_DEPLOYMENT_NAME || 'text-embedding-ada-002',
      input: text.replace(/\n/g, ' ').trim(),
    });

    return response.data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// Perform hybrid search (vector + full-text)
async function performSearch(
  query: string, 
  category?: string, 
  limit: number = 10
): Promise<SearchResponse> {
  const startTime = Date.now();
  const db = await getDbConnection();
  
  try {
    // Generate embedding for semantic search
    const queryEmbedding = await generateEmbedding(query);
    const embeddingVector = `[${queryEmbedding.join(',')}]`;
    
    // Build SQL query with hybrid search
    let sql = `
      WITH vector_search AS (
        SELECT 
          id,
          document_id,
          title,
          content,
          category,
          source_path,
          metadata,
          1 - (embedding <=> $1::vector) AS vector_score
        FROM document_search
        WHERE 1 - (embedding <=> $1::vector) > 0.3
      ),
      text_search AS (
        SELECT 
          id,
          document_id,
          title,
          content,
          category,
          source_path,
          metadata,
          ts_rank_cd(search_vector, plainto_tsquery($2)) AS text_score
        FROM document_search
        WHERE search_vector @@ plainto_tsquery($2)
      ),
      combined_search AS (
        SELECT 
          COALESCE(v.id, t.id) as id,
          COALESCE(v.document_id, t.document_id) as document_id,
          COALESCE(v.title, t.title) as title,
          COALESCE(v.content, t.content) as content,
          COALESCE(v.category, t.category) as category,
          COALESCE(v.source_path, t.source_path) as source_path,
          COALESCE(v.metadata, t.metadata) as metadata,
          COALESCE(v.vector_score, 0) * 0.7 + COALESCE(t.text_score, 0) * 0.3 as combined_score
        FROM vector_search v
        FULL OUTER JOIN text_search t ON v.id = t.id
      )
      SELECT 
        document_id as id,
        title,
        SUBSTRING(content, 1, 300) || '...' as description,
        category,
        '/' || REPLACE(LOWER(document_id), '-', '/') || '/' as url,
        content,
        combined_score as score,
        metadata
      FROM combined_search
    `;
    
    const params = [embeddingVector, query];
    let paramIndex = 3;
    
    // Add category filter if specified
    if (category) {
      sql += ` WHERE category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    
    sql += ` ORDER BY combined_score DESC LIMIT $${paramIndex}`;
    params.push(limit.toString());
    
    // Execute search query
    const searchResult = await db.query(sql, params);
    
    // Get available categories
    const categoriesResult = await db.query(
      'SELECT DISTINCT category FROM document_search ORDER BY category'
    );
    
    // Get total document count
    const countResult = await db.query('SELECT COUNT(*) as total FROM document_search');
    
    const results: SearchResult[] = searchResult.rows.map(row => ({
      id: row.id,
      title: row.title || row.id.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
      description: row.description,
      category: row.category,
      url: row.url,
      content: row.content,
      score: parseFloat(row.score) || 0,
      headings: row.metadata?.headings || []
    }));
    
    const searchTime = Date.now() - startTime;
    
    return {
      query,
      total: results.length,
      results,
      categories: categoriesResult.rows.map(row => row.category),
      metadata: {
        searchTime,
        totalDocuments: parseInt(countResult.rows[0].total)
      }
    };
    
  } catch (error) {
    console.error('Search error:', error);
    throw error;
  }
}

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
  // Create Datadog span for request tracing
  const span = tracer.startSpan('docs.search.request');
  
  context.log('Documentation search request received');
  
  try {
    // Parse query parameters
    const query = req.query.q || req.body?.q;
    const category = req.query.category || req.body?.category;
    const limit = parseInt(req.query.limit || req.body?.limit || '10');
    
    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      span.setTag('error', true);
      span.setTag('error.type', 'validation');
      span.finish();
      
      context.res = {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: {
          error: 'Query parameter "q" is required and must be a non-empty string'
        }
      };
      return;
    }
    
    if (limit > 50) {
      context.res = {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: {
          error: 'Limit cannot exceed 50 results'
        }
      };
      return;
    }
    
    // Add Datadog tags for monitoring
    span.setTag('search.query', query.trim());
    span.setTag('search.category', category || 'all');
    span.setTag('search.limit', limit);
    
    // Perform search
    const searchResults = await performSearch(query.trim(), category, limit);
    
    // Add result metrics to span
    span.setTag('search.results.count', searchResults.results.length);
    span.setTag('search.results.total', searchResults.total);
    span.setTag('search.time_ms', searchResults.metadata.searchTime);
    
    // Return results
    context.res = {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
      },
      body: searchResults
    };
    
    context.log(`Search completed: "${query}" returned ${searchResults.results.length} results in ${searchResults.metadata.searchTime}ms`);
    span.finish();
    
  } catch (error) {
    // Log error to Datadog
    span.setTag('error', true);
    span.setTag('error.type', error.constructor.name);
    span.setTag('error.message', error.message);
    span.finish();
    
    context.log.error('Search function error:', error);
    
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: {
        error: 'Internal server error during search',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Search temporarily unavailable'
      }
    };
  }
};

export default httpTrigger;
