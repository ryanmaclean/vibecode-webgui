/**
 * Comprehensive Monitoring Dashboard Configuration for VibeCode WebGUI
 * Production-ready monitoring dashboard for operations teams
 */

import { getDatadogApiKey, getDatadogAppKey, getDatadogSite } from './datadog-env'

export interface DashboardWidget {
  id: string
  title: string
  type: 'timeseries' | 'query_value' | 'toplist' | 'heatmap' | 'distribution' | 'log_stream'
  definition: {
    requests: Array<{
      q: string
      display_type?: string
      style?: {
        palette: string
        line_type: string
        line_width: string
      }
    }>
    title?: string
    show_legend?: boolean
    legend_size?: string
    time?: {
      live_span: string
    }
    yaxis?: {
      min: string
      max: string
      scale: string
    }
  }
  layout: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface MonitoringDashboard {
  title: string
  description: string
  widgets: DashboardWidget[]
  template_variables: Array<{
    name: string
    prefix: string
    default: string
  }>
  layout_type: 'ordered' | 'free'
  is_read_only: boolean
  notify_list: string[]
}

class MonitoringDashboardService {
  private apiKey: string
  private appKey: string
  private baseUrl: string

  constructor() {
    this.apiKey = getDatadogApiKey() || ''
    this.appKey = getDatadogAppKey() || ''
    const site = getDatadogSite()
    this.baseUrl = `https://api.${site}/api/v1`
  }

  /**
   * Create the main VibeCode operational dashboard
   */
  createOperationalDashboard(): MonitoringDashboard {
    return {
      title: 'VibeCode WebGUI - Operational Dashboard',
      description: 'Comprehensive monitoring dashboard for VibeCode WebGUI platform operations',
      layout_type: 'ordered',
      is_read_only: false,
      notify_list: [],
      template_variables: [
        {
          name: 'env',
          prefix: 'env',
          default: 'production'
        },
        {
          name: 'service',
          prefix: 'service',
          default: 'vibecode-webgui'
        }
      ],
      widgets: [
        // System Health Overview
        {
          id: 'system-health',
          title: 'System Health Overview',
          type: 'query_value',
          definition: {
            requests: [{
              q: 'avg:vibecode.system.health{$env,$service}',
              display_type: 'line'
            }],
            title: 'Overall System Health',
            time: { live_span: '1h' }
          },
          layout: { x: 0, y: 0, width: 3, height: 2 }
        },

        // API Response Times
        {
          id: 'api-response-times',
          title: 'API Response Times (P95)',
          type: 'timeseries',
          definition: {
            requests: [
              {
                q: 'avg:vibecode.api.response_time{$env,$service} by {endpoint}',
                display_type: 'line',
                style: {
                  palette: 'dog_classic',
                  line_type: 'solid',
                  line_width: 'normal'
                }
              }
            ],
            title: 'API Response Times by Endpoint',
            show_legend: true,
            legend_size: 'auto',
            time: { live_span: '4h' },
            yaxis: {
              min: '0',
              max: 'auto',
              scale: 'linear'
            }
          },
          layout: { x: 3, y: 0, width: 6, height: 4 }
        },

        // Error Rates
        {
          id: 'error-rates',
          title: 'Error Rates',
          type: 'timeseries',
          definition: {
            requests: [
              {
                q: 'sum:vibecode.api.errors{$env,$service}.as_rate() by {endpoint}',
                display_type: 'line',
                style: {
                  palette: 'warm',
                  line_type: 'solid',
                  line_width: 'normal'
                }
              }
            ],
            title: 'Error Rate by Endpoint (per minute)',
            show_legend: true,
            time: { live_span: '4h' }
          },
          layout: { x: 9, y: 0, width: 3, height: 4 }
        },

        // AI Performance Metrics
        {
          id: 'ai-performance',
          title: 'AI Performance',
          type: 'timeseries',
          definition: {
            requests: [
              {
                q: 'avg:vibecode.ai.response_time{$env,$service} by {model}',
                display_type: 'line',
                style: {
                  palette: 'cool',
                  line_type: 'solid',
                  line_width: 'normal'
                }
              }
            ],
            title: 'AI Response Times by Model',
            show_legend: true,
            time: { live_span: '4h' }
          },
          layout: { x: 0, y: 4, width: 6, height: 4 }
        },

        // Database Performance
        {
          id: 'database-performance',
          title: 'Database Performance',
          type: 'timeseries',
          definition: {
            requests: [
              {
                q: 'avg:vibecode.database.query_time{$env,$service} by {operation}',
                display_type: 'line',
                style: {
                  palette: 'purple',
                  line_type: 'solid',
                  line_width: 'normal'
                }
              }
            ],
            title: 'Database Query Times by Operation',
            show_legend: true,
            time: { live_span: '4h' }
          },
          layout: { x: 6, y: 4, width: 6, height: 4 }
        },

        // Memory Usage
        {
          id: 'memory-usage',
          title: 'Memory Usage',
          type: 'timeseries',
          definition: {
            requests: [
              {
                q: 'avg:vibecode.system.memory.usage_percent{$env,$service}',
                display_type: 'area',
                style: {
                  palette: 'orange',
                  line_type: 'solid',
                  line_width: 'normal'
                }
              }
            ],
            title: 'Memory Usage Percentage',
            time: { live_span: '4h' },
            yaxis: {
              min: '0',
              max: '100',
              scale: 'linear'
            }
          },
          layout: { x: 0, y: 8, width: 4, height: 3 }
        },

        // Top Slow Endpoints
        {
          id: 'slow-endpoints',
          title: 'Slowest Endpoints',
          type: 'toplist',
          definition: {
            requests: [{
              q: 'top(avg:vibecode.api.response_time{$env,$service} by {endpoint}, 10, \'mean\', \'desc\')'
            }],
            title: 'Top 10 Slowest Endpoints (24h avg)'
          },
          layout: { x: 4, y: 8, width: 4, height: 3 }
        },

        // Active Users
        {
          id: 'active-users',
          title: 'Active Users',
          type: 'query_value',
          definition: {
            requests: [{
              q: 'sum:vibecode.user.active_sessions{$env,$service}'
            }],
            title: 'Current Active Sessions',
            time: { live_span: '1h' }
          },
          layout: { x: 8, y: 8, width: 2, height: 2 }
        },

        // Security Events
        {
          id: 'security-events',
          title: 'Security Events',
          type: 'timeseries',
          definition: {
            requests: [
              {
                q: 'sum:vibecode.security.events{$env,$service}.as_count() by {event_type}',
                display_type: 'bars',
                style: {
                  palette: 'red',
                  line_type: 'solid',
                  line_width: 'normal'
                }
              }
            ],
            title: 'Security Events Count',
            show_legend: true,
            time: { live_span: '24h' }
          },
          layout: { x: 10, y: 8, width: 2, height: 3 }
        },

        // Business Metrics
        {
          id: 'business-metrics',
          title: 'Business Metrics',
          type: 'timeseries',
          definition: {
            requests: [
              {
                q: 'sum:vibecode.user.actions{$env,$service}.as_count() by {action}',
                display_type: 'line',
                style: {
                  palette: 'green',
                  line_type: 'solid',
                  line_width: 'normal'
                }
              }
            ],
            title: 'User Actions per Hour',
            show_legend: true,
            time: { live_span: '24h' }
          },
          layout: { x: 0, y: 11, width: 6, height: 3 }
        },

        // Cache Performance
        {
          id: 'cache-performance',
          title: 'Cache Performance',
          type: 'timeseries',
          definition: {
            requests: [
              {
                q: 'avg:vibecode.cache.hit_rate{$env,$service}',
                display_type: 'line',
                style: {
                  palette: 'blue',
                  line_type: 'solid',
                  line_width: 'normal'
                }
              }
            ],
            title: 'Cache Hit Rate',
            time: { live_span: '4h' },
            yaxis: {
              min: '0',
              max: '100',
              scale: 'linear'
            }
          },
          layout: { x: 6, y: 11, width: 6, height: 3 }
        },

        // Performance Baselines
        {
          id: 'performance-baselines',
          title: 'Performance vs Baselines',
          type: 'timeseries',
          definition: {
            requests: [
              {
                q: 'avg:vibecode.baseline.api.chat.p95{$env,$service}',
                display_type: 'line',
                style: {
                  palette: 'grey',
                  line_type: 'dashed',
                  line_width: 'thin'
                }
              },
              {
                q: 'avg:vibecode.api.response_time{$env,$service,endpoint:/api/ai/chat}',
                display_type: 'line',
                style: {
                  palette: 'classic',
                  line_type: 'solid',
                  line_width: 'normal'
                }
              }
            ],
            title: 'Current vs Baseline Performance',
            show_legend: true,
            time: { live_span: '4h' }
          },
          layout: { x: 0, y: 14, width: 12, height: 4 }
        }
      ]
    }
  }

  /**
   * Create AI-specific monitoring dashboard
   */
  createAIDashboard(): MonitoringDashboard {
    return {
      title: 'VibeCode AI Services Dashboard',
      description: 'Monitoring dashboard focused on AI service performance and reliability',
      layout_type: 'ordered',
      is_read_only: false,
      notify_list: [],
      template_variables: [
        {
          name: 'env',
          prefix: 'env',
          default: 'production'
        },
        {
          name: 'model',
          prefix: 'model',
          default: '*'
        }
      ],
      widgets: [
        // AI Request Volume
        {
          id: 'ai-request-volume',
          title: 'AI Request Volume',
          type: 'timeseries',
          definition: {
            requests: [{
              q: 'sum:vibecode.ai.requests{$env} by {model}.as_count()',
              display_type: 'bars'
            }],
            title: 'AI Requests per Hour by Model',
            show_legend: true,
            time: { live_span: '24h' }
          },
          layout: { x: 0, y: 0, width: 6, height: 4 }
        },

        // AI Success/Failure Rates
        {
          id: 'ai-success-rates',
          title: 'AI Success Rates',
          type: 'timeseries',
          definition: {
            requests: [
              {
                q: 'avg:vibecode.ai.success_rate{$env} by {model}',
                display_type: 'line'
              }
            ],
            title: 'AI Success Rate by Model (%)',
            show_legend: true,
            time: { live_span: '24h' },
            yaxis: { min: '0', max: '100', scale: 'linear' }
          },
          layout: { x: 6, y: 0, width: 6, height: 4 }
        },

        // Token Usage
        {
          id: 'token-usage',
          title: 'Token Usage',
          type: 'timeseries',
          definition: {
            requests: [{
              q: 'sum:vibecode.ai.tokens_used{$env} by {model}',
              display_type: 'area'
            }],
            title: 'Token Consumption by Model',
            show_legend: true,
            time: { live_span: '24h' }
          },
          layout: { x: 0, y: 4, width: 12, height: 4 }
        }
      ]
    }
  }

  /**
   * Submit dashboard to Datadog
   */
  async createDashboard(dashboard: MonitoringDashboard): Promise<string | null> {
    if (!this.apiKey || !this.appKey) {
      console.warn('Datadog API keys not configured')
      return null
    }

    try {
      const response = await fetch(`${this.baseUrl}/dashboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.apiKey,
          'DD-APPLICATION-KEY': this.appKey
        },
        body: JSON.stringify(dashboard)
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to create dashboard: ${response.status} - ${error}`)
      }

      const result = await response.json()
      console.log(`✅ Dashboard created: ${dashboard.title}`)
      return result.id

    } catch (error) {
      console.error(`Failed to create dashboard "${dashboard.title}":`, error)
      return null
    }
  }

  /**
   * Setup all monitoring dashboards
   */
  async setupAllDashboards(): Promise<{ [key: string]: string }> {
    console.log('🔧 Setting up monitoring dashboards...')
    
    const dashboards = [
      { name: 'operational', config: this.createOperationalDashboard() },
      { name: 'ai-services', config: this.createAIDashboard() }
    ]

    const results: { [key: string]: string } = {}
    
    for (const { name, config } of dashboards) {
      const dashboardId = await this.createDashboard(config)
      if (dashboardId) {
        results[name] = dashboardId
      }
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log(`✅ Created ${Object.keys(results).length}/${dashboards.length} dashboards`)
    return results
  }

  /**
   * Generate dashboard configuration for export
   */
  exportDashboardConfigs(): string {
    const configs = {
      operational: this.createOperationalDashboard(),
      ai_services: this.createAIDashboard()
    }

    return JSON.stringify(configs, null, 2)
  }
}

// Export singleton instance
export const monitoringDashboard = new MonitoringDashboardService()

// Export types
export type { DashboardWidget, MonitoringDashboard }