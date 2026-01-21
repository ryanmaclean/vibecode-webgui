/**
 * Type declarations for @datadog/api-client-typescript
 * Provides minimal types for eBPF integration
 */

declare module '@datadog/api-client-typescript' {
  export interface DatadogApiConfig {
    apiKeyAuth: string;
    site: string;
  }

  export interface EventCreateRequest {
    title: string;
    text: string;
    tags?: string[];
    alertType?: string;
    sourceTypeName?: string;
  }

  export interface MetricMetadataRequest {
    metricName: string;
  }

  export class DatadogApi {
    constructor(config: DatadogApiConfig);

    v1: {
      EventsApi: {
        createEvent(params: { body: EventCreateRequest }): Promise<void>;
      };
      MetricsApi: {
        getMetricMetadata(params: MetricMetadataRequest): Promise<unknown>;
      };
    };
  }
}
