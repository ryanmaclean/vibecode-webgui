/**
 * Feature Audit: Interactive Console - Green on Black Terminal
 * Issue: #1527
 *
 * Verifies that the interactive console feature exists and functions correctly.
 */

describe('Feature Audit: Interactive Console (#1527)', () => {
  const getConsoleImplementation = async () => {
    const fs = await import('fs');
    const path = await import('path');
    const candidates = [
      'src/components/terminal/EnhancedTerminal.tsx',
      'src/components/console/ConsoleMode.tsx',
      'src/components/console/ConsoleModal.tsx',
    ];

    for (const relativePath of candidates) {
      const absolutePath = path.join(process.cwd(), relativePath);
      if (fs.existsSync(absolutePath)) {
        return {
          fs,
          path: absolutePath,
          relativePath,
          content: fs.readFileSync(absolutePath, 'utf-8'),
        };
      }
    }

    throw new Error('No console implementation file found');
  };

  describe('EnhancedTerminal component', () => {
    test('console implementation file exists', async () => {
      const implementation = await getConsoleImplementation();
      expect(implementation.path).toBeTruthy();
    });

    test('uses terminal-oriented UI or backend integration', async () => {
      const implementation = await getConsoleImplementation();
      const { content, relativePath } = implementation;

      if (relativePath === 'src/components/terminal/EnhancedTerminal.tsx') {
        expect(content).toContain("import { Terminal } from '@xterm/xterm'");
        expect(content).toContain("import { FitAddon } from '@xterm/addon-fit'");
      } else {
        expect(content).toContain('workspaceId');
        expect(content).toContain('Console');
      }
    });

    test('has dark terminal-style theming', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const modePath = path.join(process.cwd(), 'src/components/console/ConsoleMode.tsx');
      const modalPath = path.join(process.cwd(), 'src/components/console/ConsoleModal.tsx');
      const modeContent = fs.existsSync(modePath) ? fs.readFileSync(modePath, 'utf-8') : '';
      const modalContent = fs.existsSync(modalPath) ? fs.readFileSync(modalPath, 'utf-8') : '';
      const combinedContent = `${modeContent}\n${modalContent}`;

      expect(combinedContent).toContain('bg-gray-900');
    });

    test('supports interactive session lifecycle', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const componentPath = path.join(process.cwd(), 'src/components/console/ConsoleMode.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');
      expect(content).toContain('getOrCreateSession');
      expect(content).toContain('getSession');
    });

    test('includes guidance for interactive usage', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const componentPath = path.join(process.cwd(), 'src/components/console/ConsoleModal.tsx');
      const content = fs.readFileSync(componentPath, 'utf-8');
      expect(content).toContain('Press Esc to close');
      expect(content).toContain('Ctrl+C to interrupt');
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
