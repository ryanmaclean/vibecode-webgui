/**
 * ModelDisplay Component
 *
 * Prominently displays the currently active AI model with key information
 * including name, provider, quality tier, speed, and context window.
 */

'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Sparkles, Zap, Maximize } from 'lucide-react';
import type { ModelProfile, QualityTier, SpeedTier } from '@/types/model-comparison';

// ============================================================================
// Types
// ============================================================================

interface ModelDisplayProps {
  /** Currently active model to display */
  model?: ModelProfile;
  /** Custom class name */
  className?: string;
  /** Whether to show detailed information */
  showDetails?: boolean;
  /** Compact mode for smaller display */
  compact?: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getQualityColor = (tier: QualityTier): string => {
  const colors: Record<QualityTier, string> = {
    basic: 'bg-gray-100 text-gray-600 border-gray-200',
    good: 'bg-blue-100 text-blue-700 border-blue-200',
    excellent: 'bg-green-100 text-green-700 border-green-200',
    state_of_art: 'bg-purple-100 text-purple-700 border-purple-200',
  };
  return colors[tier];
};

const getSpeedBadge = (tier: SpeedTier): string => {
  const badges: Record<SpeedTier, string> = {
    slow: 'bg-red-100 text-red-600 border-red-200',
    medium: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    fast: 'bg-green-100 text-green-700 border-green-200',
    very_fast: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  };
  return badges[tier];
};

const formatContext = (tokens: number): string => {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return tokens.toString();
};

const formatPrice = (price: number): string => {
  if (price === 0) return 'Free';
  if (price < 0.001) return `$${(price * 1000).toFixed(2)}/M`;
  return `$${price.toFixed(4)}/1K`;
};

const formatQualityTier = (tier: QualityTier): string => {
  const labels: Record<QualityTier, string> = {
    basic: 'Basic',
    good: 'Good',
    excellent: 'Excellent',
    state_of_art: 'State of the Art',
  };
  return labels[tier];
};

const formatSpeedTier = (tier: SpeedTier): string => {
  const labels: Record<SpeedTier, string> = {
    slow: 'Slow',
    medium: 'Medium',
    fast: 'Fast',
    very_fast: 'Very Fast',
  };
  return labels[tier];
};

// ============================================================================
// Main Component
// ============================================================================

const ModelDisplay: React.FC<ModelDisplayProps> = React.memo(({
  model,
  className = '',
  showDetails = true,
  compact = false,
}) => {
  if (!model) {
    return (
      <Card className={cn('border-dashed', className)}>
        <CardContent className="flex items-center justify-center py-8 text-gray-500">
          <div className="text-center">
            <Sparkles className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm font-medium">No model selected</p>
            <p className="text-xs mt-1">Select a model to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2 p-2 bg-white border rounded-lg', className)}>
        <Sparkles className="h-4 w-4 text-blue-500 flex-shrink-0" />
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="font-medium text-sm text-gray-900 truncate">{model.name}</span>
          <Badge variant="outline" className="text-xs flex-shrink-0">
            {model.provider.name}
          </Badge>
        </div>
        <Badge className={cn('text-xs flex-shrink-0', getQualityColor(model.qualityTier))}>
          {formatQualityTier(model.qualityTier)}
        </Badge>
      </div>
    );
  }

  return (
    <Card className={cn('border-blue-200 bg-gradient-to-br from-blue-50 to-white', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-500 flex-shrink-0" />
            <CardTitle className="text-lg">Active Model</CardTitle>
          </div>
          {model.deprecated && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
              Deprecated
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Model Name & Provider */}
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-1">{model.name}</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{model.provider.name}</span>
            {!model.provider.available && (
              <Badge variant="outline" className="text-xs bg-red-50 text-red-600 border-red-200">
                Unavailable
              </Badge>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="flex flex-wrap gap-2">
          <Badge className={cn('text-xs border', getQualityColor(model.qualityTier))}>
            {formatQualityTier(model.qualityTier)}
          </Badge>
          <Badge className={cn('text-xs border flex items-center gap-1', getSpeedBadge(model.performance.speedTier))}>
            <Zap className="h-3 w-3" />
            {formatSpeedTier(model.performance.speedTier)}
          </Badge>
          <Badge variant="outline" className="text-xs flex items-center gap-1">
            <Maximize className="h-3 w-3" />
            {formatContext(model.limits.contextWindow)} context
          </Badge>
          {model.pricing.isFree && (
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
              Free
            </Badge>
          )}
        </div>

        {/* Detailed Information */}
        {showDetails && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Input Cost</p>
              <p className="text-sm font-medium text-gray-900">
                {formatPrice(model.pricing.inputPer1K)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Output Cost</p>
              <p className="text-sm font-medium text-gray-900">
                {formatPrice(model.pricing.outputPer1K)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Max Output</p>
              <p className="text-sm font-medium text-gray-900">
                {formatContext(model.limits.maxOutputTokens)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Speed</p>
              <p className="text-sm font-medium text-gray-900">
                {model.performance.tokensPerSecond.toFixed(0)} tok/s
              </p>
            </div>
          </div>
        )}

        {/* Capabilities */}
        {showDetails && (
          <div className="flex flex-wrap gap-1.5">
            {model.capabilities.coding >= 70 && (
              <Badge variant="secondary" className="text-xs">
                Coding
              </Badge>
            )}
            {model.capabilities.reasoning >= 70 && (
              <Badge variant="secondary" className="text-xs">
                Reasoning
              </Badge>
            )}
            {model.capabilities.vision > 0 && (
              <Badge variant="secondary" className="text-xs">
                Vision
              </Badge>
            )}
            {model.capabilities.function_calling && (
              <Badge variant="secondary" className="text-xs">
                Function Calling
              </Badge>
            )}
            {model.capabilities.math >= 70 && (
              <Badge variant="secondary" className="text-xs">
                Math
              </Badge>
            )}
          </div>
        )}

        {/* Description */}
        {showDetails && model.description && (
          <p className="text-xs text-gray-600 line-clamp-2">{model.description}</p>
        )}
      </CardContent>
    </Card>
  );
});

ModelDisplay.displayName = 'ModelDisplay';

export default ModelDisplay;
