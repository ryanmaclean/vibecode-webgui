/**
 * Mock Experiment Data for Development
 *
 * Provides realistic experiment data for testing the dashboard UI.
 * Includes various statuses, metric types, and statistical outcomes.
 */

export interface MockExperiment {
  id: string
  key: string
  name: string
  hypothesis: string
  status: 'draft' | 'running' | 'completed' | 'paused' | 'archived'
  created_at: string
  updated_at: string
  started_at?: string
  ended_at?: string
  config: {
    variants: Array<{
      key: string
      name: string
      weight: number
    }>
    metrics: {
      primary: string[]
      secondary: string[]
      guardrails: Array<{
        metricName: string
        operator: 'gt' | 'lt' | 'gte' | 'lte'
        threshold: number
      }>
    }
    targeting?: {
      segments?: string[]
      trafficPercentage?: number
    }
  }
  results?: {
    totalUsers: number
    variantDistribution: Record<string, number>
    metrics: Record<string, {
      control: {
        count: number
        mean: number
        stdDev: number
        conversionRate?: number
      }
      treatment: {
        count: number
        mean: number
        stdDev: number
        conversionRate?: number
      }
      statistics: {
        pValue: number
        significant: boolean
        lift: number
        confidenceInterval: [number, number]
      }
    }>
    srmCheck?: {
      hasMismatch: boolean
      pValue: number
      severity: 'none' | 'low' | 'medium' | 'high' | 'critical'
    }
  }
}

export const mockExperiments: MockExperiment[] = [
  {
    id: '1',
    key: 'gpt4-vs-gpt41-transcription',
    name: 'GPT-4 vs GPT-4.1 Speech Transcription',
    hypothesis: 'GPT-4.1 will provide 20% faster transcription with equal or better accuracy',
    status: 'running',
    created_at: '2025-10-15T10:00:00Z',
    updated_at: '2025-10-24T12:00:00Z',
    started_at: '2025-10-16T00:00:00Z',
    config: {
      variants: [
        { key: 'control', name: 'GPT-4', weight: 50 },
        { key: 'treatment', name: 'GPT-4.1', weight: 50 }
      ],
      metrics: {
        primary: ['transcription_latency', 'transcription_accuracy'],
        secondary: ['user_satisfaction', 'retry_rate'],
        guardrails: [
          { metricName: 'error_rate', operator: 'lt', threshold: 0.05 },
          { metricName: 'cost_per_minute', operator: 'lt', threshold: 0.10 }
        ]
      },
      targeting: {
        segments: ['premium_users'],
        trafficPercentage: 100
      }
    },
    results: {
      totalUsers: 1234,
      variantDistribution: {
        control: 617,
        treatment: 617
      },
      metrics: {
        transcription_latency: {
          control: {
            count: 617,
            mean: 2340,
            stdDev: 450,
          },
          treatment: {
            count: 617,
            mean: 1685,
            stdDev: 380,
          },
          statistics: {
            pValue: 0.0001,
            significant: true,
            lift: -28.0,
            confidenceInterval: [-32.5, -23.5]
          }
        },
        transcription_accuracy: {
          control: {
            count: 617,
            mean: 0.952,
            stdDev: 0.023,
            conversionRate: 95.2
          },
          treatment: {
            count: 617,
            mean: 0.958,
            stdDev: 0.021,
            conversionRate: 95.8
          },
          statistics: {
            pValue: 0.0312,
            significant: true,
            lift: 0.6,
            confidenceInterval: [0.05, 1.15]
          }
        }
      },
      srmCheck: {
        hasMismatch: false,
        pValue: 0.892,
        severity: 'none'
      }
    }
  },
  {
    id: '2',
    key: 'chatbot-performance-optimization',
    name: 'Chatbot Response Time Optimization',
    hypothesis: 'Optimized caching will reduce response time by 40% without affecting quality',
    status: 'draft',
    created_at: '2025-10-22T14:30:00Z',
    updated_at: '2025-10-22T14:30:00Z',
    config: {
      variants: [
        { key: 'control', name: 'Standard', weight: 50 },
        { key: 'treatment', name: 'Optimized Cache', weight: 50 }
      ],
      metrics: {
        primary: ['response_time', 'user_satisfaction'],
        secondary: ['cache_hit_rate', 'cache_miss_latency'],
        guardrails: [
          { metricName: 'error_rate', operator: 'lt', threshold: 0.02 }
        ]
      }
    }
  },
  {
    id: '3',
    key: 'code-completion-context-window',
    name: 'Expanded Context Window for Code Completion',
    hypothesis: 'Larger context window (8K vs 4K tokens) will improve completion acceptance rate',
    status: 'running',
    created_at: '2025-10-10T09:00:00Z',
    updated_at: '2025-10-24T12:00:00Z',
    started_at: '2025-10-11T00:00:00Z',
    config: {
      variants: [
        { key: 'control', name: '4K Context', weight: 50 },
        { key: 'treatment', name: '8K Context', weight: 50 }
      ],
      metrics: {
        primary: ['acceptance_rate', 'completion_quality'],
        secondary: ['latency', 'token_usage'],
        guardrails: [
          { metricName: 'latency_p95', operator: 'lt', threshold: 1000 },
          { metricName: 'cost_per_completion', operator: 'lt', threshold: 0.005 }
        ]
      },
      targeting: {
        segments: ['active_developers'],
        trafficPercentage: 80
      }
    },
    results: {
      totalUsers: 5678,
      variantDistribution: {
        control: 2834,
        treatment: 2844
      },
      metrics: {
        acceptance_rate: {
          control: {
            count: 2834,
            mean: 0.342,
            stdDev: 0.089,
            conversionRate: 34.2
          },
          treatment: {
            count: 2844,
            mean: 0.389,
            stdDev: 0.092,
            conversionRate: 38.9
          },
          statistics: {
            pValue: 0.0008,
            significant: true,
            lift: 13.7,
            confidenceInterval: [9.2, 18.2]
          }
        },
        latency: {
          control: {
            count: 2834,
            mean: 450,
            stdDev: 125
          },
          treatment: {
            count: 2844,
            mean: 580,
            stdDev: 145
          },
          statistics: {
            pValue: 0.0001,
            significant: true,
            lift: 28.9,
            confidenceInterval: [24.5, 33.3]
          }
        }
      },
      srmCheck: {
        hasMismatch: false,
        pValue: 0.756,
        severity: 'none'
      }
    }
  },
  {
    id: '4',
    key: 'ai-model-provider-comparison',
    name: 'OpenAI vs Anthropic for Code Analysis',
    hypothesis: 'Anthropic Claude will provide better code analysis accuracy than GPT-4',
    status: 'completed',
    created_at: '2025-09-01T10:00:00Z',
    updated_at: '2025-10-01T00:00:00Z',
    started_at: '2025-09-05T00:00:00Z',
    ended_at: '2025-10-01T00:00:00Z',
    config: {
      variants: [
        { key: 'control', name: 'GPT-4', weight: 50 },
        { key: 'treatment', name: 'Claude Sonnet', weight: 50 }
      ],
      metrics: {
        primary: ['analysis_accuracy', 'user_rating'],
        secondary: ['response_time', 'code_quality_score'],
        guardrails: [
          { metricName: 'error_rate', operator: 'lt', threshold: 0.03 }
        ]
      }
    },
    results: {
      totalUsers: 8942,
      variantDistribution: {
        control: 4471,
        treatment: 4471
      },
      metrics: {
        analysis_accuracy: {
          control: {
            count: 4471,
            mean: 0.854,
            stdDev: 0.067,
            conversionRate: 85.4
          },
          treatment: {
            count: 4471,
            mean: 0.912,
            stdDev: 0.053,
            conversionRate: 91.2
          },
          statistics: {
            pValue: 0.0001,
            significant: true,
            lift: 6.8,
            confidenceInterval: [5.8, 7.8]
          }
        },
        user_rating: {
          control: {
            count: 4471,
            mean: 4.23,
            stdDev: 0.89
          },
          treatment: {
            count: 4471,
            mean: 4.67,
            stdDev: 0.72
          },
          statistics: {
            pValue: 0.0001,
            significant: true,
            lift: 10.4,
            confidenceInterval: [8.9, 11.9]
          }
        }
      },
      srmCheck: {
        hasMismatch: false,
        pValue: 1.000,
        severity: 'none'
      }
    }
  },
  {
    id: '5',
    key: 'onboarding-flow-redesign',
    name: 'Streamlined Onboarding Flow',
    hypothesis: 'Simplified 3-step onboarding will increase completion rate by 25%',
    status: 'running',
    created_at: '2025-10-18T08:00:00Z',
    updated_at: '2025-10-24T12:00:00Z',
    started_at: '2025-10-20T00:00:00Z',
    config: {
      variants: [
        { key: 'control', name: 'Original (5 steps)', weight: 50 },
        { key: 'treatment', name: 'Simplified (3 steps)', weight: 50 }
      ],
      metrics: {
        primary: ['onboarding_completion_rate', 'time_to_complete'],
        secondary: ['first_project_creation', 'activation_rate'],
        guardrails: [
          { metricName: 'bounce_rate', operator: 'lt', threshold: 0.30 }
        ]
      },
      targeting: {
        segments: ['new_users'],
        trafficPercentage: 100
      }
    },
    results: {
      totalUsers: 892,
      variantDistribution: {
        control: 448,
        treatment: 444
      },
      metrics: {
        onboarding_completion_rate: {
          control: {
            count: 448,
            mean: 0.623,
            stdDev: 0.112,
            conversionRate: 62.3
          },
          treatment: {
            count: 444,
            mean: 0.781,
            stdDev: 0.098,
            conversionRate: 78.1
          },
          statistics: {
            pValue: 0.0001,
            significant: true,
            lift: 25.4,
            confidenceInterval: [20.1, 30.7]
          }
        },
        time_to_complete: {
          control: {
            count: 448,
            mean: 485,
            stdDev: 134
          },
          treatment: {
            count: 444,
            mean: 312,
            stdDev: 89
          },
          statistics: {
            pValue: 0.0001,
            significant: true,
            lift: -35.7,
            confidenceInterval: [-40.2, -31.2]
          }
        }
      },
      srmCheck: {
        hasMismatch: false,
        pValue: 0.823,
        severity: 'none'
      }
    }
  },
  {
    id: '6',
    key: 'pricing-page-cta',
    name: 'Pricing Page CTA Button Color',
    hypothesis: 'Green CTA button will increase trial signups vs blue',
    status: 'paused',
    created_at: '2025-10-05T12:00:00Z',
    updated_at: '2025-10-12T15:30:00Z',
    started_at: '2025-10-08T00:00:00Z',
    config: {
      variants: [
        { key: 'control', name: 'Blue Button', weight: 50 },
        { key: 'treatment', name: 'Green Button', weight: 50 }
      ],
      metrics: {
        primary: ['trial_signup_rate'],
        secondary: ['button_clicks', 'time_on_page'],
        guardrails: []
      }
    },
    results: {
      totalUsers: 2145,
      variantDistribution: {
        control: 1098,
        treatment: 1047
      },
      metrics: {
        trial_signup_rate: {
          control: {
            count: 1098,
            mean: 0.087,
            stdDev: 0.034,
            conversionRate: 8.7
          },
          treatment: {
            count: 1047,
            mean: 0.089,
            stdDev: 0.036,
            conversionRate: 8.9
          },
          statistics: {
            pValue: 0.645,
            significant: false,
            lift: 2.3,
            confidenceInterval: [-7.8, 12.4]
          }
        }
      },
      srmCheck: {
        hasMismatch: true,
        pValue: 0.0234,
        severity: 'low'
      }
    }
  },
  {
    id: '7',
    key: 'notification-frequency',
    name: 'Email Notification Frequency Optimization',
    hypothesis: 'Weekly digest will have higher engagement than daily emails',
    status: 'archived',
    created_at: '2025-08-15T09:00:00Z',
    updated_at: '2025-09-30T00:00:00Z',
    started_at: '2025-08-20T00:00:00Z',
    ended_at: '2025-09-30T00:00:00Z',
    config: {
      variants: [
        { key: 'control', name: 'Daily', weight: 50 },
        { key: 'treatment', name: 'Weekly Digest', weight: 50 }
      ],
      metrics: {
        primary: ['open_rate', 'click_rate'],
        secondary: ['unsubscribe_rate', 'engagement_score'],
        guardrails: [
          { metricName: 'unsubscribe_rate', operator: 'lt', threshold: 0.05 }
        ]
      }
    },
    results: {
      totalUsers: 15234,
      variantDistribution: {
        control: 7617,
        treatment: 7617
      },
      metrics: {
        open_rate: {
          control: {
            count: 7617,
            mean: 0.234,
            stdDev: 0.089,
            conversionRate: 23.4
          },
          treatment: {
            count: 7617,
            mean: 0.412,
            stdDev: 0.112,
            conversionRate: 41.2
          },
          statistics: {
            pValue: 0.0001,
            significant: true,
            lift: 76.1,
            confidenceInterval: [68.5, 83.7]
          }
        },
        click_rate: {
          control: {
            count: 7617,
            mean: 0.045,
            stdDev: 0.023,
            conversionRate: 4.5
          },
          treatment: {
            count: 7617,
            mean: 0.089,
            stdDev: 0.034,
            conversionRate: 8.9
          },
          statistics: {
            pValue: 0.0001,
            significant: true,
            lift: 97.8,
            confidenceInterval: [85.3, 110.3]
          }
        }
      },
      srmCheck: {
        hasMismatch: false,
        pValue: 1.000,
        severity: 'none'
      }
    }
  }
]

/**
 * Get experiment by key
 */
export function getExperimentByKey(key: string): MockExperiment | undefined {
  return mockExperiments.find(exp => exp.key === key)
}

/**
 * Get experiments by status
 */
export function getExperimentsByStatus(status: MockExperiment['status']): MockExperiment[] {
  return mockExperiments.filter(exp => exp.status === status)
}

/**
 * Get time series data for a metric
 */
export function generateTimeSeriesData(experimentKey: string, metricName: string) {
  const experiment = getExperimentByKey(experimentKey)
  if (!experiment?.results) return []

  // Generate 14 days of data
  const days = 14
  const data = []
  const baseDate = new Date(experiment.started_at || Date.now())

  for (let i = 0; i < days; i++) {
    const date = new Date(baseDate)
    date.setDate(date.getDate() + i)

    data.push({
      date: date.toISOString().split('T')[0],
      control: Math.random() * 100 + 50,
      treatment: Math.random() * 100 + 60
    })
  }

  return data
}
