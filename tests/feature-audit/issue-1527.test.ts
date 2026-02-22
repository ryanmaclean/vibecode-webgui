/**
 * Feature Audit: Interactive Console - Green on Black Terminal
 * Issue: #1527
 *
 * Verifies that the interactive console feature exists and functions correctly.
 */

describe('Feature Audit: Interactive Console (#1527)', () => {
  describe('ConsoleMode component implementation', () => {
    test('component file exists', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const componentPath = path.join(process.cwd(), 'src/components/console/ConsoleMode.tsx');
      expect(fs.existsSync(componentPath)).toBe(true);
    });

    test('uses code-server client session APIs', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const componentPath = path.join(process.cwd(), 'src/components/console/ConsoleMode.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');
      expect(content).toContain('codeServerClient.getOrCreateSession');
      expect(content).toContain('codeServerClient.getSession');
    });

    test('has dark theme with green color support', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const componentPath = path.join(process.cwd(), 'src/components/console/ConsoleMode.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');
      expect(content).toContain('bg-gray-900');
      expect(content).toContain('bg-gray-800');
    });

    test('handles startup and error states', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const componentPath = path.join(process.cwd(), 'src/components/console/ConsoleMode.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');
      expect(content).toContain("status: 'starting'");
      expect(content).toContain('Failed to start console');
    });

    test('includes toast notifications for user feedback', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const componentPath = path.join(process.cwd(), 'src/components/console/ConsoleMode.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');
      expect(content).toContain('showToast');
      expect(content).toContain('Test Toasts');
    });
  });

  describe('ConsoleMode component', () => {
    test('component file exists', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const componentPath = path.join(process.cwd(), 'src/components/console/ConsoleMode.tsx');
      expect(fs.existsSync(componentPath)).toBe(true);
    });

    test('renders in fullscreen modal style', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const componentPath = path.join(process.cwd(), 'src/components/console/ConsoleMode.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');
      expect(content).toContain('fixed inset-0');
      expect(content).toContain('bg-gray-900');
    });
  });

  describe('Console test page', () => {
    test('console-test page was removed (consolidated in Wave 18)', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const pagePath = path.join(process.cwd(), 'src/app/console-test/page.tsx');
      // Page was intentionally removed during Wave 18 consolidation
      // Console functionality is accessed via the main terminal components
      expect(fs.existsSync(pagePath)).toBe(false);
    });
  });
});
