/**
 * ValKey Metrics Collector for VibeCode WebGUI
 * Collects and reports ValKey performance metrics to Datadog
 */

import { metrics, logger } from '../server-monitoring';
import { RedisClientType } from './redis-connection';

// Metrics collection interval in milliseconds
const METRICS_INTERVAL = 30000; // 30 seconds

// Interface for ValKey metrics
interface ValKeyMetrics {
  uptime_in_seconds?: number;
  connected_clients?: number;
  used_memory?: number;
  used_memory_peak?: number;
  mem_fragmentation_ratio?: number;
  total_connections_received?: number;
  total_commands_processed?: number;
  instantaneous_ops_per_sec?: number;
  keyspace_hits?: number;
  keyspace_misses?: number;
  hit_rate?: number;
  evicted_keys?: number;
  expired_keys?: number;
  connected?: boolean;
  db0_keys?: number;
  slowlog_length?: number;
  cluster_enabled?: number;
}

/**
 * ValKey/Redis metrics collector
 * Collects and reports metrics to Datadog
 */
export class ValKeyMetricsCollector {
  private client: RedisClientType | null = null;
  private interval: NodeJS.Timeout | null = null;
  private lastMetrics: ValKeyMetrics = {};
  private collectionEnabled = false;
  private environment: string;

  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
  }

  /**
   * Initialize metrics collection
   */
  initialize(client: RedisClientType): void {
    this.client = client;
    this.collectionEnabled = true;
    logger.info('ValKey metrics collection initialized');
    
    // Start collection interval
    this.startCollection();
  }

  /**
   * Start metrics collection
   */
  startCollection(): void {
    if (!this.collectionEnabled || !this.client || this.interval) {
      return;
    }

    logger.info('Starting ValKey metrics collection');
    
    // Collect metrics immediately
    this.collectMetrics();
    
    // Set up interval for periodic collection
    this.interval = setInterval(() => {
      this.collectMetrics();
    }, METRICS_INTERVAL);
  }

  /**
   * Stop metrics collection
   */
  stopCollection(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('ValKey metrics collection stopped');
    }
  }

  /**
   * Collect and report metrics
   */
  async collectMetrics(): Promise<void> {
    if (!this.client) {
      this.reportConnectionStatus(false);
      return;
    }

    try {
      // Check connection
      const pingResult = await this.client.ping();
      const connected = pingResult === 'PONG';
      this.reportConnectionStatus(connected);
      
      if (!connected) {
        return;
      }
      
      // Get ValKey info
      const info = await this.client.info();
      const parsedMetrics = this.parseInfo(info);
      
      // Get slowlog length - using generic 'call' since slowlog may not be directly exposed
      try {
        const slowlog = await (this.client as any).call('SLOWLOG', 'LEN');
        parsedMetrics.slowlog_length = typeof slowlog === 'number' ? slowlog : parseInt(slowlog.toString(), 10);
      } catch (error) {
        logger.warn('Error getting ValKey slowlog length', { error });
      }
      
      // Get database size
      const dbSize = await this.client.dbsize();
      parsedMetrics.db0_keys = dbSize;
      
      // Calculate hit rate
      if (parsedMetrics.keyspace_hits !== undefined && parsedMetrics.keyspace_misses !== undefined) {
        const total = parsedMetrics.keyspace_hits + parsedMetrics.keyspace_misses;
        parsedMetrics.hit_rate = total > 0 ? parsedMetrics.keyspace_hits / total : 0;
      }
      
      // Report metrics to Datadog
      this.reportMetrics(parsedMetrics);
      
      // Update last metrics
      this.lastMetrics = parsedMetrics;
      
    } catch (error) {
      logger.error('Error collecting ValKey metrics', { error });
      this.reportConnectionStatus(false);
    }
  }

  /**
   * Parse ValKey INFO command output
   */
  private parseInfo(info: string): ValKeyMetrics {
    const metrics: ValKeyMetrics = {};
    const sections = info.split('#');
    
    // Parse relevant metrics
    for (const section of sections) {
      const lines = section.split('\r\n');
      
      for (const line of lines) {
        if (!line || line.startsWith('#')) continue;
        
        const [key, value] = line.split(':');
        
        if (!key || !value) continue;
        
        // Parse relevant metrics
        switch (key.trim()) {
          case 'uptime_in_seconds':
          case 'connected_clients':
          case 'used_memory':
          case 'used_memory_peak':
          case 'total_connections_received':
          case 'total_commands_processed':
          case 'instantaneous_ops_per_sec':
          case 'keyspace_hits':
          case 'keyspace_misses':
          case 'evicted_keys':
          case 'expired_keys':
          case 'cluster_enabled':
            metrics[key.trim() as keyof ValKeyMetrics] = parseInt(value.trim(), 10) as any;
            break;
          case 'mem_fragmentation_ratio':
            metrics.mem_fragmentation_ratio = parseFloat(value.trim());
            break;
        }
      }
    }
    
    return metrics;
  }

  /**
   * Report connection status to Datadog
   */
  private reportConnectionStatus(connected: boolean): void {
    metrics.gauge('valkey.connected', connected ? 1 : 0, {
      env: this.environment
    });
    
    this.lastMetrics.connected = connected;
  }

  /**
   * Report metrics to Datadog
   */
  private reportMetrics(metricsData: ValKeyMetrics): void {
    // Server metrics
    if (metricsData.uptime_in_seconds !== undefined) {
      metrics.gauge('valkey.uptime', metricsData.uptime_in_seconds, {
        env: this.environment
      });
    }
    
    if (metricsData.connected_clients !== undefined) {
      metrics.gauge('valkey.clients.connected', metricsData.connected_clients, {
        env: this.environment
      });
    }
    
    // Memory metrics
    if (metricsData.used_memory !== undefined) {
      metrics.gauge('valkey.memory.used', metricsData.used_memory, {
        env: this.environment
      });
    }
    
    if (metricsData.used_memory_peak !== undefined) {
      metrics.gauge('valkey.memory.peak', metricsData.used_memory_peak, {
        env: this.environment
      });
    }
    
    if (metricsData.mem_fragmentation_ratio !== undefined) {
      metrics.gauge('valkey.memory.fragmentation_ratio', metricsData.mem_fragmentation_ratio, {
        env: this.environment
      });
    }
    
    // Operation metrics
    if (metricsData.total_commands_processed !== undefined) {
      metrics.gauge('valkey.commands.processed', metricsData.total_commands_processed, {
        env: this.environment
      });
    }
    
    if (metricsData.instantaneous_ops_per_sec !== undefined) {
      metrics.gauge('valkey.commands.per_sec', metricsData.instantaneous_ops_per_sec, {
        env: this.environment
      });
    }
    
    // Cache metrics
    if (metricsData.keyspace_hits !== undefined) {
      metrics.gauge('valkey.keyspace.hits', metricsData.keyspace_hits, {
        env: this.environment
      });
    }
    
    if (metricsData.keyspace_misses !== undefined) {
      metrics.gauge('valkey.keyspace.misses', metricsData.keyspace_misses, {
        env: this.environment
      });
    }
    
    if (metricsData.hit_rate !== undefined) {
      metrics.gauge('valkey.keyspace.hit_rate', metricsData.hit_rate, {
        env: this.environment
      });
    }
    
    // Key expiration and eviction
    if (metricsData.evicted_keys !== undefined) {
      metrics.gauge('valkey.keys.evicted', metricsData.evicted_keys, {
        env: this.environment
      });
    }
    
    if (metricsData.expired_keys !== undefined) {
      metrics.gauge('valkey.keys.expired', metricsData.expired_keys, {
        env: this.environment
      });
    }
    
    // Database metrics
    if (metricsData.db0_keys !== undefined) {
      metrics.gauge('valkey.keys.total', metricsData.db0_keys, {
        env: this.environment
      });
    }
    
    // Slowlog
    if (metricsData.slowlog_length !== undefined) {
      metrics.gauge('valkey.slowlog.length', metricsData.slowlog_length, {
        env: this.environment
      });
    }
    
    // Cluster status
    if (metricsData.cluster_enabled !== undefined) {
      metrics.gauge('valkey.cluster.enabled', metricsData.cluster_enabled, {
        env: this.environment
      });
    }
    
    // Log summary of metrics
    logger.debug('ValKey metrics collected', {
      clients: metricsData.connected_clients,
      memory_used_mb: metricsData.used_memory ? Math.round(metricsData.used_memory / (1024 * 1024) * 100) / 100 : undefined,
      ops_per_sec: metricsData.instantaneous_ops_per_sec,
      hit_rate: metricsData.hit_rate ? Math.round(metricsData.hit_rate * 100) : undefined,
      total_keys: metricsData.db0_keys
    });
  }

  /**
   * Get last collected metrics
   */
  getLastMetrics(): ValKeyMetrics {
    return { ...this.lastMetrics };
  }
}

// Export singleton instance
export const valkeyMetrics = new ValKeyMetricsCollector();
export default valkeyMetrics;