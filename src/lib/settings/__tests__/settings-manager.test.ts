/**
 * Tests for SettingsManager
 */

import { SettingsManager, getSettingsManager } from '../settings-manager';
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_SERVICE_SETTINGS,
  DEFAULT_AI_SETTINGS,
  DEFAULT_ADVANCED_SETTINGS,
} from '@/types/settings';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string): string | null => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: jest.fn((key: string) => { delete store[key]; }),
    clear: jest.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: jest.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  configurable: true,
});

describe('SettingsManager', () => {
  beforeEach(() => {
    SettingsManager.resetInstance();
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  // ==== Singleton ====

  describe('singleton pattern', () => {
    it('returns the same instance on repeated calls', () => {
      const a = SettingsManager.getInstance();
      const b = SettingsManager.getInstance();
      expect(a).toBe(b);
    });

    it('creates a new instance after reset', () => {
      const a = SettingsManager.getInstance();
      SettingsManager.resetInstance();
      const b = SettingsManager.getInstance();
      expect(a).not.toBe(b);
    });

    it('getSettingsManager returns instance', () => {
      const mgr = getSettingsManager();
      expect(mgr).toBeInstanceOf(SettingsManager);
    });
  });

  // ==== Default Values ====

  describe('defaults', () => {
    it('returns default settings on fresh instance', () => {
      const mgr = SettingsManager.getInstance();
      const all = mgr.getAll();
      expect(all.version).toBe(1);
      expect(all.general.theme).toBe(DEFAULT_GENERAL_SETTINGS.theme);
      expect(all.services.ports.app).toBe(DEFAULT_SERVICE_SETTINGS.ports.app);
      expect(all.ai.defaultModel).toBe(DEFAULT_AI_SETTINGS.defaultModel);
      expect(all.advanced.logLevel).toBe(DEFAULT_ADVANCED_SETTINGS.logLevel);
    });

    it('getGeneral returns GeneralSettings copy', () => {
      const mgr = SettingsManager.getInstance();
      const gen = mgr.getGeneral();
      expect(gen.theme).toBe('system');
      gen.theme = 'dark'; // mutate copy
      expect(mgr.getGeneral().theme).toBe('system'); // original unchanged
    });

    it('getServices returns ServiceSettings copy', () => {
      const mgr = SettingsManager.getInstance();
      const svc = mgr.getServices();
      expect(svc.ports.app).toBe(3000);
    });

    it('getAI returns AISettings copy', () => {
      const mgr = SettingsManager.getInstance();
      const ai = mgr.getAI();
      expect(ai.temperature).toBe(0.7);
    });

    it('getAdvanced returns AdvancedSettings copy', () => {
      const mgr = SettingsManager.getInstance();
      const adv = mgr.getAdvanced();
      expect(adv.debugMode).toBe(false);
    });
  });

  // ==== Setters ====

  describe('setters', () => {
    it('setGeneral updates general settings and marks dirty', () => {
      const mgr = SettingsManager.getInstance();
      expect(mgr.hasUnsavedChanges()).toBe(false);

      mgr.setGeneral({ theme: 'dark' });
      expect(mgr.getGeneral().theme).toBe('dark');
      expect(mgr.hasUnsavedChanges()).toBe(true);
    });

    it('setServices updates service settings', () => {
      const mgr = SettingsManager.getInstance();
      mgr.setServices({ maxRetries: 5 });
      expect(mgr.getServices().maxRetries).toBe(5);
    });

    it('setServices merges ports correctly', () => {
      const mgr = SettingsManager.getInstance();
      mgr.setServices({ ports: { app: 9000 } as any });
      const svc = mgr.getServices();
      expect(svc.ports.app).toBe(9000);
      expect(svc.ports.database).toBe(5432); // unchanged
    });

    it('setAI updates AI settings', () => {
      const mgr = SettingsManager.getInstance();
      mgr.setAI({ temperature: 1.5 });
      expect(mgr.getAI().temperature).toBe(1.5);
    });

    it('setAdvanced updates advanced settings', () => {
      const mgr = SettingsManager.getInstance();
      mgr.setAdvanced({ debugMode: true });
      expect(mgr.getAdvanced().debugMode).toBe(true);
    });

    it('setAdvanced merges telemetry correctly', () => {
      const mgr = SettingsManager.getInstance();
      mgr.setAdvanced({ telemetry: { crashReporting: false } as any });
      const adv = mgr.getAdvanced();
      expect(adv.telemetry.crashReporting).toBe(false);
      expect(adv.telemetry.analyticsEnabled).toBe(false); // default
    });

    it('setAll applies all categories', () => {
      const mgr = SettingsManager.getInstance();
      mgr.setAll({
        general: { theme: 'light' },
        ai: { temperature: 0.5 },
      });
      expect(mgr.getGeneral().theme).toBe('light');
      expect(mgr.getAI().temperature).toBe(0.5);
    });
  });

  // ==== Reset ====

  describe('reset', () => {
    it('resetToDefaults restores all defaults', () => {
      const mgr = SettingsManager.getInstance();
      mgr.setGeneral({ theme: 'dark' });
      mgr.setAI({ temperature: 1.8 });
      mgr.resetToDefaults();
      expect(mgr.getGeneral().theme).toBe('system');
      expect(mgr.getAI().temperature).toBe(0.7);
    });

    it('resetCategory resets only specified category', () => {
      const mgr = SettingsManager.getInstance();
      mgr.setGeneral({ theme: 'dark' });
      mgr.setAI({ temperature: 1.8 });
      mgr.resetCategory('general');
      expect(mgr.getGeneral().theme).toBe('system');
      expect(mgr.getAI().temperature).toBe(1.8); // unchanged
    });
  });

  // ==== Validation ====

  describe('validation', () => {
    it('valid defaults pass validation', () => {
      const mgr = SettingsManager.getInstance();
      const result = mgr.validate();
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('detects invalid theme', () => {
      const mgr = SettingsManager.getInstance();
      mgr.setGeneral({ theme: 'neon' as any });
      const result = mgr.validate();
      expect(result.isValid).toBe(false);
      expect(result.errors['general.theme']).toBeDefined();
    });

    it('detects negative autoSaveInterval', () => {
      const mgr = SettingsManager.getInstance();
      mgr.setGeneral({ autoSaveInterval: -1 });
      const result = mgr.validate();
      expect(result.errors['general.autoSaveInterval']).toBeDefined();
    });

    it('detects invalid port', () => {
      const mgr = SettingsManager.getInstance();
      mgr.setServices({ ports: { app: 0 } as any });
      const result = mgr.validate();
      expect(result.errors['services.ports.app']).toBeDefined();
    });

    it('detects port above 65535', () => {
      const mgr = SettingsManager.getInstance();
      mgr.setServices({ ports: { app: 70000 } as any });
      const result = mgr.validate();
      expect(result.errors['services.ports.app']).toBeDefined();
    });

    it('detects invalid temperature', () => {
      const mgr = SettingsManager.getInstance();
      mgr.setAI({ temperature: 3 });
      const result = mgr.validate();
      expect(result.errors['ai.temperature']).toBeDefined();
    });

    it('detects negative temperature', () => {
      const mgr = SettingsManager.getInstance();
      mgr.setAI({ temperature: -1 });
      const result = mgr.validate();
      expect(result.errors['ai.temperature']).toBeDefined();
    });

    it('detects invalid topP', () => {
      const mgr = SettingsManager.getInstance();
      mgr.setAI({ topP: 2 });
      const result = mgr.validate();
      expect(result.errors['ai.topP']).toBeDefined();
    });

    it('detects invalid maxTokens', () => {
      const mgr = SettingsManager.getInstance();
      mgr.setAI({ maxTokens: 0 });
      const result = mgr.validate();
      expect(result.errors['ai.maxTokens']).toBeDefined();
    });

    it('detects invalid logLevel', () => {
      const mgr = SettingsManager.getInstance();
      mgr.setAdvanced({ logLevel: 'verbose' as any });
      const result = mgr.validate();
      expect(result.errors['advanced.logLevel']).toBeDefined();
    });

    it('warns about debug mode enabled', () => {
      const mgr = SettingsManager.getInstance();
      mgr.setAdvanced({ debugMode: true });
      const result = mgr.validate();
      expect(result.isValid).toBe(true);
      expect(result.warnings['advanced.debugMode']).toBeDefined();
    });

    it('warns about high temperature', () => {
      const mgr = SettingsManager.getInstance();
      mgr.setAI({ temperature: 1.8 });
      const result = mgr.validate();
      expect(result.isValid).toBe(true);
      expect(result.warnings['ai.temperature']).toBeDefined();
    });

    it('warns about crash reporting disabled', () => {
      const mgr = SettingsManager.getInstance();
      mgr.setAdvanced({ telemetry: { crashReporting: false } as any });
      const result = mgr.validate();
      expect(result.warnings['advanced.telemetry.crashReporting']).toBeDefined();
    });
  });

  // ==== Observer Pattern ====

  describe('observers', () => {
    it('notifies observer on setGeneral', () => {
      const mgr = SettingsManager.getInstance();
      const observer = jest.fn();
      mgr.subscribe(observer);

      mgr.setGeneral({ theme: 'dark' });
      expect(observer).toHaveBeenCalledTimes(1);
      expect(observer).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'general',
          timestamp: expect.any(String),
        })
      );
    });

    it('unsubscribe stops notifications', () => {
      const mgr = SettingsManager.getInstance();
      const observer = jest.fn();
      const unsub = mgr.subscribe(observer);

      mgr.setGeneral({ theme: 'dark' });
      expect(observer).toHaveBeenCalledTimes(1);

      unsub();
      mgr.setGeneral({ theme: 'light' });
      expect(observer).toHaveBeenCalledTimes(1);
    });

    it('handles observer errors gracefully', () => {
      const mgr = SettingsManager.getInstance();
      const badObserver = jest.fn(() => { throw new Error('boom'); });
      const goodObserver = jest.fn();
      mgr.subscribe(badObserver);
      mgr.subscribe(goodObserver);

      mgr.setGeneral({ theme: 'dark' });
      expect(goodObserver).toHaveBeenCalledTimes(1);
    });

    it('resetToDefaults notifies observers for each category', () => {
      const mgr = SettingsManager.getInstance();
      const observer = jest.fn();
      mgr.subscribe(observer);

      mgr.resetToDefaults();
      expect(observer).toHaveBeenCalledTimes(4); // general, services, ai, advanced
    });
  });

  // ==== Persistence ====

  describe('persistence', () => {
    it('save stores to localStorage', async () => {
      const mgr = SettingsManager.getInstance();
      mgr.setGeneral({ theme: 'dark' });
      const result = await mgr.save();
      expect(result).toBe(true);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'vibecode-settings',
        expect.any(String)
      );
      expect(mgr.hasUnsavedChanges()).toBe(false);
    });

    it('load restores from localStorage', async () => {
      const stored = { ...DEFAULT_APP_SETTINGS, general: { ...DEFAULT_GENERAL_SETTINGS, theme: 'dark' as const } };
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(stored));

      const mgr = SettingsManager.getInstance();
      await mgr.load();
      expect(mgr.getGeneral().theme).toBe('dark');
    });

    it('load returns defaults when nothing stored', async () => {
      const mgr = SettingsManager.getInstance();
      localStorageMock.getItem.mockReturnValueOnce(null);
      await mgr.load();
      expect(mgr.getGeneral().theme).toBe('system');
    });

    it('load handles corrupted JSON gracefully', async () => {
      localStorageMock.getItem.mockReturnValueOnce('not-json');
      const mgr = SettingsManager.getInstance();
      await mgr.load();
      expect(mgr.getGeneral().theme).toBe('system');
    });

    it('validateAndSave saves when valid', async () => {
      const mgr = SettingsManager.getInstance();
      mgr.setGeneral({ theme: 'dark' });
      const result = await mgr.validateAndSave();
      expect(result.isValid).toBe(true);
      expect(result.saved).toBe(true);
    });

    it('validateAndSave does not save when invalid', async () => {
      const mgr = SettingsManager.getInstance();
      mgr.setAI({ temperature: 5 });
      const result = await mgr.validateAndSave();
      expect(result.isValid).toBe(false);
      expect(result.saved).toBe(false);
    });
  });

  // ==== Import/Export ====

  describe('import/export', () => {
    it('export returns valid JSON', () => {
      const mgr = SettingsManager.getInstance();
      const json = mgr.export();
      const parsed = JSON.parse(json);
      expect(parsed.version).toBe(1);
      expect(parsed.general).toBeDefined();
    });

    it('import restores settings from JSON', () => {
      const mgr = SettingsManager.getInstance();
      const exported = mgr.export();
      const parsed = JSON.parse(exported);
      parsed.general.theme = 'dark';

      const result = mgr.import(JSON.stringify(parsed));
      expect(result.isValid).toBe(true);
      expect(mgr.getGeneral().theme).toBe('dark');
    });

    it('import rejects invalid JSON', () => {
      const mgr = SettingsManager.getInstance();
      const result = mgr.import('invalid-json');
      expect(result.isValid).toBe(false);
      expect(result.errors.import).toBeDefined();
    });

    it('import rejects invalid settings', () => {
      const mgr = SettingsManager.getInstance();
      const badSettings = { ...DEFAULT_APP_SETTINGS, ai: { ...DEFAULT_AI_SETTINGS, temperature: 10 } };
      const result = mgr.import(JSON.stringify(badSettings));
      expect(result.isValid).toBe(false);
      // Should have restored previous settings
      expect(mgr.getAI().temperature).toBe(0.7);
    });

    it('import notifies observers on valid import', () => {
      const mgr = SettingsManager.getInstance();
      const observer = jest.fn();
      mgr.subscribe(observer);

      const exported = mgr.export();
      mgr.import(exported);
      expect(observer).toHaveBeenCalled();
    });
  });

  // ==== get() ====

  describe('get method', () => {
    it('returns specific top-level setting', () => {
      const mgr = SettingsManager.getInstance();
      expect(mgr.get('version')).toBe(1);
    });

    it('returns general settings via get', () => {
      const mgr = SettingsManager.getInstance();
      const general = mgr.get('general');
      expect(general.theme).toBe('system');
    });
  });
});
