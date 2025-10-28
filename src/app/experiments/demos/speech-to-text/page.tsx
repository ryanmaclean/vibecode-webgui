/**
 * Speech-to-Text AI Model Comparison Demo
 *
 * Interactive demo comparing GPT-4 vs GPT-4.1 for speech transcription.
 * Features real-time transcription, metrics visualization, and statistical analysis.
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { TranscriptionResult, ExperimentSummary } from '@/lib/experiments/scenarios/speech-to-text';
import { TEST_TRANSCRIPTIONS } from '@/lib/experiments/scenarios/speech-test-data';

export default function SpeechToTextDemo() {
  const [userId, setUserId] = useState<string>('');
  const [textPrompt, setTextPrompt] = useState<string>('');
  const [referenceTranscript, setReferenceTranscript] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [summary, setSummary] = useState<ExperimentSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generate random user ID on mount
  useEffect(() => {
    setUserId(`user_${Math.random().toString(36).substr(2, 9)}`);
    loadSummary();
  }, []);

  // Load experiment summary
  const loadSummary = async () => {
    try {
      const response = await fetch('/api/experiments/demos/speech-to-text/summary');
      if (response.ok) {
        const data = await response.json();
        setSummary(data.data);
      }
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  };

  // Handle transcription request
  const handleTranscribe = async () => {
    if (!textPrompt.trim()) {
      setError('Please enter text to transcribe');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/experiments/demos/speech-to-text/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          textPrompt,
          referenceTranscript: referenceTranscript || undefined
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Transcription failed');
      }

      const data = await response.json();
      setResult(data.data);

      // Reload summary to show updated stats
      setTimeout(loadSummary, 1000);

    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Load example transcription
  const loadExample = (index: number) => {
    const example = TEST_TRANSCRIPTIONS[index];
    if (example) {
      setTextPrompt(example.audioDescription);
      setReferenceTranscript(example.referenceTranscript);
    }
  };

  // Generate demo data
  const handleGenerateData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/experiments/demos/speech-to-text/generate-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset: 'demo' })
      });

      if (response.ok) {
        alert('Generated 1,000 demo records successfully!');
        await loadSummary();
      }
    } catch (err) {
      console.error('Failed to generate data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Format metrics
  const formatLatency = (ms: number) => `${ms.toFixed(0)}ms`;
  const formatCost = (usd: number) => `$${usd.toFixed(4)}`;
  const formatPercent = (val: number) => `${(val * 100).toFixed(1)}%`;
  const formatImprovement = (val: number) => {
    const prefix = val > 0 ? '+' : '';
    return `${prefix}${val.toFixed(1)}%`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border p-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                GPT-4 vs GPT-4.1 Speech Transcription Experiment
              </h1>
              <p className="text-sm text-gray-600 mt-2 max-w-3xl">
                <strong>Hypothesis:</strong> GPT-4.1 reduces speech transcription latency by 30%
                compared to GPT-4, with acceptable cost increase (&lt;20%) and similar accuracy.
              </p>
            </div>
            {summary && (
              <div className="flex items-center gap-2">
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  summary.totalAssignments > 100 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {summary.totalAssignments > 100 ? '🟢 Running' : '🟡 Collecting Data'}
                </div>
                <div className="text-sm text-gray-600">
                  {summary.totalAssignments.toLocaleString()} assignments
                </div>
              </div>
            )}
          </div>

          {/* Key Results (if available) */}
          {summary && summary.totalAssignments > 50 && (
            <div className="mt-4 grid grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg">
              <div>
                <div className="text-xs text-gray-600 uppercase">Latency Improvement</div>
                <div className="text-2xl font-bold text-blue-900">
                  {formatImprovement(summary.metrics.latency.improvement)}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  p {summary.metrics.latency.pValue < 0.001 ? '< 0.001' : `= ${summary.metrics.latency.pValue.toFixed(3)}`}
                  {summary.metrics.latency.significant && ' ✓'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 uppercase">Cost Difference</div>
                <div className="text-2xl font-bold text-orange-900">
                  {formatImprovement(summary.metrics.cost.difference)}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  p = {summary.metrics.cost.pValue.toFixed(3)}
                  {summary.metrics.cost.significant && ' ✓'}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 uppercase">SRM Status</div>
                <div className={`text-2xl font-bold ${summary.srmStatus.hasMismatch ? 'text-red-900' : 'text-green-900'}`}>
                  {summary.srmStatus.hasMismatch ? '⚠️ Mismatch' : '✓ Passed'}
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  p = {summary.srmStatus.pValue.toFixed(3)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Section */}
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-xl font-semibold mb-4">Run Transcription</h2>

          {/* Example Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quick Examples
            </label>
            <div className="flex flex-wrap gap-2">
              {TEST_TRANSCRIPTIONS.slice(0, 5).map((example, idx) => (
                <Button
                  key={example.id}
                  variant="outline"
                  size="sm"
                  onClick={() => loadExample(idx)}
                  disabled={loading}
                >
                  {example.difficulty === 'easy' && '🟢'}
                  {example.difficulty === 'medium' && '🟡'}
                  {example.difficulty === 'hard' && '🔴'}
                  {' '}
                  {example.audioDescription.slice(0, 30)}...
                </Button>
              ))}
            </div>
          </div>

          {/* Text Input */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Audio Description / Text to Transcribe
              </label>
              <textarea
                className="w-full h-24 px-3 py-2 border rounded-md text-sm"
                placeholder="Describe the audio content or enter text to transcribe..."
                value={textPrompt}
                onChange={(e) => setTextPrompt(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reference Transcript (Optional - for accuracy calculation)
              </label>
              <textarea
                className="w-full h-24 px-3 py-2 border rounded-md text-sm"
                placeholder="Enter reference transcript for WER calculation..."
                value={referenceTranscript}
                onChange={(e) => setReferenceTranscript(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleTranscribe}
                disabled={loading || !textPrompt.trim()}
                className="flex-1"
              >
                {loading ? 'Transcribing...' : 'Run Transcription Experiment'}
              </Button>
              <Button
                variant="outline"
                onClick={handleGenerateData}
                disabled={loading}
              >
                Generate Demo Data (1,000 records)
              </Button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <Alert className="mt-4 bg-red-50 border-red-200">
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        {/* Results Display */}
        {result && (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4">Transcription Result</h2>

            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm font-medium text-blue-900">
                Assigned to: <strong>{result.modelName}</strong> ({result.variantKey})
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Transcript */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Transcript</h3>
                <div className="p-4 bg-gray-50 rounded-lg text-sm leading-relaxed">
                  {result.transcript}
                </div>
              </div>

              {/* Metrics */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Metrics</h3>
                <div className="space-y-2">
                  <MetricRow label="Latency" value={formatLatency(result.metrics.latencyMs)} />
                  <MetricRow label="Time to First Token" value={formatLatency(result.metrics.timeToFirstTokenMs)} />
                  <MetricRow label="Cost" value={formatCost(result.metrics.costUsd)} />
                  <MetricRow label="Confidence" value={formatPercent(result.metrics.confidenceScore)} />
                  {result.metrics.wordErrorRate !== undefined && (
                    <MetricRow label="Word Error Rate" value={formatPercent(result.metrics.wordErrorRate)} />
                  )}
                  <MetricRow label="Tokens Used" value={result.metrics.tokensUsed.toString()} />
                  <MetricRow label="Transcript Length" value={`${result.metrics.transcriptLength} words`} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Statistical Summary */}
        {summary && summary.totalAssignments > 0 && (
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-xl font-semibold mb-4">Experiment Statistics</h2>

            {/* Variant Distribution */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Variant Distribution</h3>
              <div className="flex gap-4">
                <div className="flex-1 p-3 bg-purple-50 rounded-lg">
                  <div className="text-sm text-gray-600">GPT-4</div>
                  <div className="text-2xl font-bold text-purple-900">
                    {summary.variantDistribution.gpt4 || 0}
                  </div>
                  <div className="text-xs text-gray-600">
                    {summary.totalAssignments > 0
                      ? `${((summary.variantDistribution.gpt4 || 0) / summary.totalAssignments * 100).toFixed(1)}%`
                      : '0%'}
                  </div>
                </div>
                <div className="flex-1 p-3 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600">GPT-4.1</div>
                  <div className="text-2xl font-bold text-green-900">
                    {summary.variantDistribution.gpt41 || 0}
                  </div>
                  <div className="text-xs text-gray-600">
                    {summary.totalAssignments > 0
                      ? `${((summary.variantDistribution.gpt41 || 0) / summary.totalAssignments * 100).toFixed(1)}%`
                      : '0%'}
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics Comparison */}
            {summary.totalAssignments > 10 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-gray-700">Metrics Comparison</h3>

                {/* Latency */}
                <ComparisonCard
                  title="Latency"
                  gpt4Value={formatLatency(summary.metrics.latency.gpt4.mean)}
                  gpt41Value={formatLatency(summary.metrics.latency.gpt41.mean)}
                  improvement={summary.metrics.latency.improvement}
                  pValue={summary.metrics.latency.pValue}
                  significant={summary.metrics.latency.significant}
                  better={summary.metrics.latency.improvement > 0}
                  additionalMetrics={[
                    { label: 'P50', gpt4: formatLatency(summary.metrics.latency.gpt4.p50), gpt41: formatLatency(summary.metrics.latency.gpt41.p50) },
                    { label: 'P95', gpt4: formatLatency(summary.metrics.latency.gpt4.p95), gpt41: formatLatency(summary.metrics.latency.gpt41.p95) }
                  ]}
                />

                {/* Cost */}
                <ComparisonCard
                  title="Cost per Request"
                  gpt4Value={formatCost(summary.metrics.cost.gpt4.mean)}
                  gpt41Value={formatCost(summary.metrics.cost.gpt41.mean)}
                  improvement={-summary.metrics.cost.difference}
                  pValue={summary.metrics.cost.pValue}
                  significant={summary.metrics.cost.significant}
                  better={summary.metrics.cost.difference < 0}
                  additionalMetrics={[
                    { label: 'Total Cost', gpt4: formatCost(summary.metrics.cost.gpt4.total), gpt41: formatCost(summary.metrics.cost.gpt41.total) }
                  ]}
                />

                {/* Accuracy */}
                {summary.metrics.accuracy.gpt4.mean > 0 && (
                  <ComparisonCard
                    title="Word Error Rate"
                    gpt4Value={formatPercent(summary.metrics.accuracy.gpt4.mean)}
                    gpt41Value={formatPercent(summary.metrics.accuracy.gpt41.mean)}
                    improvement={-summary.metrics.accuracy.difference}
                    pValue={summary.metrics.accuracy.pValue}
                    significant={summary.metrics.accuracy.significant}
                    better={summary.metrics.accuracy.difference < 0}
                  />
                )}
              </div>
            )}

            {/* Decision Recommendation */}
            {summary.totalAssignments > 100 && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <h3 className="text-sm font-semibold text-green-900 mb-2">Decision Recommendation</h3>
                <p className="text-sm text-green-800">
                  {summary.metrics.latency.significant && summary.metrics.latency.improvement > 20
                    ? `✓ Roll out GPT-4.1: Latency improvement of ${summary.metrics.latency.improvement.toFixed(1)}% is statistically significant and meets hypothesis target.`
                    : summary.totalAssignments > 500
                    ? '⚠️ Continue collecting data: Results not yet conclusive.'
                    : '🔵 Need more data: Continue experiment to reach statistical power.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Help Text */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">How to Use This Demo</h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Click a quick example or enter your own audio description</li>
            <li>Optionally add a reference transcript to calculate Word Error Rate</li>
            <li>Click "Run Transcription Experiment" to be randomly assigned to GPT-4 or GPT-4.1</li>
            <li>View metrics for your transcription and overall experiment statistics</li>
            <li>Generate demo data to see statistical analysis with larger sample sizes</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// Helper Components

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-100">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

interface ComparisonCardProps {
  title: string;
  gpt4Value: string;
  gpt41Value: string;
  improvement: number;
  pValue: number;
  significant: boolean;
  better: boolean;
  additionalMetrics?: Array<{ label: string; gpt4: string; gpt41: string }>;
}

function ComparisonCard({
  title,
  gpt4Value,
  gpt41Value,
  improvement,
  pValue,
  significant,
  better,
  additionalMetrics
}: ComparisonCardProps) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-semibold ${better ? 'text-green-600' : 'text-orange-600'}`}>
            {improvement > 0 ? '+' : ''}{improvement.toFixed(1)}%
          </span>
          {significant && <span className="text-green-600 text-xs">✓ Significant</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-2">
        <div className="p-3 bg-purple-50 rounded">
          <div className="text-xs text-gray-600 mb-1">GPT-4</div>
          <div className="text-lg font-bold text-purple-900">{gpt4Value}</div>
        </div>
        <div className="p-3 bg-green-50 rounded">
          <div className="text-xs text-gray-600 mb-1">GPT-4.1</div>
          <div className="text-lg font-bold text-green-900">{gpt41Value}</div>
        </div>
      </div>

      {additionalMetrics && additionalMetrics.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
          {additionalMetrics.map(({ label, gpt4, gpt41 }) => (
            <div key={label} className="flex justify-between text-xs text-gray-600">
              <span>{label}:</span>
              <span>GPT-4: {gpt4} | GPT-4.1: {gpt41}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 text-xs text-gray-500">
        p-value: {pValue < 0.001 ? '< 0.001' : pValue.toFixed(3)}
      </div>
    </div>
  );
}
