/**
 * SaveAsTemplateDialog Component
 * Dialog for saving a workspace configuration as a reusable template
 *
 * Features:
 * - Form for template name, description, visibility
 * - Optional tags, framework, and language metadata
 * - Integration with workspace template API
 * - Error handling and validation
 * - Loading states during save operation
 */

'use client';

import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

// Types
export interface SaveAsTemplateDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Callback to close the dialog */
  onClose: () => void;
  /** Workspace ID to save as template */
  workspaceId: string;
  /** Callback when template is successfully saved */
  onSuccess?: (templateId: number) => void;
  /** Pre-filled template name (optional) */
  defaultName?: string;
}

interface TemplateFormData {
  name: string;
  description: string;
  is_public: boolean;
  tags: string;
  framework: string;
  language: string;
}

interface SaveTemplateResponse {
  success: boolean;
  message: string;
  template: {
    id: number;
    name: string;
    description: string | null;
    is_public: boolean;
    tags: string | null;
    framework: string | null;
    language: string | null;
    created_at: Date;
  };
}

/**
 * SaveAsTemplateDialog
 * Dialog component for saving workspace as template
 */
export function SaveAsTemplateDialog({
  isOpen,
  onClose,
  workspaceId,
  onSuccess,
  defaultName = '',
}: SaveAsTemplateDialogProps) {
  // Form state
  const [formData, setFormData] = useState<TemplateFormData>({
    name: defaultName,
    description: '',
    is_public: false,
    tags: '',
    framework: '',
    language: '',
  });

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /**
   * Reset form to initial state
   */
  const resetForm = useCallback(() => {
    setFormData({
      name: defaultName,
      description: '',
      is_public: false,
      tags: '',
      framework: '',
      language: '',
    });
    setError(null);
    setFieldErrors({});
  }, [defaultName]);

  /**
   * Handle dialog close with cleanup
   */
  const handleClose = useCallback(() => {
    if (!isLoading) {
      resetForm();
      onClose();
    }
  }, [isLoading, resetForm, onClose]);

  /**
   * Update form field value
   */
  const updateField = useCallback((field: keyof TemplateFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear field error when user starts typing
    setFieldErrors((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
    setError(null);
  }, []);

  /**
   * Validate form data
   */
  const validateForm = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Template name is required';
    } else if (formData.name.length > 255) {
      errors.name = 'Template name cannot exceed 255 characters';
    }

    if (formData.description.length > 1000) {
      errors.description = 'Description cannot exceed 1000 characters';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  /**
   * Handle form submission
   */
  const handleSave = useCallback(async () => {
    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[SaveAsTemplateDialog] Saving workspace as template', {
        workspaceId,
        templateName: formData.name,
      });

      // Call API to save workspace as template
      const response = await fetch(`/api/workspaces/${workspaceId}/template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || undefined,
          is_public: formData.is_public,
          tags: formData.tags || undefined,
          framework: formData.framework || undefined,
          language: formData.language || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || 'Failed to save template');
      }

      const data: SaveTemplateResponse = await response.json();

      console.log('[SaveAsTemplateDialog] Template saved successfully', {
        templateId: data.template.id,
        templateName: data.template.name,
      });

      // Call success callback
      if (onSuccess) {
        onSuccess(data.template.id);
      }

      // Close dialog
      resetForm();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save template';
      console.error('[SaveAsTemplateDialog] Error saving template:', err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, formData, validateForm, onSuccess, onClose, resetForm]);

  /**
   * Handle Enter key in form inputs
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && e.currentTarget.tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave]
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>
            Save this workspace configuration as a reusable template. You can use it to create new
            workspaces with the same settings.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Template Name */}
          <div className="grid gap-2">
            <Label htmlFor="template-name">
              Template Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="template-name"
              placeholder="e.g., Next.js Starter Template"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              error={fieldErrors.name}
              className={cn(fieldErrors.name && 'border-red-500')}
              autoFocus
            />
            {fieldErrors.name && (
              <p className="text-sm text-red-500" role="alert">
                {fieldErrors.name}
              </p>
            )}
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              placeholder="Describe what this template includes..."
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              disabled={isLoading}
              rows={3}
              className={cn(fieldErrors.description && 'border-red-500')}
            />
            {fieldErrors.description && (
              <p className="text-sm text-red-500" role="alert">
                {fieldErrors.description}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {formData.description.length}/1000 characters
            </p>
          </div>

          {/* Public Visibility */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="template-public">Make Public</Label>
              <p className="text-xs text-muted-foreground">
                Allow other users to see and use this template
              </p>
            </div>
            <Switch
              id="template-public"
              checked={formData.is_public}
              onCheckedChange={(checked) => updateField('is_public', checked)}
              disabled={isLoading}
            />
          </div>

          {/* Tags */}
          <div className="grid gap-2">
            <Label htmlFor="template-tags">Tags (Optional)</Label>
            <Input
              id="template-tags"
              placeholder="e.g., react, typescript, tailwind"
              value={formData.tags}
              onChange={(e) => updateField('tags', e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">Comma-separated tags for filtering</p>
          </div>

          {/* Framework & Language (collapsed in one row) */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="template-framework">Framework</Label>
              <Input
                id="template-framework"
                placeholder="e.g., Next.js"
                value={formData.framework}
                onChange={(e) => updateField('framework', e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="template-language">Language</Label>
              <Input
                id="template-language"
                placeholder="e.g., TypeScript"
                value={formData.language}
                onChange={(e) => updateField('language', e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div
              className="rounded-md bg-red-50 border border-red-200 p-3"
              role="alert"
              aria-live="polite"
            >
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !formData.name.trim()}>
            {isLoading ? 'Saving...' : 'Save Template'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

SaveAsTemplateDialog.displayName = 'SaveAsTemplateDialog';

export { SaveAsTemplateDialog as default };
