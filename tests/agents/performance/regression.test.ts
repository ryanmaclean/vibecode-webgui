/**
 * Performance Regression Tests for Agent System
 *
 * Tracks and validates performance metrics over time
 */

import { test, expect } from '@playwright/test';
import { Agent, createAgent } from '@/lib/agent-framework';
import type { Page } from '@playwright/test';

// Performance baselines (in milliseconds)
const PERFORMANCE_BASELINES = {
  agentCreation: 100,
  simpleMessage: 500,
  toolExecution: 1000,
  pageLoad: 3000,
  firstPaint: 1000,
  timeToInteractive: 2000,
  memoryLimit: 100 * 1024 * 1024, // 100MB
};

describe('Agent Performance Regression Tests', () => {
  describe('Agent API Performance', () => {
    it('should create agent within performance budget', async () => {
      const startTime = performance.now();

      const agent = createAgent({
        model: 'gpt-4o-mini',
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(agent).toBeDefined();
      expect(duration).toBeLessThan(PERFORMANCE_BASELINES.agentCreation);
    });

    it('should process simple messages within performance budget', async () => {
      const agent = createAgent({ model: 'gpt-4o-mini' });

      const startTime = performance.now();

      await agent.processMessage('Hello');

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_BASELINES.simpleMessage);
    }, 10000);

    it('should execute tools within performance budget', async () => {
      const tool = {
        name: 'calculator',
        description: 'Performs calculations',
        parameters: {
          type: 'object',
          properties: {
            expression: { type: 'string' },
          },
        },
        execute: async (params: any) => {
          return { result: eval(params.expression) };
        },
      };

      const agent = createAgent({
        tools: [tool],
        model: 'gpt-4o-mini',
      });

      const startTime = performance.now();

      await agent.processMessage('Calculate 2 + 2');

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(PERFORMANCE_BASELINES.toolExecution);
    }, 15000);

    it('should handle concurrent requests efficiently', async () => {
      const agent = createAgent({ model: 'gpt-4o-mini' });

      const startTime = performance.now();

      const promises = Array.from({ length: 5 }, (_, i) =>
        agent.processMessage(`Message ${i}`)
      );

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should be faster than sequential execution
      expect(duration).toBeLessThan(PERFORMANCE_BASELINES.simpleMessage * 5);
    }, 30000);

    it('should maintain memory within limits', async () => {
      const agent = createAgent({
        model: 'gpt-4o-mini',
        memorySize: 10,
      });

      const initialMemory = process.memoryUsage().heapUsed;

      // Process many messages
      for (let i = 0; i < 20; i++) {
        await agent.processMessage(`Message ${i}`);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(memoryIncrease).toBeLessThan(PERFORMANCE_BASELINES.memoryLimit);
    }, 60000);
  });

  describe('Token Usage Optimization', () => {
    it('should minimize token usage for simple queries', async () => {
      const agent = createAgent({ model: 'gpt-4o-mini' });

      const response = await agent.processMessage('Say hi');

      if (response.metadata.usage) {
        expect(response.metadata.usage.promptTokens).toBeLessThan(100);
        expect(response.metadata.usage.completionTokens).toBeLessThan(50);
      }
    }, 10000);

    it('should optimize token usage with context management', async () => {
      const agent = createAgent({
        model: 'gpt-4o-mini',
        memorySize: 5,
      });

      const usages: number[] = [];

      for (let i = 0; i < 10; i++) {
        const response = await agent.processMessage(`Message ${i}`);
        if (response.metadata.usage) {
          usages.push(response.metadata.usage.promptTokens);
        }
      }

      // Prompt tokens should stabilize due to memory management
      if (usages.length > 5) {
        const recentAvg = usages.slice(-3).reduce((a, b) => a + b) / 3;
        expect(recentAvg).toBeLessThan(500);
      }
    }, 60000);
  });
});

test.describe('UI Performance Regression Tests', () => {
  let page: Page;

  test.beforeEach(async ({ page: p }) => {
    page = p;
  });

  test.describe('Page Load Performance', () => {
    test('should load agent list page within budget', async () => {
      const startTime = Date.now();

      await page.goto('/agents');
      await page.waitForSelector('[data-testid="agent-list"]');

      const endTime = Date.now();
      const loadTime = endTime - startTime;

      expect(loadTime).toBeLessThan(PERFORMANCE_BASELINES.pageLoad);
    });

    test('should achieve first paint within budget', async () => {
      await page.goto('/agents');

      const firstPaint = await page.evaluate(() => {
        const perfData = performance.getEntriesByType('paint');
        const fp = perfData.find(entry => entry.name === 'first-paint');
        return fp?.startTime || 0;
      });

      expect(firstPaint).toBeLessThan(PERFORMANCE_BASELINES.firstPaint);
    });

    test('should achieve first contentful paint within budget', async () => {
      await page.goto('/agents');

      const fcp = await page.evaluate(() => {
        const perfData = performance.getEntriesByType('paint');
        const fcpEntry = perfData.find(entry => entry.name === 'first-contentful-paint');
        return fcpEntry?.startTime || 0;
      });

      expect(fcp).toBeLessThan(PERFORMANCE_BASELINES.firstPaint * 1.5);
    });

    test('should become interactive within budget', async () => {
      await page.goto('/agents');

      const tti = await page.evaluate(() => {
        return performance.timing.domInteractive - performance.timing.navigationStart;
      });

      expect(tti).toBeLessThan(PERFORMANCE_BASELINES.timeToInteractive);
    });
  });

  test.describe('Runtime Performance', () => {
    test('should handle rapid user interactions smoothly', async () => {
      await page.goto('/agents');

      const startTime = Date.now();

      // Simulate rapid clicks
      for (let i = 0; i < 10; i++) {
        const button = page.locator('button').first();
        if (await button.isVisible()) {
          await button.click();
          await page.waitForTimeout(50);
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should remain responsive
      expect(duration).toBeLessThan(2000);
    });

    test('should scroll large lists smoothly', async () => {
      await page.goto('/agents');

      const startTime = Date.now();

      // Scroll multiple times
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => {
          window.scrollBy(0, 500);
        });
        await page.waitForTimeout(50);
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should scroll without lag
      expect(duration).toBeLessThan(1500);
    });

    test('should update UI efficiently', async () => {
      await page.goto('/agents');

      await page.click('button:has-text("Create Agent")');

      const startTime = Date.now();

      // Fill form rapidly
      await page.selectOption('select[name="agent_type"]', 'aider');
      await page.selectOption('select[name="model"]', 'gpt-4o-mini');
      await page.fill('textarea[name="task"]', 'Test task');

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);
    });
  });

  test.describe('Bundle Size', () => {
    test('should have acceptable JavaScript bundle size', async () => {
      await page.goto('/agents');

      const resourceSizes = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        return resources
          .filter((r: any) => r.name.endsWith('.js'))
          .map((r: any) => ({
            name: r.name,
            size: r.transferSize,
          }));
      });

      const totalSize = resourceSizes.reduce((sum: number, r: any) => sum + r.size, 0);

      // Total JS should be under 500KB
      expect(totalSize).toBeLessThan(500 * 1024);
    });

    test('should have acceptable CSS bundle size', async () => {
      await page.goto('/agents');

      const resourceSizes = await page.evaluate(() => {
        const resources = performance.getEntriesByType('resource');
        return resources
          .filter((r: any) => r.name.endsWith('.css'))
          .map((r: any) => ({
            name: r.name,
            size: r.transferSize,
          }));
      });

      const totalSize = resourceSizes.reduce((sum: number, r: any) => sum + r.size, 0);

      // Total CSS should be under 100KB
      expect(totalSize).toBeLessThan(100 * 1024);
    });
  });

  test.describe('Network Performance', () => {
    test('should make minimal API requests', async () => {
      const requests: string[] = [];

      page.on('request', request => {
        if (request.url().includes('/api/')) {
          requests.push(request.url());
        }
      });

      await page.goto('/agents');
      await page.waitForTimeout(2000);

      // Should not make excessive API calls
      expect(requests.length).toBeLessThan(10);
    });

    test('should cache static resources', async () => {
      await page.goto('/agents');

      const firstLoadTime = Date.now();
      await page.waitForLoadState('networkidle');
      const firstLoad = Date.now() - firstLoadTime;

      // Reload page
      await page.reload();

      const secondLoadTime = Date.now();
      await page.waitForLoadState('networkidle');
      const secondLoad = Date.now() - secondLoadTime;

      // Second load should be faster due to caching
      expect(secondLoad).toBeLessThan(firstLoad);
    });
  });

  test.describe('Memory Performance', () => {
    test('should not leak memory on page navigation', async () => {
      const initialMetrics = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });

      // Navigate multiple times
      for (let i = 0; i < 5; i++) {
        await page.goto('/agents');
        await page.goto('/');
      }

      await page.goto('/agents');

      const finalMetrics = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });

      if (initialMetrics > 0 && finalMetrics > 0) {
        const memoryIncrease = finalMetrics - initialMetrics;
        const percentIncrease = (memoryIncrease / initialMetrics) * 100;

        // Memory should not grow excessively (< 50% increase)
        expect(percentIncrease).toBeLessThan(50);
      }
    });
  });

  test.describe('Rendering Performance', () => {
    test('should render agent cards efficiently', async () => {
      await page.goto('/agents');

      const startTime = Date.now();

      await page.waitForSelector('[data-testid="agent-card"]');

      const endTime = Date.now();
      const renderTime = endTime - startTime;

      expect(renderTime).toBeLessThan(1000);
    });

    test('should handle large lists with virtualization', async () => {
      await page.goto('/agents');

      const cardCount = await page.locator('[data-testid="agent-card"]').count();

      // If many agents, should use virtualization
      if (cardCount > 20) {
        const visibleCards = await page.evaluate(() => {
          const cards = document.querySelectorAll('[data-testid="agent-card"]');
          let visible = 0;
          cards.forEach(card => {
            const rect = card.getBoundingClientRect();
            if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
              visible++;
            }
          });
          return visible;
        });

        // Should render only visible items
        expect(visibleCards).toBeLessThan(cardCount);
      }
    });
  });
});
