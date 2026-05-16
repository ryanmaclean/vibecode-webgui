/**
 * AI Models Page
 *
 * Model comparison, selection, and recommendation page.
 * Allows users to browse, compare, and get recommendations for AI models.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  Sparkles,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import ModelSelector from '@/components/ai/ModelSelector';
import ModelComparison from '@/components/ai/ModelComparison';
import ModelDetails from '@/components/ai/ModelDetails';
import OllamaModelManager from '@/components/ai/OllamaModelManager';
import { ModelChangeNotification } from '@/components/ai/ModelChangeNotification';
import type { ModelProfile, TaskType } from '@/types/model-comparison';

// ============================================================================
// Types
// ============================================================================

interface RecommendationResult {
  model: {
    id: string;
    name: string;
    description?: string;
    provider: { id: string; name: string; tier: string };
    qualityTier: string;
    speedTier: string;
    pricing: { inputPer1K: number; outputPer1K: number; isFree: boolean };
    limits: { contextWindow: number; maxOutputTokens: number };
    capabilities: {
      coding: number;
      reasoning: number;
      creative: number;
      math: number;
      vision: number;
      function_calling: boolean;
      streaming: boolean;
    };
  };
  confidence: number;
  reason: string;
  estimatedCost?: { perRequest: number; daily: number; monthly: number };
  alternatives: Array<{
    model: { id: string; name: string; provider: string; qualityTier: string; pricing: { inputPer1K: number; outputPer1K: number } };
    reason: string;
    tradeoffs: string[];
  }>;
}

const TASK_TYPE_VALUES: TaskType[] = [
  'code_generation',
  'code_review',
  'debugging',
  'chat',
  'analysis',
  'creative_writing',
  'summarization',
  'translation',
  'math',
  'research',
  'general',
];

// ============================================================================
// Main Page Component
// ============================================================================

export default function AIModelsPage() {
  const t = useTranslations();
  const [allModels, setAllModels] = useState<ModelProfile[]>([]);
  const [selectedModels, setSelectedModels] = useState<ModelProfile[]>([]);
  const [detailModel, setDetailModel] = useState<ModelProfile | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Recommendation state
  const [selectedTask, setSelectedTask] = useState<TaskType>('code_generation');
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendError, setRecommendError] = useState<string | null>(null);

  // Load favorites from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vibecode-favorite-models');
      if (saved) setFavoriteIds(JSON.parse(saved));
    } catch {
      // ignore parse errors
    }
  }, []);

  // Fetch models from API
  const fetchModels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/models?pageSize=100');
      if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
      const json = await res.json();
      if (json.success && json.data?.models) {
        setAllModels(json.data.models);
      } else if (json.success && Array.isArray(json.data)) {
        setAllModels(json.data);
      } else {
        throw new Error(json.error || 'Unexpected response format');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  // Handle model selection from selector (adds to comparison)
  const handleModelSelect = useCallback((model: ModelProfile) => {
    setSelectedModels(prev => {
      if (prev.some(m => m.id === model.id)) return prev;
      if (prev.length >= 4) return prev;
      return [...prev, model];
    });
  }, []);

  // Handle clicking a model to view details
  const handleModelClick = useCallback((model: ModelProfile) => {
    setDetailModel(model);
    setIsDetailsOpen(true);
  }, []);

  // Handle adding model from details modal to comparison
  const handleAddToComparison = useCallback((model: ModelProfile) => {
    handleModelSelect(model);
    setIsDetailsOpen(false);
  }, [handleModelSelect]);

  // Handle favorite toggle
  const handleFavoriteToggle = useCallback((modelId: string) => {
    setFavoriteIds(prev => {
      const next = prev.includes(modelId)
        ? prev.filter(id => id !== modelId)
        : [...prev, modelId];
      try {
        localStorage.setItem('vibecode-favorite-models', JSON.stringify(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  // Get recommendation
  const handleGetRecommendation = useCallback(async () => {
    setRecommendLoading(true);
    setRecommendError(null);
    try {
      const res = await fetch('/api/ai/models/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: selectedTask,
          estimatedInputTokens: 1000,
          estimatedOutputTokens: 500,
        }),
      });
      if (!res.ok) throw new Error(`Failed to get recommendation: ${res.status}`);
      const json = await res.json();
      if (json.success && json.recommendation) {
        setRecommendation(json.recommendation);
      } else {
        throw new Error(json.error || 'Unexpected response');
      }
    } catch (err) {
      setRecommendError(err instanceof Error ? err.message : 'Failed to get recommendation');
    } finally {
      setRecommendLoading(false);
    }
  }, [selectedTask]);

  const TASK_TYPES = TASK_TYPE_VALUES.map((value) => ({
    value,
    label: t(`ai.models.taskTypes.${value}`),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Brain className="h-8 w-8 text-purple-600" />
              <h1 className="text-3xl font-bold text-gray-900">{t('ai.models.pageTitle')}</h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchModels}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {t('ai.models.refreshButton')}
            </Button>
          </div>
          <p className="text-gray-600">
            {t('ai.models.pageDescription')}
          </p>
        </div>

        {/* Model Change Notifications */}
        <ModelChangeNotification
          showDetails
          showRefreshButton
          onRefresh={fetchModels}
          className="mb-6"
        />

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-800">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
            <Button variant="outline" size="sm" onClick={fetchModels}>
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('common.retry')}
            </Button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            <span className="ml-3 text-gray-600">{t('ai.models.loadingModels')}</span>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-8">
            {/* Model Selector */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ModelSelector
                  models={allModels}
                  onModelSelect={handleModelSelect}
                  favoriteModelIds={favoriteIds}
                  onFavoriteToggle={handleFavoriteToggle}
                  placeholder={t('ai.models.searchPlaceholder')}
                  label={t('ai.models.addModelToComparison')}
                  showDetails
                />
                {selectedModels.length > 0 && (
                  <p className="mt-2 text-sm text-gray-500">
                    {t('ai.models.modelsSelectedForComparison', { count: selectedModels.length })}
                  </p>
                )}
              </div>

              {/* Get Recommendation Panel */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-yellow-500" />
                    {t('ai.models.getRecommendation.title')}
                  </CardTitle>
                  <CardDescription>
                    {t('ai.models.getRecommendation.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1.5">
                      {t('ai.models.getRecommendation.taskTypeLabel')}
                    </label>
                    <select
                      value={selectedTask}
                      onChange={(e) => setSelectedTask(e.target.value as TaskType)}
                      className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                    >
                      {TASK_TYPES.map(taskType => (
                        <option key={taskType.value} value={taskType.value}>{taskType.label}</option>
                      ))}
                    </select>
                  </div>
                  <Button
                    onClick={handleGetRecommendation}
                    disabled={recommendLoading}
                    className="w-full"
                  >
                    {recommendLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        {t('ai.models.getRecommendation.findingButton')}
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        {t('ai.models.getRecommendation.getRecommendationButton')}
                      </>
                    )}
                  </Button>

                  {recommendError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                      {recommendError}
                    </div>
                  )}

                  {recommendation && (
                    <div className="space-y-3 pt-2 border-t">
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <div className="font-medium text-green-800">
                          {recommendation.model.name}
                        </div>
                        <div className="text-xs text-green-600 mt-1">
                          {recommendation.reason}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            {t('ai.models.getRecommendation.confidenceLabel', { percent: Math.round(recommendation.confidence * 100) })}
                          </Badge>
                          {recommendation.estimatedCost && (
                            <Badge variant="outline" className="text-xs">
                              {t('ai.models.getRecommendation.monthlyCostLabel', { cost: recommendation.estimatedCost.monthly?.toFixed(2) ?? '?' })}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {recommendation.alternatives.length > 0 && (
                        <div>
                          <div className="text-xs font-medium text-gray-500 mb-2">
                            {t('ai.models.getRecommendation.alternativesLabel')}
                          </div>
                          {recommendation.alternatives.slice(0, 3).map((alt, i) => (
                            <div
                              key={i}
                              className="p-2 bg-gray-50 rounded-lg mb-1.5 text-sm"
                            >
                              <div className="font-medium text-gray-800">{alt.model.name}</div>
                              <div className="text-xs text-gray-500">{alt.reason}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Model Comparison */}
            <ModelComparison
              initialModels={selectedModels}
              maxModels={4}
              availableModels={allModels}
              onModelsChange={setSelectedModels}
              onSelectModel={handleModelClick}
            />

            {/* Ollama Model Manager */}
            <OllamaModelManager showHeader />
          </div>
        )}

        {/* Model Details Modal */}
        {detailModel && (
          <ModelDetails
            model={detailModel}
            isOpen={isDetailsOpen}
            onClose={() => {
              setIsDetailsOpen(false);
              setDetailModel(null);
            }}
            onSelect={handleModelClick}
            onFavoriteToggle={handleFavoriteToggle}
            isFavorite={favoriteIds.includes(detailModel.id)}
            onAddToComparison={handleAddToComparison}
          />
        )}
      </div>
    </div>
  );
}
