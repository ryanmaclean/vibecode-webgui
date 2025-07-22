const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

describe('Astro Documentation Functionality Tests', () => {
  const docsDir = path.join(__dirname, '../../docs');
  const distDir = path.join(docsDir, 'dist');
  let devServer;
  let serverUrl = 'http://localhost:4322'; // Use different port to avoid conflicts

  // Start dev server before tests
  beforeAll(async () => {
    console.log('Starting Astro dev server...');
    
    // Kill any existing process on the port
    try {
      await new Promise((resolve) => {
        const killProcess = spawn('pkill', ['-f', 'astro.*dev'], { stdio: 'ignore' });
        killProcess.on('close', () => resolve());
        setTimeout(resolve, 1000); // Timeout after 1 second
      });
    } catch (e) {
      // Ignore errors
    }

    // Start dev server
    devServer = spawn('npm', ['run', 'dev', '--', '--port', '4322'], {
      cwd: docsDir,
      stdio: 'pipe',
      detached: false
    });

    let serverStarted = false;
    devServer.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Local') && output.includes('4322')) {
        serverStarted = true;
      }
    });

    devServer.stderr.on('data', (data) => {
      console.error('Dev server error:', data.toString());
    });

    // Wait for server to start
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Dev server failed to start within 30 seconds'));
      }, 30000);

      const checkServer = setInterval(async () => {
        try {
          const response = await fetch(serverUrl);
          if (response.status < 500) {
            clearTimeout(timeout);
            clearInterval(checkServer);
            console.log('Dev server started successfully');
            resolve();
          }
        } catch (e) {
          // Server not ready yet
        }
      }, 1000);
    });
  }, 40000);

  // Kill dev server after tests
  afterAll(async () => {
    if (devServer) {
      console.log('Stopping dev server...');
      devServer.kill('SIGTERM');
      
      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Force kill if still running
      try {
        devServer.kill('SIGKILL');
      } catch (e) {
        // Process might already be dead
      }
    }

    // Clean up any remaining processes
    try {
      spawn('pkill', ['-f', 'astro.*dev'], { stdio: 'ignore' });
    } catch (e) {
      // Ignore errors
    }
  }, 10000);

  test('should serve homepage successfully', async () => {
    const response = await fetch(serverUrl);
    
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    
    const html = await response.text();
    expect(html).toContain('VibeCode');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  test('should serve wiki index page', async () => {
    const response = await fetch(`${serverUrl}/wiki-index/`);
    
    expect(response.status).toBe(200);
    
    const html = await response.text();
    expect(html).toContain('VibeCode Documentation Wiki');
    expect(html).toContain('Quick Navigation');
  });

  test('should serve documentation pages', async () => {
    const testPages = [
      '/datadog-local-development/',
      '/comprehensive-testing-guide/',
      '/kind-troubleshooting/',
      '/ai-cli-tools/'
    ];

    for (const page of testPages) {
      const response = await fetch(`${serverUrl}${page}`);
      expect(response.status).toBe(200);
      
      const html = await response.text();
      expect(html.length).toBeGreaterThan(1000); // Should have substantial content
      expect(html).toContain('<h1'); // Should have main heading
    }
  });

  test('should have working search functionality', async () => {
    const response = await fetch(`${serverUrl}/pagefind/pagefind.js`);
    expect(response.status).toBe(200);
    
    const js = await response.text();
    expect(js).toContain('pagefind'); // Should be search script
  });

  test('should serve assets correctly', async () => {
    // Test CSS
    const cssResponse = await fetch(`${serverUrl}/_astro/`);
    // Should get directory listing or specific asset
    expect(cssResponse.status).toBeLessThan(500);
    
    // Test that static assets work
    const response = await fetch(serverUrl);
    const html = await response.text();
    
    // Find CSS links
    const cssMatch = html.match(/href="([^"]*\.css)"/);
    if (cssMatch) {
      const cssUrl = `${serverUrl}${cssMatch[1]}`;
      const cssResponse = await fetch(cssUrl);
      expect(cssResponse.status).toBe(200);
      expect(cssResponse.headers.get('content-type')).toContain('text/css');
    }
  });

  test('should handle 404 pages gracefully', async () => {
    const response = await fetch(`${serverUrl}/nonexistent-page/`);
    expect(response.status).toBe(404);
    
    const html = await response.text();
    expect(html).toContain('404'); // Should show 404 page
  });

  test('should have proper navigation between pages', async () => {
    const response = await fetch(serverUrl);
    const html = await response.text();
    
    // Should have Starlight navigation structure
    const hasNavigation = html.includes('starlight__sidebar') || html.includes('navigation') || html.includes('nav');
    expect(hasNavigation).toBe(true);
  });

  test('should include monitoring scripts in pages', async () => {
    const response = await fetch(`${serverUrl}/wiki-index/`);
    const html = await response.text();
    
    // Check for Datadog RUM
    expect(html).toContain('datadog-rum.js');
    expect(html).toContain('DD_RUM');
  });

  test('should have responsive design', async () => {
    const response = await fetch(serverUrl);
    const html = await response.text();
    
    // Check for viewport meta tag
    expect(html).toContain('name="viewport"');
    expect(html).toContain('width=device-width');
  });
});