// src/tracing.ts
import * as vscode from 'vscode';
import { Logger } from './logger';
import { getWorkspaceId } from './utils';

// Type definitions for ddtrace (to avoid requiring it directly)
interface Span {
    setTag(key: string, value: any): Span;
    finish(): void;
    addEvent?(name: string, attributes?: Record<string, any>): void;
}

interface Tracer {
    init(options: any): void;
    startSpan(name: string, options?: any): Span;
    scope(): any;
    extract(format: any, carrier: any): any;
    inject(span: any, format: any, carrier: any): void;
    flush(callback?: () => void): void;
    use(plugin: string, config?: any): void;
    FORMAT_TEXT_MAP: any;
}

export class TracingManager {
    private logger: Logger;
    private isInitialized = false;
    private tracer: Tracer | null = null;

    constructor(logger: Logger) {
        this.logger = logger;
    }

    public async initialize(): Promise<void> {
        const config = vscode.workspace.getConfiguration('workspaceRag.tracing');
        const enabled = config.get<boolean>('enabled', false);
        
        if (!enabled) {
            this.logger.debug('Tracing is disabled in configuration');
            this.isInitialized = false;
            return;
        }

        try {
            // Dynamically import dd-trace to avoid errors if not installed
            const ddtrace = await import('dd-trace');
            this.tracer = ddtrace.default as any;

            const sampleRate = config.get<number>('sampleRate', 0.1);
            const debugMode = config.get<boolean>('debug', false);
            const exporters = config.get<string[]>('exporters', ['console']);
            const datadogConfig = config.get<any>('datadog', {});
            const jaegerConfig = config.get<any>('jaeger', {});
            const datadogApiKey = (
                datadogConfig?.apiKey ||
                config.get<string>('datadogApiKey', '') ||
                process.env.DD_API_KEY
            );
            const datadogSite = (
                datadogConfig?.site ||
                config.get<string>('datadogSite', 'datadoghq.com')
            );
            const jaegerEndpoint = (
                jaegerConfig?.endpoint ||
                config.get<string>('jaegerEndpoint', 'http://localhost:14268/api/traces')
            );

            const tracerConfig: any = {
                service: process.env.DD_SERVICE || 'vscode-rag-extension',
                version: process.env.DD_VERSION || '1.0.0',
                env: process.env.DD_ENV || process.env.NODE_ENV || 'development',
                enabled: true,
                debug: debugMode,
                sampling: {
                    sampleRate: sampleRate
                },
                flushInterval: 5000,
                runtimeMetrics: true,
                logInjection: true,
                plugins: true,
                tags: {
                    team: 'platform',
                    component: 'vscode-extension',
                },
            };

            // Configure DataDog exporter if enabled
            if (exporters.includes('datadog')) {
                if (!datadogApiKey) {
                    this.logger.warn('Datadog exporter selected but no API key configured. Set workspaceRag.tracing.datadogApiKey or DD_API_KEY.');
                } else {
                    tracerConfig.site = datadogSite;
                    process.env.DD_API_KEY = datadogApiKey;
                    process.env.DD_SITE = datadogSite;
                }
            }

            if (exporters.includes('jaeger')) {
                process.env.DD_TRACE_AGENT_URL = jaegerEndpoint;
                this.logger.info('Jaeger exporter enabled via DD_TRACE_AGENT_URL', {
                    endpoint: jaegerEndpoint
                });
            }

            if (!this.tracer) return;

            this.tracer.init(tracerConfig);

            // Enable integrations
            this.tracer.use('pg', {
                enabled: true,
                operationName: 'postgres.query'
            });

            this.tracer.use('http', {
                enabled: true
            });

            this.isInitialized = true;
            this.logger.info('Tracing initialized successfully', {
                service: 'vscode-rag-extension',
                sampleRate,
                exporters
            });

            // Setup shutdown hook
            this.setupShutdownHook();

        } catch (error) {
            this.logger.warn('Failed to initialize tracing (dd-trace may not be installed)', error);
            // Don't throw - tracing is optional
        }
    }

    public async trace<T>(
        operationName: string,
        operation: (span: Span) => Promise<T>,
        tags: Record<string, any> = {}
    ): Promise<T> {
        if (!this.isInitialized || !this.tracer) {
            // If tracing is disabled, just run the operation
            return operation(this.createNoOpSpan());
        }

        const span = this.tracer.startSpan(operationName, {
            tags: {
                'component': 'vscode-extension',
                'resource.name': operationName,
                'workspaceId': getWorkspaceId() || 'no-workspace',
                ...tags
            }
        });

        try {
            const result = await operation(span);
            span.finish();
            return result;
        } catch (error: any) {
            span.setTag('error', true);
            span.setTag('error.msg', error.message);
            span.setTag('error.stack', error.stack);
            span.finish();
            throw error;
        }
    }

    private createNoOpSpan(): Span {
        return {
            setTag: () => this.createNoOpSpan(),
            finish: () => {},
            addEvent: () => {}
        };
    }

    public isTracingEnabled(): boolean {
        return this.isInitialized;
    }

    private setupShutdownHook(): void {
        const shutdown = async () => {
            if (this.tracer && this.isInitialized) {
                this.logger.debug('Flushing traces before shutdown');
                this.tracer.flush(() => {
                    this.logger.debug('Traces flushed');
                });
            }
        };

        process.on('beforeExit', shutdown);
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    }

    public async flush(): Promise<void> {
        if (!this.tracer || !this.isInitialized) {
            return;
        }

        return new Promise((resolve) => {
            this.tracer!.flush(() => {
                this.logger.debug('Tracing buffer flushed');
                resolve();
            });
        });
    }
}

// Singleton instance
let tracingManager: TracingManager | null = null;

export function getTracingManager(logger: Logger): TracingManager {
    if (!tracingManager) {
        tracingManager = new TracingManager(logger);
    }
    return tracingManager;
}

