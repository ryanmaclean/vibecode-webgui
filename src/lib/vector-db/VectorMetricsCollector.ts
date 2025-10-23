// import { logger } from '@/lib/logger';


interface VectorMetrics {
    searchLatency: {
        avg: number;
        p95: number;
        p99: number;
    };
    embeddingGeneration: {
        count: number;
        duration: number;
        errors: number;
    };
    indexPerformance: {
        searchTime: number;
        recallRate: number;
        indexSize: number;
    };
    shardHealth: {
        totalShards: number;
        healthyShards: number;
        unhealthyShards: string[];
    };
    storageMetrics: {
        totalDocuments: number;
        totalSize: number;
        avgDocumentSize: number;
    };
}

export class VectorMetricsCollector {
    private metrics: VectorMetrics;
    private searchTimes: number[] = [];
    private embeddingTimes: number[] = [];

    constructor() {
        this.metrics = {
            searchLatency: { avg: 0, p95: 0, p99: 0 },
            embeddingGeneration: { count: 0, duration: 0, errors: 0 },
            indexPerformance: { searchTime: 0, recallRate: 0, indexSize: 0 },
            shardHealth: { totalShards: 0, healthyShards: 0, unhealthyShards: [] },
            storageMetrics: { totalDocuments: 0, totalSize: 0, avgDocumentSize: 0 }
        };
    }

    recordVectorSearch(duration: number): void {
        this.searchTimes.push(duration);
        
        // Keep only last 1000 measurements for performance
        if (this.searchTimes.length > 1000) {
            this.searchTimes = this.searchTimes.slice(-1000);
        }
        
        this.updateSearchLatencyMetrics();
    }

    recordEmbeddingGeneration(duration: number, success: boolean = true): void {
        this.metrics.embeddingGeneration.count++;
        this.embeddingTimes.push(duration);
        
        if (!success) {
            this.metrics.embeddingGeneration.errors++;
        }
        
        // Keep only last 500 measurements
        if (this.embeddingTimes.length > 500) {
            this.embeddingTimes = this.embeddingTimes.slice(-500);
        }
        
        this.updateEmbeddingMetrics();
    }

    updateShardHealth(totalShards: number, healthyShards: number, unhealthyShards: string[]): void {
        this.metrics.shardHealth = {
            totalShards,
            healthyShards,
            unhealthyShards
        };
    }

    updateStorageMetrics(totalDocuments: number, totalSize: number): void {
        this.metrics.storageMetrics = {
            totalDocuments,
            totalSize,
            avgDocumentSize: totalDocuments > 0 ? totalSize / totalDocuments : 0
        };
    }

    private updateSearchLatencyMetrics(): void {
        if (this.searchTimes.length === 0) return;
        
        const sorted = [...this.searchTimes].sort((a, b) => a - b);
        const sum = sorted.reduce((a, b) => a + b, 0);
        
        this.metrics.searchLatency.avg = sum / sorted.length;
        this.metrics.searchLatency.p95 = sorted[Math.floor(sorted.length * 0.95)];
        this.metrics.searchLatency.p99 = sorted[Math.floor(sorted.length * 0.99)];
    }

    private updateEmbeddingMetrics(): void {
        if (this.embeddingTimes.length === 0) return;
        
        const sum = this.embeddingTimes.reduce((a, b) => a + b, 0);
        this.metrics.embeddingGeneration.duration = sum / this.embeddingTimes.length;
    }

    getMetrics(): VectorMetrics {
        return { ...this.metrics };
    }

    getDatadogMetrics(): Record<string, number> {
        return {
            'vector_db.search.duration.avg': this.metrics.searchLatency.avg,
            'vector_db.search.duration.p95': this.metrics.searchLatency.p95,
            'vector_db.search.duration.p99': this.metrics.searchLatency.p99,
            'vector_db.embedding.generation.count': this.metrics.embeddingGeneration.count,
            'vector_db.embedding.generation.duration': this.metrics.embeddingGeneration.duration,
            'vector_db.embedding.generation.errors': this.metrics.embeddingGeneration.errors,
            'vector_db.shard.total': this.metrics.shardHealth.totalShards,
            'vector_db.shard.healthy': this.metrics.shardHealth.healthyShards,
            'vector_db.storage.documents': this.metrics.storageMetrics.totalDocuments,
            'vector_db.storage.size_bytes': this.metrics.storageMetrics.totalSize,
            'vector_db.storage.avg_document_size': this.metrics.storageMetrics.avgDocumentSize
        };
    }

    exportToDatadog(): void {
        const metrics = this.getDatadogMetrics();
        
        // Send metrics to Datadog (would integrate with Datadog client)
        if (process.env.DD_API_KEY) {
            console.log('Sending vector metrics to Datadog:', Object.keys(metrics));
            // Implementation would use Datadog API client here
        }
    }

    reset(): void {
        this.searchTimes = [];
        this.embeddingTimes = [];
        this.metrics = {
            searchLatency: { avg: 0, p95: 0, p99: 0 },
            embeddingGeneration: { count: 0, duration: 0, errors: 0 },
            indexPerformance: { searchTime: 0, recallRate: 0, indexSize: 0 },
            shardHealth: { totalShards: 0, healthyShards: 0, unhealthyShards: [] },
            storageMetrics: { totalDocuments: 0, totalSize: 0, avgDocumentSize: 0 }
        };
    }
}