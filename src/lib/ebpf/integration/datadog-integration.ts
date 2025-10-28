/**
 * Datadog eBPF Integration
 * 
 * TypeScript client for eBPF metrics collection and Datadog forwarding
 * Extracted from Codex Salvage Branch eBPF implementation
 */

import { StatsD } from 'hot-shots';
import { DatadogApi } from '@datadog/api-client-typescript';

export interface VmLifecycleEvent {
  vm_id: string;
  action: 'start' | 'stop' | 'pause' | 'resume';
  duration_ns: number;
  cpu_usage: number;
  memory_usage: number;
  timestamp: number;
}

export interface NetworkEvent {
  vm_id: string;
  protocol: string;
  bytes_sent: number;
  bytes_received: number;
  latency_us: number;
  timestamp: number;
}

export interface EbpfMetricConfig {
  datadogApiKey: string;
  datadogSite: string;
  statsdHost: string;
  statsdPort: number;
  environment: string;
  service: string;
  version: string;
}

export class DatadogEbpfIntegration {
  private statsd: StatsD;
  private datadogApi: DatadogApi;
  private config: EbpfMetricConfig;

  constructor(config: EbpfMetricConfig) {
    this.config = config;
    
    // Initialize StatsD client
    this.statsd = new StatsD({
      host: config.statsdHost,
      port: config.statsdPort,
      prefix: 'ebpf.',
      globalTags: {
        environment: config.environment,
        service: config.service,
        version: config.version,
      },
    });

    // Initialize Datadog API client
    this.datadogApi = new DatadogApi({
      apiKeyAuth: config.datadogApiKey,
      site: config.datadogSite,
    });
  }

  /**
   * Record VM lifecycle events
   */
  recordVmLifecycle(event: VmLifecycleEvent, tags: string[]): void {
    const bootTimeMs = event.duration_ns / 1000000;
    
    // Send timing metrics
    this.statsd.timing('vm.boot_time', bootTimeMs, [
      ...tags,
      `vm_id:${event.vm_id}`,
      `action:${event.action}`,
    ]);

    // Send gauge metrics
    this.statsd.gauge('vm.cpu_usage', event.cpu_usage, [
      ...tags,
      `vm_id:${event.vm_id}`,
    ]);

    this.statsd.gauge('vm.memory_usage', event.memory_usage, [
      ...tags,
      `vm_id:${event.vm_id}`,
    ]);

    // Send counter for VM actions
    this.statsd.increment('vm.actions', 1, [
      ...tags,
      `vm_id:${event.vm_id}`,
      `action:${event.action}`,
    ]);
  }

  /**
   * Record network monitoring events
   */
  recordNetworkEvent(event: NetworkEvent, tags: string[]): void {
    // Network latency
    this.statsd.timing('network.latency', event.latency_us, [
      ...tags,
      `vm_id:${event.vm_id}`,
      `protocol:${event.protocol}`,
    ]);

    // Bytes sent/received
    this.statsd.gauge('network.bytes_sent', event.bytes_sent, [
      ...tags,
      `vm_id:${event.vm_id}`,
      `protocol:${event.protocol}`,
    ]);

    this.statsd.gauge('network.bytes_received', event.bytes_received, [
      ...tags,
      `vm_id:${event.vm_id}`,
      `protocol:${event.protocol}`,
    ]);

    // Network throughput
    const throughput = (event.bytes_sent + event.bytes_received) / (event.latency_us / 1000000);
    this.statsd.gauge('network.throughput', throughput, [
      ...tags,
      `vm_id:${event.vm_id}`,
      `protocol:${event.protocol}`,
    ]);
  }

  /**
   * Record CPU profiling data
   */
  recordCpuProfile(cpuData: {
    vm_id: string;
    cpu_usage: number;
    cpu_count: number;
    load_average: number[];
    timestamp: number;
  }, tags: string[]): void {
    this.statsd.gauge('cpu.usage', cpuData.cpu_usage, [
      ...tags,
      `vm_id:${cpuData.vm_id}`,
    ]);

    this.statsd.gauge('cpu.count', cpuData.cpu_count, [
      ...tags,
      `vm_id:${cpuData.vm_id}`,
    ]);

    // Load averages
    cpuData.load_average.forEach((load, index) => {
      this.statsd.gauge(`cpu.load_avg_${index + 1}m`, load, [
        ...tags,
        `vm_id:${cpuData.vm_id}`,
      ]);
    });
  }

  /**
   * Record memory allocation data
   */
  recordMemoryAllocation(memData: {
    vm_id: string;
    allocated_mb: number;
    free_mb: number;
    total_mb: number;
    swap_used_mb: number;
    timestamp: number;
  }, tags: string[]): void {
    this.statsd.gauge('memory.allocated', memData.allocated_mb, [
      ...tags,
      `vm_id:${memData.vm_id}`,
    ]);

    this.statsd.gauge('memory.free', memData.free_mb, [
      ...tags,
      `vm_id:${memData.vm_id}`,
    ]);

    this.statsd.gauge('memory.total', memData.total_mb, [
      ...tags,
      `vm_id:${memData.vm_id}`,
    ]);

    this.statsd.gauge('memory.swap_used', memData.swap_used_mb, [
      ...tags,
      `vm_id:${memData.vm_id}`,
    ]);

    // Memory utilization percentage
    const utilization = (memData.allocated_mb / memData.total_mb) * 100;
    this.statsd.gauge('memory.utilization', utilization, [
      ...tags,
      `vm_id:${memData.vm_id}`,
    ]);
  }

  /**
   * Send custom events to Datadog
   */
  async sendEvent(title: string, text: string, tags: string[]): Promise<void> {
    try {
      await this.datadogApi.v1.EventsApi.createEvent({
        body: {
          title,
          text,
          tags,
          alertType: 'info',
          sourceTypeName: 'ebpf',
        },
      });
    } catch (error) {
      console.error('Failed to send event to Datadog:', error);
    }
  }

  /**
   * Send performance alerts
   */
  async sendPerformanceAlert(
    vmId: string,
    metric: string,
    value: number,
    threshold: number,
    tags: string[]
  ): Promise<void> {
    const alertType = value > threshold ? 'warning' : 'info';
    
    await this.sendEvent(
      `eBPF Performance Alert: ${metric}`,
      `VM ${vmId} ${metric} is ${value} (threshold: ${threshold})`,
      [
        ...tags,
        `vm_id:${vmId}`,
        `metric:${metric}`,
        `alert_type:${alertType}`,
      ]
    );
  }

  /**
   * Health check for eBPF integration
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    metrics: Record<string, any>;
  }> {
    try {
      // Test StatsD connection
      this.statsd.increment('ebpf.health_check', 1, ['test:true']);
      
      // Test Datadog API
      await this.datadogApi.v1.MetricsApi.getMetricMetadata({
        metricName: 'system.cpu.user',
      });

      return {
        status: 'healthy',
        metrics: {
          statsd_connected: true,
          datadog_api_connected: true,
          timestamp: Date.now(),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        metrics: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
        },
      };
    }
  }

  /**
   * Cleanup resources
   */
  async close(): Promise<void> {
    if (this.statsd) {
      this.statsd.close();
    }
  }
}

// Export default instance factory
export function createDatadogEbpfIntegration(config: EbpfMetricConfig): DatadogEbpfIntegration {
  return new DatadogEbpfIntegration(config);
}

// Export types for external use
export type { VmLifecycleEvent, NetworkEvent, EbpfMetricConfig };
