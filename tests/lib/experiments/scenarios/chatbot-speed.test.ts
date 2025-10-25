/**
 * Unit Tests for Chatbot Performance Experiment
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import {
  CHATBOT_EXPERIMENT,
  createChatSession,
  sendChatMessage,
  getChatSession,
  endChatSession,
  calculateEngagementScore,
  getChatbotExperimentSummary
} from '@/lib/experiments/scenarios/chatbot-speed'
import { experimentWarehouse } from '@/lib/experiments/warehouse'
import { generateChatbotSyntheticData, TEST_SESSIONS } from '@/lib/experiments/scenarios/chatbot-test-data'

describe('Chatbot Performance Experiment', () => {
  // ==================== EXPERIMENT CONFIGURATION ====================

  describe('Experiment Configuration', () => {
    it('should have correct experiment key', () => {
      expect(CHATBOT_EXPERIMENT.experimentKey).toBe('chatbot_performance_v1')
    })

    it('should define two variants', () => {
      expect(Object.keys(CHATBOT_EXPERIMENT.variants)).toHaveLength(2)
      expect(CHATBOT_EXPERIMENT.variants.lazy_load).toBeDefined()
      expect(CHATBOT_EXPERIMENT.variants.preload).toBeDefined()
    })

    it('should define lazy load strategy correctly', () => {
      expect(CHATBOT_EXPERIMENT.variants.lazy_load.strategy).toBe('lazy')
      expect(CHATBOT_EXPERIMENT.variants.lazy_load.description).toContain('first message')
    })

    it('should define preload strategy correctly', () => {
      expect(CHATBOT_EXPERIMENT.variants.preload.strategy).toBe('eager')
      expect(CHATBOT_EXPERIMENT.variants.preload.description).toContain('page load')
    })

    it('should have comprehensive metrics defined', () => {
      const metricNames = CHATBOT_EXPERIMENT.metrics.map(m => m.name)
      expect(metricNames).toContain('ttft_ms')
      expect(metricNames).toContain('cold_start_ms')
      expect(metricNames).toContain('engagement_score')
      expect(metricNames).toContain('session_message_count')
    })

    it('should have a clear hypothesis', () => {
      expect(CHATBOT_EXPERIMENT.hypothesis).toContain('30%')
      expect(CHATBOT_EXPERIMENT.hypothesis.toLowerCase()).toContain('engagement')
    })
  })

  // ==================== SESSION MANAGEMENT ====================

  describe('Session Management', () => {
    let testUserId: string
    let testSessionId: string

    beforeEach(() => {
      testUserId = `test-user-${Date.now()}`
      testSessionId = `test-session-${Date.now()}`
    })

    it('should create a new session with variant assignment', async () => {
      const result = await createChatSession(testUserId, testSessionId)

      expect(result.sessionId).toBe(testSessionId)
      expect(['lazy_load', 'preload']).toContain(result.variantKey)
      expect(['lazy', 'eager']).toContain(result.strategy)
    })

    it('should assign lazy_load variant correctly', async () => {
      const result = await createChatSession(testUserId, testSessionId, 'lazy_load')

      expect(result.variantKey).toBe('lazy_load')
      expect(result.strategy).toBe('lazy')
    })

    it('should assign preload variant correctly', async () => {
      const result = await createChatSession(testUserId, testSessionId, 'preload')

      expect(result.variantKey).toBe('preload')
      expect(result.strategy).toBe('eager')
    })

    it('should store session in active sessions', async () => {
      await createChatSession(testUserId, testSessionId)
      const session = getChatSession(testSessionId)

      expect(session).toBeDefined()
      expect(session?.sessionId).toBe(testSessionId)
      expect(session?.userId).toBe(testUserId)
    })

    it('should track session start time', async () => {
      const beforeCreate = Date.now()
      await createChatSession(testUserId, testSessionId)
      const session = getChatSession(testSessionId)

      expect(session?.startTime).toBeDefined()
      expect(session?.startTime.getTime()).toBeGreaterThanOrEqual(beforeCreate)
    })

    it('should initialize empty message array', async () => {
      await createChatSession(testUserId, testSessionId)
      const session = getChatSession(testSessionId)

      expect(session?.messages).toEqual([])
    })
  })

  // ==================== CHAT PROCESSING ====================

  describe('Chat Processing', () => {
    let testUserId: string
    let testSessionId: string

    beforeEach(async () => {
      testUserId = `test-user-${Date.now()}`
      testSessionId = `test-session-${Date.now()}`
      await createChatSession(testUserId, testSessionId, 'preload')
    })

    it('should process chat message successfully', async () => {
      const response = await sendChatMessage({
        userId: testUserId,
        sessionId: testSessionId,
        message: 'How do I deploy?'
      })

      expect(response.message).toBeDefined()
      expect(response.message.length).toBeGreaterThan(0)
      expect(response.variantKey).toBe('preload')
      expect(response.strategy).toBe('eager')
    })

    it('should return metrics with response', async () => {
      const response = await sendChatMessage({
        userId: testUserId,
        sessionId: testSessionId,
        message: 'Test message'
      })

      expect(response.metrics).toBeDefined()
      expect(response.metrics.ttftMs).toBeGreaterThan(0)
      expect(response.metrics.totalResponseMs).toBeGreaterThan(0)
      expect(response.metrics.tokensGenerated).toBeGreaterThan(0)
      expect(response.metrics.sessionMessageCount).toBe(1)
      expect(response.metrics.engagementScore).toBeGreaterThanOrEqual(0)
      expect(response.metrics.engagementScore).toBeLessThanOrEqual(1)
    })

    it('should track cold start for lazy load variant', async () => {
      const lazySessionId = `lazy-session-${Date.now()}`
      await createChatSession(testUserId, lazySessionId, 'lazy_load')

      const response = await sendChatMessage({
        userId: testUserId,
        sessionId: lazySessionId,
        message: 'First message'
      })

      expect(response.metrics.coldStartMs).toBeDefined()
      expect(response.metrics.coldStartMs).toBeGreaterThan(0)
    })

    it('should not have cold start for preload variant', async () => {
      const response = await sendChatMessage({
        userId: testUserId,
        sessionId: testSessionId,
        message: 'First message'
      })

      // Preload variant should have coldStart = undefined or 0
      expect(response.metrics.coldStartMs === undefined || response.metrics.coldStartMs === 0).toBe(true)
    })

    it('should increment message count', async () => {
      await sendChatMessage({
        userId: testUserId,
        sessionId: testSessionId,
        message: 'Message 1'
      })

      const response2 = await sendChatMessage({
        userId: testUserId,
        sessionId: testSessionId,
        message: 'Message 2'
      })

      expect(response2.metrics.sessionMessageCount).toBe(2)
    })

    it('should store messages in session', async () => {
      await sendChatMessage({
        userId: testUserId,
        sessionId: testSessionId,
        message: 'Test message'
      })

      const session = getChatSession(testSessionId)
      expect(session?.messages.length).toBe(2) // User + assistant
      expect(session?.messages[0].role).toBe('user')
      expect(session?.messages[1].role).toBe('assistant')
    })

    it('should handle multiple messages in sequence', async () => {
      const messages = ['Message 1', 'Message 2', 'Message 3']

      for (const msg of messages) {
        await sendChatMessage({
          userId: testUserId,
          sessionId: testSessionId,
          message: msg
        })
      }

      const session = getChatSession(testSessionId)
      expect(session?.messages.length).toBe(6) // 3 user + 3 assistant
    })
  })

  // ==================== ENGAGEMENT SCORING ====================

  describe('Engagement Scoring', () => {
    it('should calculate engagement score correctly', () => {
      const score = calculateEngagementScore({
        messageCount: 5,
        sessionDuration: 180000, // 3 minutes
        avgResponseTime: 2000, // 2 seconds
        userSatisfaction: 4 // 4/5
      })

      expect(score).toBeGreaterThan(0)
      expect(score).toBeLessThanOrEqual(1)
    })

    it('should give higher score for more messages', () => {
      const lowMessages = calculateEngagementScore({
        messageCount: 1,
        sessionDuration: 60000,
        avgResponseTime: 2000
      })

      const highMessages = calculateEngagementScore({
        messageCount: 10,
        sessionDuration: 60000,
        avgResponseTime: 2000
      })

      expect(highMessages).toBeGreaterThan(lowMessages)
    })

    it('should give higher score for longer duration (up to 5 min)', () => {
      const shortDuration = calculateEngagementScore({
        messageCount: 3,
        sessionDuration: 30000, // 30 seconds
        avgResponseTime: 2000
      })

      const longDuration = calculateEngagementScore({
        messageCount: 3,
        sessionDuration: 300000, // 5 minutes
        avgResponseTime: 2000
      })

      expect(longDuration).toBeGreaterThan(shortDuration)
    })

    it('should give higher score for faster response times', () => {
      const slowResponse = calculateEngagementScore({
        messageCount: 3,
        sessionDuration: 60000,
        avgResponseTime: 8000 // 8 seconds
      })

      const fastResponse = calculateEngagementScore({
        messageCount: 3,
        sessionDuration: 60000,
        avgResponseTime: 1000 // 1 second
      })

      expect(fastResponse).toBeGreaterThan(slowResponse)
    })

    it('should handle edge case of zero messages', () => {
      const score = calculateEngagementScore({
        messageCount: 0,
        sessionDuration: 0,
        avgResponseTime: 0
      })

      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    })

    it('should incorporate user satisfaction when provided', () => {
      const withoutSatisfaction = calculateEngagementScore({
        messageCount: 3,
        sessionDuration: 60000,
        avgResponseTime: 2000
      })

      const withHighSatisfaction = calculateEngagementScore({
        messageCount: 3,
        sessionDuration: 60000,
        avgResponseTime: 2000,
        userSatisfaction: 5
      })

      const withLowSatisfaction = calculateEngagementScore({
        messageCount: 3,
        sessionDuration: 60000,
        avgResponseTime: 2000,
        userSatisfaction: 1
      })

      expect(withHighSatisfaction).toBeGreaterThan(withoutSatisfaction)
      expect(withLowSatisfaction).toBeLessThan(withoutSatisfaction)
    })
  })

  // ==================== METRICS TRACKING ====================

  describe('Metrics Tracking', () => {
    let testUserId: string
    let testSessionId: string

    beforeEach(async () => {
      testUserId = `metrics-test-${Date.now()}`
      testSessionId = `metrics-session-${Date.now()}`
    })

    it('should log TTFT metric to warehouse', async () => {
      await createChatSession(testUserId, testSessionId, 'preload')
      await sendChatMessage({
        userId: testUserId,
        sessionId: testSessionId,
        message: 'Test'
      })

      // Flush metrics
      await experimentWarehouse.flush()

      const metrics = await experimentWarehouse.getMetrics(
        CHATBOT_EXPERIMENT.experimentKey,
        'ttft_ms'
      )

      const userMetrics = metrics.filter(m => m.user_id === testUserId)
      expect(userMetrics.length).toBeGreaterThan(0)
    })

    it('should log engagement score on session end', async () => {
      await createChatSession(testUserId, testSessionId, 'preload')
      await sendChatMessage({
        userId: testUserId,
        sessionId: testSessionId,
        message: 'Test'
      })

      await endChatSession(testSessionId)
      await experimentWarehouse.flush()

      const metrics = await experimentWarehouse.getMetrics(
        CHATBOT_EXPERIMENT.experimentKey,
        'engagement_score'
      )

      const userMetrics = metrics.filter(m => m.user_id === testUserId)
      expect(userMetrics.length).toBeGreaterThan(0)
    })
  })

  // ==================== VARIANT DIFFERENCES ====================

  describe('Variant Performance Differences', () => {
    it('preload variant should have faster TTFT than lazy load', async () => {
      const lazyUserId = `lazy-${Date.now()}`
      const lazySessionId = `lazy-session-${Date.now()}`
      const preloadUserId = `preload-${Date.now()}`
      const preloadSessionId = `preload-session-${Date.now()}`

      await createChatSession(lazyUserId, lazySessionId, 'lazy_load')
      await createChatSession(preloadUserId, preloadSessionId, 'preload')

      const lazyResponse = await sendChatMessage({
        userId: lazyUserId,
        sessionId: lazySessionId,
        message: 'Test'
      })

      const preloadResponse = await sendChatMessage({
        userId: preloadUserId,
        sessionId: preloadSessionId,
        message: 'Test'
      })

      // Preload should be faster
      expect(preloadResponse.metrics.ttftMs).toBeLessThan(lazyResponse.metrics.ttftMs)
    })

    it('only lazy load should have cold start latency', async () => {
      const lazyUserId = `lazy-${Date.now()}`
      const lazySessionId = `lazy-session-${Date.now()}`
      const preloadUserId = `preload-${Date.now()}`
      const preloadSessionId = `preload-session-${Date.now()}`

      await createChatSession(lazyUserId, lazySessionId, 'lazy_load')
      await createChatSession(preloadUserId, preloadSessionId, 'preload')

      const lazyResponse = await sendChatMessage({
        userId: lazyUserId,
        sessionId: lazySessionId,
        message: 'First message'
      })

      const preloadResponse = await sendChatMessage({
        userId: preloadUserId,
        sessionId: preloadSessionId,
        message: 'First message'
      })

      expect(lazyResponse.metrics.coldStartMs).toBeGreaterThan(0)
      expect(preloadResponse.metrics.coldStartMs === undefined || preloadResponse.metrics.coldStartMs === 0).toBe(true)
    })
  })

  // ==================== EXPERIMENT SUMMARY ====================

  describe('Experiment Summary', () => {
    it('should generate experiment summary', async () => {
      const summary = await getChatbotExperimentSummary()

      expect(summary.experimentKey).toBe(CHATBOT_EXPERIMENT.experimentKey)
      expect(summary.hypothesis).toBe(CHATBOT_EXPERIMENT.hypothesis)
      expect(summary.metrics).toBeDefined()
      expect(summary.statisticalSignificance).toBeDefined()
      expect(summary.variantDistribution).toBeDefined()
    })

    it('should include all key metrics in summary', async () => {
      const summary = await getChatbotExperimentSummary()

      expect(summary.metrics.ttft).toBeDefined()
      expect(summary.metrics.coldStart).toBeDefined()
      expect(summary.metrics.messagesPerSession).toBeDefined()
      expect(summary.metrics.engagement).toBeDefined()
    })

    it('should calculate statistical significance', async () => {
      const summary = await getChatbotExperimentSummary()

      expect(summary.statisticalSignificance.messagesPerSession).toBeDefined()
      expect(summary.statisticalSignificance.engagement).toBeDefined()
      expect(typeof summary.statisticalSignificance.messagesPerSession.pValue).toBe('number')
      expect(typeof summary.statisticalSignificance.messagesPerSession.significant).toBe('boolean')
    })

    it('should check for Sample Ratio Mismatch', async () => {
      const summary = await getChatbotExperimentSummary()

      expect(summary.srmStatus).toBeDefined()
      expect(typeof summary.srmStatus.hasMismatch).toBe('boolean')
      expect(typeof summary.srmStatus.pValue).toBe('number')
    })
  })

  // ==================== TEST DATA ====================

  describe('Test Data', () => {
    it('should have pre-defined test sessions', () => {
      expect(TEST_SESSIONS.length).toBeGreaterThanOrEqual(10)
    })

    it('each test session should have messages', () => {
      for (const session of TEST_SESSIONS) {
        expect(session.messages.length).toBeGreaterThan(0)
      }
    })

    it('each test session should have expected metrics for both variants', () => {
      for (const session of TEST_SESSIONS) {
        expect(session.expectedMetrics.lazy_load).toBeDefined()
        expect(session.expectedMetrics.preload).toBeDefined()
        expect(session.expectedMetrics.lazy_load.ttft).toBeGreaterThan(0)
        expect(session.expectedMetrics.preload.ttft).toBeGreaterThan(0)
      }
    })

    it('preload metrics should show better performance than lazy load', () => {
      for (const session of TEST_SESSIONS) {
        expect(session.expectedMetrics.preload.ttft).toBeLessThan(
          session.expectedMetrics.lazy_load.ttft
        )
        expect(session.expectedMetrics.preload.coldStart).toBe(0)
        expect(session.expectedMetrics.lazy_load.coldStart).toBeGreaterThan(0)
      }
    })
  })

  // ==================== EDGE CASES ====================

  describe('Edge Cases', () => {
    it('should handle empty message gracefully', async () => {
      const sessionId = `edge-session-${Date.now()}`
      const userId = `edge-user-${Date.now()}`
      await createChatSession(userId, sessionId, 'preload')

      const response = await sendChatMessage({
        userId,
        sessionId,
        message: ''
      })

      expect(response).toBeDefined()
    })

    it('should handle very long messages', async () => {
      const sessionId = `long-session-${Date.now()}`
      const userId = `long-user-${Date.now()}`
      await createChatSession(userId, sessionId, 'preload')

      const longMessage = 'A'.repeat(10000)
      const response = await sendChatMessage({
        userId,
        sessionId,
        message: longMessage
      })

      expect(response.message).toBeDefined()
      expect(response.metrics.tokensGenerated).toBeGreaterThan(0)
    })

    it('should handle non-existent session by creating new one', async () => {
      const nonExistentSessionId = `non-existent-${Date.now()}`
      const userId = `test-user-${Date.now()}`

      const response = await sendChatMessage({
        userId,
        sessionId: nonExistentSessionId,
        message: 'Test'
      })

      expect(response).toBeDefined()
      expect(response.message).toBeDefined()
    })

    it('should handle rapid successive messages', async () => {
      const sessionId = `rapid-session-${Date.now()}`
      const userId = `rapid-user-${Date.now()}`
      await createChatSession(userId, sessionId, 'preload')

      const promises = []
      for (let i = 0; i < 5; i++) {
        promises.push(
          sendChatMessage({
            userId,
            sessionId,
            message: `Message ${i}`
          })
        )
      }

      const responses = await Promise.all(promises)
      expect(responses.length).toBe(5)
    })
  })
})
