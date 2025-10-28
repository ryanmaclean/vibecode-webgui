/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

describe('Astro Documentation Build Tests', () => {
  const docsDir = path.join(__dirname, '../../docs');
  const distDir = path.join(docsDir, 'dist');
  const astroConfigPath = path.join(docsDir, 'astro.config.mjs');

  // Derive site host and base path from astro config (fallbacks if missing)
  let siteHost = 'localhost';
  let basePath = '';
  try {
    const cfg = fs.readFileSync(astroConfigPath, 'utf-8');
    const mSite = cfg.match(/site:\s*'([^']+)'/);
    if (mSite && mSite[1]) {
      try { siteHost = new URL(mSite[1]).host; } catch {}
    }
    const mBase = cfg.match(/base:\s*'([^']+)'/);
    if (mBase && mBase[1]) basePath = mBase[1];
  } catch {}

  const baseSegment = basePath.replace(/^\//, '').replace(/\/$/, '');
  let distBaseDir = distDir;

  // Clean build before running tests and compute dist base dir dynamically
  beforeAll(async () => {
    // Remove existing dist directory
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true });
    }

    // Ensure docs dependencies are installed (only if missing)
    try {
      const astroModulePath = path.join(docsDir, 'node_modules', 'astro');
      const starlightModulePath = path.join(docsDir, 'node_modules', '@astrojs', 'starlight');
      const needsInstall = !fs.existsSync(astroModulePath) || !fs.existsSync(starlightModulePath);

      if (needsInstall) {
        const installProcess = spawn('npm', ['ci', '--no-audit', '--silent'], {
          cwd: docsDir,
          stdio: 'pipe',
          env: { ...process.env, CI: process.env.CI || '1' },
        });

        let iout = '';
        let ierr = '';
        installProcess.stdout.on('data', (d) => { iout += d.toString(); });
        installProcess.stderr.on('data', (d) => { ierr += d.toString(); });

        const installExit = await new Promise((resolve) => {
          installProcess.on('close', resolve);
        });

        if (installExit !== 0) {
          console.error('Docs dependency installation failed. stdout:', iout);
          console.error('Docs dependency installation failed. stderr:', ierr);
          throw new Error(`Docs dependency installation failed with exit code ${installExit}`);
        }
      }
    } catch (depErr) {
      console.error('Error ensuring docs dependencies are installed:', depErr);
      throw depErr;
    }

    // Run the docs build
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

    if (exitCode !== 0) {
      console.error('Build stdout:', stdout);
      console.error('Build stderr:', stderr);
      throw new Error(`Docs build failed with exit code ${exitCode}\n\n==== BEGIN BUILD STDOUT ====\n${stdout}\n==== END BUILD STDOUT ====\n\n==== BEGIN BUILD STDERR ====\n${stderr}\n==== END BUILD STDERR ====`);
    }

    // Determine the actual base directory for built files
    try {
      const rootIndex = path.join(distDir, 'index.html');
      const candidate = baseSegment ? path.join(distDir, baseSegment) : null;
      if (fs.existsSync(rootIndex)) {
        distBaseDir = distDir;
      } else if (candidate && fs.existsSync(path.join(candidate, 'index.html'))) {
        distBaseDir = candidate;
      } else {
        throw new Error('index.html not found in expected locations after build');
      }
    } catch (err) {
      console.error('Error determining dist base dir:', err);
      throw err;
    }
  }, 120000);

  // Build is executed in beforeAll; tests below assume dist is ready

  test('should generate all expected HTML pages', () => {
    expect(fs.existsSync(distBaseDir)).toBe(true);

    // Check for main files under base path
    expect(fs.existsSync(path.join(distBaseDir, 'index.html'))).toBe(true);
    const fourOhFourAt = fs.existsSync(path.join(distBaseDir, '404.html')) || fs.existsSync(path.join(distDir, '404.html'));
    expect(fourOhFourAt).toBe(true);

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

    walkDir(distBaseDir);
    
    // Should have generated many pages (at least 80+ based on our build output)
    expect(htmlFiles.length).toBeGreaterThan(80);
    console.log(`Generated ${htmlFiles.length} HTML files`);
  });

  test('should have proper page structure', () => {
    const indexPath = path.join(distBaseDir, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');

    // Check for essential elements
    expect(indexContent).toContain('<title>');
    expect(indexContent).toContain('<html');
    expect(indexContent).toContain('<head>');
    expect(indexContent).toMatch(/<body[^>]*>/);
    
    // Check for Starlight-specific elements (less brittle)
    const hasStarlightMarker = indexContent.includes('data-starlight') || indexContent.includes('starlight__sidebar');
    expect(hasStarlightMarker).toBe(true);
    
    // Check for our content
    expect(indexContent).toContain('VibeCode');
  });

  test('should include Datadog RUM integration', () => {
    const indexPath = path.join(distBaseDir, 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');

    // Check for Datadog RUM script
    expect(indexContent).toContain('datadog-rum.js');
    expect(indexContent).toContain('DD_RUM.init');
    expect(indexContent).toContain('sessionSampleRate');
    expect(indexContent).toContain('sessionReplaySampleRate');
    expect(indexContent).toContain('trackUserInteractions');
  });

  test('should generate search index', () => {
    const searchDir = path.join(distBaseDir, 'pagefind');
    expect(fs.existsSync(searchDir)).toBe(true);

    // Check for search index files
    const searchFiles = fs.readdirSync(searchDir);
    expect(searchFiles.length).toBeGreaterThan(0);
    
    // Should have index files
    const hasIndexFile = searchFiles.some(file => file.includes('index'));
    expect(hasIndexFile).toBe(true);
  });

  test('should generate sitemap', () => {
    const sitemapPath = path.join(distBaseDir, 'sitemap-index.xml');
    expect(fs.existsSync(sitemapPath)).toBe(true);

    const sitemapContent = fs.readFileSync(sitemapPath, 'utf-8');
    expect(sitemapContent).toContain('<?xml');
    expect(sitemapContent).toContain('sitemap');
    const hostOk = sitemapContent.includes(siteHost) || sitemapContent.includes('localhost');
    expect(hostOk).toBe(true);
  });

  test('should have CSS and JS assets', () => {
    const astroDir = path.join(distBaseDir, '_astro');
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
    // Test that key documentation pages exist (accept hyphen/underscore variants)
    const expectedGroups = [
      ['wiki-index/index.html', 'wiki_index/index.html', 'wiki/index.html'],
      ['datadog-local-development/index.html', 'datadog_local_development/index.html'],
      ['datadog-monitoring-configuration/index.html', 'datadog_monitoring_configuration/index.html', 'monitoring/overview/index.html'],
      ['comprehensive-testing-guide/index.html', 'comprehensive_testing_guide/index.html', 'comprehensive-testing/index.html'],
      ['kind-troubleshooting-guide/index.html', 'kind_troubleshooting_guide/index.html', 'kind-troubleshooting/index.html']
    ];

    expectedGroups.forEach(group => {
      const existing = group.find(rel => fs.existsSync(path.join(distBaseDir, rel)));
      expect(Boolean(existing)).toBe(true);
      const pagePath = path.join(distBaseDir, existing);
      const content = fs.readFileSync(pagePath, 'utf-8');
      expect(content.length).toBeGreaterThan(500); // Should have substantial content
      expect(content).toContain('<h1'); // Should have headings
    });
  });

  test('should have working navigation', () => {
    const indexContent = fs.readFileSync(path.join(distBaseDir, 'index.html'), 'utf-8');
    
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
    const indexContent = fs.readFileSync(path.join(distBaseDir, 'index.html'), 'utf-8');

    // Check for essential meta tags
    expect(indexContent).toContain('<meta name="description"');
    expect(indexContent).toContain('<meta name="viewport"');
    
    // Check for title
    expect(indexContent).toMatch(/<title>.*VibeCode.*<\/title>/);
    
    // Should have proper language
    expect(indexContent).toContain('lang="en"');
  });
});