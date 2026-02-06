/**
 * SettingsPanel Component
 *
 * Comprehensive settings panel for VibeCode with tabbed interface
 * supporting General, Services, AI, and Advanced configuration.
 *
 * Features:
 * - Tabbed interface with keyboard navigation
 * - Form validation with real-time feedback
 * - Save/Cancel/Reset functionality
 * - Responsive design
 * - WCAG 2.1 AA compliant accessibility
 * - Tauri backend sync support
 *
 * @module components/settings/SettingsPanel
 */

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Settings,
  Server,
  Brain,
  Wrench,
  Save,
  RotateCcw,
  X,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Info,
  Monitor,
  Moon,
  Sun,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

import { SettingsManager, getSettingsManager } from '@/lib/settings/settings-manager';
import type {
  AppSettings,
  GeneralSettings,
  ServiceSettings,
  AISettings,
  AdvancedSettings,
  ThemeMode,
  LogLevel,
  SettingsValidationResult,
} from '@/types/settings';
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_AI_MODELS,
} from '@/types/settings';

// ============================================================================
// Types
// ============================================================================

export interface SettingsPanelProps {
  /** Initial tab to display */
  initialTab?: 'general' | 'services' | 'ai' | 'advanced';
  /** Callback when settings are saved */
  onSave?: (settings: AppSettings) => void;
  /** Callback when panel is closed */
  onClose?: () => void;
  /** Whether the panel is in modal mode */
  isModal?: boolean;
  /** Custom className */
  className?: string;
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

// ============================================================================
// Subcomponents
// ============================================================================

/**
 * Setting row with label, description, and control
 */
interface SettingRowProps {
  id: string;
  label: string;
  description?: string;
  children: React.ReactNode;
  error?: string;
}

function SettingRow({ id, label, description, children, error }: SettingRowProps) {
  return (
    <div className="flex items-start justify-between p-4 border rounded-lg">
      <div className="space-y-1 flex-1 mr-4">
        <Label htmlFor={id} className="text-base font-medium">
          {label}
        </Label>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {error && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

/**
 * Input field for port numbers
 */
interface PortInputProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  error?: string;
}

function PortInput({ id, value, onChange, disabled, error }: PortInputProps) {
  return (
    <Input
      id={id}
      type="number"
      min={1}
      max={65535}
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
      disabled={disabled}
      className={cn('w-24', error && 'border-destructive')}
      aria-invalid={!!error}
    />
  );
}

/**
 * Masked input for API keys
 */
interface MaskedInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

function MaskedInput({ id, value, onChange, placeholder, disabled }: MaskedInputProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative w-64">
      <Input
        id={id}
        type={isVisible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="pr-10"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute right-0 top-0 h-full px-3"
        onClick={() => setIsVisible(!isVisible)}
        aria-label={isVisible ? 'Hide value' : 'Show value'}
      >
        {isVisible ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Eye className="h-4 w-4" aria-hidden="true" />
        )}
      </Button>
    </div>
  );
}

/**
 * Theme selector with icons
 */
interface ThemeSelectorProps {
  value: ThemeMode;
  onChange: (value: ThemeMode) => void;
  disabled?: boolean;
}

function ThemeSelector({ value, onChange, disabled }: ThemeSelectorProps) {
  const themes: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
    { value: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
  ];

  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg" role="radiogroup" aria-label="Theme selection">
      {themes.map((theme) => (
        <button
          key={theme.value}
          type="button"
          role="radio"
          aria-checked={value === theme.value}
          disabled={disabled}
          onClick={() => onChange(theme.value)}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            value === theme.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          {theme.icon}
          {theme.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SettingsPanel({
  initialTab = 'general',
  onSave,
  onClose,
  isModal = false,
  className,
}: SettingsPanelProps) {
  // State
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [validation, setValidation] = useState<SettingsValidationResult>({
    isValid: true,
    errors: {},
    warnings: {},
  });
  const [isLoading, setIsLoading] = useState(true);

  // API key input states (not stored in settings for security)
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({
    openai: '',
    anthropic: '',
  });

  const settingsManager = useMemo(() => getSettingsManager(), []);

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      try {
        const loaded = await settingsManager.load();
        setSettings(loaded);
        setOriginalSettings(loaded);
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, [settingsManager]);

  // Validate settings on change
  useEffect(() => {
    // Create a temporary manager to validate
    const tempManager = SettingsManager.getInstance();
    tempManager.setAll(settings);
    setValidation(tempManager.validate());
  }, [settings]);

  // Check for unsaved changes
  const hasChanges = useMemo(() => {
    return JSON.stringify(settings) !== JSON.stringify(originalSettings);
  }, [settings, originalSettings]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const updateGeneral = useCallback((updates: Partial<GeneralSettings>) => {
    setSettings((prev) => ({
      ...prev,
      general: { ...prev.general, ...updates },
    }));
    setSaveStatus('idle');
  }, []);

  const updateServices = useCallback((updates: Partial<ServiceSettings>) => {
    setSettings((prev) => ({
      ...prev,
      services: {
        ...prev.services,
        ...updates,
        ports: updates.ports
          ? { ...prev.services.ports, ...updates.ports }
          : prev.services.ports,
        timeouts: updates.timeouts
          ? { ...prev.services.timeouts, ...updates.timeouts }
          : prev.services.timeouts,
      },
    }));
    setSaveStatus('idle');
  }, []);

  const updateAI = useCallback((updates: Partial<AISettings>) => {
    setSettings((prev) => ({
      ...prev,
      ai: { ...prev.ai, ...updates },
    }));
    setSaveStatus('idle');
  }, []);

  const updateAdvanced = useCallback((updates: Partial<AdvancedSettings>) => {
    setSettings((prev) => ({
      ...prev,
      advanced: {
        ...prev.advanced,
        ...updates,
        telemetry: updates.telemetry
          ? { ...prev.advanced.telemetry, ...updates.telemetry }
          : prev.advanced.telemetry,
      },
    }));
    setSaveStatus('idle');
  }, []);

  const handleSave = useCallback(async () => {
    if (!validation.isValid) return;

    setSaveStatus('saving');

    try {
      settingsManager.setAll(settings);
      const result = await settingsManager.validateAndSave();

      if (result.saved) {
        setSaveStatus('success');
        setOriginalSettings(settings);
        onSave?.(settings);

        // Reset status after delay
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
        setValidation(result);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveStatus('error');
    }
  }, [settings, validation.isValid, settingsManager, onSave]);

  const handleCancel = useCallback(() => {
    setSettings(originalSettings);
    setSaveStatus('idle');
    onClose?.();
  }, [originalSettings, onClose]);

  const handleReset = useCallback(() => {
    setSettings(DEFAULT_APP_SETTINGS);
    setSaveStatus('idle');
  }, []);

  const handleResetCategory = useCallback(
    (category: 'general' | 'services' | 'ai' | 'advanced') => {
      const defaults = {
        general: DEFAULT_APP_SETTINGS.general,
        services: DEFAULT_APP_SETTINGS.services,
        ai: DEFAULT_APP_SETTINGS.ai,
        advanced: DEFAULT_APP_SETTINGS.advanced,
      };

      setSettings((prev) => ({
        ...prev,
        [category]: defaults[category],
      }));
      setSaveStatus('idle');
    },
    []
  );

  // ==========================================================================
  // Render
  // ==========================================================================

  if (isLoading) {
    return (
      <Card className={cn('w-full max-w-4xl', className)}>
        <CardContent className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">Loading settings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full max-w-4xl', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" aria-hidden="true" />
              Settings
            </CardTitle>
            <CardDescription>
              Configure your VibeCode preferences and application settings
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {saveStatus === 'success' && (
              <Badge variant="default" className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" aria-hidden="true" />
                Saved
              </Badge>
            )}
            {saveStatus === 'error' && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
                Error
              </Badge>
            )}
            {hasChanges && saveStatus === 'idle' && (
              <Badge variant="outline" className="flex items-center gap-1">
                <Info className="h-3 w-3" aria-hidden="true" />
                Unsaved changes
              </Badge>
            )}
            {isModal && onClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label="Close settings"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue={initialTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Settings className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">General</span>
            </TabsTrigger>
            <TabsTrigger value="services" className="flex items-center gap-2">
              <Server className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Services</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Brain className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">AI</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Advanced</span>
            </TabsTrigger>
          </TabsList>

          {/* General Settings Tab */}
          <TabsContent value="general" className="space-y-4 mt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">General Settings</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleResetCategory('general')}
                aria-label="Reset general settings to defaults"
              >
                <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
                Reset
              </Button>
            </div>

            <SettingRow
              id="theme"
              label="Theme"
              description="Choose your preferred color scheme"
            >
              <ThemeSelector
                value={settings.general.theme}
                onChange={(theme) => updateGeneral({ theme })}
              />
            </SettingRow>

            <SettingRow
              id="launch-at-login"
              label="Launch at Login"
              description="Automatically start VibeCode when you log in"
            >
              <Switch
                id="launch-at-login"
                checked={settings.general.launchAtLogin}
                onCheckedChange={(checked) => updateGeneral({ launchAtLogin: checked })}
                aria-label="Launch at login"
              />
            </SettingRow>

            <SettingRow
              id="minimize-to-tray"
              label="Minimize to Tray"
              description="Keep VibeCode running in the system tray when closed"
            >
              <Switch
                id="minimize-to-tray"
                checked={settings.general.minimizeToTray}
                onCheckedChange={(checked) => updateGeneral({ minimizeToTray: checked })}
                aria-label="Minimize to tray"
              />
            </SettingRow>

            <SettingRow
              id="notifications"
              label="Notifications"
              description="Show desktop notifications for important events"
            >
              <Switch
                id="notifications"
                checked={settings.general.notifications}
                onCheckedChange={(checked) => updateGeneral({ notifications: checked })}
                aria-label="Enable notifications"
              />
            </SettingRow>

            <SettingRow
              id="confirm-on-close"
              label="Confirm on Close"
              description="Ask for confirmation before closing with unsaved changes"
            >
              <Switch
                id="confirm-on-close"
                checked={settings.general.confirmOnClose}
                onCheckedChange={(checked) => updateGeneral({ confirmOnClose: checked })}
                aria-label="Confirm on close"
              />
            </SettingRow>

            <SettingRow
              id="auto-save"
              label="Auto-save Interval"
              description="Automatically save your work (in seconds, 0 to disable)"
              error={validation.errors['general.autoSaveInterval']}
            >
              <Input
                id="auto-save"
                type="number"
                min={0}
                max={600}
                value={settings.general.autoSaveInterval}
                onChange={(e) =>
                  updateGeneral({ autoSaveInterval: parseInt(e.target.value, 10) || 0 })
                }
                className="w-24"
              />
            </SettingRow>
          </TabsContent>

          {/* Services Settings Tab */}
          <TabsContent value="services" className="space-y-4 mt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Service Settings</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleResetCategory('services')}
                aria-label="Reset service settings to defaults"
              >
                <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
                Reset
              </Button>
            </div>

            <SettingRow
              id="auto-start-services"
              label="Auto-start Services"
              description="Automatically start background services on app launch"
            >
              <Switch
                id="auto-start-services"
                checked={settings.services.autoStartServices}
                onCheckedChange={(checked) => updateServices({ autoStartServices: checked })}
                aria-label="Auto-start services"
              />
            </SettingRow>

            <SettingRow
              id="health-monitoring"
              label="Health Monitoring"
              description="Enable real-time service health checks"
            >
              <Switch
                id="health-monitoring"
                checked={settings.services.healthMonitoring}
                onCheckedChange={(checked) => updateServices({ healthMonitoring: checked })}
                aria-label="Enable health monitoring"
              />
            </SettingRow>

            {/* Port Configuration */}
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium">Port Configuration</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="port-app">Application Port</Label>
                  <PortInput
                    id="port-app"
                    value={settings.services.ports.app}
                    onChange={(value) =>
                      updateServices({ ports: { ...settings.services.ports, app: value } })
                    }
                    error={validation.errors['services.ports.app']}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="port-ai-gateway">AI Gateway Port</Label>
                  <PortInput
                    id="port-ai-gateway"
                    value={settings.services.ports.aiGateway}
                    onChange={(value) =>
                      updateServices({ ports: { ...settings.services.ports, aiGateway: value } })
                    }
                    error={validation.errors['services.ports.aiGateway']}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="port-database">Database Port</Label>
                  <PortInput
                    id="port-database"
                    value={settings.services.ports.database}
                    onChange={(value) =>
                      updateServices({ ports: { ...settings.services.ports, database: value } })
                    }
                    error={validation.errors['services.ports.database']}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="port-vm">VM Service Port</Label>
                  <PortInput
                    id="port-vm"
                    value={settings.services.ports.vmService}
                    onChange={(value) =>
                      updateServices({ ports: { ...settings.services.ports, vmService: value } })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Timeout Configuration */}
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium">Timeout Configuration (ms)</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timeout-connection">Connection Timeout</Label>
                  <Input
                    id="timeout-connection"
                    type="number"
                    min={1000}
                    max={60000}
                    step={1000}
                    value={settings.services.timeouts.connection}
                    onChange={(e) =>
                      updateServices({
                        timeouts: {
                          ...settings.services.timeouts,
                          connection: parseInt(e.target.value, 10) || 10000,
                        },
                      })
                    }
                    className="w-28"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeout-request">Request Timeout</Label>
                  <Input
                    id="timeout-request"
                    type="number"
                    min={1000}
                    max={120000}
                    step={1000}
                    value={settings.services.timeouts.request}
                    onChange={(e) =>
                      updateServices({
                        timeouts: {
                          ...settings.services.timeouts,
                          request: parseInt(e.target.value, 10) || 30000,
                        },
                      })
                    }
                    className="w-28"
                  />
                </div>
              </div>
            </div>

            <SettingRow
              id="max-retries"
              label="Max Retries"
              description="Maximum retry attempts for failed connections"
            >
              <Input
                id="max-retries"
                type="number"
                min={0}
                max={10}
                value={settings.services.maxRetries}
                onChange={(e) =>
                  updateServices({ maxRetries: parseInt(e.target.value, 10) || 3 })
                }
                className="w-20"
              />
            </SettingRow>
          </TabsContent>

          {/* AI Settings Tab */}
          <TabsContent value="ai" className="space-y-4 mt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">AI Settings</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleResetCategory('ai')}
                aria-label="Reset AI settings to defaults"
              >
                <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
                Reset
              </Button>
            </div>

            <SettingRow
              id="default-model"
              label="Default Model"
              description="The AI model to use by default"
            >
              <Select
                value={settings.ai.defaultModel}
                onValueChange={(value) => updateAI({ defaultModel: value })}
              >
                <SelectTrigger id="default-model" className="w-48">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_AI_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex flex-col">
                        <span>{model.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {model.provider}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingRow>

            {/* API Keys Section */}
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium">API Keys</h4>
              <p className="text-sm text-muted-foreground">
                API keys are stored securely and never exposed in settings exports
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="api-key-openai">OpenAI API Key</Label>
                  <MaskedInput
                    id="api-key-openai"
                    value={apiKeyInputs.openai}
                    onChange={(value) =>
                      setApiKeyInputs((prev) => ({ ...prev, openai: value }))
                    }
                    placeholder="sk-..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="api-key-anthropic">Anthropic API Key</Label>
                  <MaskedInput
                    id="api-key-anthropic"
                    value={apiKeyInputs.anthropic}
                    onChange={(value) =>
                      setApiKeyInputs((prev) => ({ ...prev, anthropic: value }))
                    }
                    placeholder="sk-ant-..."
                  />
                </div>
              </div>
            </div>

            <SettingRow
              id="max-tokens"
              label="Max Tokens"
              description="Maximum number of tokens in AI responses"
            >
              <Input
                id="max-tokens"
                type="number"
                min={256}
                max={128000}
                step={256}
                value={settings.ai.maxTokens}
                onChange={(e) =>
                  updateAI({ maxTokens: parseInt(e.target.value, 10) || 4096 })
                }
                className="w-28"
              />
            </SettingRow>

            <div className="border rounded-lg p-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="temperature">Temperature</Label>
                  <span className="text-sm text-muted-foreground">
                    {settings.ai.temperature.toFixed(1)}
                  </span>
                </div>
                <Slider
                  id="temperature"
                  value={[settings.ai.temperature]}
                  onValueChange={([value]) => updateAI({ temperature: value })}
                  min={0}
                  max={2}
                  step={0.1}
                />
                <p className="text-xs text-muted-foreground">
                  Controls creativity: 0 is focused, 2 is highly creative
                </p>
                {validation.warnings['ai.temperature'] && (
                  <p className="text-xs text-yellow-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" aria-hidden="true" />
                    {validation.warnings['ai.temperature']}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="top-p">Top P (Nucleus Sampling)</Label>
                  <span className="text-sm text-muted-foreground">
                    {settings.ai.topP.toFixed(2)}
                  </span>
                </div>
                <Slider
                  id="top-p"
                  value={[settings.ai.topP]}
                  onValueChange={([value]) => updateAI({ topP: value })}
                  min={0}
                  max={1}
                  step={0.05}
                />
              </div>
            </div>

            <SettingRow
              id="stream-responses"
              label="Stream Responses"
              description="Show AI responses as they are generated"
            >
              <Switch
                id="stream-responses"
                checked={settings.ai.streamResponses}
                onCheckedChange={(checked) => updateAI({ streamResponses: checked })}
                aria-label="Stream responses"
              />
            </SettingRow>

            <SettingRow
              id="code-suggestions"
              label="Code Suggestions"
              description="Enable AI-powered code completions"
            >
              <Switch
                id="code-suggestions"
                checked={settings.ai.codeSuggestions}
                onCheckedChange={(checked) => updateAI({ codeSuggestions: checked })}
                aria-label="Enable code suggestions"
              />
            </SettingRow>

            <SettingRow
              id="autocomplete-delay"
              label="Auto-complete Delay"
              description="Delay before showing suggestions (in milliseconds)"
            >
              <Input
                id="autocomplete-delay"
                type="number"
                min={0}
                max={2000}
                step={50}
                value={settings.ai.autoCompleteDelay}
                onChange={(e) =>
                  updateAI({ autoCompleteDelay: parseInt(e.target.value, 10) || 300 })
                }
                className="w-24"
              />
            </SettingRow>
          </TabsContent>

          {/* Advanced Settings Tab */}
          <TabsContent value="advanced" className="space-y-4 mt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Advanced Settings</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleResetCategory('advanced')}
                aria-label="Reset advanced settings to defaults"
              >
                <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
                Reset
              </Button>
            </div>

            {/* Telemetry Section */}
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium">Privacy & Telemetry</h4>

              <SettingRow
                id="analytics"
                label="Anonymous Analytics"
                description="Help improve VibeCode by sharing anonymous usage data"
              >
                <Switch
                  id="analytics"
                  checked={settings.advanced.telemetry.analyticsEnabled}
                  onCheckedChange={(checked) =>
                    updateAdvanced({
                      telemetry: { ...settings.advanced.telemetry, analyticsEnabled: checked },
                    })
                  }
                  aria-label="Enable anonymous analytics"
                />
              </SettingRow>

              <SettingRow
                id="crash-reporting"
                label="Crash Reporting"
                description="Automatically send crash reports to help fix issues"
              >
                <Switch
                  id="crash-reporting"
                  checked={settings.advanced.telemetry.crashReporting}
                  onCheckedChange={(checked) =>
                    updateAdvanced({
                      telemetry: { ...settings.advanced.telemetry, crashReporting: checked },
                    })
                  }
                  aria-label="Enable crash reporting"
                />
              </SettingRow>

              <SettingRow
                id="performance-monitoring"
                label="Performance Monitoring"
                description="Track application performance metrics"
              >
                <Switch
                  id="performance-monitoring"
                  checked={settings.advanced.telemetry.performanceMonitoring}
                  onCheckedChange={(checked) =>
                    updateAdvanced({
                      telemetry: {
                        ...settings.advanced.telemetry,
                        performanceMonitoring: checked,
                      },
                    })
                  }
                  aria-label="Enable performance monitoring"
                />
              </SettingRow>
            </div>

            <SettingRow
              id="debug-mode"
              label="Debug Mode"
              description="Enable extra logging and developer features"
            >
              <Switch
                id="debug-mode"
                checked={settings.advanced.debugMode}
                onCheckedChange={(checked) => updateAdvanced({ debugMode: checked })}
                aria-label="Enable debug mode"
              />
            </SettingRow>
            {validation.warnings['advanced.debugMode'] && (
              <p className="text-xs text-yellow-600 flex items-center gap-1 ml-4">
                <AlertCircle className="h-3 w-3" aria-hidden="true" />
                {validation.warnings['advanced.debugMode']}
              </p>
            )}

            <SettingRow
              id="log-level"
              label="Log Level"
              description="Set the verbosity of application logs"
            >
              <Select
                value={settings.advanced.logLevel}
                onValueChange={(value) => updateAdvanced({ logLevel: value as LogLevel })}
              >
                <SelectTrigger id="log-level" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warn">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                  <SelectItem value="trace">Trace</SelectItem>
                </SelectContent>
              </Select>
            </SettingRow>

            <SettingRow
              id="data-directory"
              label="Data Directory"
              description="Custom path for application data storage"
            >
              <Input
                id="data-directory"
                type="text"
                value={settings.advanced.dataDirectory}
                onChange={(e) => updateAdvanced({ dataDirectory: e.target.value })}
                placeholder="Default location"
                className="w-64"
              />
            </SettingRow>

            <SettingRow
              id="hardware-acceleration"
              label="Hardware Acceleration"
              description="Use GPU for improved performance"
            >
              <Switch
                id="hardware-acceleration"
                checked={settings.advanced.hardwareAcceleration}
                onCheckedChange={(checked) =>
                  updateAdvanced({ hardwareAcceleration: checked })
                }
                aria-label="Enable hardware acceleration"
              />
            </SettingRow>

            <SettingRow
              id="experimental-features"
              label="Experimental Features"
              description="Enable features that are still in development"
            >
              <Switch
                id="experimental-features"
                checked={settings.advanced.experimentalFeatures}
                onCheckedChange={(checked) =>
                  updateAdvanced({ experimentalFeatures: checked })
                }
                aria-label="Enable experimental features"
              />
            </SettingRow>

            {/* Proxy Configuration */}
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium">Proxy Configuration</h4>

              <div className="space-y-2">
                <Label htmlFor="proxy-url">Proxy URL</Label>
                <Input
                  id="proxy-url"
                  type="text"
                  value={settings.advanced.proxyUrl}
                  onChange={(e) => updateAdvanced({ proxyUrl: e.target.value })}
                  placeholder="http://proxy.example.com:8080"
                  className="w-full"
                />
              </div>

              <SettingRow
                id="bypass-proxy-local"
                label="Bypass for Local"
                description="Skip proxy for local network addresses"
              >
                <Switch
                  id="bypass-proxy-local"
                  checked={settings.advanced.bypassProxyForLocal}
                  onCheckedChange={(checked) =>
                    updateAdvanced({ bypassProxyForLocal: checked })
                  }
                  aria-label="Bypass proxy for local addresses"
                />
              </SettingRow>
            </div>
          </TabsContent>
        </Tabs>

        {/* Validation Errors Display */}
        {Object.keys(validation.errors).length > 0 && (
          <div className="mt-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-medium text-destructive">
                  Please fix the following errors:
                </p>
                <ul className="mt-2 text-sm text-destructive space-y-1">
                  {Object.entries(validation.errors).map(([key, error]) => (
                    <li key={key}>
                      <span className="font-mono text-xs">{key}:</span> {error}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between border-t pt-6">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={saveStatus === 'saving'}
            aria-label="Reset all settings to defaults"
          >
            <RotateCcw className="h-4 w-4 mr-2" aria-hidden="true" />
            Reset All
          </Button>
          {isModal && (
            <Button
              variant="ghost"
              onClick={handleCancel}
              disabled={saveStatus === 'saving'}
            >
              Cancel
            </Button>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={saveStatus === 'saving' || !validation.isValid}
          aria-label="Save settings"
        >
          {saveStatus === 'saving' ? (
            <>Saving...</>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" aria-hidden="true" />
              Save Changes
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default SettingsPanel;
