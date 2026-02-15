'use client';

import * as React from 'react';
import { useState, useRef, useCallback } from 'react';
import { Upload, X, Loader2, CheckCircle, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/**
 * Props for PluginInstaller component
 */
export interface PluginInstallerProps {
  /** Callback when plugin is installed successfully */
  onInstallComplete?: (pluginId: string) => void;
  /** Callback when installation fails */
  onInstallError?: (error: Error) => void;
  /** Callback when installer is closed */
  onClose?: () => void;
  /** Additional class name */
  className?: string;
  /** Whether the installer is disabled */
  disabled?: boolean;
}

/**
 * Install method type
 */
type InstallMethod = 'url' | 'file';

/**
 * Installation status
 */
interface InstallStatus {
  state: 'idle' | 'installing' | 'success' | 'error';
  message?: string;
  pluginId?: string;
  warnings?: string[];
}

/**
 * Install options
 */
interface InstallOptions {
  force: boolean;
  skipValidation: boolean;
  autoEnable: boolean;
}

/**
 * Plugin Installer Component
 * Provides UI for installing plugins via URL or file upload
 */
export const PluginInstaller = React.memo(function PluginInstaller({
  onInstallComplete,
  onInstallError,
  onClose,
  className,
  disabled = false
}: PluginInstallerProps) {
  const [installMethod, setInstallMethod] = useState<InstallMethod>('url');
  const [pluginUrl, setPluginUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [installStatus, setInstallStatus] = useState<InstallStatus>({ state: 'idle' });
  const [options, setOptions] = useState<InstallOptions>({
    force: false,
    skipValidation: false,
    autoEnable: true,
  });
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handle drag over event
   */
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && installStatus.state !== 'installing') {
      setIsDragging(true);
    }
  }, [disabled, installStatus.state]);

  /**
   * Handle drag leave event
   */
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  /**
   * Handle drop event
   */
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || installStatus.state === 'installing') {
      return;
    }

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setSelectedFile(files[0]);
      setInstallStatus({ state: 'idle' });
    }
  }, [disabled, installStatus.state]);

  /**
   * Handle file selection via input
   */
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setInstallStatus({ state: 'idle' });
    }
  }, []);

  /**
   * Trigger file input click
   */
  const handleClickUpload = useCallback(() => {
    if (!disabled && installStatus.state !== 'installing') {
      fileInputRef.current?.click();
    }
  }, [disabled, installStatus.state]);

  /**
   * Remove selected file
   */
  const handleRemoveFile = useCallback(() => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setInstallStatus({ state: 'idle' });
  }, []);

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  /**
   * Install plugin from URL
   */
  const installFromUrl = async () => {
    if (!pluginUrl.trim()) {
      setInstallStatus({
        state: 'error',
        message: 'Please enter a plugin URL',
      });
      return;
    }

    setInstallStatus({ state: 'installing', message: 'Installing plugin...' });

    try {
      const response = await fetch('/api/plugins/install', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          source: pluginUrl,
          force: options.force,
          skipValidation: options.skipValidation,
          autoEnable: options.autoEnable,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to install plugin');
      }

      setInstallStatus({
        state: 'success',
        message: `Plugin installed successfully`,
        pluginId: data.pluginId,
        warnings: data.warnings,
      });

      if (onInstallComplete && data.pluginId) {
        onInstallComplete(data.pluginId);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setInstallStatus({
        state: 'error',
        message: errorMessage,
      });

      if (onInstallError) {
        onInstallError(error instanceof Error ? error : new Error(errorMessage));
      }
    }
  };

  /**
   * Install plugin from file
   */
  const installFromFile = async () => {
    if (!selectedFile) {
      setInstallStatus({
        state: 'error',
        message: 'Please select a plugin file',
      });
      return;
    }

    setInstallStatus({ state: 'installing', message: 'Uploading and installing plugin...' });

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('force', options.force.toString());
      formData.append('skipValidation', options.skipValidation.toString());
      formData.append('autoEnable', options.autoEnable.toString());

      const response = await fetch('/api/plugins/install', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to install plugin');
      }

      setInstallStatus({
        state: 'success',
        message: `Plugin installed successfully`,
        pluginId: data.pluginId,
        warnings: data.warnings,
      });

      if (onInstallComplete && data.pluginId) {
        onInstallComplete(data.pluginId);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setInstallStatus({
        state: 'error',
        message: errorMessage,
      });

      if (onInstallError) {
        onInstallError(error instanceof Error ? error : new Error(errorMessage));
      }
    }
  };

  /**
   * Handle install button click
   */
  const handleInstall = useCallback(() => {
    if (installMethod === 'url') {
      installFromUrl();
    } else {
      installFromFile();
    }
  }, [installMethod, pluginUrl, selectedFile, options]);

  /**
   * Reset form
   */
  const handleReset = useCallback(() => {
    setPluginUrl('');
    setSelectedFile(null);
    setInstallStatus({ state: 'idle' });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const isInstalling = installStatus.state === 'installing';
  const canInstall =
    (installMethod === 'url' && pluginUrl.trim()) ||
    (installMethod === 'file' && selectedFile);

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <CardTitle>Install Plugin</CardTitle>
        <CardDescription>
          Install a plugin from a URL or upload a plugin package file
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Installation Method Tabs */}
        <Tabs value={installMethod} onValueChange={(value) => setInstallMethod(value as InstallMethod)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="url" disabled={isInstalling}>
              <LinkIcon className="w-4 h-4 mr-2" />
              From URL
            </TabsTrigger>
            <TabsTrigger value="file" disabled={isInstalling}>
              <Upload className="w-4 h-4 mr-2" />
              Upload File
            </TabsTrigger>
          </TabsList>

          {/* URL Installation */}
          <TabsContent value="url" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="plugin-url">Plugin URL</Label>
              <Input
                id="plugin-url"
                type="url"
                placeholder="https://example.com/my-plugin.zip"
                value={pluginUrl}
                onChange={(e) => setPluginUrl(e.target.value)}
                disabled={isInstalling || disabled}
              />
              <p className="text-xs text-muted-foreground">
                Enter the URL to a plugin package (zip, tar.gz, or directory)
              </p>
            </div>
          </TabsContent>

          {/* File Upload Installation */}
          <TabsContent value="file" className="space-y-4 mt-4">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.tar,.tar.gz,.tgz"
              onChange={handleFileInputChange}
              className="hidden"
              disabled={isInstalling || disabled}
            />

            {/* Drag-drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={handleClickUpload}
              className={cn(
                'relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200',
                isDragging
                  ? 'border-primary bg-primary/5 scale-[1.02]'
                  : 'border-border hover:border-primary/50',
                (isInstalling || disabled) && 'opacity-50 cursor-not-allowed'
              )}
              role="button"
              tabIndex={0}
              aria-label="Upload plugin file"
              aria-disabled={isInstalling || disabled}
            >
              <Upload
                className={cn(
                  'w-12 h-12 mx-auto mb-4',
                  isDragging ? 'text-primary animate-bounce' : 'text-muted-foreground'
                )}
              />
              <p className="text-sm font-medium mb-2">
                {isDragging ? 'Drop plugin file here' : 'Drag & drop plugin file here'}
              </p>
              <p className="text-xs text-muted-foreground">
                or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Supported: .zip, .tar, .tar.gz (max 50MB)
              </p>
            </div>

            {/* Selected file preview */}
            {selectedFile && (
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Upload className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveFile}
                  disabled={isInstalling}
                  aria-label="Remove file"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Install Options */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Install Options</h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-enable" className="text-sm font-normal">
                  Auto-enable after install
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically enable the plugin after installation
                </p>
              </div>
              <Switch
                id="auto-enable"
                checked={options.autoEnable}
                onCheckedChange={(checked) => setOptions({ ...options, autoEnable: checked })}
                disabled={isInstalling || disabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="force-install" className="text-sm font-normal">
                  Force install
                </Label>
                <p className="text-xs text-muted-foreground">
                  Overwrite existing plugin if already installed
                </p>
              </div>
              <Switch
                id="force-install"
                checked={options.force}
                onCheckedChange={(checked) => setOptions({ ...options, force: checked })}
                disabled={isInstalling || disabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="skip-validation" className="text-sm font-normal">
                  Skip validation
                </Label>
                <p className="text-xs text-muted-foreground">
                  Skip manifest validation (not recommended)
                </p>
              </div>
              <Switch
                id="skip-validation"
                checked={options.skipValidation}
                onCheckedChange={(checked) => setOptions({ ...options, skipValidation: checked })}
                disabled={isInstalling || disabled}
              />
            </div>
          </div>
        </div>

        {/* Status Messages */}
        {installStatus.state === 'installing' && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>{installStatus.message}</AlertDescription>
          </Alert>
        )}

        {installStatus.state === 'success' && (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-900/20">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              {installStatus.message}
              {installStatus.pluginId && (
                <span className="block text-xs mt-1">Plugin ID: {installStatus.pluginId}</span>
              )}
              {installStatus.warnings && installStatus.warnings.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-xs font-medium">Warnings:</p>
                  {installStatus.warnings.map((warning, idx) => (
                    <p key={idx} className="text-xs">• {warning}</p>
                  ))}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {installStatus.state === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{installStatus.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <div className="flex gap-2">
          {onClose && (
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isInstalling}
            >
              Close
            </Button>
          )}
          {installStatus.state === 'success' && (
            <Button
              variant="outline"
              onClick={handleReset}
            >
              Install Another
            </Button>
          )}
        </div>
        <Button
          onClick={handleInstall}
          disabled={!canInstall || isInstalling || disabled}
        >
          {isInstalling ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Installing...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Install Plugin
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
});

PluginInstaller.displayName = 'PluginInstaller';
