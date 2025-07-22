/**
 * GitHub Pages Documentation Site Validation Tests
 * 
 * This test suite validates that the Astro v5 documentation site
 * is properly deployed and functioning on GitHub Pages.
 */

const fetch = require('node-fetch');

const BASE_URL = 'https://ryanmaclean.github.io/vibecode-webgui';

describe('GitHub Pages Documentation Site', () => {
  // Test site accessibility and basic functionality
  describe('Site Accessibility', () => {
    test('homepage should load successfully', async () => {
      const response = await fetch(BASE_URL);
      expect(response.status).toBe(200);
      
      const html = await response.text();
      expect(html).toContain('VibeCode Platform');
      expect(html).toContain('Astro v5.12.1');
      expect(html).toContain('Starlight v0.35.1');
    }, 10000);

    test('should have proper meta tags for SEO', async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();
      
      expect(html).toContain('<meta name="description"');
      expect(html).toContain('<meta property="og:title"');
      expect(html).toContain('<meta property="og:description"');
      expect(html).toContain('<meta name="twitter:card"');
    });

    test('should load with acceptable performance', async () => {
      const startTime = Date.now();
      const response = await fetch(BASE_URL);
      const loadTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(loadTime).toBeLessThan(2000); // Less than 2 seconds
    });
  });

  // Test navigation links
  describe('Navigation Links', () => {
    test('wiki index page should be accessible', async () => {
      const response = await fetch(`${BASE_URL}/wiki-index/`);
      expect(response.status).toBe(200);
    });

    test('quick start guide should be accessible', async () => {
      const response = await fetch(`${BASE_URL}/guides/quick-start/`);
      expect(response.status).toBe(200);
    });

    test('key documentation pages should exist', async () => {
      const pages = [
        '/ai-cli-tools/',
        '/authentication-summary/',
        '/azure-infrastructure/',
        '/datadog-compatibility/',
        '/docker-troubleshooting/',
        '/genai-integration/',
        '/kind-troubleshooting/',
        '/monitoring/overview/'
      ];

      for (const page of pages) {
        const response = await fetch(`${BASE_URL}${page}`);
        expect(response.status).toBe(200);
      }
    }, 15000);
  });

  // Test search functionality
  describe('Search Functionality', () => {
    test('pagefind search index should be available', async () => {
      const response = await fetch(`${BASE_URL}/pagefind/pagefind.js`);
      expect(response.status).toBe(200);
    });

    test('search metadata should exist', async () => {
      const response = await fetch(`${BASE_URL}/pagefind/pagefind-entry.json`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toHaveProperty('version');
      expect(data).toHaveProperty('languages');
    });
  });

  // Test site structure
  describe('Site Structure', () => {
    test('sitemap should be accessible', async () => {
      const response = await fetch(`${BASE_URL}/sitemap-index.xml`);
      expect(response.status).toBe(200);
      
      const xml = await response.text();
      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<sitemapindex');
    });

    test('robots.txt should exist', async () => {
      const response = await fetch(`${BASE_URL}/robots.txt`);
      expect(response.status).toBe(200);
    });

    test('should have at least 80 pages indexed', async () => {
      const sitemapResponse = await fetch(`${BASE_URL}/sitemap-index.xml`);
      const sitemapXml = await sitemapResponse.text();
      
      // Extract sitemap URL
      const sitemapMatch = sitemapXml.match(/<loc>(.*?)<\/loc>/);
      expect(sitemapMatch).toBeTruthy();
      
      const detailSitemapResponse = await fetch(sitemapMatch[1]);
      const detailXml = await detailSitemapResponse.text();
      
      const urlCount = (detailXml.match(/<url>/g) || []).length;
      expect(urlCount).toBeGreaterThanOrEqual(80);
    });
  });

  // Test mobile responsiveness and accessibility
  describe('Mobile & Accessibility', () => {
    test('should include viewport meta tag', async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();
      
      expect(html).toContain('<meta name="viewport"');
      expect(html).toContain('width=device-width');
    });

    test('should have theme switching capability', async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();
      
      expect(html).toContain('data-theme');
    });

    test('should have proper heading structure', async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();
      
      expect(html).toContain('<h1');
      expect(html).toMatch(/<h[1-6][^>]*>/);
    });
  });

  // Test monitoring integration
  describe('Monitoring Integration', () => {
    test('should include Datadog RUM script', async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();
      
      expect(html).toContain('datadoghq-browser-agent.com');
      expect(html).toContain('DD_RUM');
    });

    test('should have proper service identification', async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();
      
      expect(html).toContain('service: \'vibecode-docs\'');
      expect(html).toContain('env: \'production\'');
    });
  });

  // Test Astro v5 specific features
  describe('Astro v5 Features', () => {
    test('should use Astro v5.12.1 or higher', async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();
      
      const astroVersionMatch = html.match(/Astro v(\d+\.\d+\.\d+)/);
      expect(astroVersionMatch).toBeTruthy();
      
      const [major, minor, patch] = astroVersionMatch[1].split('.').map(Number);
      expect(major).toBeGreaterThanOrEqual(5);
      if (major === 5) {
        expect(minor).toBeGreaterThanOrEqual(12);
      }
    });

    test('should use Starlight v0.35.1 or higher', async () => {
      const response = await fetch(BASE_URL);
      const html = await response.text();
      
      const starlightVersionMatch = html.match(/Starlight v(\d+\.\d+\.\d+)/);
      expect(starlightVersionMatch).toBeTruthy();
      
      const [major, minor, patch] = starlightVersionMatch[1].split('.').map(Number);
      expect(major).toEqual(0);
      expect(minor).toBeGreaterThanOrEqual(35);
    });
  });
});

// Performance benchmarks
describe('Performance Benchmarks', () => {
  test('average page load should be under 1 second', async () => {
    const pages = [
      '',
      '/wiki-index/',
      '/guides/quick-start/',
      '/ai-cli-tools/',
      '/authentication-summary/'
    ];

    const loadTimes = [];

    for (const page of pages) {
      const startTime = Date.now();
      const response = await fetch(`${BASE_URL}${page}`);
      const loadTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      loadTimes.push(loadTime);
    }

    const averageLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;
    expect(averageLoadTime).toBeLessThan(1000);
  }, 10000);

  test('search index should be reasonably sized', async () => {
    const response = await fetch(`${BASE_URL}/pagefind/pagefind.js`);
    const searchScript = await response.text();
    
    // Should be substantial but not huge (reasonable for 80+ pages)
    expect(searchScript.length).toBeGreaterThan(1000);
    expect(searchScript.length).toBeLessThan(500000); // Less than 500KB
  });
});