/**
 * AI Cost Estimator Component
 *
 * Provides real-time cost estimation before sending messages:
 * - Estimates cost for the selected model
 * - Compares costs across multiple models
 * - Highlights cost-effective alternatives
 * - Shows potential savings
 *
 * @module components/ai/CostEstimator
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip } from '@/components/ui/tooltip';
import {
  DollarSign,
  TrendingDown,
  Zap,
  AlertCircle,
  Info,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  ArrowRight,
} from 'lucide-react';
import {
  CostEstimate,
  CostComparison,
  ModelCostEstimate,
  EstimateConfidence,
  ModelTier,
} from '@/types/cost-estimation';
import { getCostTracker, CostTracker, MODEL_PRICING } from '@/lib/ai/cost/cost-tracker';

// ============================================================================
// Types
// ============================================================================

interface CostEstimatorProps {
  /** The message text to estimate cost for */
  message: string;
  /** Currently selected model ID */
  selectedModel: string;
  /** Callback when user selects a different model */
  onModelSelect?: (modelId: string) => void;
  /** Show expanded comparison view by default */
  expandedByDefault?: boolean;
  /** Custom CSS class name */
  className?: string;
  /** Custom cost tracker instance */
  costTracker?: CostTracker;
  /** Estimated output tokens (optional, will be estimated if not provided) */
  estimatedOutputTokens?: number;
  /** Show compact inline version */
  inline?: boolean;
  /** Show model comparison */
  showComparison?: boolean;
  /** Maximum number of models to compare */
  maxComparisonModels?: number;
}

// ============================================================================
// Constants
// ============================================================================

const TIER_COLORS: Record<ModelTier, string> = {
  economy: 'bg-green-100 text-green-800 border-green-200',
  standard: 'bg-blue-100 text-blue-800 border-blue-200',
  premium: 'bg-purple-100 text-purple-800 border-purple-200',
  enterprise: 'bg-amber-100 text-amber-800 border-amber-200',
};

const TIER_LABELS: Record<ModelTier, string> = {
  economy: 'Economy',
  standard: 'Standard',
  premium: 'Premium',
  enterprise: 'Enterprise',
};

const CONFIDENCE_INFO: Record<EstimateConfidence, { color: string; label: string; description: string }> = {
  high: {
    color: 'text-green-600',
    label: 'High',
    description: 'Estimate based on confirmed pricing and specified output tokens',
  },
  medium: {
    color: 'text-yellow-600',
    label: 'Medium',
    description: 'Output tokens estimated based on typical response patterns',
  },
  low: {
    color: 'text-red-600',
    label: 'Low',
    description: 'Pricing is estimated or model information unavailable',
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.0001) return `$${cost.toFixed(8)}`;
  if (cost < 0.01) return `$${cost.toFixed(6)}`;
  if (cost < 1) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
  return tokens.toString();
}

// ============================================================================
// Sub-Components
// ============================================================================

interface InlineCostDisplayProps {
  estimate: CostEstimate;
  className?: string;
}

function InlineCostDisplay({ estimate, className = '' }: InlineCostDisplayProps) {
  const confidenceInfo = CONFIDENCE_INFO[estimate.confidence];

  return (
    <div className={`flex items-center space-x-2 text-sm ${className}`}>
      <DollarSign className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium">{formatCost(estimate.estimatedCost)}</span>
      <Tooltip content={confidenceInfo.description}>
        <span className={`text-xs cursor-help ${confidenceInfo.color}`}>
          ({confidenceInfo.label})
        </span>
      </Tooltip>
      <span className="text-muted-foreground">
        | {formatTokens(estimate.estimatedInputTokens)} in,{' '}
        {formatTokens(estimate.estimatedOutputTokens)} out
      </span>
    </div>
  );
}

interface CostBreakdownDisplayProps {
  estimate: CostEstimate;
}

function CostBreakdownDisplay({ estimate }: CostBreakdownDisplayProps) {
  const { breakdown, warnings, confidence } = estimate;
  const confidenceInfo = CONFIDENCE_INFO[confidence];

  return (
    <div className="space-y-4">
      {/* Main Estimate */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold">{formatCost(estimate.estimatedCost)}</p>
          <p className="text-sm text-muted-foreground">Estimated total cost</p>
        </div>
        <Tooltip content={confidenceInfo.description}>
          <Badge variant="outline" className={`cursor-help ${confidenceInfo.color}`}>
            <Info className="h-3 w-3 mr-1" />
            {confidenceInfo.label} confidence
          </Badge>
        </Tooltip>
      </div>

      {/* Cost Breakdown */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
        <div>
          <p className="text-sm text-muted-foreground">Input Cost</p>
          <p className="font-medium">{formatCost(breakdown.inputCost)}</p>
          <p className="text-xs text-muted-foreground">
            {formatTokens(breakdown.inputTokens)} tokens @ {formatCost(breakdown.inputRate)}/1K
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Output Cost</p>
          <p className="font-medium">{formatCost(breakdown.outputCost)}</p>
          <p className="text-xs text-muted-foreground">
            {formatTokens(breakdown.outputTokens)} tokens @ {formatCost(breakdown.outputRate)}/1K
          </p>
        </div>
      </div>

      {/* Cost Range */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Estimated Range</span>
          <span>
            {formatCost(estimate.minCost)} - {formatCost(estimate.maxCost)}
          </span>
        </div>
        <div className="relative h-2 bg-muted rounded-full">
          <div
            className="absolute h-full bg-primary rounded-full"
            style={{
              left: `${((estimate.minCost / estimate.maxCost) * 100)}%`,
              width: `${100 - (estimate.minCost / estimate.maxCost) * 100}%`,
            }}
          />
          <div
            className="absolute h-4 w-1 bg-primary rounded -top-1"
            style={{
              left: `${((estimate.estimatedCost - estimate.minCost) / (estimate.maxCost - estimate.minCost)) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Warnings */}
      {warnings && warnings.length > 0 && (
        <div className="space-y-2">
          {warnings.map((warning, index) => (
            <div
              key={index}
              className="flex items-start space-x-2 p-2 bg-yellow-50 text-yellow-800 rounded text-sm"
            >
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ModelComparisonListProps {
  comparison: CostComparison;
  selectedModel: string;
  onModelSelect?: (modelId: string) => void;
}

function ModelComparisonList({
  comparison,
  selectedModel,
  onModelSelect,
}: ModelComparisonListProps) {
  const [showAll, setShowAll] = useState(false);
  const displayedEstimates = showAll
    ? comparison.estimates
    : comparison.estimates.slice(0, 5);

  return (
    <div className="space-y-3">
      {displayedEstimates.map((estimate, index) => {
        const isSelected = estimate.modelId === selectedModel;
        const isCheapest = estimate.modelId === comparison.cheapestModel;
        const isBestValue = estimate.modelId === comparison.bestValueModel;

        return (
          <div
            key={estimate.modelId}
            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
              isSelected
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-muted-foreground/50 cursor-pointer'
            }`}
            onClick={() => !isSelected && onModelSelect?.(estimate.modelId)}
          >
            <div className="flex items-center space-x-3">
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-medium">
                {index + 1}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{estimate.displayName}</span>
                  {isSelected && (
                    <Badge variant="secondary" className="text-xs">
                      <Check className="h-3 w-3 mr-1" />
                      Selected
                    </Badge>
                  )}
                  {isCheapest && !isSelected && (
                    <Badge className="bg-green-100 text-green-800 text-xs">
                      <TrendingDown className="h-3 w-3 mr-1" />
                      Cheapest
                    </Badge>
                  )}
                  {isBestValue && !isCheapest && !isSelected && (
                    <Badge className="bg-blue-100 text-blue-800 text-xs">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Best Value
                    </Badge>
                  )}
                </div>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <span>{estimate.provider}</span>
                  <span>|</span>
                  <Badge variant="outline" className={`text-xs ${TIER_COLORS[estimate.tier]}`}>
                    {TIER_LABELS[estimate.tier]}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="text-right">
              <p className="font-medium">{formatCost(estimate.estimatedCost)}</p>
              {estimate.savingsPercentage > 0 && (
                <p className="text-xs text-green-600">
                  Save {estimate.savingsPercentage.toFixed(0)}%
                </p>
              )}
            </div>
          </div>
        );
      })}

      {comparison.estimates.length > 5 && (
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              Show {comparison.estimates.length - 5} More Models
            </>
          )}
        </Button>
      )}
    </div>
  );
}

interface SavingsHighlightProps {
  comparison: CostComparison;
  selectedModel: string;
}

function SavingsHighlight({ comparison, selectedModel }: SavingsHighlightProps) {
  const selectedEstimate = comparison.estimates.find(
    (e) => e.modelId === selectedModel
  );
  const cheapestEstimate = comparison.estimates.find(
    (e) => e.modelId === comparison.cheapestModel
  );

  if (!selectedEstimate || !cheapestEstimate || selectedModel === comparison.cheapestModel) {
    return null;
  }

  const potentialSavings = selectedEstimate.estimatedCost - cheapestEstimate.estimatedCost;
  const savingsPercentage =
    ((potentialSavings / selectedEstimate.estimatedCost) * 100);

  if (potentialSavings <= 0) return null;

  return (
    <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-green-100 rounded-full">
          <TrendingDown className="h-5 w-5 text-green-600" />
        </div>
        <div>
          <p className="font-medium text-green-800">
            Save {formatCost(potentialSavings)} ({savingsPercentage.toFixed(0)}%)
          </p>
          <p className="text-sm text-green-700">
            by switching to {cheapestEstimate.displayName}
          </p>
        </div>
      </div>
      <ArrowRight className="h-5 w-5 text-green-600" />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function CostEstimator({
  message,
  selectedModel,
  onModelSelect,
  expandedByDefault = false,
  className = '',
  costTracker: customTracker,
  estimatedOutputTokens,
  inline = false,
  showComparison = true,
  maxComparisonModels = 10,
}: CostEstimatorProps) {
  const tracker = customTracker || getCostTracker();
  const [isExpanded, setIsExpanded] = useState(expandedByDefault);
  const [activeTab, setActiveTab] = useState<'estimate' | 'compare'>('estimate');

  // Calculate estimates
  const estimate = useMemo(() => {
    if (!message || message.trim().length === 0) {
      return null;
    }
    return tracker.estimateCost(message, selectedModel, estimatedOutputTokens);
  }, [tracker, message, selectedModel, estimatedOutputTokens]);

  const comparison = useMemo(() => {
    if (!message || message.trim().length === 0 || !showComparison) {
      return null;
    }

    // Get popular/diverse models for comparison
    const modelsToCompare = [
      selectedModel,
      'gpt-4o',
      'gpt-4o-mini',
      'claude-3.5-sonnet',
      'claude-3-haiku',
      'gemini-1.5-flash',
      'deepseek-v3',
      'llama-3.1-70b',
      'mistral-large',
      'grok-2-mini',
    ].filter((m, i, arr) => arr.indexOf(m) === i).slice(0, maxComparisonModels);

    return tracker.compareModels(message, modelsToCompare);
  }, [tracker, message, selectedModel, showComparison, maxComparisonModels]);

  // No message entered
  if (!message || message.trim().length === 0) {
    return null;
  }

  // Inline mode
  if (inline && estimate) {
    return <InlineCostDisplay estimate={estimate} className={className} />;
  }

  // Full component
  return (
    <Card className={className}>
      <CardHeader
        className="cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Cost Estimate</CardTitle>
              {estimate && (
                <CardDescription>
                  {formatCost(estimate.estimatedCost)} for{' '}
                  {MODEL_PRICING[selectedModel]?.displayName || selectedModel}
                </CardDescription>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && estimate && (
        <CardContent className="pt-0">
          {showComparison && comparison ? (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'estimate' | 'compare')}>
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="estimate">
                  <DollarSign className="h-4 w-4 mr-1" />
                  Breakdown
                </TabsTrigger>
                <TabsTrigger value="compare">
                  <Zap className="h-4 w-4 mr-1" />
                  Compare Models
                </TabsTrigger>
              </TabsList>

              <TabsContent value="estimate" className="space-y-4">
                <CostBreakdownDisplay estimate={estimate} />
              </TabsContent>

              <TabsContent value="compare" className="space-y-4">
                {/* Savings Highlight */}
                <SavingsHighlight
                  comparison={comparison}
                  selectedModel={selectedModel}
                />

                {/* Model List */}
                <ModelComparisonList
                  comparison={comparison}
                  selectedModel={selectedModel}
                  onModelSelect={onModelSelect}
                />

                {/* Token Info */}
                <div className="text-center text-sm text-muted-foreground p-2 bg-muted/50 rounded">
                  Comparing {comparison.estimates.length} models for{' '}
                  {formatTokens(comparison.estimatedInputTokens)} input tokens
                </div>
              </TabsContent>
            </Tabs>
          ) : (
            <CostBreakdownDisplay estimate={estimate} />
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ============================================================================
// Inline Export for convenience
// ============================================================================

export function InlineCostEstimate({
  message,
  selectedModel,
  className = '',
}: {
  message: string;
  selectedModel: string;
  className?: string;
}) {
  return (
    <CostEstimator
      message={message}
      selectedModel={selectedModel}
      inline={true}
      showComparison={false}
      className={className}
    />
  );
}
