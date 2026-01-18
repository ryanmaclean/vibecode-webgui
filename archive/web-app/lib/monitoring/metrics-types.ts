/**
 * Metrics Types Definition
 * 
 * This file contains TypeScript interface definitions for metrics data
 * used throughout the VibeCode application.
 */

// Basic metric data structure
export interface MetricData {
  name: string;
  value: number;
  tags: Record<string, string>;
  timestamp?: number;
}

// Extended interface for Datadog-specific metrics
export interface DatadogMetricData extends MetricData {
  type?: 'gauge' | 'count' | 'histogram' | 'distribution';
  interval?: number;
  host?: string;
}

// Batch metrics type
export type BatchMetrics = MetricData[];

// Metric options for processing
export interface MetricOptions {
  timestamp?: number;
  tags?: Record<string, string>;
  aggregate?: boolean;
  flush?: boolean;
}

// Metric collection configuration
export interface MetricsConfig {
  enabled: boolean;
  environment: string;
  service: string;
  version: string;
  flushIntervalMs: number;
  defaultTags: Record<string, string>;
  datadogApiKey?: string;
}

// Metric processing status
export interface MetricProcessingResult {
  success: boolean;
  metricsSent: number;
  errors?: string[];
}