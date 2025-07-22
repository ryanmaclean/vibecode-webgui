const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('Astro Documentation Build Tests', () => {
  const docsDir = path.join(__dirname, '../../docs');
  const distDir = path.join(docsDir, 'dist');

  // Clean build before running tests
  beforeAll(async () => {
    // Remove existing dist directory
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
    }
  }, 30000);

  test('should build documentation successfully', async () => {
    const buildProcess = spawn('npm', ['run', 'build'], {
      cwd: docsDir,
      stdio: 'pipe'
    });

    let stdout = '';
    let stderr = '';

    buildProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    buildProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const exitCode = await new Promise((resolve) => {
      buildProcess.on('close', resolve);
    });

    // Log output for debugging
    if (exitCode !== 0) {
      console.error('Build stdout:', stdout);
      console.error('Build stderr:', stderr);
    }

    expect(exitCode).toBe(0);
    expect(stdout).toContain('page(s) built');
    expect(stdout).toContain('Complete!');
  }, 60000);

  test('should generate all expected HTML pages', () => {
    expect(fs.existsSync(distDir)).toBe(true);

    // Check for main files
    expect(fs.existsSync(path.join(distDir, 'index.html'))).toBe(true);
    expect(fs.existsSync(path.join(distDir, '404.html'))).toBe(true);

    // Count HTML files
    const htmlFiles = [];
    const walkDir = (dir) => {
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
          walkDir(fullPath);
        } else if (file.endsWith('.html')) {
          htmlFiles.push(fullPath);
        }
      });
    };

    walkDir(distDir);
    
    // Should have generated many pages (at least 80+ based on our build output)
    expect(htmlFiles.length).toBeGreaterThan(80);
    console.log(`Generated ${htmlFiles.length} HTML files`);
  });

  test('should have proper page structure', () => {
    const indexPath = path.join(distDir, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');

    // Check for essential elements
    expect(indexContent).toContain('<title>');
    expect(indexContent).toContain('<html');
    expect(indexContent).toContain('<head>');
    expect(indexContent).toContain('<body>');
    
    // Check for Starlight-specific elements
    expect(indexContent).toContain('data-starlight');
    
    // Check for our content
    expect(indexContent).toContain('VibeCode');
  });

  test('should include Datadog RUM integration', () => {
    const indexPath = path.join(distDir, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');

    // Check for Datadog RUM script
    expect(indexContent).toContain('datadog-rum.js');
    expect(indexContent).toContain('DD_RUM.init');
    expect(indexContent).toContain('sessionSampleRate');
    expect(indexContent).toContain('sessionReplaySampleRate');
    expect(indexContent).toContain('trackUserInteractions');
  });

  test('should generate search index', () => {
    const searchDir = path.join(distDir, 'pagefind');
    expect(fs.existsSync(searchDir)).toBe(true);

    // Check for search index files
    const searchFiles = fs.readdirSync(searchDir);
    expect(searchFiles.length).toBeGreaterThan(0);
    
    // Should have index files
    const hasIndexFile = searchFiles.some(file => file.includes('index'));
    expect(hasIndexFile).toBe(true);
  });

  test('should generate sitemap', () => {
    const sitemapPath = path.join(distDir, 'sitemap-index.xml');
    expect(fs.existsSync(sitemapPath)).toBe(true);

    const sitemapContent = fs.readFileSync(sitemapPath, 'utf-8');
    expect(sitemapContent).toContain('<?xml');
    expect(sitemapContent).toContain('sitemap');
    expect(sitemapContent).toContain('vibecode.github.io') || expect(sitemapContent).toContain('localhost');
  });

  test('should have CSS and JS assets', () => {
    const astroDir = path.join(distDir, '_astro');
    expect(fs.existsSync(astroDir)).toBe(true);

    const astroFiles = fs.readdirSync(astroDir);
    
    // Should have CSS files
    const cssFiles = astroFiles.filter(file => file.endsWith('.css'));
    expect(cssFiles.length).toBeGreaterThan(0);

    // Should have JS files
    const jsFiles = astroFiles.filter(file => file.endsWith('.js'));
    expect(jsFiles.length).toBeGreaterThan(0);

    console.log(`Found ${cssFiles.length} CSS files and ${jsFiles.length} JS files`);
  });

  test('should include all markdown files as pages', () => {
    // Test that key documentation pages exist
    const expectedPages = [
      'wiki-index/index.html',
      'datadog-local-development/index.html',
      'datadog-monitoring-configuration/index.html',
      'comprehensive-testing-guide/index.html',
      'kind-troubleshooting-guide/index.html'
    ];

    expectedPages.forEach(page => {
      const pagePath = path.join(distDir, page);
      expect(fs.existsSync(pagePath)).toBe(true);
      
      // Check that content exists
      const content = fs.readFileSync(pagePath, 'utf-8');
      expect(content.length).toBeGreaterThan(1000); // Should have substantial content
      expect(content).toContain('<h1'); // Should have headings
    });
  });

  test('should have working navigation', () => {
    const indexContent = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');
    
    // Should contain navigation elements
    expect(indexContent).toContain('nav');
    
    // Check for Starlight navigation structure
    expect(indexContent).toContain('starlight__sidebar');
    
    // Check for some expected navigation elements
    const hasWikiIndex = indexContent.includes('wiki-index') || indexContent.includes('Wiki Index');
    const hasDocumentation = indexContent.toLowerCase().includes('documentation') || indexContent.includes('docs');
    
    expect(hasWikiIndex || hasDocumentation).toBe(true);
  });

  test('should have proper meta tags and SEO', () => {
    const indexContent = fs.readFileSync(path.join(distDir, 'index.html'), 'utf-8');

    // Check for essential meta tags
    expect(indexContent).toContain('<meta name="description"');
    expect(indexContent).toContain('<meta name="viewport"');
    
    // Check for title
    expect(indexContent).toMatch(/<title>.*VibeCode.*<\/title>/);
    
    // Should have proper language
    expect(indexContent).toContain('lang="en"');
  });
});