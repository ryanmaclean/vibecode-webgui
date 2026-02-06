'use client';

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Upload, RotateCcw, Wand2 } from 'lucide-react';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { Button } from '@/components/ui/button';
import { OnboardingDrawer } from '@/components/onboarding/OnboardingDrawer';
import { getSettingsManager } from '@/lib/settings/settings-manager';
import { DEFAULT_APP_SETTINGS } from '@/types/settings';
import type { AppSettings } from '@/types/settings';

export default function SettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [panelKey, setPanelKey] = useState(0);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const showStatus = useCallback((type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => setStatusMessage(null), 3000);
  }, []);

  const handleSave = useCallback((settings: AppSettings) => {
    console.log('Settings saved:', settings.lastModified);
  }, []);

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const handleExport = useCallback(() => {
    try {
      const manager = getSettingsManager();
      const settings = manager.getAll();
      const json = JSON.stringify(settings, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().split('T')[0];
      const a = document.createElement('a');
      a.href = url;
      a.download = `vibecode-settings-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showStatus('success', 'Settings exported successfully');
    } catch {
      showStatus('error', 'Failed to export settings');
    }
  }, [showStatus]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input so the same file can be re-selected
    e.target.value = '';

    if (!file.name.endsWith('.json')) {
      showStatus('error', 'Please select a JSON file');
      return;
    }

    if (!window.confirm('This will overwrite your current settings. Continue?')) {
      return;
    }

    try {
      const text = await file.text();
      const imported = JSON.parse(text) as Partial<AppSettings>;

      // Basic structure validation
      if (!imported || typeof imported !== 'object') {
        showStatus('error', 'Invalid settings file format');
        return;
      }

      const hasValidSection = imported.general || imported.services || imported.ai || imported.advanced;
      if (!hasValidSection) {
        showStatus('error', 'Settings file does not contain valid settings sections');
        return;
      }

      const manager = getSettingsManager();
      manager.setAll(imported);
      await manager.save();
      setPanelKey((k) => k + 1);
      showStatus('success', 'Settings imported successfully');
    } catch {
      showStatus('error', 'Failed to parse settings file. Ensure it contains valid JSON.');
    }
  }, [showStatus]);

  const handleResetToDefaults = useCallback(async () => {
    if (!window.confirm('Reset all settings to defaults?')) {
      return;
    }

    try {
      const manager = getSettingsManager();
      manager.setAll(DEFAULT_APP_SETTINGS);
      await manager.save();
      setPanelKey((k) => k + 1);
      showStatus('success', 'Settings reset to defaults');
    } catch {
      showStatus('error', 'Failed to reset settings');
    }
  }, [showStatus]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col items-center gap-4">
          <SettingsPanel
            key={panelKey}
            onSave={handleSave}
            onClose={handleClose}
          />

          <div className="w-full max-w-4xl border rounded-lg bg-white dark:bg-gray-900 p-4">
            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" aria-hidden="true" />
                  Export Settings
                </Button>
                <Button variant="outline" size="sm" onClick={handleImport}>
                  <Upload className="h-4 w-4 mr-2" aria-hidden="true" />
                  Import Settings
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                  aria-label="Import settings file"
                />
                <Button variant="outline" size="sm" onClick={handleResetToDefaults}>
                  <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
                  Reset to Defaults
                </Button>
                <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
                  <Wand2 className="h-4 w-4 mr-2" aria-hidden="true" />
                  Setup Wizard
                </Button>
              </div>
              {statusMessage && (
                <span
                  className={`text-sm font-medium ${
                    statusMessage.type === 'success'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {statusMessage.text}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <OnboardingDrawer open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  );
}
