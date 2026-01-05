/**
 * Chatbot Performance Experiment
 *
 * Compares two chatbot loading strategies:
 * - Lazy Load: Initialize RAG on first message (faster page load, slower first response)
 * - Preload: Initialize RAG on page load (slower page load, instant first response)
 *
 * Hypothesis: Preloaded chatbot increases user engagement by 30% despite slower initial load.
 */

import { tTest } from '../statistics'

// In-memory storage for mock warehouse (exported for testing)
export const warehouseMetrics: Array<{
  experimentKey: string;
  user_id: string;
  metric_name: string;
  value: number;
  variant_key?: string;
  metadata?: any;
}> = [];

export const warehouseAssignments: Array<{
  experimentKey: string;
  userId: string;
  variantKey: string;
}> = [];

// Create a mock warehouse for this scenario (in production, use actual warehouse)
// Exported for testing
export const experimentWarehouse = {
  async logAssignment(experimentKey: string, userId: string, variantKey: string, metadata?: any) {
    warehouseAssignments.push({ experimentKey, userId, variantKey });
    return Promise.resolve();
  },
  async logMetric(experimentKey: string, userId: string, metricName: string, value: number, metadata?: any) {
    warehouseMetrics.push({
      experimentKey,
      user_id: userId,
      metric_name: metricName,
      value,
      variant_key: metadata?.variantKey,
      metadata
    });
    return Promise.resolve();
  },
  async flush() {
    return Promise.resolve();
  },
  async getMetrics(experimentKey: string, metricName: string) {
    return Promise.resolve(
      warehouseMetrics.filter(m => m.experimentKey === experimentKey && m.metric_name === metricName)
    );
  },
  async getExperimentResults(experimentKey: string) {
    const assignments = warehouseAssignments.filter(a => a.experimentKey === experimentKey);
    const distribution = assignments.reduce((acc, a) => {
      acc[a.variantKey] = (acc[a.variantKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Promise.resolve({
      totalAssignments: assignments.length,
      variantDistribution: distribution,
      metrics: warehouseMetrics.filter(m => m.experimentKey === experimentKey)
    });
  }
};

// Local alias for internal use
const warehouse = experimentWarehouse;

// ==================== EXPERIMENT CONFIGURATION ====================

export const CHATBOT_EXPERIMENT = {
  experimentKey: 'chatbot_performance_v1',
  name: 'Chatbot Performance Optimization',
  hypothesis: 'Preloaded chatbot increases user engagement (messages per session) by 30% compared to lazy loading, despite slower initial load.',
  variants: {
    lazy_load: {
      key: 'lazy_load',
      strategy: 'lazy' as const,
      description: 'Initialize RAG client on first message for faster page load',
      name: 'Lazy Load (Fast Startup)'
    },
    preload: {
      key: 'preload',
      strategy: 'eager' as const,
      description: 'Pre-initialize RAG client on page load for instant response',
      name: 'Preloaded (Instant Response)'
    }
  },
  metrics: [
    { name: 'ttft_ms', description: 'Time to First Token (milliseconds)' },
    { name: 'total_response_ms', description: 'Total response time (milliseconds)' },
    { name: 'cold_start_ms', description: 'Cold start latency (milliseconds)' },
    { name: 'tokens_generated', description: 'Number of tokens generated' },
    { name: 'session_message_count', description: 'Messages sent per session' },
    { name: 'engagement_score', description: 'User engagement score (0-1)' },
    { name: 'session_duration_ms', description: 'Total session duration (milliseconds)' },
    { name: 'user_satisfaction', description: 'User satisfaction rating (1-5)' }
  ]
}

// ==================== TYPES ====================

export interface ChatRequest {
  userId: string
  sessionId: string
  message: string
  variant?: 'lazy_load' | 'preload'
  workspaceId?: string
}

export interface ChatResponse {
  variantKey: string
  strategy: 'lazy' | 'eager'
  message: string
  metrics: {
    ttftMs: number
    totalResponseMs: number
    coldStartMs?: number
    tokensGenerated: number
    sessionMessageCount: number
    engagementScore: number
  }
  metadata?: {
    sources?: number
    relevanceScore?: number
  }
}

export interface ChatSession {
  sessionId: string
  userId: string
  variantKey: string
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: Date
    metrics?: {
      ttftMs?: number
      totalResponseMs?: number
      tokensGenerated?: number
    }
  }>
  startTime: Date
  endTime?: Date
  metadata: {
    isPreloaded: boolean
    coldStartMs?: number
    totalMessages: number
    engagementScore?: number
  }
}

// ==================== SESSION STORAGE ====================

// In-memory session storage (in production, use Redis or database)
const activeSessions = new Map<string, ChatSession>()
const preloadedClients = new Map<string, { client: any; timestamp: number }>()

// ==================== VARIANT ASSIGNMENT ====================

/**
 * Assign user to a variant using 50/50 randomization
 */
function assignVariant(userId: string, sessionId: string): 'lazy_load' | 'preload' {
  // Deterministic assignment based on sessionId for consistency
  const hash = sessionId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return hash % 2 === 0 ? 'lazy_load' : 'preload'
}

// ==================== SESSION MANAGEMENT ====================

/**
 * Create a new chat session
 */
export async function createChatSession(
  userId: string,
  sessionId: string,
  variant?: 'lazy_load' | 'preload'
): Promise<{ sessionId: string; variantKey: string; strategy: string }> {
  // Assign variant if not provided
  const variantKey = variant || assignVariant(userId, sessionId)
  const isPreloaded = variantKey === 'preload'

  // Log assignment to warehouse
  await warehouse.logAssignment(
    CHATBOT_EXPERIMENT.experimentKey,
    userId,
    variantKey,
    { sessionId, timestamp: new Date() }
  )

  // Create session
  const session: ChatSession = {
    sessionId,
    userId,
    variantKey,
    messages: [],
    startTime: new Date(),
    metadata: {
      isPreloaded,
      totalMessages: 0
    }
  }

  activeSessions.set(sessionId, session)

  // Preload RAG client if needed
  let coldStartMs = 0
  if (isPreloaded) {
    const startTime = Date.now()
    // Simulate preload initialization
    await new Promise(resolve => setTimeout(resolve, 50)) // Minimal overhead
    coldStartMs = Date.now() - startTime

    session.metadata.coldStartMs = coldStartMs
    preloadedClients.set(sessionId, { client: true, timestamp: Date.now() })
  }

  return {
    sessionId,
    variantKey,
    strategy: CHATBOT_EXPERIMENT.variants[variantKey].strategy
  }
}

/**
 * Get existing session
 */
export function getChatSession(sessionId: string): ChatSession | undefined {
  return activeSessions.get(sessionId)
}

/**
 * End a chat session
 */
export async function endChatSession(sessionId: string): Promise<void> {
  const session = activeSessions.get(sessionId)
  if (!session) return

  session.endTime = new Date()

  // Calculate final engagement score
  const engagementScore = calculateEngagementScore({
    messageCount: session.metadata.totalMessages,
    sessionDuration: session.endTime.getTime() - session.startTime.getTime(),
    avgResponseTime: calculateAvgResponseTime(session),
    userSatisfaction: undefined // Not provided in this demo
  })

  session.metadata.engagementScore = engagementScore

  // Log final session metrics
  await warehouse.logMetric(
    CHATBOT_EXPERIMENT.experimentKey,
    session.userId,
    'session_message_count',
    session.metadata.totalMessages,
    { sessionId, variantKey: session.variantKey }
  )

  await warehouse.logMetric(
    CHATBOT_EXPERIMENT.experimentKey,
    session.userId,
    'engagement_score',
    engagementScore,
    { sessionId, variantKey: session.variantKey }
  )

  await warehouse.logMetric(
    CHATBOT_EXPERIMENT.experimentKey,
    session.userId,
    'session_duration_ms',
    session.endTime.getTime() - session.startTime.getTime(),
    { sessionId, variantKey: session.variantKey }
  )

  // Clean up
  activeSessions.delete(sessionId)
  preloadedClients.delete(sessionId)
}

// ==================== CHAT PROCESSING ====================

/**
 * Send a chat message and get response
 */
export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  const { userId, sessionId, message } = request

  // Get or create session
  let session = activeSessions.get(sessionId)
  if (!session) {
    const sessionInfo = await createChatSession(userId, sessionId, request.variant)
    session = activeSessions.get(sessionId)!
  }

  const isFirstMessage = session.messages.length === 0
  const isPreloaded = session.metadata.isPreloaded

  // Measure cold start for lazy load
  let coldStartMs = 0
  if (!isPreloaded && isFirstMessage) {
    const startTime = Date.now()
    // Simulate lazy load initialization (RAG client setup)
    await new Promise(resolve => setTimeout(resolve, 150)) // Simulated overhead
    coldStartMs = Date.now() - startTime
    session.metadata.coldStartMs = coldStartMs
  }

  // Measure TTFT and total response time
  const startTime = Date.now()

  // Simulate RAG processing
  const response = await generateChatResponse(message, session, request.workspaceId || 'default')

  const ttftMs = isPreloaded ? Math.random() * 400 + 400 : Math.random() * 600 + 600 // Preload: 400-800ms, Lazy: 600-1200ms
  const elapsedMs = Date.now() - startTime
  // Ensure totalResponseMs is at least equal to ttftMs since response time includes TTFT
  const totalResponseMs = Math.max(ttftMs, elapsedMs + coldStartMs)
  const tokensGenerated = estimateTokenCount(response)

  // Add messages to session
  session.messages.push({
    role: 'user',
    content: message,
    timestamp: new Date()
  })

  session.messages.push({
    role: 'assistant',
    content: response,
    timestamp: new Date(),
    metrics: {
      ttftMs,
      totalResponseMs,
      tokensGenerated
    }
  })

  session.metadata.totalMessages = session.messages.filter(m => m.role === 'user').length

  // Log metrics to warehouse
  await warehouse.logMetric(
    CHATBOT_EXPERIMENT.experimentKey,
    userId,
    'ttft_ms',
    ttftMs,
    { sessionId, variantKey: session.variantKey, messageIndex: session.metadata.totalMessages }
  )

  await warehouse.logMetric(
    CHATBOT_EXPERIMENT.experimentKey,
    userId,
    'total_response_ms',
    totalResponseMs,
    { sessionId, variantKey: session.variantKey, messageIndex: session.metadata.totalMessages }
  )

  if (isFirstMessage && coldStartMs > 0) {
    await warehouse.logMetric(
      CHATBOT_EXPERIMENT.experimentKey,
      userId,
      'cold_start_ms',
      coldStartMs,
      { sessionId, variantKey: session.variantKey }
    )
  }

  await warehouse.logMetric(
    CHATBOT_EXPERIMENT.experimentKey,
    userId,
    'tokens_generated',
    tokensGenerated,
    { sessionId, variantKey: session.variantKey }
  )

  // Calculate current engagement score
  const engagementScore = calculateEngagementScore({
    messageCount: session.metadata.totalMessages,
    sessionDuration: Date.now() - session.startTime.getTime(),
    avgResponseTime: calculateAvgResponseTime(session),
    userSatisfaction: undefined
  })

  return {
    variantKey: session.variantKey,
    strategy: CHATBOT_EXPERIMENT.variants[session.variantKey].strategy,
    message: response,
    metrics: {
      ttftMs,
      totalResponseMs,
      coldStartMs: isFirstMessage ? coldStartMs : undefined,
      tokensGenerated,
      sessionMessageCount: session.metadata.totalMessages,
      engagementScore
    }
  }
}

// ==================== CHAT RESPONSE GENERATION ====================

/**
 * Generate chat response using RAG or simulated AI
 */
async function generateChatResponse(
  message: string,
  session: ChatSession,
  workspaceId: string
): Promise<string> {
  // Simulate response generation based on message
  const responses = [
    "To deploy to production, you'll need to run `npm run build` first, then deploy the built files to your hosting platform.",
    "For staging environments, you can use environment variables to configure different settings. Check your `.env.staging` file.",
    "You're welcome! Let me know if you have any other questions.",
    "I can help you with that. What specific aspect would you like to know more about?",
    "Based on the documentation, here's what you need to do...",
    "Great question! The best practice is to...",
    "That's a common issue. Try checking your configuration settings first."
  ]

  // Simple response selection based on message content
  if (message.toLowerCase().includes('deploy')) {
    return responses[0]
  } else if (message.toLowerCase().includes('staging')) {
    return responses[1]
  } else if (message.toLowerCase().includes('thank')) {
    return responses[2]
  } else {
    return responses[Math.floor(Math.random() * responses.length)]
  }
}

/**
 * Estimate token count from text
 */
function estimateTokenCount(text: string): number {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4)
}

// ==================== ENGAGEMENT SCORING ====================

/**
 * Calculate engagement score based on session metrics
 *
 * Score components:
 * - Messages: 40% (more messages = higher engagement)
 * - Duration: 30% (longer sessions up to 5 min)
 * - Response time: 20% (faster responses = better UX)
 * - Satisfaction: 10% (if provided)
 */
export function calculateEngagementScore(session: {
  messageCount: number
  sessionDuration: number
  avgResponseTime: number
  userSatisfaction?: number
}): number {
  // Normalize message count (0-1 scale, max at 10 messages)
  const messageScore = Math.min(session.messageCount / 10, 1)

  // Normalize duration (0-1 scale, max at 5 minutes)
  const durationScore = Math.min(session.sessionDuration / 300000, 1)

  // Normalize response time (inverse, 0-1 scale, max penalty at 10s)
  const speedScore = 1 - Math.min(session.avgResponseTime / 10000, 1)

  // Normalize satisfaction (0-1 scale from 1-5 rating)
  const satisfactionScore = session.userSatisfaction
    ? (session.userSatisfaction - 1) / 4
    : 0.5 // Default to neutral if not provided

  return (
    messageScore * 0.4 +
    durationScore * 0.3 +
    speedScore * 0.2 +
    satisfactionScore * 0.1
  )
}

/**
 * Calculate average response time for a session
 */
function calculateAvgResponseTime(session: ChatSession): number {
  const responseTimes = session.messages
    .filter(m => m.role === 'assistant' && m.metrics?.totalResponseMs)
    .map(m => m.metrics!.totalResponseMs)

  if (responseTimes.length === 0) return 0
  return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
}

// ==================== EXPERIMENT SUMMARY ====================

/**
 * Get experiment summary with statistical analysis
 */
export async function getChatbotExperimentSummary(): Promise<{
  experimentKey: string
  totalSessions: number
  variantDistribution: Record<string, number>
  metrics: {
    ttft: { lazy_load: number; preload: number; improvement: number; pValue: number }
    coldStart: { lazy_load: number; preload: number; difference: number }
    messagesPerSession: { lazy_load: number; preload: number; improvement: number; pValue: number }
    engagement: { lazy_load: number; preload: number; improvement: number; pValue: number }
  }
  statisticalSignificance: {
    messagesPerSession: { pValue: number; significant: boolean }
    engagement: { pValue: number; significant: boolean }
  }
  srmStatus: { hasMismatch: boolean; pValue: number }
  hypothesis: string
  status: string
}> {
  // Get experiment results from warehouse
  const results = await warehouse.getExperimentResults(CHATBOT_EXPERIMENT.experimentKey)

  // Extract variant-specific metrics
  const lazyLoadMetrics = {
    ttft: [] as number[],
    messagesPerSession: [] as number[],
    engagement: [] as number[],
    coldStart: [] as number[]
  }

  const preloadMetrics = {
    ttft: [] as number[],
    messagesPerSession: [] as number[],
    engagement: [] as number[],
    coldStart: [] as number[]
  }

  // Get raw metrics
  const ttftMetrics = await warehouse.getMetrics(CHATBOT_EXPERIMENT.experimentKey, 'ttft_ms')
  const sessionMetrics = await warehouse.getMetrics(CHATBOT_EXPERIMENT.experimentKey, 'session_message_count')
  const engagementMetrics = await warehouse.getMetrics(CHATBOT_EXPERIMENT.experimentKey, 'engagement_score')
  const coldStartMetrics = await warehouse.getMetrics(CHATBOT_EXPERIMENT.experimentKey, 'cold_start_ms')

  // Group by variant
  for (const metric of ttftMetrics) {
    if (metric.variant_key === 'lazy_load') {
      lazyLoadMetrics.ttft.push(metric.value)
    } else {
      preloadMetrics.ttft.push(metric.value)
    }
  }

  for (const metric of sessionMetrics) {
    if (metric.variant_key === 'lazy_load') {
      lazyLoadMetrics.messagesPerSession.push(metric.value)
    } else {
      preloadMetrics.messagesPerSession.push(metric.value)
    }
  }

  for (const metric of engagementMetrics) {
    if (metric.variant_key === 'lazy_load') {
      lazyLoadMetrics.engagement.push(metric.value)
    } else {
      preloadMetrics.engagement.push(metric.value)
    }
  }

  for (const metric of coldStartMetrics) {
    if (metric.variant_key === 'lazy_load') {
      lazyLoadMetrics.coldStart.push(metric.value)
    } else {
      preloadMetrics.coldStart.push(metric.value)
    }
  }

  // Calculate means
  const mean = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0

  const lazyTtft = mean(lazyLoadMetrics.ttft)
  const preloadTtft = mean(preloadMetrics.ttft)
  const lazyMessages = mean(lazyLoadMetrics.messagesPerSession)
  const preloadMessages = mean(preloadMetrics.messagesPerSession)
  const lazyEngagement = mean(lazyLoadMetrics.engagement)
  const preloadEngagement = mean(preloadMetrics.engagement)
  const lazyColdStart = mean(lazyLoadMetrics.coldStart)
  const preloadColdStart = mean(preloadMetrics.coldStart)

  // Calculate improvements
  const ttftImprovement = lazyTtft > 0 ? ((lazyTtft - preloadTtft) / lazyTtft) * 100 : 0
  const messagesImprovement = lazyMessages > 0 ? ((preloadMessages - lazyMessages) / lazyMessages) * 100 : 0
  const engagementImprovement = lazyEngagement > 0 ? ((preloadEngagement - lazyEngagement) / lazyEngagement) * 100 : 0

  // Statistical tests
  const messagesTest = tTest(lazyLoadMetrics.messagesPerSession, preloadMetrics.messagesPerSession)
  const engagementTest = tTest(lazyLoadMetrics.engagement, preloadMetrics.engagement)

  // Check for Sample Ratio Mismatch
  const totalAssignments = results.totalAssignments
  const lazyCount = results.variantDistribution['lazy_load'] || 0
  const preloadCount = results.variantDistribution['preload'] || 0
  const expectedRatio = 0.5
  const observedRatio = totalAssignments > 0 ? lazyCount / totalAssignments : 0.5
  const srmPValue = Math.abs(observedRatio - expectedRatio) > 0.05 ? 0.03 : 0.5 // Simplified

  return {
    experimentKey: CHATBOT_EXPERIMENT.experimentKey,
    totalSessions: totalAssignments,
    variantDistribution: results.variantDistribution,
    metrics: {
      ttft: {
        lazy_load: lazyTtft,
        preload: preloadTtft,
        improvement: ttftImprovement,
        pValue: 0.001 // Placeholder
      },
      coldStart: {
        lazy_load: lazyColdStart,
        preload: preloadColdStart,
        difference: lazyColdStart - preloadColdStart
      },
      messagesPerSession: {
        lazy_load: lazyMessages,
        preload: preloadMessages,
        improvement: messagesImprovement,
        pValue: messagesTest.pValue
      },
      engagement: {
        lazy_load: lazyEngagement,
        preload: preloadEngagement,
        improvement: engagementImprovement,
        pValue: engagementTest.pValue
      }
    },
    statisticalSignificance: {
      messagesPerSession: {
        pValue: messagesTest.pValue,
        significant: messagesTest.significant
      },
      engagement: {
        pValue: engagementTest.pValue,
        significant: engagementTest.significant
      }
    },
    srmStatus: {
      hasMismatch: srmPValue < 0.05,
      pValue: srmPValue
    },
    hypothesis: CHATBOT_EXPERIMENT.hypothesis,
    status: 'running'
  }
}
