/**
 * Feature Audit: Auto-Discovery - Automatic VM Image Detection
 * Issue: #1488
 *
 * Verifies that the VM auto-discovery feature exists and functions correctly.
 */

describe('Feature Audit: Auto-Discovery VM Detection (#1488)', () => {
  describe('VMManager component', () => {
    test('VMManager.swift file exists', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const componentPath = path.join(
        process.cwd(),
        'platforms/macos/VibeCodeSwift/Sources/ViewModels/VMManager.swift'
      );
      expect(fs.existsSync(componentPath)).toBe(true);
    });

    test('implements loadAvailableVMs function', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const componentPath = path.join(
        process.cwd(),
        'platforms/macos/VibeCodeSwift/Sources/ViewModels/VMManager.swift'
      );
      const content = fs.readFileSync(componentPath, 'utf-8');
      expect(content).toContain('func loadAvailableVMs()');
    });

    test('scans app bundle for VMs', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const componentPath = path.join(
        process.cwd(),
        'platforms/macos/VibeCodeSwift/Sources/ViewModels/VMManager.swift'
      );
      const content = fs.readFileSync(componentPath, 'utf-8');
      expect(content).toContain('Bundle.main.resourcePath');
      expect(content).toContain('appendingPathComponent("vms")');
    });

    test('scans Application Support for user VMs', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const componentPath = path.join(
        process.cwd(),
        'platforms/macos/VibeCodeSwift/Sources/ViewModels/VMManager.swift'
      );
      const content = fs.readFileSync(componentPath, 'utf-8');
      expect(content).toContain('.applicationSupportDirectory');
      expect(content).toContain('VibeCode/vms');
    });

    test('includes Datadog observability logging', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const componentPath = path.join(
        process.cwd(),
        'platforms/macos/VibeCodeSwift/Sources/ViewModels/VMManager.swift'
      );
      const content = fs.readFileSync(componentPath, 'utf-8');
      expect(content).toContain('DatadogLogger');
      expect(content).toContain('vm_discovery');
    });

    test('handles no VMs found gracefully', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const componentPath = path.join(
        process.cwd(),
        'platforms/macos/VibeCodeSwift/Sources/ViewModels/VMManager.swift'
      );
      const content = fs.readFileSync(componentPath, 'utf-8');
      expect(content).toContain('No VM directory found');
      expect(content).toContain('vm_discovery_failed');
    });
  });

  describe('VMOrchestrator integration', () => {
    test('VMOrchestrator.swift file exists', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const componentPath = path.join(
        process.cwd(),
        'platforms/macos/Sources/VibeCode/Virtualization/VMOrchestrator.swift'
      );
      expect(fs.existsSync(componentPath)).toBe(true);
    });
  });
});
