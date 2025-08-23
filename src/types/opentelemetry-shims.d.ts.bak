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
    constructor(config?: any)
    start(): void
    shutdown(): Promise<void>
  }
}

declare module '@opentelemetry/auto-instrumentations-node' {
  export function getNodeAutoInstrumentations(config?: any): any
}

declare module '@opentelemetry/sdk-trace-web' {
  export class WebTracerProvider {
    constructor(config?: any)
    getTracer(name: string): any
    addSpanProcessor(processor: any): void
    register(): void
  }
}

declare module '@opentelemetry/auto-instrumentations-web' {
  export function getWebAutoInstrumentations(config?: any): any
}

declare module '@opentelemetry/sdk-trace-base' {
  export class BatchSpanProcessor {
    constructor(exporter: any, config?: any)
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
