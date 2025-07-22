const fs = require('fs');
const path = require('path');

describe('Astro Content Validation Tests', () => {
  const docsDir = path.join(__dirname, '../../docs');
  const srcContentDir = path.join(docsDir, 'src/content/docs');
  const distDir = path.join(docsDir, 'dist');

  test('should have content configuration file', () => {
    const configPath = path.join(docsDir, 'src/content/config.ts');
    expect(fs.existsSync(configPath)).toBe(true);
    
    const configContent = fs.readFileSync(configPath, 'utf-8');
    expect(configContent).toContain('defineCollection');
    expect(configContent).toContain('docsSchema');
  });

  test('should have all markdown files with proper frontmatter', () => {
    if (!fs.existsSync(srcContentDir)) {
      throw new Error('Source content directory does not exist');
    }

    const mdFiles = fs.readdirSync(srcContentDir)
      .filter(file => file.endsWith('.md') || file.endsWith('.mdx'));

    expect(mdFiles.length).toBeGreaterThan(70); // Should have many markdown files
    
    // Check random selection of files for frontmatter
    const sampleFiles = mdFiles.slice(0, 10);
    
    sampleFiles.forEach(file => {
      const filePath = path.join(srcContentDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Should start with frontmatter
      expect(content.trim()).toMatch(/^---\s*\n/);
      expect(content).toContain('title:');
      expect(content).toContain('description:');
      expect(content).toContain('---');
      
      // Should have substantial content after frontmatter
      const contentAfterFrontmatter = content.split('---').slice(2).join('---');
      expect(contentAfterFrontmatter.trim().length).toBeGreaterThan(100);
    });
  });

  test('should generate HTML for all markdown files', () => {
    if (!fs.existsSync(distDir)) {
      throw new Error('Distribution directory does not exist - run build first');
    }

    const mdFiles = fs.readdirSync(srcContentDir)
      .filter(file => file.endsWith('.md') || file.endsWith('.mdx'));

    // Check that most markdown files have corresponding HTML
    let htmlCount = 0;
    
    mdFiles.forEach(file => {
      const baseName = path.basename(file, path.extname(file));
      
      // Try different possible HTML paths
      const possiblePaths = [
        path.join(distDir, baseName, 'index.html'),
        path.join(distDir, baseName.toLowerCase(), 'index.html'),
        path.join(distDir, baseName.replace(/_/g, '-'), 'index.html'),
        path.join(distDir, baseName.toLowerCase().replace(/_/g, '-'), 'index.html')
      ];
      
      const htmlExists = possiblePaths.some(htmlPath => fs.existsSync(htmlPath));
      
      if (htmlExists) {
        htmlCount++;
      } else {
        console.warn(`No HTML found for markdown file: ${file}`);
      }
    });

    // Should have HTML for most markdown files (allow some tolerance)
    const conversionRate = htmlCount / mdFiles.length;
    expect(conversionRate).toBeGreaterThan(0.8); // At least 80% should be converted
    
    console.log(`Generated HTML for ${htmlCount}/${mdFiles.length} markdown files (${Math.round(conversionRate * 100)}%)`);
  });

  test('should have proper heading structure', () => {
    // Check a few key pages for proper heading structure
    const testPages = [
      'wiki-index/index.html',
      'datadog-local-development/index.html',
      'comprehensive-testing-guide/index.html'
    ];

    testPages.forEach(page => {
      const pagePath = path.join(distDir, page);
      if (fs.existsSync(pagePath)) {
        const html = fs.readFileSync(pagePath, 'utf-8');
        
        // Should have h1 tag
        expect(html).toMatch(/<h1[^>]*>/);
        
        // Should have some content structure
        expect(html).toMatch(/<h[2-6][^>]*>/); // Should have subheadings
        expect(html).toContain('<p>'); // Should have paragraphs
      }
    });
  });

  test('should have proper internal linking', () => {
    const indexPath = path.join(distDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      const html = fs.readFileSync(indexPath, 'utf-8');
      
      // Should have links to other documentation pages
      const links = html.match(/href="[^"]*"/g) || [];
      const internalLinks = links.filter(link => 
        !link.includes('http') && !link.includes('mailto:')
      );
      
      expect(internalLinks.length).toBeGreaterThan(1); // Should have some internal links
    }
  });

  test('should have search index with content', () => {
    const searchDir = path.join(distDir, 'pagefind');
    
    if (fs.existsSync(searchDir)) {
      const searchFiles = fs.readdirSync(searchDir);
      
      // Should have fragment files (these contain the actual searchable content)
      const fragmentFiles = searchFiles.filter(file => file.startsWith('fragment'));
      expect(fragmentFiles.length).toBeGreaterThan(0);
      
      // Check one fragment file for content
      if (fragmentFiles.length > 0) {
        const fragmentPath = path.join(searchDir, fragmentFiles[0]);
        const fragmentContent = fs.readFileSync(fragmentPath);
        expect(fragmentContent.length).toBeGreaterThan(100); // Should have substantial content
      }
    }
  });

  test('should have consistent styling across pages', () => {
    // Check that multiple pages use the same CSS
    const pages = [
      'index.html',
      'wiki-index/index.html',
      'datadog-local-development/index.html'
    ];

    let cssHrefs = [];
    
    pages.forEach(page => {
      const pagePath = path.join(distDir, page);
      if (fs.existsSync(pagePath)) {
        const html = fs.readFileSync(pagePath, 'utf-8');
        const cssMatches = html.match(/href="([^"]*\.css)"/g) || [];
        cssHrefs = cssHrefs.concat(cssMatches);
      }
    });

    // Should have consistent CSS references
    expect(cssHrefs.length).toBeGreaterThan(0);
    
    // All pages should reference similar CSS files
    const uniqueCss = [...new Set(cssHrefs)];
    expect(uniqueCss.length).toBeLessThan(cssHrefs.length); // Some CSS should be shared
  });

  test('should have proper meta information', () => {
    const testPages = [
      'index.html',
      'wiki-index/index.html'
    ];

    testPages.forEach(page => {
      const pagePath = path.join(distDir, page);
      if (fs.existsSync(pagePath)) {
        const html = fs.readFileSync(pagePath, 'utf-8');
        
        // Should have proper meta tags
        expect(html).toContain('<meta name="description"');
        expect(html).toContain('<meta name="viewport"');
        
        // Should have title
        expect(html).toMatch(/<title>.*<\/title>/);
        
        // Should have language attribute
        expect(html).toMatch(/<html[^>]*lang="en"/);
      }
    });
  });
});