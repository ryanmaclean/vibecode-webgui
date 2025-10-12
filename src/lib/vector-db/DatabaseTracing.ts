import { logger } from '@/lib/logger';

interface TraceSpan {
    traceId: string;
    spanId: string;
    operationName: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    tags: Record<string, any>;
    status: 'pending' | 'success' | 'error';
    error?: string;
}

interface DatabaseOperation {
    type: 'query' | 'insert' | 'update' | 'delete' | 'vector_search';
    sql: string;
    parameters: any[];
    connection: string;
    shard?: string;
}

export class DatabaseTracing {
    private activeSpans: Map<string, TraceSpan> = new Map();
    private completedSpans: TraceSpan[] = [];
    private traceConfig = {
        sampleRate: 0.1, // Sample 10% of operations
        maxSpans: 1000,
        enableSlowQueryTracing: true,
        slowQueryThreshold: 500 // ms
    };

    startTrace(operation: DatabaseOperation): string {
        const traceId = this.generateTraceId();
        const spanId = this.generateSpanId();
        
        // Only trace if sampling allows it
        if (Math.random() > this.traceConfig.sampleRate && !this.shouldForceTrace(operation)) {
            return traceId; // Return trace ID but don't actually trace
        }

        const span: TraceSpan = {
            traceId,
            spanId,
            operationName: `db.${operation.type}`,
            startTime: Date.now(),
            status: 'pending',
            tags: {
                'db.type': 'postgresql',
                'db.operation': operation.type,
                'db.connection': operation.connection,
                'db.shard': operation.shard,
                'db.sql': this.sanitizeSql(operation.sql),
                'db.parameter_count': operation.parameters.length
            }
        };

        this.activeSpans.set(traceId, span);
        return traceId;
    }

    finishTrace(traceId: string, error?: Error): void {
        const span = this.activeSpans.get(traceId);
        if (!span) return;

        span.endTime = Date.now();
        span.duration = span.endTime - span.startTime;
        span.status = error ? 'error' : 'success';
        
        if (error) {
            span.error = error.message;
            span.tags['error'] = true;
            span.tags['error.message'] = error.message;
        }

        // Add performance tags
        span.tags['duration_ms'] = span.duration;
        if (span.duration > this.traceConfig.slowQueryThreshold) {
            span.tags['slow_query'] = true;
        }

        // Move to completed spans
        this.activeSpans.delete(traceId);
        this.completedSpans.push(span);

        // Limit memory usage
        if (this.completedSpans.length > this.traceConfig.maxSpans) {
            this.completedSpans.splice(0, 100); // Remove oldest 100 spans
        }

        // Send to external tracing systems if configured
        this.exportTrace(span);
    }

    private shouldForceTrace(operation: DatabaseOperation): boolean {
        // Always trace vector searches and slow operations
        return operation.type === 'vector_search' || 
               operation.sql.toLowerCase().includes('embedding');
    }

    private sanitizeSql(sql: string): string {
        // Remove sensitive data from SQL for tracing
        return sql
            .replace(/password\s*=\s*'[^']*'/gi, "password='***'")
            .replace(/\$\d+/g, '?') // Replace parameter placeholders
            .trim();
    }

    private generateTraceId(): string {
        return `trace_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    private generateSpanId(): string {
        return `span_${Math.random().toString(36).substring(2, 11)}`;
    }

    private exportTrace(span: TraceSpan): void {
        // Export to Datadog APM
        if (process.env.DD_API_KEY) {
            this.exportToDatadog(span);
        }

        // Export to OpenTelemetry if configured
        if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
            this.exportToOpenTelemetry(span);
        }

        // Log slow queries
        if (span.tags.slow_query) {
            logger.warn('Slow database query detected:', {
                traceId: span.traceId,
                duration: span.duration,
                operation: span.operationName,
                sql: span.tags['db.sql']
            });
        }
    }

    private exportToDatadog(span: TraceSpan): void {
        // Convert span to Datadog trace format
        const datadogSpan = {
            trace_id: span.traceId,
            span_id: span.spanId,
            name: span.operationName,
            resource: span.tags['db.sql'],
            service: 'vector-database',
            type: 'db',
            start: span.startTime * 1000000, // nanoseconds
            duration: (span.duration || 0) * 1000000, // nanoseconds
            error: span.status === 'error' ? 1 : 0,
            meta: span.tags,
            metrics: {
                'db.duration': span.duration || 0
            }
        };

        // Send to Datadog (would use actual Datadog client)
        logger.info('Sending trace to Datadog:', datadogSpan.trace_id);
    }

    private exportToOpenTelemetry(span: TraceSpan): void {
        // Convert to OpenTelemetry format
        const otelSpan = {
            traceId: span.traceId,
            spanId: span.spanId,
            operationName: span.operationName,
            startTime: span.startTime,
            finishTime: span.endTime,
            duration: span.duration,
            tags: span.tags,
            status: span.status
        };

        logger.info('Sending trace to OpenTelemetry:', otelSpan.traceId);
    }

    getActiveTraces(): TraceSpan[] {
        return Array.from(this.activeSpans.values());
    }

    getCompletedTraces(limit: number = 100): TraceSpan[] {
        return this.completedSpans.slice(-limit);
    }

    getSlowQueries(threshold: number = 500): TraceSpan[] {
        return this.completedSpans.filter(span => 
            span.duration && span.duration > threshold
        );
    }

    getTraceStatistics(): Record<string, any> {
        const total = this.completedSpans.length;
        const errors = this.completedSpans.filter(s => s.status === 'error').length;
        const slowQueries = this.getSlowQueries().length;
        
        const durations = this.completedSpans
            .filter(s => s.duration)
            .map(s => s.duration!);
        
        const avgDuration = durations.length > 0 
            ? durations.reduce((a, b) => a + b, 0) / durations.length 
            : 0;

        return {
            totalTraces: total,
            errorRate: total > 0 ? (errors / total) * 100 : 0,
            slowQueryRate: total > 0 ? (slowQueries / total) * 100 : 0,
            averageDuration: avgDuration,
            activeTraces: this.activeSpans.size
        };
    }

    clearTraces(): void {
        this.completedSpans = [];
        this.activeSpans.clear();
    }
}