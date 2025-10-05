/**
 * Datadog Dashboard Configuration for AgentAPI
 * Creates comprehensive monitoring dashboards for agent health, performance, and usage
 */

interface DatadogWidget {
  definition: {
    type: string;
    requests?: any[];
    title?: string;
    title_size?: string;
    title_align?: string;
    [key: string]: any;
  };
  layout?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface DatadogDashboard {
  title: string;
  description: string;
  widgets: DatadogWidget[];
  layout_type: 'ordered' | 'free';
  is_read_only: boolean;
  notify_list: string[];
  template_variables?: any[];
}

/**
 * Agent Health Status Grid Widget
 */
function createAgentHealthStatusGrid(): DatadogWidget {
  return {
    definition: {
      type: 'query_value',
      requests: [
        {
          q: 'sum:agent_active_count{*}.as_count()',
          aggregator: 'last',
          conditional_formats: [
            {
              comparator: '>',
              value: 4,
              palette: 'white_on_red'
            },
            {
              comparator: '>=',
              value: 2,
              palette: 'white_on_yellow'
            },
            {
              comparator: '<',
              value: 2,
              palette: 'white_on_green'
            }
          ]
        }
      ],
      title: 'Active Agents',
      title_size: '16',
      title_align: 'left',
      precision: 0
    },
    layout: {
      x: 0,
      y: 0,
      width: 3,
      height: 2
    }
  };
}

/**
 * Agent Status Breakdown by Type
 */
function createAgentStatusBreakdown(): DatadogWidget {
  return {
    definition: {
      type: 'sunburst',
      requests: [
        {
          q: 'sum:agent_active_count{*} by {agent_type,state}'
        }
      ],
      title: 'Agent Status by Type',
      title_size: '16',
      title_align: 'left',
      legend: {
        type: 'automatic'
      }
    },
    layout: {
      x: 3,
      y: 0,
      width: 5,
      height: 4
    }
  };
}

/**
 * API Latency Heatmap
 */
function createAPILatencyHeatmap(): DatadogWidget {
  return {
    definition: {
      type: 'heatmap',
      requests: [
        {
          q: 'avg:http_request_duration_seconds{service:agentapi} by {route}',
          style: {
            palette: 'dog_classic'
          }
        }
      ],
      title: 'API Latency Heatmap (by Route)',
      title_size: '16',
      title_align: 'left',
      yaxis: {
        include_zero: true,
        scale: 'linear'
      },
      show_legend: true
    },
    layout: {
      x: 0,
      y: 4,
      width: 8,
      height: 4
    }
  };
}

/**
 * Error Rate Timeseries
 */
function createErrorRateTimeseries(): DatadogWidget {
  return {
    definition: {
      type: 'timeseries',
      requests: [
        {
          q: 'sum:agent_failure_total{*}.as_rate()',
          display_type: 'bars',
          style: {
            palette: 'warm',
            line_type: 'solid',
            line_width: 'normal'
          },
          metadata: [
            {
              expression: 'sum:agent_failure_total{*}.as_rate()',
              alias_name: 'Agent Failures'
            }
          ]
        },
        {
          q: 'sum:agent_errors_total{*}.as_rate()',
          display_type: 'line',
          style: {
            palette: 'dog_classic',
            line_type: 'solid',
            line_width: 'normal'
          },
          metadata: [
            {
              expression: 'sum:agent_errors_total{*}.as_rate()',
              alias_name: 'Agent Errors'
            }
          ]
        }
      ],
      title: 'Error Rate (per second)',
      title_size: '16',
      title_align: 'left',
      yaxis: {
        include_zero: true,
        scale: 'linear',
        label: 'errors/sec'
      },
      show_legend: true,
      legend_layout: 'auto',
      legend_columns: ['avg', 'min', 'max', 'value', 'sum']
    },
    layout: {
      x: 8,
      y: 0,
      width: 4,
      height: 4
    }
  };
}

/**
 * Agent Task Duration Percentiles
 */
function createTaskDurationPercentiles(): DatadogWidget {
  return {
    definition: {
      type: 'timeseries',
      requests: [
        {
          q: 'max:agent_task_duration_seconds.max{*} by {agent_type}',
          display_type: 'line',
          style: {
            palette: 'cool',
            line_type: 'solid',
            line_width: 'thick'
          },
          metadata: [
            {
              expression: 'max:agent_task_duration_seconds.max{*} by {agent_type}',
              alias_name: 'P99 Duration'
            }
          ]
        },
        {
          q: 'avg:agent_task_duration_seconds.95percentile{*} by {agent_type}',
          display_type: 'line',
          style: {
            palette: 'purple',
            line_type: 'solid',
            line_width: 'normal'
          },
          metadata: [
            {
              expression: 'avg:agent_task_duration_seconds.95percentile{*} by {agent_type}',
              alias_name: 'P95 Duration'
            }
          ]
        },
        {
          q: 'avg:agent_task_duration_seconds.median{*} by {agent_type}',
          display_type: 'line',
          style: {
            palette: 'green',
            line_type: 'solid',
            line_width: 'normal'
          },
          metadata: [
            {
              expression: 'avg:agent_task_duration_seconds.median{*} by {agent_type}',
              alias_name: 'P50 Duration'
            }
          ]
        }
      ],
      title: 'Agent Task Duration (Percentiles)',
      title_size: '16',
      title_align: 'left',
      yaxis: {
        include_zero: true,
        scale: 'linear',
        label: 'seconds'
      },
      show_legend: true,
      legend_layout: 'auto',
      legend_columns: ['avg', 'min', 'max', 'value']
    },
    layout: {
      x: 0,
      y: 8,
      width: 6,
      height: 4
    }
  };
}

/**
 * Resource Utilization (CPU & Memory)
 */
function createResourceUtilization(): DatadogWidget {
  return {
    definition: {
      type: 'timeseries',
      requests: [
        {
          q: 'avg:process_cpu_seconds_total{service:agentapi}.as_rate() * 100',
          display_type: 'area',
          style: {
            palette: 'orange',
            line_type: 'solid',
            line_width: 'normal'
          },
          metadata: [
            {
              expression: 'avg:process_cpu_seconds_total{service:agentapi}.as_rate() * 100',
              alias_name: 'CPU Usage %'
            }
          ]
        },
        {
          q: 'avg:process_resident_memory_bytes{service:agentapi} / 1024 / 1024',
          display_type: 'line',
          style: {
            palette: 'blue',
            line_type: 'solid',
            line_width: 'normal'
          },
          on_right_yaxis: true,
          metadata: [
            {
              expression: 'avg:process_resident_memory_bytes{service:agentapi} / 1024 / 1024',
              alias_name: 'Memory MB'
            }
          ]
        }
      ],
      title: 'Resource Utilization (CPU & Memory per Agent)',
      title_size: '16',
      title_align: 'left',
      yaxis: {
        include_zero: true,
        scale: 'linear',
        label: 'CPU %'
      },
      right_yaxis: {
        include_zero: true,
        scale: 'linear',
        label: 'Memory MB'
      },
      show_legend: true
    },
    layout: {
      x: 6,
      y: 8,
      width: 6,
      height: 4
    }
  };
}

/**
 * Success Rate by Agent Type
 */
function createSuccessRateByType(): DatadogWidget {
  return {
    definition: {
      type: 'query_value',
      requests: [
        {
          q: '(sum:agent_success_total{*}.as_count() / (sum:agent_success_total{*}.as_count() + sum:agent_failure_total{*}.as_count())) * 100',
          aggregator: 'avg',
          conditional_formats: [
            {
              comparator: '>=',
              value: 95,
              palette: 'white_on_green'
            },
            {
              comparator: '>=',
              value: 85,
              palette: 'white_on_yellow'
            },
            {
              comparator: '<',
              value: 85,
              palette: 'white_on_red'
            }
          ]
        }
      ],
      title: 'Overall Success Rate',
      title_size: '16',
      title_align: 'left',
      precision: 2,
      custom_unit: '%'
    },
    layout: {
      x: 8,
      y: 4,
      width: 4,
      height: 2
    }
  };
}

/**
 * Agent Output Activity
 */
function createAgentOutputActivity(): DatadogWidget {
  return {
    definition: {
      type: 'timeseries',
      requests: [
        {
          q: 'sum:agent_output_lines_total{*}.as_rate() by {agent_type}',
          display_type: 'bars',
          style: {
            palette: 'dog_classic'
          }
        }
      ],
      title: 'Agent Output Activity (lines/sec)',
      title_size: '16',
      title_align: 'left',
      yaxis: {
        include_zero: true,
        scale: 'linear',
        label: 'lines/sec'
      },
      show_legend: true
    },
    layout: {
      x: 0,
      y: 12,
      width: 6,
      height: 3
    }
  };
}

/**
 * HTTP Request Throughput
 */
function createHTTPThroughput(): DatadogWidget {
  return {
    definition: {
      type: 'timeseries',
      requests: [
        {
          q: 'sum:http_requests_total{service:agentapi}.as_rate() by {route}',
          display_type: 'area',
          style: {
            palette: 'dog_classic'
          }
        }
      ],
      title: 'HTTP Request Throughput (req/sec)',
      title_size: '16',
      title_align: 'left',
      yaxis: {
        include_zero: true,
        scale: 'linear',
        label: 'req/sec'
      },
      show_legend: true
    },
    layout: {
      x: 6,
      y: 12,
      width: 6,
      height: 3
    }
  };
}

/**
 * Create complete AgentAPI dashboard
 */
export function createAgentAPIDashboard(): DatadogDashboard {
  return {
    title: 'AgentAPI Monitoring Dashboard',
    description: 'Comprehensive monitoring for AI coding agent health, performance, and resource usage',
    layout_type: 'ordered',
    is_read_only: false,
    notify_list: [],
    template_variables: [
      {
        name: 'agent_type',
        prefix: 'agent_type',
        available_values: ['aider', 'goose', 'cline'],
        default: '*'
      },
      {
        name: 'env',
        prefix: 'env',
        available_values: ['production', 'staging', 'development'],
        default: 'production'
      }
    ],
    widgets: [
      createAgentHealthStatusGrid(),
      createAgentStatusBreakdown(),
      createErrorRateTimeseries(),
      createAPILatencyHeatmap(),
      createSuccessRateByType(),
      createTaskDurationPercentiles(),
      createResourceUtilization(),
      createAgentOutputActivity(),
      createHTTPThroughput()
    ]
  };
}

/**
 * Create dashboard using Datadog API
 */
export async function deployAgentAPIDashboard(
  datadogApiKey: string,
  datadogAppKey: string,
  datadogSite: string = 'datadoghq.com'
): Promise<{ id: string; url: string }> {
  const dashboard = createAgentAPIDashboard();

  const response = await fetch(`https://api.${datadogSite}/api/v1/dashboard`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DD-API-KEY': datadogApiKey,
      'DD-APPLICATION-KEY': datadogAppKey
    },
    body: JSON.stringify(dashboard)
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Datadog dashboard: ${response.status} ${error}`);
  }

  const result = await response.json();
  return {
    id: result.id,
    url: result.url
  };
}

/**
 * Export dashboard as JSON for manual import
 */
export function exportDashboardJSON(): string {
  return JSON.stringify(createAgentAPIDashboard(), null, 2);
}
