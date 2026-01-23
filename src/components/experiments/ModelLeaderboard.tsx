'use client';

import React, { memo, useMemo } from 'react';

/**
 * Model leaderboard entry
 */
export interface ModelLeaderboardEntry {
  key: string;
  name: string;
  score: number;
  traffic: number; // percentage
  totalRequests: number;
  avgQuality: number;
  avgLatency: number;
  avgCost: number;
  expectedReward: number;
}

/**
 * Model leaderboard props
 */
export interface ModelLeaderboardProps {
  models: ModelLeaderboardEntry[];
  totalRequests: number;
  cumulativeReward: number;
  cumulativeRegret: number;
  className?: string;
}

/**
 * Format number with commas
 */
function formatNumber(num: number, decimals: number = 0): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  if (amount < 0.01) {
    return `$${(amount * 1000).toFixed(2)}/1k`;
  }
  return `$${amount.toFixed(3)}`;
}

/**
 * Get rank indicator
 */
function getRankIndicator(rank: number): string {
  switch (rank) {
    case 1:
      return '🥇';
    case 2:
      return '🥈';
    case 3:
      return '🥉';
    default:
      return `${rank}.`;
  }
}

/**
 * Get traffic color based on percentage
 */
function getTrafficColor(traffic: number): string {
  if (traffic >= 40) return 'text-green-600 dark:text-green-400';
  if (traffic >= 20) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-gray-600 dark:text-gray-400';
}

/**
 * Get quality color
 */
function getQualityColor(quality: number): string {
  if (quality >= 0.8) return 'text-green-600 dark:text-green-400';
  if (quality >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

// Memoized Model Row Component to prevent unnecessary re-renders
const ModelRow = memo(function ModelRow({
  model,
  index
}: {
  model: ModelLeaderboardEntry
  index: number
}) {
  return (
    <div
      className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
    >
      <div className="flex items-start justify-between">
        {/* Rank and Name */}
        <div className="flex items-start space-x-3">
          <div className="text-2xl">{getRankIndicator(index + 1)}</div>
          <div>
            <div className="font-semibold text-gray-900 dark:text-white">
              {model.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {model.key}
            </div>
          </div>
        </div>

        {/* Score Badge */}
        <div className="text-right">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
            <span className="text-sm font-semibold">
              Score: {(model.score * 100).toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
        {/* Traffic */}
        <div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Traffic</div>
          <div className={`text-lg font-semibold ${getTrafficColor(model.traffic)}`}>
            {model.traffic.toFixed(1)}%
          </div>
          <div className="mt-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, model.traffic)}%` }}
            />
          </div>
        </div>

        {/* Requests */}
        <div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Requests</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatNumber(model.totalRequests)}
          </div>
        </div>

        {/* Quality */}
        <div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Avg Quality</div>
          <div className={`text-lg font-semibold ${getQualityColor(model.avgQuality)}`}>
            {(model.avgQuality * 100).toFixed(1)}%
          </div>
        </div>

        {/* Latency */}
        <div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Avg Latency</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatNumber(model.avgLatency, 0)}ms
          </div>
        </div>

        {/* Cost */}
        <div>
          <div className="text-xs text-gray-600 dark:text-gray-400">Avg Cost</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatCurrency(model.avgCost)}
          </div>
        </div>
      </div>
    </div>
  )
})

/**
 * Model Leaderboard Component
 *
 * Displays ranked list of models with performance metrics and traffic allocation.
 */
function ModelLeaderboardInner({
  models,
  totalRequests,
  cumulativeReward,
  cumulativeRegret,
  className = ''
}: ModelLeaderboardProps) {
  // Memoize convergence analysis text
  const convergenceText = useMemo(() => {
    if (models.length === 0 || totalRequests <= 100) return null

    return models[0].traffic > 60
      ? `The algorithm has converged to ${models[0].name} with ${models[0].traffic.toFixed(1)}% traffic allocation.`
      : 'The algorithm is still exploring different models. Convergence expected after ~2,000 requests.'
  }, [models, totalRequests])

  const showLowRegretMessage = useMemo(() => {
    return cumulativeRegret < 50 && totalRequests > 500
  }, [cumulativeRegret, totalRequests])

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Requests</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {formatNumber(totalRequests)}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <div className="text-sm text-gray-600 dark:text-gray-400">Cumulative Reward</div>
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {formatNumber(cumulativeReward, 1)}
          </div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <div className="text-sm text-gray-600 dark:text-gray-400">Cumulative Regret</div>
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {formatNumber(cumulativeRegret, 1)}
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Model Leaderboard
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Ranked by Thompson Sampling performance
          </p>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {models.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
              No models available. Start making requests to see rankings.
            </div>
          ) : (
            models.map((model, index) => (
              <ModelRow key={model.key} model={model} index={index} />
            ))
          )}
        </div>
      </div>

      {/* Convergence Info */}
      {convergenceText && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="text-blue-500 dark:text-blue-400 text-xl">ℹ️</div>
            <div>
              <div className="font-semibold text-blue-900 dark:text-blue-100">
                Convergence Analysis
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                {convergenceText}
              </p>
              {showLowRegretMessage && (
                <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                  Low regret ({cumulativeRegret.toFixed(1)}) indicates efficient learning.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const ModelLeaderboard = memo(ModelLeaderboardInner)

// Memoized Traffic Bar component
const TrafficBar = memo(function TrafficBar({ model }: { model: ModelLeaderboardEntry }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-700 dark:text-gray-300">{model.name}</span>
        <span className="font-semibold text-gray-900 dark:text-white">
          {model.traffic.toFixed(1)}%
        </span>
      </div>
      <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-3">
        <div
          className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, model.traffic)}%` }}
        />
      </div>
    </div>
  )
})

/**
 * Model Comparison Chart Component
 *
 * Shows traffic allocation over time (placeholder for future implementation)
 */
function ModelComparisonChartInner({ models }: { models: ModelLeaderboardEntry[] }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Traffic Allocation
      </h3>
      <div className="space-y-3">
        {models.map(model => (
          <TrafficBar key={model.key} model={model} />
        ))}
      </div>
    </div>
  );
}

export const ModelComparisonChart = memo(ModelComparisonChartInner)
