/**
 * ChatSettings Component
 *
 * Settings panel for chat-specific configuration including RAG context toggle.
 *
 * Features:
 * - RAG (Retrieval Augmented Generation) context toggle
 * - Persistent state management via localStorage
 * - WCAG 2.1 AA compliant accessibility
 *
 * @module components/chat-settings
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Brain, Info } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ============================================================================
// Constants
// ============================================================================

const RAG_ENABLED_KEY = 'vibecode-rag-enabled';

// ============================================================================
// Types
// ============================================================================

export interface ChatSettingsProps {
  /** Callback when RAG setting changes */
  onRAGToggle?: (enabled: boolean) => void;
  /** Custom className */
  className?: string;
}

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
  badge?: React.ReactNode;
}

function SettingRow({ id, label, description, children, badge }: SettingRowProps) {
  return (
    <div className="flex items-start justify-between p-4 border rounded-lg">
      <div className="space-y-1 flex-1 mr-4">
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="text-base font-medium">
            {label}
          </Label>
          {badge}
        </div>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ChatSettings({
  onRAGToggle,
  className,
}: ChatSettingsProps) {
  const [ragEnabled, setRAGEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load RAG setting from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(RAG_ENABLED_KEY);
      if (saved !== null) {
        const enabled = JSON.parse(saved);
        setRAGEnabled(enabled);
      }
    } catch (error) {
      console.error('Failed to load RAG setting:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle RAG toggle
  const handleRAGToggle = useCallback((checked: boolean) => {
    setRAGEnabled(checked);

    // Persist to localStorage
    try {
      localStorage.setItem(RAG_ENABLED_KEY, JSON.stringify(checked));
    } catch (error) {
      console.error('Failed to save RAG setting:', error);
    }

    // Notify parent component
    onRAGToggle?.(checked);
  }, [onRAGToggle]);

  if (isLoading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardContent className="flex items-center justify-center min-h-[200px]">
          <div className="text-muted-foreground">Loading settings...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" aria-hidden="true" />
              Chat Settings
            </CardTitle>
            <CardDescription>
              Configure AI chat behavior and context options
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <SettingRow
          id="rag-enabled"
          label="RAG Context"
          description="Enable Retrieval Augmented Generation to provide AI with relevant codebase context for more accurate suggestions"
          badge={
            <Badge variant="secondary" className="flex items-center gap-1">
              <Info className="h-3 w-3" aria-hidden="true" />
              Beta
            </Badge>
          }
        >
          <Switch
            id="rag-enabled"
            checked={ragEnabled}
            onCheckedChange={handleRAGToggle}
            aria-label="Enable RAG context"
          />
        </SettingRow>

        {ragEnabled && (
          <div className="p-4 bg-muted/50 border rounded-lg">
            <div className="space-y-2 text-sm">
              <p className="font-medium text-foreground">How RAG Context Works:</p>
              <ul className="list-disc list-inside space-y-1 ml-2 text-muted-foreground">
                <li>Searches your entire codebase semantically</li>
                <li>Retrieves relevant code snippets for your question</li>
                <li>Provides AI with complete context for accurate answers</li>
                <li>Eliminates fabricated details about your code</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ChatSettings;

/**
 * Hook to access and update RAG enabled setting
 */
export function useRAGEnabled(): [boolean, (enabled: boolean) => void] {
  const [ragEnabled, setRAGEnabled] = useState(false);

  // Load initial value
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(RAG_ENABLED_KEY);
      if (saved !== null) {
        setRAGEnabled(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load RAG setting:', error);
    }
  }, []);

  // Update function
  const updateRAGEnabled = useCallback((enabled: boolean) => {
    setRAGEnabled(enabled);
    try {
      localStorage.setItem(RAG_ENABLED_KEY, JSON.stringify(enabled));
    } catch (error) {
      console.error('Failed to save RAG setting:', error);
    }
  }, []);

  return [ragEnabled, updateRAGEnabled];
}
