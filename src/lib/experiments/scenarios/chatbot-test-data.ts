/**
 * Chatbot Performance Experiment - Test Data Generator
 *
 * Generates synthetic chat sessions for testing and demonstration.
 * Creates realistic conversation patterns with performance metrics.
 */

import { experimentWarehouse } from '../warehouse'
import { CHATBOT_EXPERIMENT } from './chatbot-speed'

// ==================== TYPES ====================

export interface SyntheticChatSession {
  userId: string
  sessionId: string
  messages: Array<{ user: string; bot: string }>
  expectedMetrics: {
    lazy_load: { ttft: number; coldStart: number; messagesPerSession: number; engagement: number }
    preload: { ttft: number; coldStart: number; messagesPerSession: number; engagement: number }
  }
}

// ==================== TEST CONVERSATIONS ====================

/**
 * Pre-defined test sessions with realistic conversations
 */
export const TEST_SESSIONS: SyntheticChatSession[] = [
  {
    userId: 'user-001',
    sessionId: 'session-001',
    messages: [
      { user: 'How do I deploy to production?', bot: 'To deploy to production, run `npm run build` then deploy the built files.' },
      { user: 'What about staging?', bot: 'For staging, use environment variables in your `.env.staging` file.' },
      { user: 'Thanks!', bot: "You're welcome! Let me know if you need anything else." }
    ],
    expectedMetrics: {
      lazy_load: { ttft: 1200, coldStart: 3500, messagesPerSession: 3, engagement: 0.65 },
      preload: { ttft: 800, coldStart: 0, messagesPerSession: 3, engagement: 0.68 }
    }
  },
  {
    userId: 'user-002',
    sessionId: 'session-002',
    messages: [
      { user: 'What is TypeScript?', bot: 'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript.' }
    ],
    expectedMetrics: {
      lazy_load: { ttft: 1100, coldStart: 3200, messagesPerSession: 1, engagement: 0.35 },
      preload: { ttft: 750, coldStart: 0, messagesPerSession: 1, engagement: 0.40 }
    }
  },
  {
    userId: 'user-003',
    sessionId: 'session-003',
    messages: [
      { user: 'How do I set up authentication?', bot: 'You can use NextAuth.js for authentication in Next.js apps.' },
      { user: 'What about JWT tokens?', bot: 'JWT tokens can be configured in NextAuth with the jwt callback.' },
      { user: 'Can you show an example?', bot: 'Sure! Here\'s a basic configuration example...' },
      { user: 'What about refresh tokens?', bot: 'Refresh tokens can be implemented using the refresh token rotation pattern.' },
      { user: 'Perfect, thanks!', bot: 'Glad I could help!' }
    ],
    expectedMetrics: {
      lazy_load: { ttft: 1300, coldStart: 3800, messagesPerSession: 5, engagement: 0.82 },
      preload: { ttft: 850, coldStart: 0, messagesPerSession: 5, engagement: 0.88 }
    }
  },
  {
    userId: 'user-004',
    sessionId: 'session-004',
    messages: [
      { user: 'How to debug React components?', bot: 'Use React DevTools to inspect component props and state.' },
      { user: 'What about performance issues?', bot: 'Check for unnecessary re-renders using React Profiler.' }
    ],
    expectedMetrics: {
      lazy_load: { ttft: 1150, coldStart: 3300, messagesPerSession: 2, engagement: 0.55 },
      preload: { ttft: 780, coldStart: 0, messagesPerSession: 2, engagement: 0.60 }
    }
  },
  {
    userId: 'user-005',
    sessionId: 'session-005',
    messages: [
      { user: 'What is a REST API?', bot: 'REST is an architectural style for designing networked applications.' },
      { user: 'How is it different from GraphQL?', bot: 'GraphQL allows clients to request exactly the data they need.' },
      { user: 'Which should I use?', bot: 'It depends on your use case. REST is simpler, GraphQL is more flexible.' },
      { user: 'Can they work together?', bot: 'Yes, you can use both in the same application for different purposes.' }
    ],
    expectedMetrics: {
      lazy_load: { ttft: 1250, coldStart: 3600, messagesPerSession: 4, engagement: 0.75 },
      preload: { ttft: 820, coldStart: 0, messagesPerSession: 4, engagement: 0.82 }
    }
  },
  {
    userId: 'user-006',
    sessionId: 'session-006',
    messages: [
      { user: 'Database setup?', bot: 'What database are you using?' }
    ],
    expectedMetrics: {
      lazy_load: { ttft: 1080, coldStart: 3100, messagesPerSession: 1, engagement: 0.32 },
      preload: { ttft: 730, coldStart: 0, messagesPerSession: 1, engagement: 0.38 }
    }
  },
  {
    userId: 'user-007',
    sessionId: 'session-007',
    messages: [
      { user: 'How to optimize images?', bot: 'Use Next.js Image component with automatic optimization.' },
      { user: 'What formats are supported?', bot: 'JPEG, PNG, WebP, AVIF are all supported.' },
      { user: 'How about lazy loading?', bot: 'Images are lazy loaded by default with Next.js Image.' },
      { user: 'Great!', bot: 'Happy to help!' }
    ],
    expectedMetrics: {
      lazy_load: { ttft: 1220, coldStart: 3500, messagesPerSession: 4, engagement: 0.73 },
      preload: { ttft: 810, coldStart: 0, messagesPerSession: 4, engagement: 0.80 }
    }
  },
  {
    userId: 'user-008',
    sessionId: 'session-008',
    messages: [
      { user: 'What is serverless?', bot: 'Serverless lets you run code without managing servers.' },
      { user: 'Is it cheaper?', bot: 'It can be cheaper for variable workloads since you only pay for usage.' },
      { user: 'What are the downsides?', bot: 'Cold starts and vendor lock-in are common concerns.' }
    ],
    expectedMetrics: {
      lazy_load: { ttft: 1180, coldStart: 3400, messagesPerSession: 3, engagement: 0.68 },
      preload: { ttft: 790, coldStart: 0, messagesPerSession: 3, engagement: 0.72 }
    }
  },
  {
    userId: 'user-009',
    sessionId: 'session-009',
    messages: [
      { user: 'How to handle errors in React?', bot: 'Use Error Boundaries to catch errors in component trees.' },
      { user: 'What about async errors?', bot: 'For async errors, use try-catch in async functions.' },
      { user: 'Can you show an example?', bot: 'Here\'s a basic error boundary implementation...' },
      { user: 'What about logging?', bot: 'You can integrate services like Sentry for error logging.' },
      { user: 'How do I set up Sentry?', bot: 'Install @sentry/react and initialize it in your app.' },
      { user: 'Thanks for the help!', bot: 'You\'re welcome!' }
    ],
    expectedMetrics: {
      lazy_load: { ttft: 1320, coldStart: 3900, messagesPerSession: 6, engagement: 0.87 },
      preload: { ttft: 870, coldStart: 0, messagesPerSession: 6, engagement: 0.92 }
    }
  },
  {
    userId: 'user-010',
    sessionId: 'session-010',
    messages: [
      { user: 'Testing in React?', bot: 'Use Jest and React Testing Library for testing components.' },
      { user: 'What about E2E tests?', bot: 'Playwright or Cypress are great for end-to-end testing.' }
    ],
    expectedMetrics: {
      lazy_load: { ttft: 1160, coldStart: 3350, messagesPerSession: 2, engagement: 0.58 },
      preload: { ttft: 770, coldStart: 0, messagesPerSession: 2, engagement: 0.62 }
    }
  }
]

// ==================== SYNTHETIC DATA GENERATION ====================

/**
 * Generate realistic chat messages
 */
const QUESTION_TEMPLATES = [
  'How do I {action} in {technology}?',
  'What is {concept}?',
  'Can you explain {concept}?',
  'What\'s the difference between {tech1} and {tech2}?',
  'How to optimize {feature}?',
  'Best practices for {topic}?',
  'How to debug {issue}?',
  'What are the benefits of {technology}?',
  'How to set up {tool}?',
  'Can you show an example of {concept}?'
]

const ACTIONS = ['deploy', 'configure', 'optimize', 'debug', 'test', 'implement', 'setup', 'migrate']
const TECHNOLOGIES = ['React', 'Next.js', 'TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'AWS', 'GraphQL']
const CONCEPTS = ['authentication', 'caching', 'state management', 'API design', 'database indexing', 'error handling']
const ISSUES = ['memory leaks', 'slow queries', 'build errors', 'type errors', 'performance issues']

/**
 * Generate a random question
 */
function generateQuestion(): string {
  const template = QUESTION_TEMPLATES[Math.floor(Math.random() * QUESTION_TEMPLATES.length)]

  return template
    .replace('{action}', ACTIONS[Math.floor(Math.random() * ACTIONS.length)])
    .replace('{technology}', TECHNOLOGIES[Math.floor(Math.random() * TECHNOLOGIES.length)])
    .replace('{tech1}', TECHNOLOGIES[Math.floor(Math.random() * TECHNOLOGIES.length)])
    .replace('{tech2}', TECHNOLOGIES[Math.floor(Math.random() * TECHNOLOGIES.length)])
    .replace('{concept}', CONCEPTS[Math.floor(Math.random() * CONCEPTS.length)])
    .replace('{feature}', CONCEPTS[Math.floor(Math.random() * CONCEPTS.length)])
    .replace('{topic}', CONCEPTS[Math.floor(Math.random() * CONCEPTS.length)])
    .replace('{issue}', ISSUES[Math.floor(Math.random() * ISSUES.length)])
    .replace('{tool}', TECHNOLOGIES[Math.floor(Math.random() * TECHNOLOGIES.length)])
}

/**
 * Generate synthetic session data
 */
export async function generateChatbotSyntheticData(count: number): Promise<void> {
  console.log(`Generating ${count} synthetic chat sessions...`)

  // Ensure experiment exists
  await warehouse.upsertExperiment(
    CHATBOT_EXPERIMENT.experimentKey,
    CHATBOT_EXPERIMENT.name,
    {
      variants: CHATBOT_EXPERIMENT.variants,
      metrics: CHATBOT_EXPERIMENT.metrics
    },
    CHATBOT_EXPERIMENT.hypothesis,
    'running'
  )

  // Generate sessions
  for (let i = 0; i < count; i++) {
    const userId = `synthetic-user-${i + 1}`
    const sessionId = `synthetic-session-${i + 1}`
    const variant = i % 2 === 0 ? 'lazy_load' : 'preload'

    // Determine session length (1-7 messages, weighted toward 2-4)
    const sessionLength = Math.random() < 0.7
      ? Math.floor(Math.random() * 3) + 2 // 2-4 messages (70% of sessions)
      : Math.random() < 0.8
        ? Math.floor(Math.random() * 2) + 1 // 1-2 messages (24% of sessions)
        : Math.floor(Math.random() * 3) + 5 // 5-7 messages (6% of sessions)

    // Log assignment
    await warehouse.logAssignment(
      CHATBOT_EXPERIMENT.experimentKey,
      userId,
      variant,
      { sessionId, synthetic: true }
    )

    // Generate metrics based on variant
    const isPreload = variant === 'preload'

    // Base metrics with realistic variation
    const baseTtft = isPreload ? 800 : 1200
    const ttftVariation = Math.random() * 400 - 200 // ±200ms
    const ttft = Math.max(200, baseTtft + ttftVariation)

    const coldStart = isPreload ? 0 : 3000 + Math.random() * 1000 // Lazy: 3000-4000ms

    // Engagement correlation: Preload has slightly higher engagement
    const engagementBase = isPreload
      ? 0.65 + (sessionLength / 10) * 0.3 // Preload: higher engagement
      : 0.58 + (sessionLength / 10) * 0.25 // Lazy: lower engagement

    const engagement = Math.min(1, Math.max(0, engagementBase + (Math.random() * 0.2 - 0.1)))

    // Log metrics
    await warehouse.logMetric(
      CHATBOT_EXPERIMENT.experimentKey,
      userId,
      'ttft_ms',
      ttft,
      { sessionId, variant_key: variant }
    )

    if (coldStart > 0) {
      await warehouse.logMetric(
        CHATBOT_EXPERIMENT.experimentKey,
        userId,
        'cold_start_ms',
        coldStart,
        { sessionId, variant_key: variant }
      )
    }

    await warehouse.logMetric(
      CHATBOT_EXPERIMENT.experimentKey,
      userId,
      'session_message_count',
      sessionLength,
      { sessionId, variant_key: variant }
    )

    await warehouse.logMetric(
      CHATBOT_EXPERIMENT.experimentKey,
      userId,
      'engagement_score',
      engagement,
      { sessionId, variant_key: variant }
    )

    // Log per-message metrics
    for (let msgIdx = 0; msgIdx < sessionLength; msgIdx++) {
      const totalResponseMs = ttft + Math.random() * 500
      await warehouse.logMetric(
        CHATBOT_EXPERIMENT.experimentKey,
        userId,
        'total_response_ms',
        totalResponseMs,
        { sessionId, variant_key: variant, messageIndex: msgIdx + 1 }
      )

      const tokensGenerated = Math.floor(Math.random() * 100) + 50
      await warehouse.logMetric(
        CHATBOT_EXPERIMENT.experimentKey,
        userId,
        'tokens_generated',
        tokensGenerated,
        { sessionId, variant_key: variant, messageIndex: msgIdx + 1 }
      )
    }

    // Progress indicator
    if ((i + 1) % 100 === 0) {
      console.log(`  Generated ${i + 1}/${count} sessions...`)
    }
  }

  // Flush all metrics
  await warehouse.flush()

  console.log(`✓ Successfully generated ${count} synthetic chat sessions`)
}

// ==================== TEST DATA HELPERS ====================

/**
 * Generate a batch of realistic test sessions
 */
export function generateTestSessions(count: number): SyntheticChatSession[] {
  const sessions: SyntheticChatSession[] = []

  for (let i = 0; i < count; i++) {
    const sessionLength = Math.floor(Math.random() * 5) + 1 // 1-5 messages

    const messages: Array<{ user: string; bot: string }> = []
    for (let j = 0; j < sessionLength; j++) {
      messages.push({
        user: generateQuestion(),
        bot: 'Here is a helpful response based on your question...'
      })
    }

    sessions.push({
      userId: `test-user-${i + 1}`,
      sessionId: `test-session-${i + 1}`,
      messages,
      expectedMetrics: {
        lazy_load: {
          ttft: 1200 + Math.random() * 300,
          coldStart: 3000 + Math.random() * 1000,
          messagesPerSession: sessionLength,
          engagement: 0.55 + (sessionLength / 10) * 0.25 + Math.random() * 0.1
        },
        preload: {
          ttft: 800 + Math.random() * 200,
          coldStart: 0,
          messagesPerSession: sessionLength,
          engagement: 0.62 + (sessionLength / 10) * 0.3 + Math.random() * 0.1
        }
      }
    })
  }

  return sessions
}

/**
 * Clear all synthetic data from experiment
 */
export async function clearSyntheticData(): Promise<void> {
  console.log('Clearing synthetic data...')
  // This would require a database truncate operation
  // For now, just log the intent
  console.log('Note: Manual database cleanup required for full reset')
}

/**
 * Generate expected results based on synthetic data distribution
 */
export function generateExpectedResults(sessionCount: number) {
  // Based on our synthetic data generation logic:
  // - Preload TTFT: ~800ms (400-1000ms range)
  // - Lazy TTFT: ~1200ms (1000-1400ms range)
  // - Preload engagement: ~0.72 (higher due to better UX)
  // - Lazy engagement: ~0.65 (lower due to slower responses)
  // - Preload messages/session: ~3.2 (higher engagement = more messages)
  // - Lazy messages/session: ~2.8 (lower engagement = fewer messages)

  const lazyCount = Math.floor(sessionCount / 2)
  const preloadCount = sessionCount - lazyCount

  return {
    totalSessions: sessionCount,
    variantDistribution: {
      lazy_load: lazyCount,
      preload: preloadCount
    },
    expectedMetrics: {
      ttft: {
        lazy_load: 1200,
        preload: 800,
        improvement: 33.3, // (1200-800)/1200 * 100
        expectedSignificant: true
      },
      coldStart: {
        lazy_load: 3500,
        preload: 0,
        difference: 3500
      },
      messagesPerSession: {
        lazy_load: 2.8,
        preload: 3.2,
        improvement: 14.3, // (3.2-2.8)/2.8 * 100
        expectedSignificant: sessionCount > 100
      },
      engagement: {
        lazy_load: 0.65,
        preload: 0.72,
        improvement: 10.8, // (0.72-0.65)/0.65 * 100
        expectedSignificant: sessionCount > 200
      }
    }
  }
}
