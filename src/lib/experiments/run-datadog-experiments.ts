/**
 * Run Experiments with Datadog LLM Observability
 *
 * This script runs our AI experiments and tracks everything to Datadog
 */

import { datadogLLMTracker, type LLMExperimentMetrics } from './datadog-llm-tracking';
import RUMMonitoring from '../monitoring/rum-client';

// Initialize Datadog RUM
function initializeDatadog() {
  RUMMonitoring.initializeWithTracking({
    service: 'vibecode-experiments',
    env: process.env.DD_ENV || 'development',
  });

  console.log('[Experiments] Datadog RUM initialized for LLM observability');
}

/**
 * Experiment 1: GPT-4 vs GPT-4.1 for Speech Transcription
 */
export async function runSpeechTranscriptionExperiment(
  userId: string,
  text: string
): Promise<{variant: string; result: any; metrics: LLMExperimentMetrics}> {

  const experimentKey = 'speech_transcription_model';

  // Randomly assign variant (50/50 split)
  const variant = Math.random() < 0.5 ? 'gpt4' : 'gpt41';
  const model = variant === 'gpt4' ? 'gpt-4-turbo' : 'gpt-4-turbo-preview';

  // Track assignment to Datadog
  datadogLLMTracker.trackAssignment({
    experimentKey,
    variantKey: variant,
    userId,
    sessionId: RUMMonitoring.getSessionInfo()?.sessionId,
    assignmentProbability: 0.5,
  });

  console.log(`[Experiment] Assigned user ${userId} to variant: ${variant}`);

  const startTime = Date.now();
  let ttftTime: number | undefined;

  try {
    // Simulate LLM API call (replace with actual OpenRouter/OpenAI call)
    const response = await simulateLLMCall(model, text, (firstToken) => {
      ttftTime = Date.now() - startTime;
    });

    const endTime = Date.now();
    const latency = endTime - startTime;

    // Calculate metrics
    const promptTokens = Math.ceil(text.length / 4); // Rough estimate
    const completionTokens = Math.ceil(response.length / 4);
    const totalTokens = promptTokens + completionTokens;

    // Cost estimation (approximate)
    const costPer1kTokens = variant === 'gpt4' ? 0.01 : 0.012;
    const costUsd = (totalTokens / 1000) * costPer1kTokens;

    // Quality score (simulated - in reality use WER or user rating)
    const qualityScore = 0.95 + Math.random() * 0.05;

    const metrics: LLMExperimentMetrics = {
      experimentKey,
      variantKey: variant,
      userId,
      sessionId: RUMMonitoring.getSessionInfo()?.sessionId,
      model,
      provider: 'openai',
      latencyMs: latency,
      timeToFirstTokenMs: ttftTime,
      tokensPrompt: promptTokens,
      tokensCompletion: completionTokens,
      tokensTotal: totalTokens,
      costUsd,
      costPer1kTokens,
      qualityScore,
      promptLength: text.length,
      responseLength: response.length,
      temperature: 0.7,
      maxTokens: 1000,
    };

    // Track to Datadog LLM Observability
    datadogLLMTracker.trackLLMExperiment(metrics);

    // Track conversion metric (successful transcription)
    datadogLLMTracker.trackMetric({
      experimentKey,
      variantKey: variant,
      userId,
      metricName: 'transcription_success',
      metricValue: 1,
      metricType: 'conversion',
    });

    // Track latency as continuous metric
    datadogLLMTracker.trackMetric({
      experimentKey,
      variantKey: variant,
      userId,
      metricName: 'latency_ms',
      metricValue: latency,
      metricType: 'continuous',
    });

    console.log(`[Experiment] Tracked to Datadog - Variant: ${variant}, Latency: ${latency}ms, Cost: $${costUsd.toFixed(4)}`);

    return { variant, result: response, metrics };

  } catch (error) {
    // Track error to Datadog
    datadogLLMTracker.trackError(
      experimentKey,
      variant,
      error as Error,
      { userId, model }
    );
    throw error;
  }
}

/**
 * Experiment 2: RAG Chatbot Performance (Lazy Load vs Preload)
 */
export async function runChatbotPerformanceExperiment(
  userId: string,
  message: string,
  isFirstMessage: boolean
): Promise<{variant: string; result: any; metrics: any}> {

  const experimentKey = 'chatbot_initialization_strategy';

  // Randomly assign variant
  const variant = Math.random() < 0.5 ? 'lazy_load' : 'preload';

  // Track assignment
  datadogLLMTracker.trackAssignment({
    experimentKey,
    variantKey: variant,
    userId,
    sessionId: RUMMonitoring.getSessionInfo()?.sessionId,
    assignmentProbability: 0.5,
  });

  const startTime = Date.now();
  let coldStartTime: number | undefined;
  let ttftTime: number | undefined;

  // Simulate cold start for lazy_load on first message
  if (isFirstMessage && variant === 'lazy_load') {
    coldStartTime = Math.random() * 2000 + 2000; // 2-4 seconds
    await new Promise(resolve => setTimeout(resolve, coldStartTime));
  }

  try {
    // Simulate RAG + LLM call
    const response = await simulateLLMCall('gpt-4-turbo', message, (firstToken) => {
      ttftTime = Date.now() - startTime;
    });

    const endTime = Date.now();
    const totalLatency = endTime - startTime;

    const metrics = {
      experimentKey,
      variantKey: variant,
      userId,
      sessionId: RUMMonitoring.getSessionInfo()?.sessionId,
      model: 'gpt-4-turbo',
      provider: 'openai',
      latencyMs: totalLatency,
      timeToFirstTokenMs: ttftTime,
      tokensPrompt: Math.ceil(message.length / 4),
      tokensCompletion: Math.ceil(response.length / 4),
      tokensTotal: Math.ceil((message.length + response.length) / 4),
      costUsd: 0.015,
      qualityScore: 0.92,
    };

    // Track to Datadog
    datadogLLMTracker.trackLLMExperiment(metrics);

    // Track specific metrics
    if (coldStartTime) {
      datadogLLMTracker.trackMetric({
        experimentKey,
        variantKey: variant,
        userId,
        metricName: 'cold_start_ms',
        metricValue: coldStartTime,
        metricType: 'continuous',
      });
    }

    datadogLLMTracker.trackMetric({
      experimentKey,
      variantKey: variant,
      userId,
      metricName: 'ttft_ms',
      metricValue: ttftTime || 0,
      metricType: 'continuous',
    });

    console.log(`[Chatbot Experiment] Variant: ${variant}, Total: ${totalLatency}ms, TTFT: ${ttftTime}ms, Cold Start: ${coldStartTime || 0}ms`);

    return { variant, result: response, metrics: { ...metrics, coldStartMs: coldStartTime } };

  } catch (error) {
    datadogLLMTracker.trackError(experimentKey, variant, error as Error, { userId });
    throw error;
  }
}

/**
 * Experiment 3: Multi-Model Selection (Thompson Sampling)
 */
export async function runMultiModelExperiment(
  userId: string,
  prompt: string
): Promise<{variant: string; model: string; result: any; metrics: LLMExperimentMetrics}> {

  const experimentKey = 'multi_model_selection';

  // Models to choose from
  const models = [
    { key: 'gpt4', model: 'gpt-4-turbo', provider: 'openai', costPer1k: 0.01 },
    { key: 'claude', model: 'claude-3-5-sonnet', provider: 'anthropic', costPer1k: 0.015 },
    { key: 'gemini', model: 'gemini-1.5-pro', provider: 'google', costPer1k: 0.007 },
    { key: 'llama', model: 'llama-3.1-70b', provider: 'meta', costPer1k: 0.0015 },
  ];

  // Simple Thompson Sampling (replace with actual bandit logic)
  const selectedModel = models[Math.floor(Math.random() * models.length)];

  // Track assignment
  datadogLLMTracker.trackAssignment({
    experimentKey,
    variantKey: selectedModel.key,
    userId,
    sessionId: RUMMonitoring.getSessionInfo()?.sessionId,
  });

  const startTime = Date.now();
  let ttftTime: number | undefined;

  try {
    const response = await simulateLLMCall(selectedModel.model, prompt, (firstToken) => {
      ttftTime = Date.now() - startTime;
    });

    const endTime = Date.now();
    const latency = endTime - startTime;

    const totalTokens = Math.ceil((prompt.length + response.length) / 4);
    const costUsd = (totalTokens / 1000) * selectedModel.costPer1k;
    const qualityScore = 0.80 + Math.random() * 0.15;

    const metrics: LLMExperimentMetrics = {
      experimentKey,
      variantKey: selectedModel.key,
      userId,
      sessionId: RUMMonitoring.getSessionInfo()?.sessionId,
      model: selectedModel.model,
      provider: selectedModel.provider,
      latencyMs: latency,
      timeToFirstTokenMs: ttftTime,
      tokensPrompt: Math.ceil(prompt.length / 4),
      tokensCompletion: Math.ceil(response.length / 4),
      tokensTotal: totalTokens,
      costUsd,
      costPer1kTokens: selectedModel.costPer1k,
      qualityScore,
      promptLength: prompt.length,
      responseLength: response.length,
    };

    // Track to Datadog
    datadogLLMTracker.trackLLMExperiment(metrics);

    // Track quality and cost metrics
    datadogLLMTracker.trackMetric({
      experimentKey,
      variantKey: selectedModel.key,
      userId,
      metricName: 'quality_score',
      metricValue: qualityScore,
      metricType: 'continuous',
    });

    datadogLLMTracker.trackMetric({
      experimentKey,
      variantKey: selectedModel.key,
      userId,
      metricName: 'cost_usd',
      metricValue: costUsd,
      metricType: 'continuous',
    });

    console.log(`[Multi-Model] Selected: ${selectedModel.key}, Quality: ${qualityScore.toFixed(2)}, Cost: $${costUsd.toFixed(4)}`);

    return { variant: selectedModel.key, model: selectedModel.model, result: response, metrics };

  } catch (error) {
    datadogLLMTracker.trackError(experimentKey, selectedModel.key, error as Error, { userId, model: selectedModel.model });
    throw error;
  }
}

/**
 * Simulate LLM API call (replace with actual OpenRouter/OpenAI call)
 */
async function simulateLLMCall(
  model: string,
  prompt: string,
  onFirstToken?: (firstToken: string) => void
): Promise<string> {

  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 300));

  // Simulate first token
  if (onFirstToken) {
    onFirstToken('First');
  }

  // Simulate streaming response
  await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));

  return `This is a simulated response from ${model} to the prompt: "${prompt.substring(0, 50)}..."`;
}

/**
 * Run all experiments for a user
 */
export async function runAllExperimentsForUser(userId: string) {
  initializeDatadog();

  console.log(`\n=== Running All Experiments for User: ${userId} ===\n`);

  // Experiment 1: Speech Transcription
  console.log('Running Experiment 1: Speech Transcription...');
  const speech = await runSpeechTranscriptionExperiment(
    userId,
    'Hello, this is a test transcription for our experiment.'
  );

  // Experiment 2: Chatbot Performance
  console.log('\nRunning Experiment 2: Chatbot Performance...');
  const chatbot = await runChatbotPerformanceExperiment(
    userId,
    'How do I deploy this application to production?',
    true // first message
  );

  // Experiment 3: Multi-Model Selection
  console.log('\nRunning Experiment 3: Multi-Model Selection...');
  const multiModel = await runMultiModelExperiment(
    userId,
    'Explain the benefits of serverless architecture.'
  );

  console.log('\n=== Experiments Complete ===');
  console.log('All data tracked to Datadog LLM Observability');

  return {
    speechTranscription: speech,
    chatbotPerformance: chatbot,
    multiModelSelection: multiModel,
  };
}

// Export for testing
export { initializeDatadog };
