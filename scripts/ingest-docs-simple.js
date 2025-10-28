#!/usr/bin/env node

/**
 * Simple Documentation Ingestion Script
 * 
 * Ingests all consolidated documentation into PostgreSQL full-text search
 * This provides immediate search capabilities while we prepare vector search
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

class SimpleDocumentationIngester {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/vibecode'
    });
  }

  /**
   * Extract frontmatter and content from markdown file
   */
  parseFrontmatter(content) {
    const frontmatterRegex = /^---\n(.*?)\n---\n(.*)$/s;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
      return { frontmatter: {}, content };
    }
    
    const frontmatterText = match[1];
    const bodyContent = match[2];
    
    // Simple YAML parsing for common frontmatter fields
    const frontmatter = {};
    frontmatterText.split('\n').forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim().replace(/^["']|["']$/g, '');
        frontmatter[key] = value;
      }
    });
    
    return { frontmatter, content: bodyContent };
  }

  /**
   * Get category from file path
   */
  getCategory(filePath) {
    const relativePath = path.relative('/Users/ryan.maclean/vibecode-webgui/docs/src/content/docs', filePath);
    const segments = relativePath.split('/');
    
    if (segments.length > 1) {
      return segments[0]; // First directory is the category
    }
    
    // Categorize based on filename patterns
    const filename = path.basename(filePath, '.md');
    if (filename.startsWith('mcp-')) return 'MCP Framework';
    if (filename.includes('test')) return 'Testing';
    if (filename.includes('deploy') || filename.includes('production')) return 'Deployment';
    if (filename.includes('security')) return 'Security';
    if (filename.includes('ai') || filename.includes('genai')) return 'AI Integration';
    if (filename.includes('kubernetes') || filename.includes('k8s')) return 'Kubernetes';
    if (filename.includes('docker')) return 'Docker';
    
    return 'General';
  }

  /**
   * Get all markdown files from the docs directory
   */
  async getMarkdownFiles() {
    const docsDir = '/Users/ryan.maclean/vibecode-webgui/docs/src/content/docs';
    const files = [];
    
    async function walkDir(dir) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
          files.push(fullPath);
        }
      }
    }
    
    await walkDir(docsDir);
    return files;
  }

  /**
   * Process a single markdown file
   */
  async processMarkdownFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const { frontmatter, content: bodyContent } = this.parseFrontmatter(content);
      
      const documentId = `docs:${path.basename(filePath, '.md')}`;
      const title = frontmatter.title || path.basename(filePath, '.md');
      const category = this.getCategory(filePath);
      
      // Clean content for search (remove markdown syntax)
      const cleanContent = bodyContent
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks
        .replace(/`[^`]+`/g, '') // Remove inline code
        .replace(/[#*_\[\]()]/g, '') // Remove markdown formatting
        .replace(/\n+/g, ' ') // Replace newlines with spaces
        .trim();

      return {
        documentId,
        title,
        content: cleanContent,
        category,
        sourcePath: path.relative('/Users/ryan.maclean/vibecode-webgui', filePath),
        metadata: {
          ...frontmatter,
          wordCount: cleanContent.split(/\s+/).length,
          lastModified: (await fs.stat(filePath)).mtime.toISOString()
        }
      };
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Store document in the database
   */
  async storeDocument(doc) {
    const client = await this.pool.connect();
    try {
      await client.query(`
        INSERT INTO document_search (
          document_id, title, content, category, source_path, metadata, search_vector
        ) VALUES ($1, $2, $3, $4, $5, $6, to_tsvector('english', $2 || ' ' || $3))
        ON CONFLICT (document_id) 
        DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          category = EXCLUDED.category,
          source_path = EXCLUDED.source_path,
          metadata = EXCLUDED.metadata,
          search_vector = EXCLUDED.search_vector,
          updated_at = CURRENT_TIMESTAMP
      `, [
        doc.documentId,
        doc.title,
        doc.content,
        doc.category,
        doc.sourcePath,
        JSON.stringify(doc.metadata)
      ]);
      
      console.log(`✅ Stored: ${doc.title}`);
    } finally {
      client.release();
    }
  }

  /**
   * Main ingestion process
   */
  async ingestDocumentation() {
    console.log('🚀 Starting documentation ingestion...');
    
    try {
      // Get all markdown files
      const markdownFiles = await this.getMarkdownFiles();
      console.log(`📚 Found ${markdownFiles.length} documentation files`);
      
      let processed = 0;
      const categories = new Set();
      
      // Process files in batches
      const batchSize = 10;
      for (let i = 0; i < markdownFiles.length; i += batchSize) {
        const batch = markdownFiles.slice(i, i + batchSize);
        
        await Promise.all(batch.map(async (filePath) => {
          const doc = await this.processMarkdownFile(filePath);
          if (doc) {
            await this.storeDocument(doc);
            categories.add(doc.category);
            processed++;
          }
        }));
        
        console.log(`📄 Processed ${Math.min(i + batchSize, markdownFiles.length)}/${markdownFiles.length} files`);
      }
      
      // Generate summary
      const client = await this.pool.connect();
      try {
        const result = await client.query('SELECT COUNT(*) as total FROM document_search');
        const totalDocs = result.rows[0].total;
        
        console.log('\n📊 Ingestion Summary:');
        console.log(`Total files processed: ${processed}`);
        console.log(`Total documents in database: ${totalDocs}`);
        console.log(`Categories: ${Array.from(categories).join(', ')}`);
        
        console.log('\n✅ Documentation ingestion completed successfully!');
      } finally {
        client.release();
      }
      
    } catch (error) {
      console.error('❌ Error during ingestion:', error);
      throw error;
    } finally {
      await this.pool.end();
    }
  }

  /**
   * Test the ingested data by performing a sample search
   */
  async testSearch(query = 'deployment production') {
    console.log(`\n🔍 Testing search with query: "${query}"`);
    
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT 
          document_id,
          title,
          category,
          ts_rank(search_vector, plainto_tsquery('english', $1)) as rank,
          substring(content, 1, 150) as preview
        FROM document_search 
        WHERE search_vector @@ plainto_tsquery('english', $1)
        ORDER BY rank DESC
        LIMIT 5
      `, [query]);
      
      console.log(`Found ${result.rows.length} relevant documents:`);
      result.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row.title} (${row.category}) - Rank: ${row.rank.toFixed(3)}`);
        console.log(`   Preview: ${row.preview}...`);
        console.log('');
      });
      
    } catch (error) {
      console.error('❌ Error during search test:', error);
    } finally {
      client.release();
      await this.pool.end();
    }
  }
}

// Main execution
async function main() {
  const ingester = new SimpleDocumentationIngester();
  
  try {
    await ingester.ingestDocumentation();
    
    // Create a new instance for testing since the pool was closed
    const tester = new SimpleDocumentationIngester();
    await tester.testSearch();
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { SimpleDocumentationIngester };
