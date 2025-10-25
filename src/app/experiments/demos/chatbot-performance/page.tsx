'use client'

/**
 * Chatbot Performance Experiment Demo
 *
 * Interactive demo comparing lazy load vs preload chatbot strategies.
 * Displays real-time metrics and statistical analysis.
 */

import { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'

// ==================== TYPES ====================

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  metrics?: {
    ttftMs?: number
    totalResponseMs?: number
    coldStartMs?: number
  }
}

interface SessionMetrics {
  ttftMs: number
  totalResponseMs: number
  coldStartMs?: number
  sessionMessageCount: number
  engagementScore: number
}

interface ExperimentSummary {
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
}

// ==================== MAIN COMPONENT ====================

export default function ChatbotPerformanceDemo() {
  // Session state
  const [sessionId, setSessionId] = useState<string>('')
  const [userId] = useState<string>(() => `demo-user-${Date.now()}`)
  const [variantKey, setVariantKey] = useState<'lazy_load' | 'preload' | null>(null)
  const [strategy, setStrategy] = useState<'lazy' | 'eager' | null>(null)

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentMetrics, setCurrentMetrics] = useState<SessionMetrics | null>(null)

  // Experiment summary state
  const [summary, setSummary] = useState<ExperimentSummary | null>(null)
  const [loadingSummary, setLoadingSummary] = useState(false)

  // UI state
  const [showComparison, setShowComparison] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ==================== EFFECTS ====================

  // Initialize session on mount
  useEffect(() => {
    initializeSession()
    loadExperimentSummary()
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ==================== SESSION MANAGEMENT ====================

  async function initializeSession() {
    try {
      const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      const response = await fetch('/api/experiments/demos/chatbot-performance/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sessionId: newSessionId })
      })

      const data = await response.json()
      setSessionId(data.sessionId)
      setVariantKey(data.variantKey)
      setStrategy(data.strategy)
    } catch (error) {
      console.error('Failed to initialize session:', error)
    }
  }

  async function loadExperimentSummary() {
    setLoadingSummary(true)
    try {
      const response = await fetch('/api/experiments/demos/chatbot-performance/summary')
      const data = await response.json()
      setSummary(data)
    } catch (error) {
      console.error('Failed to load summary:', error)
    } finally {
      setLoadingSummary(false)
    }
  }

  // ==================== CHAT FUNCTIONS ====================

  async function sendMessage() {
    if (!inputMessage.trim() || !sessionId || isLoading) return

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/experiments/demos/chatbot-performance/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          sessionId,
          message: inputMessage,
          variant: variantKey
        })
      })

      const data = await response.json()

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        metrics: {
          ttftMs: data.metrics.ttftMs,
          totalResponseMs: data.metrics.totalResponseMs,
          coldStartMs: data.metrics.coldStartMs
        }
      }

      setMessages(prev => [...prev, assistantMessage])
      setCurrentMetrics(data.metrics)

      // Reload summary to get updated stats
      loadExperimentSummary()
    } catch (error) {
      console.error('Failed to send message:', error)
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  async function resetSession() {
    setMessages([])
    setCurrentMetrics(null)
    await initializeSession()
  }

  // ==================== RENDER HELPERS ====================

  function formatMetric(value: number, decimals: number = 0): string {
    return value.toFixed(decimals)
  }

  function formatPValue(pValue: number): string {
    if (pValue < 0.001) return 'p < 0.001'
    return `p = ${pValue.toFixed(3)}`
  }

  function getVariantDisplayName(): string {
    if (!variantKey) return 'Loading...'
    return variantKey === 'preload' ? 'Preloaded (Instant Response)' : 'Lazy Load (Fast Startup)'
  }

  function getStatusIcon(): string {
    if (!summary) return '⏳'
    return summary.status === 'running' ? '🟢' : '🔴'
  }

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
            Chatbot Performance Optimization Experiment
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Hypothesis: Preloaded chatbot increases engagement by 30% despite slower initial load
          </p>
          {summary && (
            <div className="flex items-center justify-center gap-4 text-sm text-slate-600 dark:text-slate-400">
              <span>Status: {getStatusIcon()} {summary.status}</span>
              <span>|</span>
              <span>{summary.totalSessions} sessions</span>
              {summary.statisticalSignificance.messagesPerSession.significant && (
                <>
                  <span>|</span>
                  <span className="text-green-600 font-semibold">
                    {formatPValue(summary.statisticalSignificance.messagesPerSession.pValue)} ✓
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Your Variant Badge */}
        <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-400">Your Variant:</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {getVariantDisplayName()}
              </p>
            </div>
            {strategy && (
              <Badge variant={strategy === 'eager' ? 'default' : 'secondary'} className="text-lg px-4 py-2">
                {strategy === 'eager' ? 'Instant Response' : 'Fast Startup'}
              </Badge>
            )}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat Interface */}
          <Card className="lg:col-span-2 p-6 flex flex-col h-[600px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                💬 Chat Interface
              </h2>
              <Button onClick={resetSession} variant="outline" size="sm">
                Reset Session
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
              {messages.length === 0 && (
                <div className="text-center text-slate-500 dark:text-slate-400 mt-8">
                  <p className="text-lg">Start a conversation to see the performance difference!</p>
                  <p className="text-sm mt-2">Try asking: "How do I deploy to production?"</p>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                    {msg.metrics && (
                      <div className="mt-2 pt-2 border-t border-slate-300 dark:border-slate-600 text-xs opacity-70">
                        <span>
                          {msg.metrics.coldStartMs !== undefined && msg.metrics.coldStartMs > 0 && (
                            <span className="text-orange-400 font-semibold">
                              Cold Start: {formatMetric(msg.metrics.coldStartMs)}ms |{' '}
                            </span>
                          )}
                          TTFT: {formatMetric(msg.metrics.ttftMs || 0)}ms |{' '}
                          Total: {formatMetric(msg.metrics.totalResponseMs || 0)}ms
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <Input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type your message..."
                disabled={isLoading || !sessionId}
                className="flex-1"
              />
              <Button
                onClick={sendMessage}
                disabled={isLoading || !inputMessage.trim() || !sessionId}
              >
                {isLoading ? 'Sending...' : 'Send'}
              </Button>
            </div>
          </Card>

          {/* Performance Metrics */}
          <div className="space-y-6">
            {/* Current Session Metrics */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Performance Metrics
              </h3>
              {currentMetrics ? (
                <div className="space-y-3">
                  <MetricRow
                    label="TTFT"
                    value={`${formatMetric(currentMetrics.ttftMs)}ms`}
                    description="Time to First Token"
                  />
                  <MetricRow
                    label="Total"
                    value={`${formatMetric(currentMetrics.totalResponseMs)}ms`}
                    description="Total response time"
                  />
                  {currentMetrics.coldStartMs !== undefined && currentMetrics.coldStartMs > 0 && (
                    <MetricRow
                      label="Cold Start"
                      value={`${formatMetric(currentMetrics.coldStartMs)}ms`}
                      description="Initialization time"
                      highlight="orange"
                    />
                  )}
                  <MetricRow
                    label="Messages"
                    value={currentMetrics.sessionMessageCount.toString()}
                    description="Messages in session"
                  />
                  <MetricRow
                    label="Engagement"
                    value={formatMetric(currentMetrics.engagementScore * 100, 1) + '%'}
                    description="Engagement score"
                    highlight={currentMetrics.engagementScore > 0.7 ? 'green' : undefined}
                  />
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Send a message to see metrics
                </p>
              )}
            </Card>

            {/* Toggle Comparison */}
            <Button
              onClick={() => setShowComparison(!showComparison)}
              variant="outline"
              className="w-full"
            >
              {showComparison ? 'Hide' : 'Show'} Comparison
            </Button>
          </div>
        </div>

        {/* Comparison Results */}
        {showComparison && summary && (
          <Card className="p-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
              Experiment Results Comparison
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* TTFT Comparison */}
              <ComparisonCard
                title="Time to First Token"
                lazyValue={formatMetric(summary.metrics.ttft.lazy_load)}
                preloadValue={formatMetric(summary.metrics.ttft.preload)}
                unit="ms"
                improvement={summary.metrics.ttft.improvement}
                pValue={summary.metrics.ttft.pValue}
                lowerIsBetter
              />

              {/* Cold Start */}
              <ComparisonCard
                title="Cold Start Latency"
                lazyValue={formatMetric(summary.metrics.coldStart.lazy_load)}
                preloadValue={formatMetric(summary.metrics.coldStart.preload)}
                unit="ms"
                improvement={100}
                lowerIsBetter
                description="Preload eliminates cold start"
              />

              {/* Messages per Session */}
              <ComparisonCard
                title="Messages / Session"
                lazyValue={formatMetric(summary.metrics.messagesPerSession.lazy_load, 1)}
                preloadValue={formatMetric(summary.metrics.messagesPerSession.preload, 1)}
                unit=""
                improvement={summary.metrics.messagesPerSession.improvement}
                pValue={summary.metrics.messagesPerSession.pValue}
                significant={summary.statisticalSignificance.messagesPerSession.significant}
              />

              {/* Engagement Score */}
              <ComparisonCard
                title="Engagement Score"
                lazyValue={formatMetric(summary.metrics.engagement.lazy_load * 100, 1)}
                preloadValue={formatMetric(summary.metrics.engagement.preload * 100, 1)}
                unit="%"
                improvement={summary.metrics.engagement.improvement}
                pValue={summary.metrics.engagement.pValue}
                significant={summary.statisticalSignificance.engagement.significant}
              />
            </div>

            {/* Decision */}
            {summary.statisticalSignificance.messagesPerSession.significant && (
              <Alert className="mt-6 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <AlertDescription className="text-green-900 dark:text-green-100">
                  <strong>Decision: Roll out Preloaded variant</strong>
                  <br />
                  Engagement improvement (+{formatMetric(summary.metrics.messagesPerSession.improvement, 1)}%) is statistically significant (
                  {formatPValue(summary.statisticalSignificance.messagesPerSession.pValue)}).
                  The performance benefits outweigh the minimal initialization overhead.
                </AlertDescription>
              </Alert>
            )}
          </Card>
        )}
      </div>
    </div>
  )
}

// ==================== HELPER COMPONENTS ====================

function MetricRow({
  label,
  value,
  description,
  highlight
}: {
  label: string
  value: string
  description: string
  highlight?: 'green' | 'orange'
}) {
  return (
    <div className="flex justify-between items-center">
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <p
        className={`text-lg font-bold ${
          highlight === 'green'
            ? 'text-green-600'
            : highlight === 'orange'
            ? 'text-orange-600'
            : 'text-slate-900 dark:text-white'
        }`}
      >
        {value}
      </p>
    </div>
  )
}

function ComparisonCard({
  title,
  lazyValue,
  preloadValue,
  unit,
  improvement,
  pValue,
  significant,
  lowerIsBetter = false,
  description
}: {
  title: string
  lazyValue: string
  preloadValue: string
  unit: string
  improvement: number
  pValue?: number
  significant?: boolean
  lowerIsBetter?: boolean
  description?: string
}) {
  const isPositive = lowerIsBetter ? improvement < 0 : improvement > 0

  return (
    <Card className="p-4 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-900">
      <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">{title}</h4>

      <div className="space-y-2 mb-3">
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500">Lazy Load:</span>
          <span className="text-lg font-bold text-slate-900 dark:text-white">
            {lazyValue}{unit}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-slate-500">Preload:</span>
          <span className="text-lg font-bold text-blue-600">
            {preloadValue}{unit}
          </span>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <span className={`text-sm font-semibold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
            {isPositive ? '↑' : '↓'} {Math.abs(improvement).toFixed(1)}%
          </span>
          {pValue !== undefined && (
            <Badge variant={significant ? 'default' : 'secondary'} className="text-xs">
              {pValue < 0.001 ? 'p<0.001' : `p=${pValue.toFixed(3)}`}
              {significant && ' ✓'}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{description}</p>
        )}
      </div>
    </Card>
  )
}
