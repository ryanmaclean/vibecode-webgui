declare module '@opentelemetry/exporter-otlp-http' {
  export class OTLPTraceExporter {
    constructor(config?: { url?: string; headers?: Record<string, string> })
  }
}

declare module '@opentelemetry/exporter-prometheus' {
  export class PrometheusExporter {
    constructor(config?: { port?: number; endpoint?: string }, callback?: () => void)
  }
}

declare module '@opentelemetry/resources' {
  export class Resource {
    constructor(attributes?: Record<string, unknown>)
  }
}

declare module '@opentelemetry/sdk-node' {
  export class NodeSDK {
    constructor(config?: Record<string, unknown>)
    start(): void
    shutdown(): Promise<void>
  }
}

declare module '@opentelemetry/auto-instrumentations-node' {
  export function getNodeAutoInstrumentations(
    config?: Record<string, unknown>,
  ): Record<string, unknown>
}

declare module '@opentelemetry/sdk-trace-web' {
  export class WebTracerProvider {
    constructor(config?: Record<string, unknown>)
    getTracer(name: string): unknown
    addSpanProcessor(processor: unknown): void
    register(): void
  }
}

declare module '@opentelemetry/auto-instrumentations-web' {
  export function getWebAutoInstrumentations(
    config?: Record<string, unknown>,
  ): Record<string, unknown>
}

declare module '@opentelemetry/sdk-trace-base' {
  export class BatchSpanProcessor {
    constructor(exporter: unknown, config?: Record<string, unknown>)
  }
}

declare module 'web-vitals' {
  type MetricName = 'CLS' | 'FID' | 'FCP' | 'LCP' | 'TTFB'
  type WebVitalMetric = { name: MetricName; value: number; id: string }
  export function onCLS(cb: (metric: WebVitalMetric) => void): void
  export function onFID(cb: (metric: WebVitalMetric) => void): void
  export function onFCP(cb: (metric: WebVitalMetric) => void): void
  export function onLCP(cb: (metric: WebVitalMetric) => void): void
  export function onTTFB(cb: (metric: WebVitalMetric) => void): void
}
