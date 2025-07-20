import { exec } from 'child_process';
import { promisify } from 'util';
import { tracer } from './server-monitoring';
import { metrics } from './server-monitoring';

const execAsync = promisify(exec);
interface HopStat {
  hop: number;
  host?: string;
  ip?: string;
  loss: string;
  sent: number;
  last: number;
  avg: number;
  best: number;
  worst: number;
  stdev: number;
  jitter: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
}

class NetworkDiagnostics {
  private static readonly PACKET_COUNT = 10;
  private static readonly MAX_HOPS = 30;
  private static readonly TIMEOUT = 2; // seconds

  /**
   * Run MTR-like diagnostics to a target host
   */
  public static async traceRoute(host: string): Promise<HopStat[]> {
    const span = tracer.scope().active();
    const startTime = Date.now();
    let results: HopStat[] = [];

    try {
      // Use traceroute with JSON output format
      const { stdout } = await execAsync(
        `mtr --json -c ${this.PACKET_COUNT} -m ${this.MAX_HOPS} -w ${this.TIMEOUT} ${host}`,
        { maxBuffer: 1024 * 1024 * 5 } // 5MB buffer for large responses
      );

      // Parse and process results
      const data = JSON.parse(stdout.toString());
      results = this.processTraceResults(data);
      
      // Calculate and report metrics
      this.reportMetrics(host, results, Date.now() - startTime);
      
      return results;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      span?.setTag('error', true);
      span?.setTag('error.msg', errorMessage);
      metrics.increment('network.diagnostics.error', { host, error: errorMessage });
      throw new Error(`Network diagnostics failed: ${errorMessage}`);
    }
  }

  /**
   * Process raw MTR results into structured data
   */
  private static processTraceResults(data: {
    hubs: Array<{
      count: number;
      host?: string;
      ASN?: string;
      Loss: number;
      Snt: number;
      Last?: number;
      Avg?: number;
      Best?: number;
      Wrst?: number;
      StDev?: number;
      Javg?: number;
      P50?: number;
      P90?: number;
      P95?: number;
      P99?: number;
    }>;
  }): HopStat[] {
    return data.hubs.map((hub) => ({
      hop: hub.count,
      host: hub.host || 'Unknown',
      ip: hub.ASN || 'N/A',
      loss: hub.Loss,
      sent: hub.Snt,
      last: hub.Last || 0,
      avg: hub.Avg || 0,
      best: hub.Best || 0,
      worst: hub.Wrst || 0,
      stdev: hub.StDev || 0,
      jitter: hub.Javg,
      p50: hub.P50,
      p90: hub.P90,
      p95: hub.P95,
      p99: hub.P99,
      hop: hub.count,
      host: hub.host || 'Unknown',
      ip: hub.host || hub.ASN || 'Unknown',
      loss: `${hub.Loss || 0}%`,
      sent: hub.Snt,
      last: hub.Last || 0,
      avg: hub.Avg || 0,
      best: hub.Best || 0,
      worst: hub.Wrst || 0,
      stdev: hub.StDev || 0,
      jitter: hub.Javg || 0,
      p50: hub.P50 || 0,
      p90: hub.P90 || 0,
      p95: hub.P95 || 0,
      p99: hub.P99 || 0,
    }));
  }

  /**
   * Report metrics to Datadog
   */
  private static reportMetrics(host: string, results: HopStat[], duration: number): void {
    // Track overall diagnostic duration
    metrics.histogram('network.diagnostics.duration', duration, { host });

    // Track each hop's metrics
    results.forEach(hop => {
      const tags = {
        host,
        hop: hop.hop.toString(),
        target: hop.host || 'unknown'
      };

      metrics.gauge('network.hop.latency.avg', hop.avg, tags);
      metrics.gauge('network.hop.latency.best', hop.best, tags);
      metrics.gauge('network.hop.latency.worst', hop.worst, tags);
      metrics.gauge('network.hop.latency.stdev', hop.stdev, tags);
      metrics.gauge('network.hop.jitter', hop.jitter, tags);
      metrics.gauge('network.hop.loss', parseFloat(hop.loss), tags);
      metrics.gauge('network.hop.percentile.p50', hop.p50, tags);
      metrics.gauge('network.hop.percentile.p90', hop.p90, tags);
      metrics.gauge('network.hop.percentile.p95', hop.p95, tags);
      metrics.gauge('network.hop.percentile.p99', hop.p99, tags);
    });
  }

  /**
   * Run a quick connectivity test to the target
   */
  public static async testConnectivity(host: string, port = 443): Promise<{
    success: boolean;
    latency: number;
    error?: string;
  }> {
    const start = process.hrtime();
    
    try {
      // Simple TCP connection test
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      await execAsync(`nc -zv -w 2 ${host} ${port}`);
      const [seconds, nanoseconds] = process.hrtime(start);
      const latency = (seconds * 1000) + (nanoseconds / 1e6);
      
      // Track success metrics
      metrics.increment('network.connectivity.test', { host, port: port.toString(), status: 'success' });
      metrics.histogram('network.connectivity.latency', latency, { host, port: port.toString() });
      
      return { success: true, latency };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      metrics.increment('network.connectivity.test', { 
        host, 
        port: port.toString(), 
        status: 'error',
        error: errorMessage 
      });
      
      return { 
        success: false, 
        latency: -1,
        error: errorMessage 
      };
    }
  }
}

export default NetworkDiagnostics;
