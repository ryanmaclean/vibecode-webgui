/**
 * Datadog Alerts and Monitors Configuration
 * Defines and manages critical alerts for VibeCode platform
 */

export interface AlertConfig {
  name: string
  type: 'metric alert' | 'service check' | 'event alert' | 'log alert'
  query: string
  message: string
  tags: string[]
  options?: {
    thresholds?: {
      critical?: number
      warning?: number
      ok?: number
    }
    notify_no_data?: boolean
    no_data_timeframe?: number
    renotify_interval?: number
    evaluation_delay?: number
  }
}

export class DatadogAlertsManager {
  private apiKey: string
  private appKey: string
  private baseUrl: string

  constructor() {
    this.apiKey = process.env.DATADOG_API_KEY || ''
    this.appKey = process.env.DATADOG_APP_KEY || ''
    const site = process.env.DATADOG_SITE || 'datadoghq.com'
    this.baseUrl = `https://api.${site}/api/v1`
  }

  /**
   * Critical AI Service Alerts
   */
  private getAIServiceAlerts(): AlertConfig[] {
    return [
      {
        name: 'High AI Request Failure Rate',
        type: 'metric alert',
        query: 'avg(last_5m):( sum:vibecode.ai.requests{success:false}.as_count() / sum:vibecode.ai.requests{*}.as_count() ) * 100 > 10',
        message: `@channel **CRITICAL: High AI Request Failure Rate**
        
AI requests are failing at {{value}}% over the last 5 minutes.

**Impact**: Users experiencing AI feature failures
**Threshold**: >10% failure rate
**Action Required**: 
- Check OpenRouter API status
- Verify API keys and quotas
- Review error logs for specific failure patterns

Dashboard: /dashboard/ai-features-monitoring`,
        tags: ['service:vibecode-ai', 'alert:critical', 'team:platform'],
        options: {
          thresholds: {
            critical: 10,
            warning: 5
          },
          notify_no_data: false,
          renotify_interval: 30,
          evaluation_delay: 60
        }
      },
      {
        name: 'AI Response Time Degradation',
        type: 'metric alert',
        query: 'avg(last_10m):avg:vibecode.ai.response_time{*} > 15000',
        message: `**WARNING: AI Response Times Degraded**
        
Average AI response time is {{value}}ms over the last 10 minutes.

**Impact**: Poor user experience with AI features
**Threshold**: >15 seconds average
**Action**: Check AI provider status and network connectivity`,
        tags: ['service:vibecode-ai', 'alert:warning', 'team:platform'],
        options: {
          thresholds: {
            critical: 30000,  // 30 seconds
            warning: 15000    // 15 seconds
          },
          notify_no_data: true,
          no_data_timeframe: 20,
          renotify_interval: 60
        }
      },
      {
        name: 'Claude CLI Command Failures',
        type: 'metric alert',
        query: 'avg(last_5m):sum:vibecode.claude.cli.commands{success:false}.as_count() > 5',
        message: `**ALERT: Claude CLI Experiencing Failures**
        
{{value}} Claude CLI commands failed in the last 5 minutes.

**Impact**: Terminal AI features not working
**Check**: Authentication, API connectivity, command parsing`,
        tags: ['service:claude-cli', 'alert:warning', 'team:platform'],
        options: {
          thresholds: {
            critical: 10,
            warning: 5
          }
        }
      }
    ]
  }

  /**
   * Infrastructure Health Alerts
   */
  private getInfrastructureAlerts(): AlertConfig[] {
    return [
      {
        name: 'High Memory Usage',
        type: 'metric alert',
        query: 'avg(last_5m):avg:vibecode.system.memory.used{*} > 1500',
        message: `**WARNING: High Memory Usage**
        
Application memory usage is {{value}}MB, approaching limits.

**Impact**: Potential performance degradation
**Action**: 
- Check for memory leaks
- Scale resources if needed
- Review active sessions`,
        tags: ['service:vibecode-webgui', 'alert:warning', 'team:infrastructure'],
        options: {
          thresholds: {
            critical: 2000,  // 2GB
            warning: 1500    // 1.5GB
          }
        }
      },
      {
        name: 'Database Connection Issues',
        type: 'service check',
        query: '"postgres".over("*").last(3).count_by_status()',
        message: `**CRITICAL: Database Connection Failure**
        
PostgreSQL health checks are failing.

**Impact**: Application cannot function
**Immediate Action**: 
- Check database server status
- Verify connection strings
- Check network connectivity`,
        tags: ['service:postgresql', 'alert:critical', 'team:infrastructure'],
        options: {
          thresholds: {
            critical: 1
          },
          notify_no_data: true,
          no_data_timeframe: 10
        }
      },
      {
        name: 'Redis Connection Issues',
        type: 'service check',
        query: '"redis".over("*").last(3).count_by_status()',
        message: `**WARNING: Redis Connection Issues**
        
Redis health checks are failing - session storage may be affected.

**Impact**: User sessions and caching degraded
**Action**: Check Redis server and connectivity`,
        tags: ['service:redis', 'alert:warning', 'team:infrastructure'],
        options: {
          thresholds: {
            critical: 1
          }
        }
      }
    ]
  }

  /**
   * User Experience Alerts
   */
  private getUserExperienceAlerts(): AlertConfig[] {
    return [
      {
        name: 'High Terminal Session Failure Rate',
        type: 'metric alert',
        query: 'avg(last_10m):( sum:vibecode.terminal.sessions.ended{end_reason:error}.as_count() / sum:vibecode.terminal.sessions.ended{*}.as_count() ) * 100 > 20',
        message: `**WARNING: High Terminal Session Failure Rate**
        
{{value}}% of terminal sessions are ending with errors.

**Impact**: Users experiencing terminal instability
**Action**: Check terminal service logs and WebSocket connections`,
        tags: ['service:terminal', 'alert:warning', 'team:platform'],
        options: {
          thresholds: {
            critical: 30,
            warning: 20
          }
        }
      },
      {
        name: 'Page Load Time Degradation',
        type: 'metric alert',
        query: 'avg(last_15m):avg:vibecode.page.load_time{*} > 5000',
        message: `**WARNING: Slow Page Load Times**
        
Average page load time is {{value}}ms over the last 15 minutes.

**Impact**: Poor user experience
**Action**: Check CDN, optimize bundles, review server performance`,
        tags: ['service:frontend', 'alert:warning', 'team:frontend'],
        options: {
          thresholds: {
            critical: 10000,  // 10 seconds
            warning: 5000     // 5 seconds
          }
        }
      }
    ]
  }

  /**
   * Security and Anomaly Alerts
   */
  private getSecurityAlerts(): AlertConfig[] {
    return [
      {
        name: 'High Error Rate',
        type: 'metric alert',
        query: 'avg(last_5m):sum:vibecode.errors.count{*}.as_rate() > 1',
        message: `**ALERT: High Application Error Rate**
        
Error rate is {{value}} errors per minute.

**Impact**: Application stability concerns
**Action**: Review error logs and investigate root cause`,
        tags: ['service:vibecode-webgui', 'alert:warning', 'team:platform'],
        options: {
          thresholds: {
            critical: 5,
            warning: 1
          }
        }
      },
      {
        name: 'Unusual AI Token Usage',
        type: 'metric alert',
        query: 'avg(last_1h):sum:vibecode.ai.tokens_used{*}.as_count() > 1000000',
        message: `**WARNING: High AI Token Usage**
        
Token usage is {{value}} tokens in the last hour.

**Possible Causes**: 
- Unusual user activity
- Potential abuse
- Runaway AI requests

**Action**: Review usage patterns and investigate`,
        tags: ['service:vibecode-ai', 'alert:warning', 'team:platform'],
        options: {
          thresholds: {
            critical: 2000000,
            warning: 1000000
          }
        }
      }
    ]
  }

  /**
   * Create a monitor in Datadog
   */
  async createMonitor(alert: AlertConfig): Promise<string | null> {
    if (!this.apiKey || !this.appKey) {
      console.warn('Datadog API keys not configured')
      return null
    }

    const monitorPayload = {
      name: alert.name,
      type: alert.type,
      query: alert.query,
      message: alert.message,
      tags: alert.tags,
      options: {
        notify_audit: false,
        locked: false,
        timeout_h: 0,
        include_tags: true,
        no_data_timeframe: 20,
        require_full_window: false,
        new_host_delay: 300,
        notify_no_data: false,
        renotify_interval: 0,
        escalation_message: "",
        ...alert.options
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/monitor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.apiKey,
          'DD-APPLICATION-KEY': this.appKey
        },
        body: JSON.stringify(monitorPayload)
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to create monitor: ${response.status} - ${error}`)
      }

      const result = await response.json()
      console.log(`✅ Monitor created: ${alert.name} (ID: ${result.id})`)
      return result.id

    } catch (error) {
      console.error(`Failed to create monitor "${alert.name}":`, error)
      return null
    }
  }

  /**
   * Setup all critical alerts
   */
  async setupAllAlerts(): Promise<{ [key: string]: string }> {
    console.log('🚨 Setting up Datadog alerts...')
    
    const allAlerts = [
      ...this.getAIServiceAlerts(),
      ...this.getInfrastructureAlerts(),
      ...this.getUserExperienceAlerts(),
      ...this.getSecurityAlerts()
    ]

    const results: { [key: string]: string } = {}
    
    for (const alert of allAlerts) {
      const monitorId = await this.createMonitor(alert)
      if (monitorId) {
        results[alert.name] = monitorId
      }
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    console.log(`✅ Created ${Object.keys(results).length}/${allAlerts.length} monitors`)
    return results
  }

  /**
   * List existing monitors
   */
  async listMonitors(): Promise<any[]> {
    try {
      const response = await fetch(`${this.baseUrl}/monitor`, {
        method: 'GET',
        headers: {
          'DD-API-KEY': this.apiKey,
          'DD-APPLICATION-KEY': this.appKey
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to list monitors: ${response.status}`)
      }

      const result = await response.json()
      return result.filter((monitor: any) => 
        monitor.name?.includes('vibecode') || 
        monitor.tags?.some((tag: string) => tag.includes('vibecode'))
      )

    } catch (error) {
      console.error('Failed to list monitors:', error)
      return []
    }
  }

  /**
   * Test alert by sending a custom event
   */
  async testAlert(alertName: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'DD-API-KEY': this.apiKey
        },
        body: JSON.stringify({
          title: `Test Alert: ${alertName}`,
          text: `This is a test alert for ${alertName} monitoring`,
          priority: 'normal',
          tags: ['test', 'vibecode', 'monitoring'],
          alert_type: 'info'
        })
      })

      return response.ok
    } catch (error) {
      console.error('Failed to send test alert:', error)
      return false
    }
  }
}

// Export singleton
export const alertsManager = new DatadogAlertsManager()