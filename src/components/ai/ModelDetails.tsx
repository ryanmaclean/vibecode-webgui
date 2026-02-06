/**
 * ModelDetails Component
 *
 * Modal displaying full model specifications, pricing details,
 * benchmark scores, and capability information.
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  X,
  ExternalLink,
  Star,
  Copy,
  Check,
  Code,
  Brain,
  Sparkles,
  Calculator,
  Eye,
  MessageSquare,
  Zap,
  Clock,
  DollarSign,
  Database,
  TrendingUp,
  AlertTriangle,
  Info,
  BarChart3,
  Cpu,
  Gauge,
} from 'lucide-react';
import type {
  ModelProfile,
  ModelBenchmark,
  QualityTier,
  SpeedTier,
} from '@/types/model-comparison';

// ============================================================================
// Types
// ============================================================================

interface ModelDetailsProps {
  /** Model to display */
  model: ModelProfile;
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback when user wants to select this model */
  onSelect?: (model: ModelProfile) => void;
  /** Callback when user toggles favorite */
  onFavoriteToggle?: (modelId: string) => void;
  /** Whether model is favorited */
  isFavorite?: boolean;
  /** Callback to add to comparison */
  onAddToComparison?: (model: ModelProfile) => void;
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatPrice = (price: number): string => {
  if (price === 0) return 'Free';
  if (price < 0.0001) return `$${(price * 1000000).toFixed(2)}/B`;
  if (price < 0.001) return `$${(price * 1000).toFixed(4)}/M`;
  return `$${price.toFixed(6)}/1K`;
};

const formatContext = (tokens: number): string => {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M tokens`;
  if (tokens >= 1000) return `${Math.round(tokens / 1000)}K tokens`;
  return `${tokens} tokens`;
};

const getQualityInfo = (tier: QualityTier): { color: string; label: string; description: string } => {
  const info: Record<QualityTier, { color: string; label: string; description: string }> = {
    basic: {
      color: 'bg-gray-100 text-gray-700 border-gray-300',
      label: 'Basic',
      description: 'Suitable for simple tasks and basic conversations',
    },
    good: {
      color: 'bg-blue-100 text-blue-700 border-blue-300',
      label: 'Good',
      description: 'Reliable for most everyday use cases',
    },
    excellent: {
      color: 'bg-green-100 text-green-700 border-green-300',
      label: 'Excellent',
      description: 'High performance for complex tasks',
    },
    state_of_art: {
      color: 'bg-purple-100 text-purple-700 border-purple-300',
      label: 'State of the Art',
      description: 'Cutting-edge performance, best in class',
    },
  };
  return info[tier];
};

const getSpeedInfo = (tier: SpeedTier): { color: string; label: string; description: string } => {
  const info: Record<SpeedTier, { color: string; label: string; description: string }> = {
    slow: {
      color: 'bg-red-100 text-red-700',
      label: 'Slow',
      description: 'Longer response times, best for non-time-critical tasks',
    },
    medium: {
      color: 'bg-yellow-100 text-yellow-700',
      label: 'Medium',
      description: 'Balanced response times for most use cases',
    },
    fast: {
      color: 'bg-green-100 text-green-700',
      label: 'Fast',
      description: 'Quick responses suitable for interactive use',
    },
    very_fast: {
      color: 'bg-emerald-100 text-emerald-700',
      label: 'Very Fast',
      description: 'Near-instant responses for real-time applications',
    },
  };
  return info[tier];
};

const getCapabilityIcon = (capability: string): React.ReactNode => {
  const icons: Record<string, React.ReactNode> = {
    coding: <Code className="h-4 w-4" />,
    reasoning: <Brain className="h-4 w-4" />,
    creative: <Sparkles className="h-4 w-4" />,
    math: <Calculator className="h-4 w-4" />,
    vision: <Eye className="h-4 w-4" />,
    conversation: <MessageSquare className="h-4 w-4" />,
    instruction_following: <Check className="h-4 w-4" />,
    debugging: <AlertTriangle className="h-4 w-4" />,
  };
  return icons[capability] || <Info className="h-4 w-4" />;
};

const getCapabilityColor = (score: number): string => {
  if (score >= 90) return 'text-green-600';
  if (score >= 75) return 'text-blue-600';
  if (score >= 50) return 'text-yellow-600';
  return 'text-gray-500';
};

const getCapabilityDescription = (capability: string): string => {
  const descriptions: Record<string, string> = {
    coding: 'Code generation, completion, and understanding',
    reasoning: 'Logical thinking and problem solving',
    creative: 'Creative writing and content generation',
    math: 'Mathematical operations and calculations',
    vision: 'Image understanding and analysis',
    conversation: 'Natural dialogue and chat',
    instruction_following: 'Following complex instructions',
    debugging: 'Finding and fixing code issues',
  };
  return descriptions[capability] || '';
};

// ============================================================================
// Sub-Components
// ============================================================================

interface CapabilityCardProps {
  name: string;
  score: number;
}

const CapabilityCard: React.FC<CapabilityCardProps> = ({ name, score }) => {
  const displayName = name.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getCapabilityIcon(name)}
          <span className="font-medium text-sm">{displayName}</span>
        </div>
        <span className={`font-bold ${getCapabilityColor(score)}`}>{score}</span>
      </div>
      <Progress value={score} className="h-2" />
      <p className="text-xs text-gray-500 mt-1.5">{getCapabilityDescription(name)}</p>
    </div>
  );
};

interface BenchmarkRowProps {
  benchmark: ModelBenchmark;
}

const BenchmarkRow: React.FC<BenchmarkRowProps> = ({ benchmark }) => {
  const categoryColors: Record<string, string> = {
    code_generation: 'bg-blue-100 text-blue-700',
    reasoning: 'bg-purple-100 text-purple-700',
    math: 'bg-green-100 text-green-700',
    general: 'bg-gray-100 text-gray-700',
    creative_writing: 'bg-pink-100 text-pink-700',
  };

  return (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0">
      <div className="flex items-center gap-3">
        <div>
          <div className="font-medium text-sm">{benchmark.name}</div>
          <Badge className={`text-xs mt-0.5 ${categoryColors[benchmark.category] || 'bg-gray-100 text-gray-700'}`}>
            {benchmark.category.replace('_', ' ')}
          </Badge>
        </div>
      </div>
      <div className="text-right">
        <div className="font-bold text-lg">{benchmark.score.toFixed(1)}</div>
        {benchmark.source && (
          <div className="text-xs text-gray-500">{benchmark.source}</div>
        )}
      </div>
    </div>
  );
};

interface PricingCalculatorProps {
  model: ModelProfile;
}

const PricingCalculator: React.FC<PricingCalculatorProps> = ({ model }) => {
  const [inputTokens, setInputTokens] = useState(1000);
  const [outputTokens, setOutputTokens] = useState(500);
  const [requestsPerDay, setRequestsPerDay] = useState(100);

  const costs = useMemo(() => {
    const inputCost = (inputTokens / 1000) * model.pricing.inputPer1K;
    const outputCost = (outputTokens / 1000) * model.pricing.outputPer1K;
    const perRequest = inputCost + outputCost;
    const daily = perRequest * requestsPerDay;
    const monthly = daily * 30;

    return {
      perRequest: perRequest.toFixed(6),
      daily: daily.toFixed(4),
      monthly: monthly.toFixed(2),
    };
  }, [inputTokens, outputTokens, requestsPerDay, model.pricing]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-500">Input Tokens</label>
          <input
            type="number"
            value={inputTokens}
            onChange={(e) => setInputTokens(Number(e.target.value))}
            className="w-full mt-1 p-2 border rounded text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Output Tokens</label>
          <input
            type="number"
            value={outputTokens}
            onChange={(e) => setOutputTokens(Number(e.target.value))}
            className="w-full mt-1 p-2 border rounded text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Requests/Day</label>
          <input
            type="number"
            value={requestsPerDay}
            onChange={(e) => setRequestsPerDay(Number(e.target.value))}
            className="w-full mt-1 p-2 border rounded text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-xs text-gray-500">Per Request</div>
          <div className="font-bold text-lg">${costs.perRequest}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">Daily Cost</div>
          <div className="font-bold text-lg">${costs.daily}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500">Monthly Cost</div>
          <div className="font-bold text-lg text-blue-600">${costs.monthly}</div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

const ModelDetails: React.FC<ModelDetailsProps> = ({
  model,
  isOpen,
  onClose,
  onSelect,
  onFavoriteToggle,
  isFavorite = false,
  onAddToComparison,
}) => {
  const [copied, setCopied] = useState(false);

  const qualityInfo = getQualityInfo(model.qualityTier);
  const speedInfo = getSpeedInfo(model.performance.speedTier);

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(model.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-gray-900 truncate">{model.name}</h2>
                {onFavoriteToggle && (
                  <button
                    onClick={() => onFavoriteToggle(model.id)}
                    className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
                    aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Star className={`h-5 w-5 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-500">{model.provider.name}</span>
                <span className="text-gray-300">|</span>
                <button
                  onClick={handleCopyId}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{model.id}</code>
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap gap-2 mt-4">
            <Badge className={qualityInfo.color}>
              <TrendingUp className="h-3 w-3 mr-1" />
              {qualityInfo.label}
            </Badge>
            <Badge className={speedInfo.color}>
              <Gauge className="h-3 w-3 mr-1" />
              {speedInfo.label}
            </Badge>
            <Badge variant="outline">
              <Database className="h-3 w-3 mr-1" />
              {formatContext(model.limits.contextWindow)}
            </Badge>
            <Badge variant="outline">
              <DollarSign className="h-3 w-3 mr-1" />
              {formatPrice(model.pricing.inputPer1K)} in / {formatPrice(model.pricing.outputPer1K)} out
            </Badge>
            {model.capabilities.vision > 0 && (
              <Badge variant="outline" className="bg-blue-50">
                <Eye className="h-3 w-3 mr-1" />
                Vision
              </Badge>
            )}
            {model.capabilities.function_calling && (
              <Badge variant="outline" className="bg-green-50">
                <Zap className="h-3 w-3 mr-1" />
                Functions
              </Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-200px)]">
          <Tabs defaultValue="overview" className="w-full">
            <div className="sticky top-0 bg-white z-10 px-6 border-b">
              <TabsList className="h-12">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="capabilities">Capabilities</TabsTrigger>
                <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
                <TabsTrigger value="pricing">Pricing</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="p-6 space-y-6">
              {/* Description */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-gray-600">{model.description || 'No description available.'}</p>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <TrendingUp className="h-8 w-8 mx-auto mb-2 text-purple-500" />
                    <div className="text-xs text-gray-500">Quality Tier</div>
                    <div className="font-bold">{qualityInfo.label}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Clock className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                    <div className="text-xs text-gray-500">Avg Latency</div>
                    <div className="font-bold">{model.performance.avgLatencyMs}ms</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Cpu className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <div className="text-xs text-gray-500">Tokens/sec</div>
                    <div className="font-bold">{model.performance.tokensPerSecond}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <BarChart3 className="h-8 w-8 mx-auto mb-2 text-orange-500" />
                    <div className="text-xs text-gray-500">Benchmark Score</div>
                    <div className="font-bold">{model.benchmarks.overall}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Context Limits */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Token Limits</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500">Context Window</div>
                    <div className="font-bold text-lg">{formatContext(model.limits.contextWindow)}</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500">Max Input</div>
                    <div className="font-bold text-lg">{formatContext(model.limits.maxInputTokens)}</div>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="text-xs text-gray-500">Max Output</div>
                    <div className="font-bold text-lg">{formatContext(model.limits.maxOutputTokens)}</div>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {model.tags.length > 0 && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {model.tags.map(tag => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Provider Info */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Provider</h3>
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium">{model.provider.name}</div>
                    <div className="text-sm text-gray-500">Tier: {model.provider.tier}</div>
                  </div>
                  {model.provider.endpoint && (
                    <a
                      href={model.provider.endpoint}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
                    >
                      API Docs
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="capabilities" className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <CapabilityCard name="coding" score={model.capabilities.coding} />
                <CapabilityCard name="reasoning" score={model.capabilities.reasoning} />
                <CapabilityCard name="creative" score={model.capabilities.creative} />
                <CapabilityCard name="math" score={model.capabilities.math} />
                <CapabilityCard name="conversation" score={model.capabilities.conversation} />
                <CapabilityCard name="instruction_following" score={model.capabilities.instruction_following} />
                {model.capabilities.vision > 0 && (
                  <CapabilityCard name="vision" score={model.capabilities.vision} />
                )}
                <CapabilityCard name="debugging" score={model.capabilities.debugging} />
              </div>

              <Separator className="my-6" />

              {/* Feature Support */}
              <h3 className="font-semibold text-gray-900 mb-4">Feature Support</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className={`p-3 rounded-lg border ${model.capabilities.function_calling ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-2">
                    {model.capabilities.function_calling ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="text-sm font-medium">Function Calling</span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg border ${model.capabilities.streaming ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-2">
                    {model.capabilities.streaming ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="text-sm font-medium">Streaming</span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg border ${model.capabilities.vision > 0 ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center gap-2">
                    {model.capabilities.vision > 0 ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <X className="h-4 w-4 text-gray-400" />
                    )}
                    <span className="text-sm font-medium">Vision</span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg border ${!model.deprecated ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center gap-2">
                    {!model.deprecated ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm font-medium">{model.deprecated ? 'Deprecated' : 'Active'}</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="benchmarks" className="p-6">
              {model.benchmarks.benchmarks.length > 0 ? (
                <div className="space-y-6">
                  {/* Overall Score */}
                  <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">Overall Benchmark Score</h3>
                        <p className="text-sm text-gray-600">
                          Aggregated from {model.benchmarks.benchmarkCount} benchmarks
                        </p>
                      </div>
                      <div className="text-4xl font-bold text-blue-600">
                        {model.benchmarks.overall}
                      </div>
                    </div>
                  </div>

                  {/* Category Scores */}
                  {Object.keys(model.benchmarks.byCategory).length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">Scores by Category</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {Object.entries(model.benchmarks.byCategory).map(([category, score]) => (
                          <div key={category} className="p-3 bg-gray-50 rounded-lg">
                            <div className="text-xs text-gray-500 capitalize">
                              {category.replace('_', ' ')}
                            </div>
                            <div className="font-bold text-lg">{score}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Individual Benchmarks */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">Individual Benchmarks</h3>
                    <Card>
                      <CardContent className="p-0 divide-y">
                        {model.benchmarks.benchmarks.map((benchmark, index) => (
                          <BenchmarkRow key={`${benchmark.name}-${index}`} benchmark={benchmark} />
                        ))}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <BarChart3 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Benchmark Data</h3>
                  <p className="text-gray-500">
                    Benchmark data is not yet available for this model.
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="pricing" className="p-6 space-y-6">
              {/* Base Pricing */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Base Pricing</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm text-gray-500 mb-1">Input Tokens</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {formatPrice(model.pricing.inputPer1K)}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">per 1,000 tokens</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-sm text-gray-500 mb-1">Output Tokens</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {formatPrice(model.pricing.outputPer1K)}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">per 1,000 tokens</div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Cost Calculator */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Cost Calculator</h3>
                <Card>
                  <CardContent className="p-4">
                    <PricingCalculator model={model} />
                  </CardContent>
                </Card>
              </div>

              {/* Pricing Notes */}
              {model.pricing.freeLimit && (
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 text-green-800">
                    <Gift className="h-5 w-5" />
                    <span className="font-medium">Free Tier Available</span>
                  </div>
                  <p className="text-sm text-green-700 mt-1">{model.pricing.freeLimit}</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex items-center justify-between">
          <div className="flex gap-2">
            {onAddToComparison && (
              <Button variant="outline" onClick={() => onAddToComparison(model)}>
                Add to Comparison
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            {onSelect && (
              <Button onClick={() => onSelect(model)}>
                Use This Model
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelDetails;
