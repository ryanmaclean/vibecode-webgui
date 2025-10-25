'use client';

import React, { useState, useEffect } from 'react';
import { ModelLeaderboard, ModelComparisonChart } from '@/components/experiments/ModelLeaderboard';
import { askMultiModel, getModelLeaderboard, MODELS } from '@/lib/experiments/scenarios/multi-model';
import type { ModelResponse } from '@/lib/experiments/scenarios/multi-model';
import type { ModelLeaderboardEntry } from '@/components/experiments/ModelLeaderboard';

/**
 * Multi-Model AI Selection Experiment Demo Page
 *
 * Interactive demonstration of Thompson Sampling for dynamic model selection.
 */
export default function ModelComparisonPage() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<ModelResponse | null>(null);
  const [leaderboard, setLeaderboard] = useState<{
    models: ModelLeaderboardEntry[];
    totalRequests: number;
    cumulativeReward: number;
    cumulativeRegret: number;
  }>({
    models: [],
    totalRequests: 0,
    cumulativeReward: 0,
    cumulativeRegret: 0
  });
  const [error, setError] = useState<string | null>(null);

  // Load leaderboard on mount
  useEffect(() => {
    loadLeaderboard();
  }, []);

  /**
   * Load current leaderboard
   */
  const loadLeaderboard = async () => {
    try {
      const data = await getModelLeaderboard();
      setLeaderboard(data);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    }
  };

  /**
   * Handle question submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      // Generate random user ID for demo
      const userId = `demo_user_${Math.random().toString(36).substr(2, 9)}`;

      // Ask multi-model
      const result = await askMultiModel({
        userId,
        question: question.trim()
      });

      setResponse(result);

      // Reload leaderboard
      await loadLeaderboard();
    } catch (err) {
      console.error('Failed to get response:', err);
      setError(err instanceof Error ? err.message : 'Failed to get response');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Get model info by key
   */
  const getModelInfo = (key: string) => {
    return MODELS[key as keyof typeof MODELS] || null;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            Multi-Model AI Selection Experiment
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Dynamic optimization across 4 models using Thompson Sampling to maximize quality while minimizing cost
          </p>
        </div>

        {/* Experiment Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
            How It Works
          </h2>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Thompson Sampling selects the best model based on past performance</li>
            <li>• Quality score combines accuracy, latency, and cost efficiency</li>
            <li>• Traffic allocation adapts in real-time as models prove themselves</li>
            <li>• Algorithm balances exploration (trying new models) vs exploitation (using the best)</li>
          </ul>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Question Input & Response */}
          <div className="lg:col-span-2 space-y-6">
            {/* Question Input */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Ask a Question
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="What would you like to know? (e.g., 'Explain quantum computing in simple terms')"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white resize-none"
                    rows={4}
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !question.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  {loading ? 'Processing...' : 'Submit Question'}
                </button>
              </form>

              {error && (
                <div className="mt-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                </div>
              )}
            </div>

            {/* Response */}
            {response && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Response
                  </h2>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Selected:</span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 text-sm font-semibold">
                      {getModelInfo(response.modelKey)?.name || response.modelKey}
                    </span>
                  </div>
                </div>

                <div className="prose dark:prose-invert max-w-none mb-6">
                  <div className="text-gray-900 dark:text-white whitespace-pre-wrap">
                    {response.answer}
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Quality Score</div>
                    <div className="text-lg font-semibold text-green-600 dark:text-green-400">
                      {(response.qualityEvaluation.score * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                      {response.qualityEvaluation.method}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Latency</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      {response.metrics.latencyMs.toFixed(0)}ms
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Cost</div>
                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                      ${response.metrics.costUsd.toFixed(4)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Reward</div>
                    <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                      {(response.reward * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Selection Details */}
                <div className="mt-4 bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    Selection Details
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Probability:</span>
                      <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                        {(response.selectionProbability * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Tokens:</span>
                      <span className="ml-2 font-semibold text-gray-900 dark:text-white">
                        {response.metrics.tokensGenerated}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Leaderboard */}
            <ModelLeaderboard
              models={leaderboard.models}
              totalRequests={leaderboard.totalRequests}
              cumulativeReward={leaderboard.cumulativeReward}
              cumulativeRegret={leaderboard.cumulativeRegret}
            />
          </div>

          {/* Right Column: Model Info & Chart */}
          <div className="space-y-6">
            {/* Model Cards */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Available Models
              </h2>
              <div className="space-y-4">
                {Object.values(MODELS).map((model) => (
                  <div
                    key={model.key}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {model.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {model.description}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Quality:</span>
                        <span className="ml-1 font-semibold text-gray-900 dark:text-white">
                          {(model.expectedMetrics.quality * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-600 dark:text-gray-400">Cost:</span>
                        <span className="ml-1 font-semibold text-gray-900 dark:text-white">
                          ${model.expectedMetrics.costPer1kTokens}/1k
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Traffic Allocation Chart */}
            {leaderboard.models.length > 0 && (
              <ModelComparisonChart models={leaderboard.models} />
            )}

            {/* Stats */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Experiment Stats
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Total Requests</span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {leaderboard.totalRequests.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Cumulative Reward</span>
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    {leaderboard.cumulativeReward.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Cumulative Regret</span>
                  <span className="font-semibold text-orange-600 dark:text-orange-400">
                    {leaderboard.cumulativeRegret.toFixed(1)}
                  </span>
                </div>
                {leaderboard.totalRequests > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Avg Reward/Request</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {(leaderboard.cumulativeReward / leaderboard.totalRequests * 100).toFixed(1)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
