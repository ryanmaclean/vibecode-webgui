// src/tracing/index.ts
import * as tracer from 'dd-trace';
import { Logger } from '../logger';
import * as vscode from 'vscode';

interface TracingConfig {
    enabled: boolean;
    sampleRate: number;
    debug: boolean;
    exporters: string[];
    datadog?: {
        apiKey?: string;
        site?: string;
    };
    jaeger?: {
        endpoint?: string;
    };
}

export class TracingManager {
    private logger: Logger;
    private isInitialized = false;
    private config: TracingConfig;

    constructor(logger: Logger) {
        this.logger = logger;
        this.config = this.loadConfig();
    }

    private loadConfig(): TracingConfig {
        const vscodeConfig = vscode.workspace.getConfiguration('workspaceRag.tracing');
        return {
            enabled: vscodeConfig.get<boolean>('enabled', false),
            sampleRate: vscodeConfig.get<number>('sampleRate', 0.1),
            debug: vscodeConfig.get<boolean>('debug', false),
            exporters: vscodeConfig.get<string[]>('exporters', ['console']),
            datadog: vscodeConfig.get<object>('datadog', {}) as any,
            jaeger: vscodeConfig.get<object>('jaeger', {}) as any
        };
    }

    public async initialize(): Promise<void> {
        if (!this.config.enabled) {
            this.logger.info('Tracing is disabled in configuration');
            return;
        }

        try {
            const tracerConfig: any = {
                service: 'vscode-rag-extension',
                version: '1.0.0',
                env: process.env.NODE_ENV || 'development',
                enabled: true,
                debug: this.config.debug,
                sampling: {
                    sampleRate: this.config.sampleRate
                },
                flushInterval: 5000,
                runtimeMetrics: true,
                logInjection: true
            };

            // Configure exporters
            if (this.config.exporters.includes('datadog') && this.config.datadog?.apiKey) {
                tracerConfig.url = `https://trace.agent.${this.config.datadog.site || 'datadoghq.com'}`;
                tracerConfig.site = this.config.datadog.site;
                process.env.DD_API_KEY = this.config.datadog.apiKey;
            }

            if (this.config.exporters.includes('jaeger') && this.config.jaeger?.endpoint) {
                tracerConfig.jaeger = {
                    endpoint: this.config.jaeger.endpoint
                };
            }

            // Initialize tracer
            tracer.init(tracerConfig);

            // Set up custom span hooks
            tracer.use('pg', { enabled: true });
            tracer.use('http', { enabled: true });

            this.isInitialized = true;
            this.logger.info('Tracing initialized with exporters', {
                exporters: this.config.exporters,
                sampleRate: this.config.sampleRate
            });

            this.setupShutdownHook();

        } catch (error) {
            this.logger.error('Failed to initialize tracing', error);
            throw error;
        }
    }

    public async trace<T>(
        operationName: string,
        operation: (span: any) => Promise<T>,
        tags: Record<string, any> = {},
        parentSpan?: any
    ): Promise<T> {
        if (!this.isInitialized) {
            return operation({});
        }

        const spanOptions: any = {
            tags: {
                'component': 'vscode-extension',
                'resource.name': operationName,
                'workspaceId': this.getCurrentWorkspaceId(),
                ...tags
            }
        };

        if (parentSpan) {
            spanOptions.childOf = parentSpan;
        }

        const span = tracer.startSpan(operationName, spanOptions);

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

    public createChildSpan(operationName: string, parentSpan: any): any {
        if (!this.isInitialized) return {};
        
        return tracer.startSpan(operationName, {
            childOf: parentSpan,
            tags: {
                'component': 'vscode-extension',
                'resource.name': operationName
            }
        });
    }

    public startSpan(operationName: string, tags: Record<string, any> = {}): any {
        if (!this.isInitialized) return {};
        
        return tracer.startSpan(operationName, {
            tags: {
                'component': 'vscode-extension',
                'resource.name': operationName,
                ...tags
            }
        });
    }

    public async flush(): Promise<void> {
        if (!this.isInitialized) return;
        
        return new Promise((resolve) => {
            (tracer as any).flush(() => {
                this.logger.debug('Tracing buffer flushed');
                resolve();
            });
        });
    }

    private setupShutdownHook(): void {
        const shutdown = async () => {
            this.logger.info('Shutting down tracing');
            await this.flush();
        };

        process.on('beforeExit', shutdown);
        process.on('SIGINT', shutdown);
        process.on('SIGTERM', shutdown);
    }

    public getCurrentWorkspaceId(): string {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        return workspaceFolders && workspaceFolders.length > 0 
            ? workspaceFolders[0].name 
            : 'no-workspace';
    }

    public isTracingEnabled(): boolean {
        return this.isInitialized;
    }

    public getConfig(): TracingConfig {
        return { ...this.config };
    }
}

// Singleton instance
let tracingManager: TracingManager | undefined;

export function getTracingManager(logger?: Logger): TracingManager {
    if (!tracingManager && logger) {
        tracingManager = new TracingManager(logger);
    }
    if (!tracingManager) {
        throw new Error('TracingManager not initialized. Provide logger first.');
    }
    return tracingManager;
}

