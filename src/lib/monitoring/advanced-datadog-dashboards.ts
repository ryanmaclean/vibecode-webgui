/**
 * Advanced Datadog Dashboard Management
 * Creates and manages custom dashboards for VibeCode monitoring
 */

export interface DashboardWidget {
  id: string
  definition: any
  layout: {
    x: number
    y: number
    width: number
    height: number
  }
}

export class DatadogDashboardManager {
  private apiKey: string
  private appKey: string
  private site: string
  private baseUrl: string

  constructor() {
    this.apiKey = process.env.DATADOG_API_KEY || ''
    this.appKey = process.env.DATADOG_APP_KEY || ''
    this.site = process.env.DATADOG_SITE || 'datadoghq.com'
    this.baseUrl = `https://api.${this.site}/api/v1`
  }

  /**
   * Create AI Features Monitoring Dashboard
   */
  async createAIFeaturesDashboard(): Promise<string | null> {
    if (!this.apiKey || !this.appKey) {
      console.warn('Datadog API keys not configured')
      return null
    }

    const dashboardPayload = {
      title: 'VibeCode AI Features Monitoring',
      description: 'Comprehensive monitoring of AI features, API calls, and user interactions',
      widgets: [
        // AI Request Volume
        {
          id: 0,
          definition: {
            type: 'timeseries',
            requests: [
              {
                q: 'sum:vibecode.ai.requests{*} by {provider,model}.as_count()',
                display_type: 'bars',
                style: {
                  palette: 'dog_classic',
                  line_type: 'solid',
                  line_width: 'normal'
                }
              }
            ],
            title: 'AI Requests by Provider & Model',
            show_legend: true,
            legend_layout: 'auto',
            legend_columns: ['avg', 'min', 'max', 'value', 'sum']
          },
          layout: { x: 0, y: 0, width: 6, height: 4 }
        },
        // Response Times
        {
          id: 1,
          definition: {
            type: 'timeseries',
            requests: [
              {
                q: 'avg:vibecode.ai.response_time{*} by {provider}',
                display_type: 'line'
              }
            ],
            title: 'AI Response Times by Provider',
            yaxis: {
              label: '',
              scale: 'linear',
              min: 'auto',
              max: 'auto',
              include_zero: true
            }
          },
          layout: { x: 6, y: 0, width: 6, height: 4 }
        },
        // Token Usage
        {
          id: 2,
          definition: {
            type: 'query_value',
            requests: [
              {
                q: 'sum:vibecode.ai.tokens_used{*}.as_count()',
                aggregator: 'sum'
              }
            ],
            title: 'Total Tokens Used (24h)',
            precision: 0
          },
          layout: { x: 0, y: 4, width: 3, height: 2 }
        },
        // Success Rate
        {
          id: 3,
          definition: {
            type: 'query_value',
            requests: [
              {
                q: '(sum:vibecode.claude.cli.commands{success:true}.as_count() / sum:vibecode.claude.cli.commands{*}.as_count()) * 100',
                aggregator: 'last'
              }
            ],
            title: 'Claude CLI Success Rate (%)',
            precision: 1
          },
          layout: { x: 3, y: 4, width: 3, height: 2 }
        },
        // Active Terminal Sessions
        {
          id: 4,
          definition: {
            type: 'query_value',
            requests: [
              {
                q: 'avg:vibecode.terminal.sessions.active{*}',
                aggregator: 'last'
              }
            ],
            title: 'Active Terminal Sessions',
            precision: 0
          },
          layout: { x: 6, y: 4, width: 3, height: 2 }
        },
        // Error Rate
        {
          id: 5,
          definition: {
            type: 'query_value',
            requests: [
              {
                q: 'sum:vibecode.errors.count{*}.as_rate()',
                aggregator: 'sum'
              }
            ],
            title: 'Error Rate (per minute)',
            precision: 2
          },
          layout: { x: 9, y: 4, width: 3, height: 2 }
        },
        // Command Categories Heat Map
        {
          id: 6,
          definition: {
            type: 'heatmap',
            requests: [
              {
                q: 'avg:vibecode.terminal.commands.executed{*} by {command_type}'
              }
            ],
            title: 'Terminal Command Usage Heatmap'
          },
          layout: { x: 0, y: 6, width: 6, height: 4 }
        },
        // System Performance
        {
          id: 7,
          definition: {
            type: 'timeseries',
            requests: [
              {
                q: 'avg:vibecode.system.memory.used{*}',
                display_type: 'line'
              },
              {
                q: 'avg:vibecode.system.cpu.user{*}',
                display_type: 'line'
              }
            ],
            title: 'System Resource Usage',
            yaxis: {
              label: 'MB / %',
              scale: 'linear'
            }
          },
          layout: { x: 6, y: 6, width: 6, height: 4 }
        }
      ],
      template_variables: [
        {
          name: 'env',
          prefix: 'env',
          default: 'production'
        },
        {
          name: 'service',
          prefix: 'service',
          default: 'vibecode-enhanced'
        }
      ],
      layout_type: 'ordered',
      is_read_only: false,
      notify_list: [],
      reflow_type: 'fixed'
    }

    try {
      const response = await fetch(`${this.baseUrl}/dashboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.apiKey,
          'DD-APPLICATION-KEY': this.appKey
        },
        body: JSON.stringify(dashboardPayload)
      })

      if (!response.ok) {
        throw new Error(`Failed to create dashboard: ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ AI Features Dashboard created:', result.url)
      return result.id

    } catch (error) {
      console.error('Failed to create AI features dashboard:', error)
      return null
    }
  }

  /**
   * Create User Experience Dashboard
   */
  async createUserExperienceDashboard(): Promise<string | null> {
    const dashboardPayload = {
      title: 'VibeCode User Experience Dashboard',
      description: 'User interactions, page performance, and engagement metrics',
      widgets: [
        // Page Load Times
        {
          id: 0,
          definition: {
            type: 'timeseries',
            requests: [
              {
                q: 'avg:vibecode.page.load_time{*} by {page}',
                display_type: 'line'
              }
            ],
            title: 'Page Load Times by Route'
          },
          layout: { x: 0, y: 0, width: 6, height: 4 }
        },
        // User Actions
        {
          id: 1,
          definition: {
            type: 'toplist',
            requests: [
              {
                q: 'top(sum:vibecode.user.actions{*} by {action}.as_count(), 10, "sum", "desc")'
              }
            ],
            title: 'Top User Actions (24h)'
          },
          layout: { x: 6, y: 0, width: 6, height: 4 }
        },
        // Session Duration
        {
          id: 2,
          definition: {
            type: 'query_value',
            requests: [
              {
                q: 'avg:vibecode.terminal.session.duration{*}',
                aggregator: 'avg'
              }
            ],
            title: 'Avg Session Duration (minutes)',
            precision: 1,
            custom_unit: 'min'
          },
          layout: { x: 0, y: 4, width: 4, height: 2 }
        },
        // AI Usage per Session
        {
          id: 3,
          definition: {
            type: 'query_value',
            requests: [
              {
                q: 'avg:vibecode.terminal.session.ai_usage{*}',
                aggregator: 'avg'
              }
            ],
            title: 'Avg AI Interactions per Session',
            precision: 1
          },
          layout: { x: 4, y: 4, width: 4, height: 2 }
        },
        // Session End Reasons
        {
          id: 4,
          definition: {
            type: 'distribution',
            requests: [
              {
                q: 'avg:vibecode.terminal.sessions.ended{*} by {end_reason}'
              }
            ],
            title: 'Session End Reasons'
          },
          layout: { x: 8, y: 4, width: 4, height: 2 }
        }
      ],
      layout_type: 'ordered'
    }

    try {
      const response = await fetch(`${this.baseUrl}/dashboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.apiKey,
          'DD-APPLICATION-KEY': this.appKey
        },
        body: JSON.stringify(dashboardPayload)
      })

      if (!response.ok) {
        throw new Error(`Failed to create UX dashboard: ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ User Experience Dashboard created:', result.url)
      return result.id

    } catch (error) {
      console.error('Failed to create user experience dashboard:', error)
      return null
    }
  }

  /**
   * Create Infrastructure Health Dashboard
   */
  async createInfrastructureDashboard(): Promise<string | null> {
    const dashboardPayload = {
      title: 'VibeCode Infrastructure Health',
      description: 'System health, database performance, and service monitoring',
      widgets: [
        // Service Health Status
        {
          id: 0,
          definition: {
            type: 'check_status',
            title: 'Service Health Checks',
            check: 'vibecode.health.check',
            grouping: 'cluster',
            group_by: ['service'],
            tags: ['*']
          },
          layout: { x: 0, y: 0, width: 4, height: 2 }
        },
        // Database Performance
        {
          id: 1,
          definition: {
            type: 'timeseries',
            requests: [
              {
                q: 'avg:postgresql.connections.active{*}',
                display_type: 'line'
              },
              {
                q: 'avg:postgresql.bgwriter.buffers_checkpoint{*}',
                display_type: 'line'
              }
            ],
            title: 'Database Performance'
          },
          layout: { x: 4, y: 0, width: 8, height: 4 }
        },
        // Memory Usage
        {
          id: 2,
          definition: {
            type: 'timeseries',
            requests: [
              {
                q: 'avg:vibecode.system.memory.used{*}',
                display_type: 'area'
              },
              {
                q: 'avg:vibecode.system.memory.total{*}',
                display_type: 'line'
              }
            ],
            title: 'Memory Usage'
          },
          layout: { x: 0, y: 4, width: 6, height: 4 }
        },
        // Redis Performance
        {
          id: 3,
          definition: {
            type: 'timeseries',
            requests: [
              {
                q: 'avg:redis.info.clients_connected{*}',
                display_type: 'line'
              },
              {
                q: 'avg:redis.net.commands_processed{*}.as_rate()',
                display_type: 'line'
              }
            ],
            title: 'Redis Performance'
          },
          layout: { x: 6, y: 4, width: 6, height: 4 }
        }
      ],
      layout_type: 'ordered'
    }

    try {
      const response = await fetch(`${this.baseUrl}/dashboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.apiKey,
          'DD-APPLICATION-KEY': this.appKey
        },
        body: JSON.stringify(dashboardPayload)
      })

      if (!response.ok) {
        throw new Error(`Failed to create infrastructure dashboard: ${response.status}`)
      }

      const result = await response.json()
      console.log('✅ Infrastructure Health Dashboard created:', result.url)
      return result.id

    } catch (error) {
      console.error('Failed to create infrastructure dashboard:', error)
      return null
    }
  }

  /**
   * Setup all dashboards
   */
  async setupAllDashboards(): Promise<{
    aiFeatures?: string
    userExperience?: string
    infrastructure?: string
  }> {
    console.log('🚀 Setting up Datadog dashboards...')
    
    const results = await Promise.allSettled([
      this.createAIFeaturesDashboard(),
      this.createUserExperienceDashboard(),
      this.createInfrastructureDashboard()
    ])

    const dashboardIds: any = {}
    
    if (results[0].status === 'fulfilled' && results[0].value) {
      dashboardIds.aiFeatures = results[0].value
    }
    
    if (results[1].status === 'fulfilled' && results[1].value) {
      dashboardIds.userExperience = results[1].value
    }
    
    if (results[2].status === 'fulfilled' && results[2].value) {
      dashboardIds.infrastructure = results[2].value
    }

    console.log('✅ Dashboard setup complete:', dashboardIds)
    return dashboardIds
  }

  /**
   * Check if dashboards exist
   */
  async listDashboards(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/dashboard`, {
        method: 'GET',
        headers: {
          'DD-API-KEY': this.apiKey,
          'DD-APPLICATION-KEY': this.appKey
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to list dashboards: ${response.status}`)
      }

      const result = await response.json()
      return result.dashboards?.filter((d: any) => 
        d.title?.includes('VibeCode')
      ) || []

    } catch (error) {
      console.error('Failed to list dashboards:', error)
      return []
    }
  }
}

// Export singleton
export const dashboardManager = new DatadogDashboardManager()