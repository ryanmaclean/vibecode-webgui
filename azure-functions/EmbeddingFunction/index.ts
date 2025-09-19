import { AzureFunction, Context } from "@azure/functions";
import { Pool } from 'pg';
import { OpenAIApi, Configuration } from 'openai';
import { promises as fs } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';
import { createHash } from 'crypto';

// Cached connections
let cachedDbConnection: Pool;
let cachedOpenAI: OpenAIApi;

interface DocumentData {
  id: string;
  title: string;
  content: string;
  category: string;
  sourcePath: string;
  checksum: string;
  metadata: {
    headings: Array<{
      level: number;
      text: string;
      id: string;
    }>;
    lastModified: string;
    tags: string[];
  };
}

// Initialize database connection
async function getDbConnection(): Promise<Pool> {
  if (!cachedDbConnection) {
    cachedDbConnection = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
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

// Generate embeddings with retry logic
async function generateEmbedding(text: string, retries = 3): Promise<number[]> {
  const openai = await getOpenAIClient();
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await openai.createEmbedding({
        model: process.env.EMBEDDINGS_DEPLOYMENT_NAME || 'text-embedding-ada-002',
        input: text.replace(/\n/g, ' ').trim().substring(0, 8000), // Limit input length
      });

      return response.data.data[0].embedding;
    } catch (error) {
      console.error(`Embedding attempt ${attempt} failed:`, error);
      if (attempt === retries) throw error;
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
  
  throw new Error('Failed to generate embedding after all retries');
}

// Calculate content checksum for change detection
function calculateChecksum(content: string): string {
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

// Extract headings from markdown content
function extractHeadings(content: string): Array<{ level: number; text: string; id: string }> {
  const headings: Array<{ level: number; text: string; id: string }> = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim();
      const id = text.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/--+/g, '-')
        .replace(/^-+|-+$/g, '');
      
      headings.push({ level, text, id });
    }
  }
  
  return headings;
}

// Clean content for embedding
function cleanContentForEmbedding(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/<!--[\s\S]*?-->/g, '') // Remove HTML comments
    .replace(/\[.*?\]\(.*?\)/g, '') // Remove markdown links
    .replace(/<.*?>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

// Process a single document
async function processDocument(filePath: string, content: string): Promise<DocumentData | null> {
  try {
    const { data: frontmatter, content: markdownContent } = matter(content);
    
    const cleanContent = cleanContentForEmbedding(markdownContent);
    if (cleanContent.length < 50) {
      console.log(`Skipping ${filePath}: content too short`);
      return null;
    }
    
    const fileName = filePath.split('/').pop()?.replace(/\.(md|mdx)$/, '') || 'unknown';
    const id = fileName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    
    // Determine category from path or frontmatter
    let category = 'General';
    if (frontmatter.category) {
      category = frontmatter.category;
    } else if (filePath.includes('/deployment/')) {
      category = 'Deployment';
    } else if (filePath.includes('/testing/')) {
      category = 'Testing';
    } else if (filePath.includes('/ai/')) {
      category = 'AI Integration';
    } else if (filePath.includes('/kubernetes/') || filePath.includes('/k8s/')) {
      category = 'Kubernetes';
    } else if (filePath.includes('/security/')) {
      category = 'Security';
    } else if (filePath.includes('/mcp/')) {
      category = 'MCP Framework';
    }
    
    return {
      id,
      title: frontmatter.title || fileName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      content: cleanContent,
      category,
      sourcePath: filePath,
      checksum: calculateChecksum(content),
      metadata: {
        headings: extractHeadings(markdownContent),
        lastModified: frontmatter.lastmod || new Date().toISOString(),
        tags: frontmatter.tags || []
      }
    };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return null;
  }
}

// Find all markdown files in documentation directories
async function findDocumentationFiles(): Promise<string[]> {
  const docPaths = [
    '/home/site/wwwroot/docs/src/content/docs',
    '/home/site/wwwroot/archive/consolidated-wiki',
    // Add other documentation paths as needed
  ];
  
  const files: string[] = [];
  
  for (const docPath of docPaths) {
    try {
      await walkDirectory(docPath, files);
    } catch (error) {
      console.log(`Documentation path not found: ${docPath}`);
    }
  }
  
  return files;
}

// Recursively walk directory for markdown files
async function walkDirectory(dir: string, files: string[]): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        await walkDirectory(fullPath, files);
      } else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error);
  }
}

// Update document in database
async function updateDocument(db: Pool, doc: DocumentData, embedding: number[]): Promise<void> {
  const embeddingVector = `[${embedding.join(',')}]`;
  
  await db.query(`
    INSERT INTO document_search (
      document_id, title, content, category, source_path, metadata, 
      embedding, search_vector, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7::vector, to_tsvector('english', $2 || ' ' || $3), NOW(), NOW())
    ON CONFLICT (document_id) 
    DO UPDATE SET
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      category = EXCLUDED.category,
      source_path = EXCLUDED.source_path,
      metadata = EXCLUDED.metadata,
      embedding = EXCLUDED.embedding,
      search_vector = EXCLUDED.search_vector,
      updated_at = NOW()
  `, [
    doc.id,
    doc.title,
    doc.content,
    doc.category,
    doc.sourcePath,
    JSON.stringify(doc.metadata),
    embeddingVector
  ]);
}

const timerTrigger: AzureFunction = async function (context: Context, myTimer: any): Promise<void> {
  const startTime = Date.now();
  context.log('Embedding generation function started');
  
  try {
    const db = await getDbConnection();
    
    // Find all documentation files
    const files = await findDocumentationFiles();
    context.log(`Found ${files.length} documentation files`);
    
    if (files.length === 0) {
      context.log('No documentation files found');
      return;
    }
    
    // Get existing documents with checksums
    const existingDocs = await db.query(`
      SELECT document_id, (metadata->>'checksum') as checksum 
      FROM document_search
    `);
    
    const existingChecksums = new Map(
      existingDocs.rows.map(row => [row.document_id, row.checksum])
    );
    
    let processed = 0;
    let updated = 0;
    let errors = 0;
    
    // Process files in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (filePath) => {
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const doc = await processDocument(filePath, content);
          
          if (!doc) {
            return;
          }
          
          processed++;
          
          // Check if document has changed
          const existingChecksum = existingChecksums.get(doc.id);
          if (existingChecksum === doc.checksum) {
            context.log(`Skipping unchanged document: ${doc.id}`);
            return;
          }
          
          // Generate embedding
          const embedding = await generateEmbedding(doc.content);
          
          // Update document with checksum in metadata
          doc.metadata = { ...doc.metadata, checksum: doc.checksum };
          
          // Save to database
          await updateDocument(db, doc, embedding);
          
          updated++;
          context.log(`Updated document: ${doc.id} (${doc.category})`);
          
        } catch (error) {
          errors++;
          context.log.error(`Error processing ${filePath}:`, error);
        }
      }));
      
      // Rate limiting - wait between batches
      if (i + batchSize < files.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Clean up orphaned documents
    const validIds = files.map(f => {
      const fileName = f.split('/').pop()?.replace(/\.(md|mdx)$/, '') || 'unknown';
      return fileName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    });
    
    if (validIds.length > 0) {
      const deleteResult = await db.query(`
        DELETE FROM document_search 
        WHERE document_id NOT IN (${validIds.map((_, i) => `$${i + 1}`).join(',')})
      `, validIds);
      
      if (deleteResult.rowCount > 0) {
        context.log(`Removed ${deleteResult.rowCount} orphaned documents`);
      }
    }
    
    const duration = Date.now() - startTime;
    
    context.log(`Embedding generation completed:
      - Files found: ${files.length}
      - Documents processed: ${processed}
      - Documents updated: ${updated}
      - Errors: ${errors}
      - Duration: ${duration}ms`);
    
  } catch (error) {
    context.log.error('Embedding generation function failed:', error);
    throw error;
  }
};

export default timerTrigger;
