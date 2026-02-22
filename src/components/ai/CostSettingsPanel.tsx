/**
 * AI Cost Settings Panel Component
 *
 * Provides an editable form for configuring cost tracking settings including:
 * - Budget limits (monthly, daily, session)
 * - Display preferences
 * - Alert thresholds
 * - Feature toggles
 *
 * @module components/ai/CostSettingsPanel
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  DollarSign,
  Save,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Settings,
  Bell,
  Eye,
  Lightbulb,
} from 'lucide-react';
import {
  CostSettings,
  DEFAULT_COST_SETTINGS,
} from '@/types/cost-estimation';
import { getCostTracker, CostTracker } from '@/lib/ai/cost/cost-tracker';

// ============================================================================
// Types
// ============================================================================

interface CostSettingsPanelProps {
  /** Custom CSS class name */
  className?: string;
  /** Custom cost tracker instance */
  costTracker?: CostTracker;
  /** Callback when settings are saved */
  onSettingsSaved?: (settings: CostSettings) => void;
  /** Callback when settings change (before save) */
  onSettingsChange?: (settings: CostSettings) => void;
  /** Show compact version */
  compact?: boolean;
}

interface FormErrors {
  monthlyBudget?: string;
  dailyBudget?: string;
  sessionBudget?: string;
  warningThreshold?: string;
  criticalThreshold?: string;
  dailyWarning?: string;
  sessionWarning?: string;
}

type SaveState = 'idle' | 'saving' | 'success' | 'error';

// ============================================================================
// Utility Functions
// ============================================================================

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function validateBudget(value: string, fieldName: string): string | undefined {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return `${fieldName} must be a valid number`;
  }
  if (num < 0) {
    return `${fieldName} cannot be negative`;
  }
  if (num > 100000) {
    return `${fieldName} seems unreasonably high`;
  }
  return undefined;
}

function validateThreshold(value: string, fieldName: string): string | undefined {
  const num = parseFloat(value);
  if (isNaN(num)) {
    return `${fieldName} must be a valid number`;
  }
  if (num < 0 || num > 100) {
    return `${fieldName} must be between 0 and 100`;
  }
  return undefined;
}

// ============================================================================
// Main Component
// ============================================================================

export function CostSettingsPanel({
  className = '',
  costTracker,
  onSettingsSaved,
  onSettingsChange,
  compact = false,
}: CostSettingsPanelProps) {
  const tracker = costTracker || getCostTracker();

  // State
  const [settings, setSettings] = useState<CostSettings>(DEFAULT_COST_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<CostSettings>(DEFAULT_COST_SETTINGS);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [errors, setErrors] = useState<FormErrors>({});
  const [saveMessage, setSaveMessage] = useState<string>('');

  // ============================================================================
  // Effects
  // ============================================================================

  // Load settings on mount
  useEffect(() => {
    const currentSettings = tracker.getSettings();
    setSettings(currentSettings);
    setOriginalSettings(currentSettings);
  }, [tracker]);

  // Notify parent of changes
  useEffect(() => {
    if (onSettingsChange && JSON.stringify(settings) !== JSON.stringify(originalSettings)) {
      onSettingsChange(settings);
    }
  }, [settings, originalSettings, onSettingsChange]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleBudgetChange = useCallback((field: keyof CostSettings, value: string) => {
    const numValue = parseFloat(value) || 0;
    setSettings((prev) => ({
      ...prev,
      [field]: numValue,
    }));

    // Validate
    const error = validateBudget(value, field.toString());
    setErrors((prev) => ({
      ...prev,
      [field]: error,
    }));
  }, []);

  const handleThresholdChange = useCallback((
    field: keyof CostSettings['alertThresholds'],
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    setSettings((prev) => ({
      ...prev,
      alertThresholds: {
        ...prev.alertThresholds,
        [field]: numValue,
      },
    }));

    // Validate
    const error = validateThreshold(value, field.toString());
    setErrors((prev) => ({
      ...prev,
      [field]: error,
    }));
  }, []);

  const handleToggleChange = useCallback((field: keyof CostSettings, value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const handleReset = useCallback(() => {
    setSettings(originalSettings);
    setErrors({});
    setSaveState('idle');
    setSaveMessage('');
  }, [originalSettings]);

  const handleSave = useCallback(async () => {
    // Validate all fields
    const newErrors: FormErrors = {};

    const monthlyError = validateBudget(settings.monthlyBudget.toString(), 'Monthly budget');
    if (monthlyError) newErrors.monthlyBudget = monthlyError;

    const dailyError = validateBudget(settings.dailyBudget.toString(), 'Daily budget');
    if (dailyError) newErrors.dailyBudget = dailyError;

    const sessionError = validateBudget(settings.sessionBudget.toString(), 'Session budget');
    if (sessionError) newErrors.sessionBudget = sessionError;

    const warningError = validateThreshold(
      settings.alertThresholds.warning.toString(),
      'Warning threshold'
    );
    if (warningError) newErrors.warningThreshold = warningError;

    const criticalError = validateThreshold(
      settings.alertThresholds.critical.toString(),
      'Critical threshold'
    );
    if (criticalError) newErrors.criticalThreshold = criticalError;

    // Check that critical > warning
    if (settings.alertThresholds.critical <= settings.alertThresholds.warning) {
      newErrors.criticalThreshold = 'Critical threshold must be greater than warning threshold';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      setSaveState('error');
      setSaveMessage('Please fix validation errors before saving');
      return;
    }

    // Save settings
    setSaveState('saving');
    setSaveMessage('');

    try {
      // Call API to save settings
      const response = await fetch('/api/ai/costs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_settings',
          settings: {
            monthlyBudget: settings.monthlyBudget,
            dailyBudget: settings.dailyBudget,
            sessionBudget: settings.sessionBudget,
            displayMode: settings.displayMode,
            showEstimatesBeforeSend: settings.showEstimatesBeforeSend,
            showRealtimeCosts: settings.showRealtimeCosts,
            enableOptimizationSuggestions: settings.enableOptimizationSuggestions,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to save settings');
      }

      // Update local tracker
      tracker.updateSettings(settings);

      // Update original settings to reflect saved state
      setOriginalSettings(settings);

      setSaveState('success');
      setSaveMessage('Settings saved successfully');

      // Call callback
      if (onSettingsSaved) {
        onSettingsSaved(settings);
      }

      // Reset success state after 3 seconds
      setTimeout(() => {
        setSaveState('idle');
        setSaveMessage('');
      }, 3000);
    } catch (error) {
      setSaveState('error');
      setSaveMessage(error instanceof Error ? error.message : 'Failed to save settings');

      // Reset error state after 5 seconds
      setTimeout(() => {
        setSaveState('idle');
      }, 5000);
    }
  }, [settings, tracker, onSettingsSaved]);

  // Check if settings have changed
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Cost Settings
            </CardTitle>
            <CardDescription>
              Configure budget limits, alerts, and cost tracking preferences
            </CardDescription>
          </div>
          {hasChanges && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
              Unsaved Changes
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Budget Limits Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Budget Limits</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Set spending limits to control costs. Use 0 for unlimited.
          </p>

          <div className="grid gap-4 md:grid-cols-3">
            {/* Monthly Budget */}
            <div className="space-y-2">
              <Label htmlFor="monthly-budget" className="text-xs">
                Monthly Budget
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  data-testid="monthly-budget-input"
                  id="monthly-budget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.monthlyBudget}
                  onChange={(e) => handleBudgetChange('monthlyBudget', e.target.value)}
                  className="pl-6"
                  error={errors.monthlyBudget}
                />
              </div>
              {errors.monthlyBudget && (
                <p className="text-xs text-red-500">{errors.monthlyBudget}</p>
              )}
            </div>

            {/* Daily Budget */}
            <div className="space-y-2">
              <Label htmlFor="daily-budget" className="text-xs">
                Daily Budget
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  data-testid="daily-budget-input"
                  id="daily-budget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.dailyBudget}
                  onChange={(e) => handleBudgetChange('dailyBudget', e.target.value)}
                  className="pl-6"
                  error={errors.dailyBudget}
                />
              </div>
              {errors.dailyBudget && (
                <p className="text-xs text-red-500">{errors.dailyBudget}</p>
              )}
            </div>

            {/* Session Budget */}
            <div className="space-y-2">
              <Label htmlFor="session-budget" className="text-xs">
                Session Budget
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  data-testid="session-budget-input"
                  id="session-budget"
                  type="number"
                  min="0"
                  step="0.01"
                  value={settings.sessionBudget}
                  onChange={(e) => handleBudgetChange('sessionBudget', e.target.value)}
                  className="pl-6"
                  error={errors.sessionBudget}
                />
              </div>
              {errors.sessionBudget && (
                <p className="text-xs text-red-500">{errors.sessionBudget}</p>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Alert Thresholds Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Alert Thresholds</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Set percentage thresholds for budget alerts (0-100%).
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Warning Threshold */}
            <div className="space-y-2">
              <Label htmlFor="warning-threshold" className="text-xs">
                Warning Threshold (%)
              </Label>
              <Input
                data-testid="warning-threshold-input"
                id="warning-threshold"
                type="number"
                min="0"
                max="100"
                step="1"
                value={settings.alertThresholds.warning}
                onChange={(e) => handleThresholdChange('warning', e.target.value)}
                error={errors.warningThreshold}
              />
              {errors.warningThreshold && (
                <p className="text-xs text-red-500">{errors.warningThreshold}</p>
              )}
            </div>

            {/* Critical Threshold */}
            <div className="space-y-2">
              <Label htmlFor="critical-threshold" className="text-xs">
                Critical Threshold (%)
              </Label>
              <Input
                data-testid="critical-threshold-input"
                id="critical-threshold"
                type="number"
                min="0"
                max="100"
                step="1"
                value={settings.alertThresholds.critical}
                onChange={(e) => handleThresholdChange('critical', e.target.value)}
                error={errors.criticalThreshold}
              />
              {errors.criticalThreshold && (
                <p className="text-xs text-red-500">{errors.criticalThreshold}</p>
              )}
            </div>

            {/* Daily Warning */}
            <div className="space-y-2">
              <Label htmlFor="daily-warning" className="text-xs">
                Daily Warning (%)
              </Label>
              <Input
                id="daily-warning"
                type="number"
                min="0"
                max="100"
                step="1"
                value={settings.alertThresholds.dailyWarning}
                onChange={(e) => handleThresholdChange('dailyWarning', e.target.value)}
                error={errors.dailyWarning}
              />
              {errors.dailyWarning && (
                <p className="text-xs text-red-500">{errors.dailyWarning}</p>
              )}
            </div>

            {/* Session Warning */}
            <div className="space-y-2">
              <Label htmlFor="session-warning" className="text-xs">
                Session Warning (%)
              </Label>
              <Input
                id="session-warning"
                type="number"
                min="0"
                max="100"
                step="1"
                value={settings.alertThresholds.sessionWarning}
                onChange={(e) => handleThresholdChange('sessionWarning', e.target.value)}
                error={errors.sessionWarning}
              />
              {errors.sessionWarning && (
                <p className="text-xs text-red-500">{errors.sessionWarning}</p>
              )}
            </div>
          </div>
        </div>

        <Separator />

        {/* Display & Feature Toggles Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Display & Features</h3>
          </div>

          <div className="space-y-4">
            {/* Show Estimates Before Send */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-estimates" className="text-sm font-normal">
                  Show cost estimates before sending
                </Label>
                <p className="text-xs text-muted-foreground">
                  Preview the estimated cost before making AI requests
                </p>
              </div>
              <Switch
                data-testid="show-estimates-toggle"
                id="show-estimates"
                checked={settings.showEstimatesBeforeSend}
                onCheckedChange={(checked) =>
                  handleToggleChange('showEstimatesBeforeSend', checked)
                }
              />
            </div>

            {/* Show Realtime Costs */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-realtime" className="text-sm font-normal">
                  Show real-time cost tracking
                </Label>
                <p className="text-xs text-muted-foreground">
                  Display live cost updates during sessions
                </p>
              </div>
              <Switch
                id="show-realtime"
                checked={settings.showRealtimeCosts}
                onCheckedChange={(checked) =>
                  handleToggleChange('showRealtimeCosts', checked)
                }
              />
            </div>

            {/* Enable Optimization Suggestions */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="optimization" className="text-sm font-normal">
                  Enable cost optimization suggestions
                </Label>
                <p className="text-xs text-muted-foreground">
                  Get recommendations for more cost-effective models
                </p>
              </div>
              <Switch
                id="optimization"
                checked={settings.enableOptimizationSuggestions}
                onCheckedChange={(checked) =>
                  handleToggleChange('enableOptimizationSuggestions', checked)
                }
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {saveMessage && (
              <div
                className={`flex items-center gap-2 text-sm ${
                  saveState === 'success'
                    ? 'text-green-600'
                    : saveState === 'error'
                    ? 'text-red-600'
                    : 'text-muted-foreground'
                }`}
              >
                {saveState === 'success' && <CheckCircle2 className="h-4 w-4" />}
                {saveState === 'error' && <XCircle className="h-4 w-4" />}
                <span>{saveMessage}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={!hasChanges || saveState === 'saving'}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || saveState === 'saving'}
            >
              {saveState === 'saving' ? (
                <>
                  <RefreshCw data-testid="save-spinner" className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default CostSettingsPanel;
