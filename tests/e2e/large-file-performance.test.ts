/**
 * Large File Performance E2E Tests
 * Verifies that large file optimizations work correctly in the browser
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

// Test configuration
const TEST_TIMEOUT = 120000; // 2 minutes for large file tests
const PERFORMANCE_THRESHOLDS = {
  LOAD_TIME_MS: 2000, // 2 seconds max load time
  MEMORY_MB: 4096, // 4GB max memory usage
  UI_FREEZE_MS: 100, // Max time for UI to be unresponsive
};

/**
 * Helper to generate a large test file with the specified number of lines
 */
function generateLargeFile(lines: number, language: 'typescript' | 'javascript' | 'text' = 'typescript'): string {
  const content: string[] = [];

  if (language === 'typescript' || language === 'javascript') {
    content.push('/**');
    content.push(' * Large test file for performance testing');
    content.push(` * Generated with ${lines} lines`);
    content.push(' */\n');

    // Generate realistic code
    for (let i = 0; i < lines; i++) {
      const lineType = i % 10;

      switch (lineType) {
        case 0:
          content.push(`// Line ${i}: Comment`);
          break;
        case 1:
          content.push(`export function function${i}(param: string): string {`);
          break;
        case 2:
          content.push(`  const variable${i} = 'value${i}';`);
          break;
        case 3:
          content.push(`  if (variable${i}.length > 0) {`);
          break;
        case 4:
          content.push(`    console.log('Processing line ${i}');`);
          break;
        case 5:
          content.push(`    return variable${i}.toUpperCase();`);
          break;
        case 6:
          content.push('  }');
          break;
        case 7:
          content.push(`  return 'default${i}';`);
          break;
        case 8:
          content.push('}\n');
          break;
        default:
          content.push('');
      }
    }
  } else {
    // Plain text
    for (let i = 0; i < lines; i++) {
      content.push(`Line ${i}: This is test content for performance testing`);
    }
  }

  return content.join('\n');
}

/**
 * Helper to measure memory usage
 */
async function measureMemory(page: Page): Promise<number> {
  const memoryInfo = await page.evaluate(() => {
    if ('memory' in performance) {
      const perfMemory = (performance as any).memory;
      return {
        usedJSHeapSize: perfMemory.usedJSHeapSize,
        totalJSHeapSize: perfMemory.totalJSHeapSize,
        jsHeapSizeLimit: perfMemory.jsHeapSizeLimit,
      };
    }
    return null;
  });

  if (memoryInfo) {
    // Convert bytes to MB
    return Math.round(memoryInfo.usedJSHeapSize / 1024 / 1024);
  }

  return 0;
}

/**
 * Helper to check UI responsiveness
 */
async function checkUIResponsiveness(page: Page): Promise<boolean> {
  const startTime = Date.now();

  try {
    // Try to interact with the page
    await page.evaluate(() => {
      // Simple DOM query that should be fast
      document.querySelector('body');
    });

    const elapsed = Date.now() - startTime;
    return elapsed < PERFORMANCE_THRESHOLDS.UI_FREEZE_MS;
  } catch (error) {
    console.error('UI responsiveness check failed:', error);
    return false;
  }
}

/**
 * Helper to wait for Monaco editor to be ready
 */
async function waitForMonacoEditor(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      // Check if Monaco editor is loaded and ready
      return (window as any).monaco !== undefined;
    },
    { timeout: 30000 }
  );
}

test.describe('Large File Performance', () => {
  test.setTimeout(TEST_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    // Set larger viewport for editor testing
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('should open a file with 50,000+ lines without lag (within 2 seconds)', async ({ page }) => {
    // Generate test file
    const testFile = generateLargeFile(50000, 'typescript');
    const testFilePath = path.join(__dirname, '..', '..', 'fixtures', 'large-test-file.ts');

    // Ensure fixtures directory exists
    const fixturesDir = path.dirname(testFilePath);
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }

    fs.writeFileSync(testFilePath, testFile);

    // Navigate to editor
    await page.goto('/editor');

    // Wait for Monaco editor to be ready
    await waitForMonacoEditor(page);

    // Measure load time
    const startTime = Date.now();

    // Simulate opening the large file
    // This depends on your editor implementation - adjust as needed
    await page.evaluate((content) => {
      const monaco = (window as any).monaco;
      if (monaco && monaco.editor) {
        const editor = monaco.editor.getEditors()[0];
        if (editor) {
          editor.setValue(content);
        }
      }
    }, testFile);

    // Wait for editor to finish rendering
    await page.waitForFunction(
      () => {
        const monaco = (window as any).monaco;
        if (monaco && monaco.editor) {
          const editor = monaco.editor.getEditors()[0];
          return editor && editor.getValue().length > 0;
        }
        return false;
      },
      { timeout: 30000 }
    );

    const loadTime = Date.now() - startTime;

    console.log(`Large file load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.LOAD_TIME_MS);

    // Verify file is actually loaded
    const editorContent = await page.evaluate(() => {
      const monaco = (window as any).monaco;
      const editor = monaco.editor.getEditors()[0];
      return editor ? editor.getValue().length : 0;
    });

    expect(editorContent).toBeGreaterThan(50000); // Should have content

    // Cleanup
    fs.unlinkSync(testFilePath);
  });

  test('should keep scrolling smooth in large files', async ({ page }) => {
    // Generate test file with 50,000 lines
    const testFile = generateLargeFile(50000, 'typescript');

    await page.goto('/editor');
    await waitForMonacoEditor(page);

    // Load the large file
    await page.evaluate((content) => {
      const monaco = (window as any).monaco;
      const editor = monaco.editor.getEditors()[0];
      if (editor) {
        editor.setValue(content);
      }
    }, testFile);

    // Wait for initial render
    await page.waitForTimeout(1000);

    // Measure scroll performance
    const scrollMetrics: number[] = [];

    for (let i = 0; i < 10; i++) {
      const startTime = Date.now();

      // Scroll to different positions
      await page.evaluate((targetLine) => {
        const monaco = (window as any).monaco;
        const editor = monaco.editor.getEditors()[0];
        if (editor) {
          editor.revealLineInCenter(targetLine);
        }
      }, (i + 1) * 5000);

      await page.waitForTimeout(100);

      const scrollTime = Date.now() - startTime;
      scrollMetrics.push(scrollTime);

      // Check UI remains responsive during scroll
      const responsive = await checkUIResponsiveness(page);
      expect(responsive).toBe(true);
    }

    const avgScrollTime = scrollMetrics.reduce((a, b) => a + b, 0) / scrollMetrics.length;
    console.log(`Average scroll time: ${avgScrollTime}ms`);

    // Scrolling should be smooth - under 200ms per scroll
    expect(avgScrollTime).toBeLessThan(200);

    // No scroll should take more than 500ms
    const maxScrollTime = Math.max(...scrollMetrics);
    expect(maxScrollTime).toBeLessThan(500);
  });

  test('should complete search in large files in under 2 seconds', async ({ page }) => {
    // Generate test file with 50,000 lines
    const testFile = generateLargeFile(50000, 'typescript');

    await page.goto('/editor');
    await waitForMonacoEditor(page);

    // Load the large file
    await page.evaluate((content) => {
      const monaco = (window as any).monaco;
      const editor = monaco.editor.getEditors()[0];
      if (editor) {
        editor.setValue(content);
      }
    }, testFile);

    // Wait for initial render
    await page.waitForTimeout(1000);

    // Test search performance
    const searchTerms = ['function', 'variable', 'return', 'console'];

    for (const searchTerm of searchTerms) {
      const startTime = Date.now();

      // Trigger search using Monaco's find command
      await page.evaluate((term) => {
        const monaco = (window as any).monaco;
        const editor = monaco.editor.getEditors()[0];
        if (editor) {
          // Open find widget and search
          editor.trigger('test', 'actions.find', {});

          // Set search value
          const findController = (editor as any)._standaloneKeybindingService;
          if (findController) {
            // Directly call the find method
            editor.getModel()?.findMatches(term, true, false, false, null, true);
          }
        }
      }, searchTerm);

      // Wait for search to complete
      await page.waitForTimeout(100);

      const searchTime = Date.now() - startTime;
      console.log(`Search for "${searchTerm}" completed in ${searchTime}ms`);

      // Search must complete in under 2 seconds
      expect(searchTime).toBeLessThan(2000);

      // UI should remain responsive during search
      const responsive = await checkUIResponsiveness(page);
      expect(responsive).toBe(true);
    }
  });

  test('should maintain UI responsiveness during AI operations', async ({ page }) => {
    // Generate test file
    const testFile = generateLargeFile(20000, 'typescript');

    await page.goto('/editor');
    await waitForMonacoEditor(page);

    // Load file
    await page.evaluate((content) => {
      const monaco = (window as any).monaco;
      const editor = monaco.editor.getEditors()[0];
      if (editor) {
        editor.setValue(content);
      }
    }, testFile);

    // Check UI responsiveness before AI operation
    const responsiveBefore = await checkUIResponsiveness(page);
    expect(responsiveBefore).toBe(true);

    // Trigger AI operation (adjust based on your UI)
    // This is a placeholder - update based on your actual AI trigger mechanism
    const aiTriggerExists = await page.locator('[data-testid="ai-trigger"], [aria-label*="AI"], button:has-text("AI")').first().isVisible().catch(() => false);

    if (aiTriggerExists) {
      await page.locator('[data-testid="ai-trigger"], [aria-label*="AI"], button:has-text("AI")').first().click();

      // Check UI remains responsive during operation
      await page.waitForTimeout(1000); // Wait a bit for operation to start

      const responsiveDuring = await checkUIResponsiveness(page);
      expect(responsiveDuring).toBe(true);

      // Check after operation
      await page.waitForTimeout(2000);
      const responsiveAfter = await checkUIResponsiveness(page);
      expect(responsiveAfter).toBe(true);
    } else {
      console.log('AI trigger not found - skipping AI operation test');
      test.skip();
    }
  });

  test('should keep memory usage under 4GB', async ({ page }) => {
    // Generate multiple large files to stress test memory
    const testFiles = [
      generateLargeFile(30000, 'typescript'),
      generateLargeFile(25000, 'javascript'),
    ];

    await page.goto('/editor');
    await waitForMonacoEditor(page);

    // Measure baseline memory
    const baselineMemory = await measureMemory(page);
    console.log(`Baseline memory: ${baselineMemory}MB`);

    // Load files sequentially
    for (let i = 0; i < testFiles.length; i++) {
      await page.evaluate((content) => {
        const monaco = (window as any).monaco;
        const editor = monaco.editor.getEditors()[0];
        if (editor) {
          editor.setValue(content);
        }
      }, testFiles[i]);

      await page.waitForTimeout(1000);

      const currentMemory = await measureMemory(page);
      console.log(`Memory after file ${i + 1}: ${currentMemory}MB`);

      expect(currentMemory).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_MB);
    }

    // Final memory check
    const finalMemory = await measureMemory(page);
    console.log(`Final memory: ${finalMemory}MB`);
    expect(finalMemory).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_MB);
  });

  test('should handle file size categories correctly', async ({ page }) => {
    const testCases = [
      { lines: 1000, expectedCategory: 'small' },
      { lines: 7000, expectedCategory: 'medium' },
      { lines: 15000, expectedCategory: 'large' },
      { lines: 30000, expectedCategory: 'very-large' },
      { lines: 55000, expectedCategory: 'extreme' },
    ];

    await page.goto('/editor');
    await waitForMonacoEditor(page);

    for (const testCase of testCases) {
      const testFile = generateLargeFile(testCase.lines, 'typescript');

      await page.evaluate((content) => {
        const monaco = (window as any).monaco;
        const editor = monaco.editor.getEditors()[0];
        if (editor) {
          editor.setValue(content);
        }
      }, testFile);

      await page.waitForTimeout(500);

      // Check if status bar shows correct category
      const statusBarExists = await page.locator('[data-testid="editor-status"], .status-bar, .editor-status').first().isVisible().catch(() => false);

      if (statusBarExists) {
        const statusText = await page.locator('[data-testid="editor-status"], .status-bar, .editor-status').first().textContent();
        console.log(`File with ${testCase.lines} lines - Status: ${statusText}`);

        // The status should indicate the file category
        // Adjust this based on your actual UI implementation
        if (statusText) {
          expect(statusText.toLowerCase()).toContain(testCase.expectedCategory);
        }
      }

      // Verify optimizations are applied
      const editorOptions = await page.evaluate(() => {
        const monaco = (window as any).monaco;
        const editor = monaco.editor.getEditors()[0];
        if (editor) {
          return {
            minimap: editor.getOption(monaco.editor.EditorOption.minimap),
            codeLens: editor.getOption(monaco.editor.EditorOption.codeLens),
          };
        }
        return null;
      });

      if (editorOptions) {
        // For large files, minimap should be disabled
        if (testCase.lines > 5000) {
          expect(editorOptions.minimap.enabled).toBe(false);
        }
      }
    }
  });

  test('should not crash during extended editing session', async ({ page }) => {
    // Shorter version for automated testing - real test would be 30+ minutes
    const testDuration = 30000; // 30 seconds for automated testing
    const testFile = generateLargeFile(20000, 'typescript');

    await page.goto('/editor');
    await waitForMonacoEditor(page);

    // Load file
    await page.evaluate((content) => {
      const monaco = (window as any).monaco;
      const editor = monaco.editor.getEditors()[0];
      if (editor) {
        editor.setValue(content);
      }
    }, testFile);

    const startTime = Date.now();
    let iterations = 0;

    // Simulate editing operations
    while (Date.now() - startTime < testDuration) {
      iterations++;

      // Perform various editing operations
      await page.evaluate((iter) => {
        const monaco = (window as any).monaco;
        const editor = monaco.editor.getEditors()[0];
        if (editor) {
          // Insert text
          const position = editor.getPosition();
          editor.executeEdits('test', [{
            range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
            text: `// Edit ${iter}\n`,
          }]);

          // Move cursor
          editor.setPosition({ lineNumber: Math.max(1, position.lineNumber - 10), column: 1 });

          // Trigger some editor features
          editor.trigger('test', 'editor.action.formatDocument', {});
        }
      }, iterations);

      // Check UI responsiveness
      const responsive = await checkUIResponsiveness(page);
      expect(responsive).toBe(true);

      // Check memory periodically
      if (iterations % 5 === 0) {
        const memory = await measureMemory(page);
        console.log(`Iteration ${iterations}, Memory: ${memory}MB`);
        expect(memory).toBeLessThan(PERFORMANCE_THRESHOLDS.MEMORY_MB);
      }

      await page.waitForTimeout(1000);
    }

    console.log(`Completed ${iterations} editing iterations without crash`);
    expect(iterations).toBeGreaterThan(10); // Should have performed multiple iterations
  });

  test('should detect and report memory leaks', async ({ page }) => {
    await page.goto('/editor');
    await waitForMonacoEditor(page);

    const testFile = generateLargeFile(15000, 'typescript');

    // Measure memory before operations
    const memoryBefore = await measureMemory(page);
    console.log(`Memory before: ${memoryBefore}MB`);

    // Perform operations that could cause leaks
    for (let i = 0; i < 5; i++) {
      await page.evaluate((content) => {
        const monaco = (window as any).monaco;
        const editor = monaco.editor.getEditors()[0];
        if (editor) {
          editor.setValue(content);
          // Trigger some operations
          editor.trigger('test', 'editor.action.selectAll', {});
          editor.trigger('test', 'editor.action.formatDocument', {});
        }
      }, testFile);

      await page.waitForTimeout(500);
    }

    // Force garbage collection if available
    await page.evaluate(() => {
      if ((window as any).gc) {
        (window as any).gc();
      }
    });

    await page.waitForTimeout(2000);

    // Measure memory after operations
    const memoryAfter = await measureMemory(page);
    console.log(`Memory after: ${memoryAfter}MB`);

    // Memory shouldn't grow excessively (allow some growth for legitimate caching)
    const memoryGrowth = memoryAfter - memoryBefore;
    console.log(`Memory growth: ${memoryGrowth}MB`);

    // Allow up to 500MB growth (adjust based on your needs)
    expect(memoryGrowth).toBeLessThan(500);
  });

  test('should not leak memory when switching between files', async ({ page }) => {
    await page.goto('/editor');
    await waitForMonacoEditor(page);

    // Generate different test files
    const files = [
      generateLargeFile(10000, 'typescript'),
      generateLargeFile(12000, 'javascript'),
      generateLargeFile(8000, 'typescript'),
    ];

    // Measure baseline memory
    const baselineMemory = await measureMemory(page);
    console.log(`Baseline memory: ${baselineMemory}MB`);

    const memorySnapshots: number[] = [baselineMemory];

    // Switch between files multiple times to detect memory leaks
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const file of files) {
        await page.evaluate((content) => {
          const monaco = (window as any).monaco;
          const editor = monaco.editor.getEditors()[0];
          if (editor) {
            // Clear previous content
            editor.setValue('');
            // Set new content
            editor.setValue(content);
          }
        }, file);

        await page.waitForTimeout(300);

        // Measure memory after each file switch
        const currentMemory = await measureMemory(page);
        memorySnapshots.push(currentMemory);
        console.log(`Cycle ${cycle + 1}, Memory: ${currentMemory}MB`);
      }

      // Force garbage collection between cycles
      await page.evaluate(() => {
        if ((window as any).gc) {
          (window as any).gc();
        }
      });

      await page.waitForTimeout(1000);
    }

    // Check memory after all cycles
    const finalMemory = await measureMemory(page);
    const totalGrowth = finalMemory - baselineMemory;

    console.log(`Total memory growth after file switching: ${totalGrowth}MB`);

    // Memory should not grow excessively (allow 300MB for caching)
    expect(totalGrowth).toBeLessThan(300);

    // Check for consistent memory leak pattern
    // If memory keeps growing linearly, it indicates a leak
    const lastThreeAvg = memorySnapshots.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const firstThreeAvg = memorySnapshots.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const avgGrowth = lastThreeAvg - firstThreeAvg;

    console.log(`Average memory growth trend: ${avgGrowth}MB`);
    expect(avgGrowth).toBeLessThan(250);
  });

  test('should not leak memory from event listeners', async ({ page }) => {
    await page.goto('/editor');
    await waitForMonacoEditor(page);

    const testFile = generateLargeFile(10000, 'typescript');

    // Load initial file
    await page.evaluate((content) => {
      const monaco = (window as any).monaco;
      const editor = monaco.editor.getEditors()[0];
      if (editor) {
        editor.setValue(content);
      }
    }, testFile);

    // Measure baseline memory
    const baselineMemory = await measureMemory(page);
    console.log(`Baseline memory: ${baselineMemory}MB`);

    // Count initial event listeners
    const initialListenerCount = await page.evaluate(() => {
      // Try to get event listener count (browser-specific)
      // This is a simplified check
      const elements = document.querySelectorAll('*');
      let listenerCount = 0;

      elements.forEach((element) => {
        // Count listeners if getEventListeners is available (Chrome DevTools)
        if ((window as any).getEventListeners) {
          const listeners = (window as any).getEventListeners(element);
          if (listeners) {
            Object.keys(listeners).forEach((eventType) => {
              listenerCount += listeners[eventType].length;
            });
          }
        }
      });

      return listenerCount;
    });

    // Perform operations that might add event listeners
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => {
        const monaco = (window as any).monaco;
        const editor = monaco.editor.getEditors()[0];
        if (editor) {
          // Trigger operations that might add listeners
          editor.focus();
          editor.trigger('test', 'editor.action.triggerSuggest', {});
          editor.trigger('test', 'closeReferenceSearch', {});
        }
      });

      await page.waitForTimeout(200);
    }

    // Force garbage collection
    await page.evaluate(() => {
      if ((window as any).gc) {
        (window as any).gc();
      }
    });

    await page.waitForTimeout(1000);

    // Check memory and listeners after operations
    const finalMemory = await measureMemory(page);
    const finalListenerCount = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      let listenerCount = 0;

      elements.forEach((element) => {
        if ((window as any).getEventListeners) {
          const listeners = (window as any).getEventListeners(element);
          if (listeners) {
            Object.keys(listeners).forEach((eventType) => {
              listenerCount += listeners[eventType].length;
            });
          }
        }
      });

      return listenerCount;
    });

    const memoryGrowth = finalMemory - baselineMemory;
    console.log(`Memory growth: ${memoryGrowth}MB`);
    console.log(`Listener count change: ${initialListenerCount} -> ${finalListenerCount}`);

    // Memory growth should be minimal
    expect(memoryGrowth).toBeLessThan(100);

    // Event listener count shouldn't grow excessively
    // Allow some growth for legitimate UI state
    if (initialListenerCount > 0 && finalListenerCount > 0) {
      const listenerGrowth = finalListenerCount - initialListenerCount;
      expect(listenerGrowth).toBeLessThan(50);
    }
  });

  test('should keep memory stable during extended sessions', async ({ page }) => {
    await page.goto('/editor');
    await waitForMonacoEditor(page);

    const testFile = generateLargeFile(15000, 'typescript');

    await page.evaluate((content) => {
      const monaco = (window as any).monaco;
      const editor = monaco.editor.getEditors()[0];
      if (editor) {
        editor.setValue(content);
      }
    }, testFile);

    // Take memory snapshots over time
    const memorySnapshots: { time: number; memory: number }[] = [];
    const testDuration = 20000; // 20 seconds
    const snapshotInterval = 2000; // Every 2 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < testDuration) {
      // Perform various operations
      await page.evaluate(() => {
        const monaco = (window as any).monaco;
        const editor = monaco.editor.getEditors()[0];
        if (editor) {
          const position = editor.getPosition();
          // Type some text
          editor.executeEdits('test', [{
            range: new monaco.Range(
              position.lineNumber,
              position.column,
              position.lineNumber,
              position.column
            ),
            text: '// test comment\n',
          }]);
          // Move cursor
          editor.setPosition({ lineNumber: 100, column: 1 });
        }
      });

      await page.waitForTimeout(snapshotInterval);

      // Take memory snapshot
      const currentMemory = await measureMemory(page);
      const elapsed = Date.now() - startTime;

      memorySnapshots.push({
        time: elapsed,
        memory: currentMemory,
      });

      console.log(`Time: ${elapsed}ms, Memory: ${currentMemory}MB`);
    }

    // Analyze memory trend
    // Memory should stabilize, not grow linearly
    const firstSnapshot = memorySnapshots[0];
    const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];

    const totalGrowth = lastSnapshot.memory - firstSnapshot.memory;
    const growthRate = totalGrowth / (lastSnapshot.time / 1000); // MB per second

    console.log(`Total memory growth: ${totalGrowth}MB`);
    console.log(`Growth rate: ${growthRate.toFixed(2)} MB/s`);

    // Memory should not grow more than 200MB over the test period
    expect(totalGrowth).toBeLessThan(200);

    // Growth rate should be minimal (less than 5 MB/s)
    expect(Math.abs(growthRate)).toBeLessThan(5);
  });

  test('should apply progressive optimizations based on file size', async ({ page }) => {
    await page.goto('/editor');
    await waitForMonacoEditor(page);

    const fileSizes = [
      { lines: 1000, expectMinimal: false },
      { lines: 6000, expectMinimal: true },
      { lines: 15000, expectModerate: true },
      { lines: 50000, expectAggressive: true },
    ];

    for (const fileSize of fileSizes) {
      const testFile = generateLargeFile(fileSize.lines, 'typescript');

      await page.evaluate((content) => {
        const monaco = (window as any).monaco;
        const editor = monaco.editor.getEditors()[0];
        if (editor) {
          editor.setValue(content);
        }
      }, testFile);

      await page.waitForTimeout(500);

      // Check editor options to verify optimizations
      const options = await page.evaluate(() => {
        const monaco = (window as any).monaco;
        const editor = monaco.editor.getEditors()[0];
        if (editor) {
          return {
            minimap: editor.getOption(monaco.editor.EditorOption.minimap)?.enabled,
            codeLens: editor.getOption(monaco.editor.EditorOption.codeLens),
            folding: editor.getOption(monaco.editor.EditorOption.folding),
            hover: editor.getOption(monaco.editor.EditorOption.hover)?.enabled,
          };
        }
        return null;
      });

      if (options) {
        console.log(`Options for ${fileSize.lines} lines:`, options);

        // Verify appropriate optimizations are applied
        if (fileSize.expectMinimal) {
          expect(options.minimap).toBe(false);
        }

        if (fileSize.expectModerate) {
          expect(options.folding).toBe(false);
        }

        if (fileSize.expectAggressive) {
          expect(options.hover).toBe(false);
        }
      }
    }
  });
});

test.describe('Large File Performance - Performance API', () => {
  test.setTimeout(TEST_TIMEOUT);

  test('should track performance metrics', async ({ page }) => {
    await page.goto('/editor');
    await waitForMonacoEditor(page);

    const testFile = generateLargeFile(20000, 'typescript');

    // Clear performance marks
    await page.evaluate(() => {
      performance.clearMarks();
      performance.clearMeasures();
    });

    // Load file and measure
    await page.evaluate((content) => {
      performance.mark('file-load-start');
      const monaco = (window as any).monaco;
      const editor = monaco.editor.getEditors()[0];
      if (editor) {
        editor.setValue(content);
      }
      performance.mark('file-load-end');
      performance.measure('file-load', 'file-load-start', 'file-load-end');
    }, testFile);

    // Get performance measurements
    const measurements = await page.evaluate(() => {
      const measures = performance.getEntriesByType('measure');
      return measures.map(m => ({
        name: m.name,
        duration: m.duration,
      }));
    });

    console.log('Performance measurements:', measurements);

    const fileLoadMeasure = measurements.find(m => m.name === 'file-load');
    if (fileLoadMeasure) {
      expect(fileLoadMeasure.duration).toBeLessThan(PERFORMANCE_THRESHOLDS.LOAD_TIME_MS);
    }
  });
});
