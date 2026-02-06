/**
 * ModelComparison Component
 *
 * Side-by-side comparison of AI models with visual scoring,
 * pricing comparison, and recommendations.
 */

'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  X,
  Plus,
  Trophy,
  Zap,
  DollarSign,
  Brain,
  Code,
  Eye,
  MessageSquare,
  Calculator,
  Sparkles,
  Check,
  AlertCircle,
  TrendingUp,
  Clock,
  Database,
} from 'lucide-react';
import type {
  ModelProfile,
  ComparisonCriteria,
  ComparisonResult,
  ModelComparisonScore,
  QualityTier,
  SpeedTier,
  DEFAULT_COMPARISON_CRITERIA,
} from '@/types/model-comparison';

// ============================================================================
// Types
// ============================================================================

interface ModelComparisonProps {
  /** Initial models to compare */
  initialModels?: ModelProfile[];
  /** Maximum models to compare */
  maxModels?: number;
  /** Callback when models change */
  onModelsChange?: (models: ModelProfile[]) => void;
  /** Callback when a model is selected as winner */
  onSelectModel?: (model: ModelProfile) => void;
  /** Custom class name */
  className?: string;
  /** Model registry for adding new models */
  availableModels?: ModelProfile[];
}

// ============================================================================
// Helper Functions
// ============================================================================

const getQualityColor = (tier: QualityTier): string => {
  const colors: Record<QualityTier, string> = {
    basic: 'bg-gray-100 text-gray-700',
    good: 'bg-blue-100 text-blue-700',
    excellent: 'bg-green-100 text-green-700',
    state_of_art: 'bg-purple-100 text-purple-700',
  };
  return colors[tier];
};

const getSpeedColor = (tier: SpeedTier): string => {
  const colors: Record<SpeedTier, string> = {
    slow: 'bg-red-100 text-red-700',
    medium: 'bg-yellow-100 text-yellow-700',
    fast: 'bg-green-100 text-green-700',
    very_fast: 'bg-emerald-100 text-emerald-700',
  };
  return colors[tier];
};

const formatPrice = (price: number): string => {
  if (price === 0) return 'Free';
  if (price < 0.001) return `$${(price * 1000).toFixed(4)}/M`;
  return `$${price.toFixed(4)}/1K`;
};

const formatContext = (tokens: number): string => {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K`;
  return tokens.toString();
};

// ============================================================================
// Sub-Components
// ============================================================================

interface CapabilityBarProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}

const CapabilityBar: React.FC<CapabilityBarProps> = ({ label, value, icon, color = 'bg-blue-500' }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-1.5 text-gray-600">
        {icon}
        <span>{label}</span>
      </div>
      <span className="font-medium">{value}</span>
    </div>
    <Progress value={value} className="h-2" />
  </div>
);

interface ModelCardProps {
  model: ModelProfile;
  score?: ModelComparisonScore;
  isWinner?: boolean;
  onRemove?: () => void;
  onSelect?: () => void;
}

const ModelCard: React.FC<ModelCardProps> = ({
  model,
  score,
  isWinner,
  onRemove,
  onSelect,
}) => {
  return (
    <Card className={`relative ${isWinner ? 'ring-2 ring-green-500 shadow-lg' : ''}`}>
      {isWinner && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-green-500 text-white">
            <Trophy className="h-3 w-3 mr-1" />
            Recommended
          </Badge>
        </div>
      )}

      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Remove model from comparison"
        >
          <X className="h-4 w-4 text-gray-400" />
        </button>
      )}

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{model.name}</CardTitle>
            <CardDescription className="text-xs mt-1">
              {model.provider.name}
            </CardDescription>
          </div>
          {score && (
            <div className="text-right">
              <div className="text-2xl font-bold text-gray-900">
                {score.overallScore.toFixed(1)}
              </div>
              <div className="text-xs text-gray-500">Score</div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5 mt-2">
          <Badge className={getQualityColor(model.qualityTier)}>
            {model.qualityTier.replace('_', ' ')}
          </Badge>
          <Badge className={getSpeedColor(model.performance.speedTier)}>
            {model.performance.speedTier.replace('_', ' ')}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Pricing */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-gray-50 rounded-lg">
          <div>
            <div className="text-xs text-gray-500">Input</div>
            <div className="font-medium text-sm">{formatPrice(model.pricing.inputPer1K)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Output</div>
            <div className="font-medium text-sm">{formatPrice(model.pricing.outputPer1K)}</div>
          </div>
        </div>

        {/* Context Window */}
        <div className="flex items-center justify-between p-2 border rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Database className="h-4 w-4" />
            <span>Context</span>
          </div>
          <span className="font-medium">{formatContext(model.limits.contextWindow)}</span>
        </div>

        {/* Capabilities */}
        <div className="space-y-3">
          <CapabilityBar
            label="Coding"
            value={model.capabilities.coding}
            icon={<Code className="h-3.5 w-3.5" />}
          />
          <CapabilityBar
            label="Reasoning"
            value={model.capabilities.reasoning}
            icon={<Brain className="h-3.5 w-3.5" />}
          />
          <CapabilityBar
            label="Creative"
            value={model.capabilities.creative}
            icon={<Sparkles className="h-3.5 w-3.5" />}
          />
          <CapabilityBar
            label="Math"
            value={model.capabilities.math}
            icon={<Calculator className="h-3.5 w-3.5" />}
          />
        </div>

        {/* Features */}
        <div className="flex flex-wrap gap-2">
          {model.capabilities.vision > 0 && (
            <Badge variant="outline" className="text-xs">
              <Eye className="h-3 w-3 mr-1" />
              Vision
            </Badge>
          )}
          {model.capabilities.function_calling && (
            <Badge variant="outline" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              Functions
            </Badge>
          )}
          {model.capabilities.streaming && (
            <Badge variant="outline" className="text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />
              Streaming
            </Badge>
          )}
        </div>

        {/* Pros and Cons */}
        {score && (
          <div className="space-y-2 pt-2 border-t">
            {score.pros.slice(0, 3).map((pro, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-green-700">
                <Check className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>{pro}</span>
              </div>
            ))}
            {score.cons.slice(0, 2).map((con, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-red-600">
                <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>{con}</span>
              </div>
            ))}
          </div>
        )}

        {/* Select Button */}
        {onSelect && (
          <Button onClick={onSelect} className="w-full" variant={isWinner ? 'default' : 'outline'}>
            {isWinner ? 'Use This Model' : 'Select Model'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

interface CriteriaAdjusterProps {
  criteria: ComparisonCriteria;
  onCriteriaChange: (criteria: ComparisonCriteria) => void;
}

const CriteriaAdjuster: React.FC<CriteriaAdjusterProps> = ({
  criteria,
  onCriteriaChange,
}) => {
  const handleChange = (key: keyof ComparisonCriteria, value: number) => {
    const newCriteria = { ...criteria, [key]: value };
    // Normalize weights to sum to 1
    const total = newCriteria.cost + newCriteria.speed + newCriteria.quality + newCriteria.context_size;
    if (total > 0) {
      newCriteria.cost /= total;
      newCriteria.speed /= total;
      newCriteria.quality /= total;
      newCriteria.context_size /= total;
    }
    onCriteriaChange(newCriteria);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Cost Importance
          </Label>
          <span className="text-sm text-gray-500">{Math.round(criteria.cost * 100)}%</span>
        </div>
        <Slider
          value={[criteria.cost * 100]}
          onValueChange={([v]) => handleChange('cost', v / 100)}
          max={100}
          step={5}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Speed Importance
          </Label>
          <span className="text-sm text-gray-500">{Math.round(criteria.speed * 100)}%</span>
        </div>
        <Slider
          value={[criteria.speed * 100]}
          onValueChange={([v]) => handleChange('speed', v / 100)}
          max={100}
          step={5}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Quality Importance
          </Label>
          <span className="text-sm text-gray-500">{Math.round(criteria.quality * 100)}%</span>
        </div>
        <Slider
          value={[criteria.quality * 100]}
          onValueChange={([v]) => handleChange('quality', v / 100)}
          max={100}
          step={5}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Context Size Importance
          </Label>
          <span className="text-sm text-gray-500">{Math.round(criteria.context_size * 100)}%</span>
        </div>
        <Slider
          value={[criteria.context_size * 100]}
          onValueChange={([v]) => handleChange('context_size', v / 100)}
          max={100}
          step={5}
        />
      </div>
    </div>
  );
};

interface ComparisonTableProps {
  models: ModelProfile[];
  scores?: ModelComparisonScore[];
  winnerId?: string;
}

const ComparisonTable: React.FC<ComparisonTableProps> = ({
  models,
  scores,
  winnerId,
}) => {
  const attributes = [
    { key: 'pricing', label: 'Price (Input)', getValue: (m: ModelProfile) => formatPrice(m.pricing.inputPer1K) },
    { key: 'pricingOut', label: 'Price (Output)', getValue: (m: ModelProfile) => formatPrice(m.pricing.outputPer1K) },
    { key: 'context', label: 'Context Window', getValue: (m: ModelProfile) => formatContext(m.limits.contextWindow) },
    { key: 'speed', label: 'Speed', getValue: (m: ModelProfile) => m.performance.speedTier.replace('_', ' ') },
    { key: 'quality', label: 'Quality', getValue: (m: ModelProfile) => m.qualityTier.replace('_', ' ') },
    { key: 'coding', label: 'Coding', getValue: (m: ModelProfile) => m.capabilities.coding.toString() },
    { key: 'reasoning', label: 'Reasoning', getValue: (m: ModelProfile) => m.capabilities.reasoning.toString() },
    { key: 'creative', label: 'Creative', getValue: (m: ModelProfile) => m.capabilities.creative.toString() },
    { key: 'math', label: 'Math', getValue: (m: ModelProfile) => m.capabilities.math.toString() },
    { key: 'vision', label: 'Vision', getValue: (m: ModelProfile) => m.capabilities.vision > 0 ? 'Yes' : 'No' },
    { key: 'functions', label: 'Function Calling', getValue: (m: ModelProfile) => m.capabilities.function_calling ? 'Yes' : 'No' },
    { key: 'latency', label: 'Avg Latency', getValue: (m: ModelProfile) => `${m.performance.avgLatencyMs}ms` },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left p-3 bg-gray-50 border-b font-medium text-gray-600">
              Attribute
            </th>
            {models.map(model => (
              <th
                key={model.id}
                className={`text-left p-3 bg-gray-50 border-b font-medium ${
                  model.id === winnerId ? 'bg-green-50 text-green-800' : 'text-gray-600'
                }`}
              >
                {model.name}
                {model.id === winnerId && (
                  <Trophy className="h-4 w-4 inline ml-2 text-green-600" />
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {attributes.map(attr => (
            <tr key={attr.key} className="hover:bg-gray-50">
              <td className="p-3 border-b text-sm text-gray-600">{attr.label}</td>
              {models.map(model => (
                <td
                  key={model.id}
                  className={`p-3 border-b text-sm ${
                    model.id === winnerId ? 'bg-green-50/50' : ''
                  }`}
                >
                  {attr.getValue(model)}
                </td>
              ))}
            </tr>
          ))}
          {scores && (
            <tr className="bg-gray-100 font-medium">
              <td className="p-3 border-b">Overall Score</td>
              {models.map(model => {
                const score = scores.find(s => s.modelId === model.id);
                return (
                  <td
                    key={model.id}
                    className={`p-3 border-b ${
                      model.id === winnerId ? 'bg-green-100 text-green-800' : ''
                    }`}
                  >
                    {score?.overallScore.toFixed(1) || '-'}
                  </td>
                );
              })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const ModelComparison: React.FC<ModelComparisonProps> = ({
  initialModels = [],
  maxModels = 4,
  onModelsChange,
  onSelectModel,
  className = '',
  availableModels = [],
}) => {
  const [models, setModels] = useState<ModelProfile[]>(initialModels);
  const [criteria, setCriteria] = useState<ComparisonCriteria>({
    cost: 0.25,
    speed: 0.2,
    quality: 0.35,
    context_size: 0.2,
  });
  const [showAddModal, setShowAddModal] = useState(false);

  // Calculate comparison result
  const comparisonResult = useMemo((): ComparisonResult | null => {
    if (models.length < 2) return null;

    // Score each model
    const scores: ModelComparisonScore[] = models.map(model => {
      // Calculate criteria scores (0-100 scale)
      const maxCost = Math.max(...models.map(m => m.pricing.inputPer1K + m.pricing.outputPer1K));
      const modelCost = model.pricing.inputPer1K + model.pricing.outputPer1K;
      const costScore = maxCost > 0 ? (1 - modelCost / maxCost) * 100 : 100;

      const speedOrder: Record<SpeedTier, number> = { slow: 25, medium: 50, fast: 75, very_fast: 100 };
      const speedScore = speedOrder[model.performance.speedTier];

      const qualityOrder: Record<QualityTier, number> = { basic: 25, good: 50, excellent: 75, state_of_art: 100 };
      const qualityScore = qualityOrder[model.qualityTier];

      const maxContext = Math.max(...models.map(m => m.limits.contextWindow));
      const contextScore = (model.limits.contextWindow / maxContext) * 100;

      // Calculate weighted overall score
      const overallScore =
        costScore * criteria.cost +
        speedScore * criteria.speed +
        qualityScore * criteria.quality +
        contextScore * criteria.context_size;

      // Generate pros and cons
      const pros: string[] = [];
      const cons: string[] = [];

      if (model.qualityTier === 'state_of_art') pros.push('State of the art quality');
      else if (model.qualityTier === 'excellent') pros.push('Excellent quality');

      if (model.performance.speedTier === 'very_fast') pros.push('Very fast responses');
      else if (model.performance.speedTier === 'fast') pros.push('Fast responses');

      if (model.pricing.inputPer1K < 0.001) pros.push('Very affordable');
      if (model.limits.contextWindow >= 100000) pros.push('Large context window');
      if (model.capabilities.vision > 0) pros.push('Vision capable');
      if (model.capabilities.function_calling) pros.push('Function calling support');

      if (model.qualityTier === 'basic') cons.push('Basic quality tier');
      if (model.performance.speedTier === 'slow') cons.push('Slower responses');
      if (model.pricing.inputPer1K >= 0.01) cons.push('Higher cost');
      if (model.limits.contextWindow < 16000) cons.push('Limited context');

      return {
        modelId: model.id,
        overallScore: Math.round(overallScore * 100) / 100,
        criteriaScores: {
          cost: Math.round(costScore),
          speed: speedScore,
          quality: qualityScore,
          contextSize: Math.round(contextScore),
        },
        capabilityMatch: model.benchmarks.overall,
        benchmarkScore: model.benchmarks.overall,
        pros,
        cons,
        rankingReason: '',
      };
    });

    // Sort by overall score
    scores.sort((a, b) => b.overallScore - a.overallScore);

    // Add ranking reasons
    scores.forEach((score, index) => {
      score.rankingReason = index === 0
        ? 'Best overall match for your criteria'
        : `Ranks #${index + 1} based on weighted criteria`;
    });

    const winnerId = scores[0].modelId;
    const winner = models.find(m => m.id === winnerId)!;

    return {
      models,
      scores,
      recommendation: winnerId,
      recommendationReason: `${winner.name} scores highest with balanced performance across all criteria`,
      criteria,
      generatedAt: new Date().toISOString(),
      summary: {
        bestForCoding: models.reduce((best, m) =>
          !best || m.capabilities.coding > best.capabilities.coding ? m : best
        , models[0] as ModelProfile | undefined)?.id,
        bestForReasoning: models.reduce((best, m) =>
          !best || m.capabilities.reasoning > best.capabilities.reasoning ? m : best
        , models[0] as ModelProfile | undefined)?.id,
        bestValue: models.reduce((best, m) => {
          const mValue = m.benchmarks.overall / Math.max(0.0001, m.pricing.inputPer1K);
          const bestValue = best ? best.benchmarks.overall / Math.max(0.0001, best.pricing.inputPer1K) : 0;
          return mValue > bestValue ? m : best;
        }, models[0] as ModelProfile | undefined)?.id,
        fastest: models.reduce((best, m) => {
          const speedOrder: Record<SpeedTier, number> = { slow: 0, medium: 1, fast: 2, very_fast: 3 };
          return !best || speedOrder[m.performance.speedTier] > speedOrder[best.performance.speedTier] ? m : best;
        }, models[0] as ModelProfile | undefined)?.id,
        largestContext: models.reduce((best, m) =>
          !best || m.limits.contextWindow > best.limits.contextWindow ? m : best
        , models[0] as ModelProfile | undefined)?.id,
      },
    };
  }, [models, criteria]);

  const handleRemoveModel = useCallback((modelId: string) => {
    const newModels = models.filter(m => m.id !== modelId);
    setModels(newModels);
    onModelsChange?.(newModels);
  }, [models, onModelsChange]);

  const handleAddModel = useCallback((model: ModelProfile) => {
    if (models.length >= maxModels) return;
    if (models.some(m => m.id === model.id)) return;

    const newModels = [...models, model];
    setModels(newModels);
    onModelsChange?.(newModels);
    setShowAddModal(false);
  }, [models, maxModels, onModelsChange]);

  const handleSelectModel = useCallback((model: ModelProfile) => {
    onSelectModel?.(model);
  }, [onSelectModel]);

  const availableToAdd = useMemo(() => {
    return availableModels.filter(m => !models.some(existing => existing.id === m.id));
  }, [availableModels, models]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Model Comparison</h2>
          <p className="text-gray-600">
            Compare up to {maxModels} models side by side
          </p>
        </div>
        {models.length < maxModels && availableToAdd.length > 0 && (
          <Button onClick={() => setShowAddModal(true)} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Add Model
          </Button>
        )}
      </div>

      {/* Add Model Modal */}
      {showAddModal && (
        <Card className="border-2 border-dashed">
          <CardHeader>
            <CardTitle className="text-lg">Add Model to Compare</CardTitle>
            <CardDescription>Select a model to add to the comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-80 overflow-y-auto">
              {availableToAdd.slice(0, 12).map(model => (
                <button
                  key={model.id}
                  onClick={() => handleAddModel(model)}
                  className="p-3 text-left border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="font-medium text-sm">{model.name}</div>
                  <div className="text-xs text-gray-500">{model.provider.name}</div>
                  <div className="flex gap-1 mt-2">
                    <Badge variant="outline" className="text-xs">
                      {model.qualityTier}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {formatPrice(model.pricing.inputPer1K)}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Comparison Content */}
      {models.length === 0 ? (
        <Card className="border-2 border-dashed">
          <CardContent className="py-12 text-center">
            <div className="text-gray-400 mb-4">
              <TrendingUp className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No models to compare
            </h3>
            <p className="text-gray-500 mb-4">
              Add at least 2 models to start comparing
            </p>
            {availableModels.length > 0 && (
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Model
              </Button>
            )}
          </CardContent>
        </Card>
      ) : models.length === 1 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModelCard
            model={models[0]}
            onRemove={() => handleRemoveModel(models[0].id)}
          />
          <Card className="border-2 border-dashed flex items-center justify-center">
            <CardContent className="text-center py-8">
              <p className="text-gray-500 mb-4">Add another model to compare</p>
              {availableToAdd.length > 0 && (
                <Button onClick={() => setShowAddModal(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Model
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <Tabs defaultValue="cards" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="cards">Card View</TabsTrigger>
            <TabsTrigger value="table">Table View</TabsTrigger>
            <TabsTrigger value="settings">Criteria</TabsTrigger>
          </TabsList>

          <TabsContent value="cards">
            {/* Winner Summary */}
            {comparisonResult && (
              <Card className="mb-4 bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-full">
                        <Trophy className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <div className="font-medium text-green-800">
                          Recommended: {models.find(m => m.id === comparisonResult.recommendation)?.name}
                        </div>
                        <div className="text-sm text-green-600">
                          {comparisonResult.recommendationReason}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        const winner = models.find(m => m.id === comparisonResult.recommendation);
                        if (winner) handleSelectModel(winner);
                      }}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Use This Model
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Model Cards Grid */}
            <div className={`grid gap-4 ${
              models.length === 2 ? 'grid-cols-1 md:grid-cols-2' :
              models.length === 3 ? 'grid-cols-1 md:grid-cols-3' :
              'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
            }`}>
              {models.map(model => {
                const score = comparisonResult?.scores.find(s => s.modelId === model.id);
                const isWinner = comparisonResult?.recommendation === model.id;

                return (
                  <ModelCard
                    key={model.id}
                    model={model}
                    score={score}
                    isWinner={isWinner}
                    onRemove={() => handleRemoveModel(model.id)}
                    onSelect={() => handleSelectModel(model)}
                  />
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="table">
            <Card>
              <CardContent className="p-0">
                <ComparisonTable
                  models={models}
                  scores={comparisonResult?.scores}
                  winnerId={comparisonResult?.recommendation}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Comparison Criteria</CardTitle>
                <CardDescription>
                  Adjust the importance of each factor in the comparison
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CriteriaAdjuster
                  criteria={criteria}
                  onCriteriaChange={setCriteria}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Quick Summary */}
      {comparisonResult && comparisonResult.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {comparisonResult.summary.bestForCoding && (
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <Code className="h-5 w-5 mx-auto mb-2 text-blue-600" />
                  <div className="text-xs text-gray-500">Best for Coding</div>
                  <div className="font-medium text-sm truncate">
                    {models.find(m => m.id === comparisonResult.summary.bestForCoding)?.name}
                  </div>
                </div>
              )}
              {comparisonResult.summary.bestForReasoning && (
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <Brain className="h-5 w-5 mx-auto mb-2 text-purple-600" />
                  <div className="text-xs text-gray-500">Best Reasoning</div>
                  <div className="font-medium text-sm truncate">
                    {models.find(m => m.id === comparisonResult.summary.bestForReasoning)?.name}
                  </div>
                </div>
              )}
              {comparisonResult.summary.bestValue && (
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <DollarSign className="h-5 w-5 mx-auto mb-2 text-green-600" />
                  <div className="text-xs text-gray-500">Best Value</div>
                  <div className="font-medium text-sm truncate">
                    {models.find(m => m.id === comparisonResult.summary.bestValue)?.name}
                  </div>
                </div>
              )}
              {comparisonResult.summary.fastest && (
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <Zap className="h-5 w-5 mx-auto mb-2 text-yellow-600" />
                  <div className="text-xs text-gray-500">Fastest</div>
                  <div className="font-medium text-sm truncate">
                    {models.find(m => m.id === comparisonResult.summary.fastest)?.name}
                  </div>
                </div>
              )}
              {comparisonResult.summary.largestContext && (
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <Database className="h-5 w-5 mx-auto mb-2 text-indigo-600" />
                  <div className="text-xs text-gray-500">Largest Context</div>
                  <div className="font-medium text-sm truncate">
                    {models.find(m => m.id === comparisonResult.summary.largestContext)?.name}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ModelComparison;
