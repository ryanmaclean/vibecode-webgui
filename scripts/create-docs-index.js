#!/usr/bin/env node

/**
 * Documentation Index Creator
 * 
 * Creates a searchable JSON index of all consolidated documentation
 * This provides immediate search capabilities for the frontend
 */

const fs = require('fs').promises;
const path = require('path');

class DocumentationIndexer {
  constructor() {
    this.index = [];
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
   * Extract headings from markdown content
   */
  extractHeadings(content) {
    const headings = [];
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        
        headings.push({
          level,
          text,
          id,
          line: index + 1
        });
      }
    });
    
    return headings;
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
      const stats = await fs.stat(filePath);
      
      const filename = path.basename(filePath, path.extname(filePath));
      const relativePath = path.relative('/Users/ryan.maclean/vibecode-webgui/docs/src/content/docs', filePath);
      const urlPath = '/' + relativePath.replace(/\.mdx?$/, '/').replace(/\/index\/$/, '/');
      
      // Clean content for search (remove markdown syntax)
      const cleanContent = bodyContent
        .replace(/```[\s\S]*?```/g, '') // Remove code blocks
        .replace(/`[^`]+`/g, '') // Remove inline code
        .replace(/[#*_\[\]()]/g, '') // Remove markdown formatting
        .replace(/\n+/g, ' ') // Replace newlines with spaces
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();

      const headings = this.extractHeadings(bodyContent);
      const category = this.getCategory(filePath);
      
      // Create searchable keywords
      const keywords = [
        filename,
        frontmatter.title || '',
        frontmatter.description || '',
        category,
        ...headings.map(h => h.text),
        ...cleanContent.split(' ').slice(0, 50) // First 50 words for search
      ].filter(Boolean).join(' ').toLowerCase();

      const document = {
        id: filename,
        title: frontmatter.title || filename.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        description: frontmatter.description || '',
        category,
        url: urlPath,
        filePath: relativePath,
        headings,
        content: cleanContent.substring(0, 500) + (cleanContent.length > 500 ? '...' : ''),
        keywords,
        wordCount: cleanContent.split(/\s+/).length,
        lastModified: stats.mtime.toISOString(),
        size: stats.size
      };

      return document;
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Create the documentation index
   */
  async createIndex() {
    console.log('🚀 Creating documentation index...');
    
    try {
      const markdownFiles = await this.getMarkdownFiles();
      console.log(`📚 Found ${markdownFiles.length} documentation files`);
      
      const documents = [];
      const categories = new Set();
      
      for (const filePath of markdownFiles) {
        const doc = await this.processMarkdownFile(filePath);
        if (doc) {
          documents.push(doc);
          categories.add(doc.category);
          console.log(`✅ Indexed: ${doc.title}`);
        }
      }
      
      // Sort documents by category and title
      documents.sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.title.localeCompare(b.title);
      });
      
      // Create the index structure
      const index = {
        metadata: {
          generated: new Date().toISOString(),
          totalDocuments: documents.length,
          categories: Array.from(categories).sort(),
          totalWords: documents.reduce((sum, doc) => sum + doc.wordCount, 0)
        },
        documents
      };
      
      // Write the index to file
      const indexPath = path.join(__dirname, '../src/data/docs-index.json');
      await fs.mkdir(path.dirname(indexPath), { recursive: true });
      await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
      
      // Create a minified version for production
      const minifiedPath = path.join(__dirname, '../public/docs-index.json');
      await fs.mkdir(path.dirname(minifiedPath), { recursive: true });
      await fs.writeFile(minifiedPath, JSON.stringify(index));
      
      console.log('\n📊 Index Creation Summary:');
      console.log(`Total documents indexed: ${documents.length}`);
      console.log(`Categories: ${Array.from(categories).join(', ')}`);
      console.log(`Total words: ${index.metadata.totalWords.toLocaleString()}`);
      console.log(`Index file: ${indexPath}`);
      console.log(`Public index: ${minifiedPath}`);
      
      console.log('\n✅ Documentation index created successfully!');
      
      return index;
      
    } catch (error) {
      console.error('❌ Error creating index:', error);
      throw error;
    }
  }

  /**
   * Test the search functionality
   */
  testSearch(index, query = 'deployment production') {
    console.log(`\n🔍 Testing search with query: "${query}"`);
    
    const queryTerms = query.toLowerCase().split(/\s+/);
    const results = [];
    
    for (const doc of index.documents) {
      let score = 0;
      const keywords = doc.keywords.toLowerCase();
      
      // Calculate relevance score
      for (const term of queryTerms) {
        // Title match (high weight)
        if (doc.title.toLowerCase().includes(term)) score += 10;
        
        // Category match (medium weight)
        if (doc.category.toLowerCase().includes(term)) score += 5;
        
        // Description match (medium weight)
        if (doc.description.toLowerCase().includes(term)) score += 5;
        
        // Heading match (medium weight)
        if (doc.headings.some(h => h.text.toLowerCase().includes(term))) score += 3;
        
        // Content match (low weight)
        const termCount = (keywords.match(new RegExp(term, 'g')) || []).length;
        score += termCount;
      }
      
      if (score > 0) {
        results.push({ ...doc, score });
      }
    }
    
    // Sort by score (descending)
    results.sort((a, b) => b.score - a.score);
    
    console.log(`Found ${results.length} relevant documents:`);
    results.slice(0, 5).forEach((doc, index) => {
      console.log(`${index + 1}. ${doc.title} (${doc.category}) - Score: ${doc.score}`);
      console.log(`   URL: ${doc.url}`);
      console.log(`   Preview: ${doc.content.substring(0, 100)}...`);
      console.log('');
    });
  }
}

// Main execution
async function main() {
  const indexer = new DocumentationIndexer();
  
  try {
    const index = await indexer.createIndex();
    indexer.testSearch(index, 'deployment production');
    indexer.testSearch(index, 'testing kubernetes');
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { DocumentationIndexer };
