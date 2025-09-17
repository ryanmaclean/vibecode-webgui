#!/usr/bin/env tsx

/**
 * Documentation RAG Ingestion Script
 * 
 * This script processes all consolidated documentation files and stores them
 * in the pgvector database for semantic search and RAG functionality.
 * 
 * Features:
 * - Processes all markdown files in the Astro docs directory
 * - Chunks documents for optimal retrieval
 * - Generates embeddings using Azure OpenAI
 * - Stores in pgvector with metadata
 * - Progress tracking and error handling
 * - Deduplication support
 */

import fs from 'fs/promises';
import path from 'path';
import { AzureEmbeddingService } from '../src/lib/ai/azureEmbeddingService';
import { VectorService } from '../src/lib/db/vector';
import { PrismaClient } from '@prisma/client';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    title?: string;
    description?: string;
    category?: string;
    chunkIndex: number;
    totalChunks: number;
    lastModified?: string;
  };
}

class DocumentationRAGIngester {
  private embeddingService: AzureEmbeddingService;
  private vectorService: VectorService;
  private prisma: PrismaClient;
  private textSplitter: RecursiveCharacterTextSplitter;
  
  constructor() {
    this.prisma = new PrismaClient();
    this.vectorService = new VectorService(this.prisma);
    this.embeddingService = new AzureEmbeddingService({
      apiKey: process.env.AZURE_OPENAI_API_KEY!,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
      deploymentName: process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME || 'text-embedding-ada-002',
      apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-02-15-preview'
    });
    
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '. ', ' ', '']
    });
  }

  /**
   * Extract frontmatter and content from markdown file
   */
  private parseFrontmatter(content: string): { frontmatter: any; content: string } {
    const frontmatterRegex = /^---\n(.*?)\n---\n(.*)$/s;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
      return { frontmatter: {}, content };
    }
    
    const frontmatterText = match[1];
    const bodyContent = match[2];
    
    // Simple YAML parsing for common frontmatter fields
    const frontmatter: any = {};
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
  private getCategory(filePath: string): string {
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
   * Process a single markdown file
   */
  private async processMarkdownFile(filePath: string): Promise<DocumentChunk[]> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const { frontmatter, content: bodyContent } = this.parseFrontmatter(content);
      
      // Get file stats for metadata
      const stats = await fs.stat(filePath);
      
      // Split content into chunks
      const chunks = await this.textSplitter.createDocuments([bodyContent]);
      
      const documentChunks: DocumentChunk[] = chunks.map((chunk, index) => ({
        id: `docs:${path.basename(filePath, '.md')}:chunk:${index}`,
        content: chunk.pageContent,
        metadata: {
          source: filePath,
          title: frontmatter.title || path.basename(filePath, '.md'),
          description: frontmatter.description,
          category: this.getCategory(filePath),
          chunkIndex: index,
          totalChunks: chunks.length,
          lastModified: stats.mtime.toISOString()
        }
      }));
      
      return documentChunks;
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Get all markdown files from the docs directory
   */
  private async getMarkdownFiles(): Promise<string[]> {
    const docsDir = '/Users/ryan.maclean/vibecode-webgui/docs/src/content/docs';
    const files: string[] = [];
    
    async function walkDir(dir: string) {
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
   * Store document chunks in the vector database
   */
  private async storeDocumentChunks(chunks: DocumentChunk[]): Promise<void> {
    const batchSize = 10; // Process in batches to avoid overwhelming the API
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (chunk) => {
        try {
          await this.embeddingService.storeDocument(
            chunk.id,
            chunk.content,
            chunk.metadata
          );
          console.log(`✅ Stored chunk: ${chunk.id}`);
        } catch (error) {
          console.error(`❌ Failed to store chunk ${chunk.id}:`, error);
        }
      }));
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Main ingestion process
   */
  async ingestDocumentation(): Promise<void> {
    console.log('🚀 Starting documentation RAG ingestion...');
    
    try {
      // Get all markdown files
      const markdownFiles = await this.getMarkdownFiles();
      console.log(`📚 Found ${markdownFiles.length} documentation files`);
      
      // Process all files and collect chunks
      const allChunks: DocumentChunk[] = [];
      
      for (const filePath of markdownFiles) {
        console.log(`📄 Processing: ${path.basename(filePath)}`);
        const chunks = await this.processMarkdownFile(filePath);
        allChunks.push(...chunks);
      }
      
      console.log(`📦 Generated ${allChunks.length} document chunks`);
      
      // Store chunks in vector database
      console.log('💾 Storing chunks in vector database...');
      await this.storeDocumentChunks(allChunks);
      
      // Generate summary statistics
      const categories = [...new Set(allChunks.map(chunk => chunk.metadata.category))];
      const categoryCounts = categories.map(category => ({
        category,
        count: allChunks.filter(chunk => chunk.metadata.category === category).length
      }));
      
      console.log('\n📊 Ingestion Summary:');
      console.log(`Total files processed: ${markdownFiles.length}`);
      console.log(`Total chunks generated: ${allChunks.length}`);
      console.log(`Categories:`);
      categoryCounts.forEach(({ category, count }) => {
        console.log(`  - ${category}: ${count} chunks`);
      });
      
      console.log('\n✅ Documentation RAG ingestion completed successfully!');
      
    } catch (error) {
      console.error('❌ Error during ingestion:', error);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * Test the ingested data by performing a sample search
   */
  async testSearch(query: string = 'How to deploy to production'): Promise<void> {
    console.log(`\n🔍 Testing search with query: "${query}"`);
    
    try {
      const queryEmbedding = await this.embeddingService.generateEmbedding(query);
      const results = await this.vectorService.findSimilarDocuments({
        embedding: queryEmbedding,
        threshold: 0.7,
        limit: 5
      });
      
      console.log(`Found ${results.length} relevant documents:`);
      results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.document_id} (similarity: ${result.similarity?.toFixed(3)})`);
        console.log(`   Content preview: ${result.content.substring(0, 100)}...`);
      });
      
    } catch (error) {
      console.error('❌ Error during search test:', error);
    }
  }
}

// Main execution
async function main() {
  const ingester = new DocumentationRAGIngester();
  
  try {
    await ingester.ingestDocumentation();
    await ingester.testSearch();
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { DocumentationRAGIngester };
