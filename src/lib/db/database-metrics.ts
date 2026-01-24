/**
 * Global state interface for tracking application start time
 */
interface GlobalWithStartTime {
    __startTime?: number;
}

export interface DatabaseMetrics {
    connectionPool: {
        totalConnections: number;
        activeConnections: number;
        idleConnections: number;
        waitingClients: number;
        maxConnections: number;
    };
    queryPerformance: {
        totalQueries: number;
        averageQueryTime: number;
        slowQueries: number;
        failedQueries: number;
    };
    vectorOperations: {
        embeddingInserts: number;
        similaritySearches: number;
        vectorIndexSize: number;
        avgEmbeddingTime: number;
    };
    systemHealth: {
        diskUsage: number;
        memoryUsage: number;
        cpuUsage: number;
        uptime: number;
    };
}

class MetricsCollector {
    private connectionMetrics = {
        totalConnections: 0,
        activeConnections: 0,
        maxConnections: 0
    };

    private vectorOperationMetrics = {
        embeddingInserts: 0,
        similaritySearches: 0,
        vectorIndexSize: 0,
        totalEmbeddingTime: 0,
        embeddingCount: 0,
        searchQueries: [] as number[],
        failedOperations: 0,
        cacheHits: 0,
        cacheMisses: 0,
        providerSwitches: 0
    };

    private queryMetrics = {
        totalQueries: 0,
        queryTimes: [] as number[],
        slowQueries: 0,
        failedQueries: 0
    };

    setConnectionMetrics(total: number, active: number, max: number): void {
        this.connectionMetrics = { totalConnections: total, activeConnections: active, maxConnections: max };
    }

    // Track vector operations from EnhancedVectorStore
    recordVectorSearch(_provider: 'pgvector' | 'weaviate', queryTime: number, _resultCount: number, cacheHit: boolean): void {
        this.vectorOperationMetrics.similaritySearches++;
        this.vectorOperationMetrics.searchQueries.push(queryTime);
        
        if (cacheHit) {
            this.vectorOperationMetrics.cacheHits++;
        } else {
            this.vectorOperationMetrics.cacheMisses++;
        }

        // Keep only last 100 measurements for performance
        if (this.vectorOperationMetrics.searchQueries.length > 100) {
            this.vectorOperationMetrics.searchQueries.shift();
        }
    }

    recordVectorStore(documents: number, _provider: 'pgvector' | 'weaviate', duration: number): void {
        this.vectorOperationMetrics.embeddingInserts += documents;
        this.vectorOperationMetrics.vectorIndexSize += documents;
        this.vectorOperationMetrics.totalEmbeddingTime += duration;
        this.vectorOperationMetrics.embeddingCount++;
    }

    recordProviderSwitch(_from: 'pgvector' | 'weaviate', _to: 'pgvector' | 'weaviate'): void {
        this.vectorOperationMetrics.providerSwitches++;
    }

    recordVectorError(_operation: 'search' | 'store' | 'delete'): void {
        this.vectorOperationMetrics.failedOperations++;
    }

    recordQuery(queryTime: number, isSlowQuery: boolean = false): void {
        this.queryMetrics.totalQueries++;
        this.queryMetrics.queryTimes.push(queryTime);
        
        if (isSlowQuery) {
            this.queryMetrics.slowQueries++;
        }

        // Keep only last 100 measurements
        if (this.queryMetrics.queryTimes.length > 100) {
            this.queryMetrics.queryTimes.shift();
        }
    }

    recordQueryError(): void {
        this.queryMetrics.failedQueries++;
    }

    private getAverageQueryTime(): number {
        if (this.queryMetrics.queryTimes.length === 0) return 0;
        return this.queryMetrics.queryTimes.reduce((sum, time) => sum + time, 0) / this.queryMetrics.queryTimes.length;
    }

    private getAverageEmbeddingTime(): number {
        if (this.vectorOperationMetrics.embeddingCount === 0) return 0;
        return this.vectorOperationMetrics.totalEmbeddingTime / this.vectorOperationMetrics.embeddingCount;
    }

    private getAverageSearchTime(): number {
        if (this.vectorOperationMetrics.searchQueries.length === 0) return 0;
        return this.vectorOperationMetrics.searchQueries.reduce((sum, time) => sum + time, 0) / this.vectorOperationMetrics.searchQueries.length;
    }

    getCacheEfficiency(): number {
        const total = this.vectorOperationMetrics.cacheHits + this.vectorOperationMetrics.cacheMisses;
        if (total === 0) return 0;
        return (this.vectorOperationMetrics.cacheHits / total) * 100;
    }

    getProviderSwitchRate(): number {
        if (this.vectorOperationMetrics.similaritySearches === 0) return 0;
        return (this.vectorOperationMetrics.providerSwitches / this.vectorOperationMetrics.similaritySearches) * 100;
    }

    getMetrics(): DatabaseMetrics {
        return {
            connectionPool: {
                totalConnections: this.connectionMetrics.totalConnections,
                activeConnections: this.connectionMetrics.activeConnections,
                idleConnections: this.connectionMetrics.totalConnections - this.connectionMetrics.activeConnections,
                waitingClients: 0,
                maxConnections: this.connectionMetrics.maxConnections
            },
            queryPerformance: {
                totalQueries: this.queryMetrics.totalQueries,
                averageQueryTime: Math.round(this.getAverageQueryTime()),
                slowQueries: this.queryMetrics.slowQueries,
                failedQueries: this.queryMetrics.failedQueries
            },
            vectorOperations: {
                embeddingInserts: this.vectorOperationMetrics.embeddingInserts,
                similaritySearches: this.vectorOperationMetrics.similaritySearches,
                vectorIndexSize: this.vectorOperationMetrics.vectorIndexSize,
                avgEmbeddingTime: Math.round(this.getAverageEmbeddingTime())
            },
            systemHealth: {
                diskUsage: 65.4, // Would need OS integration for real values
                memoryUsage: 72.1,
                cpuUsage: 45.2,
                uptime: Date.now() - ((global as GlobalWithStartTime).__startTime ?? (Date.now() - 86400))
            }
        };
    }

    // Additional metrics for enhanced monitoring
    getVectorMetrics() {
        return {
            cacheEfficiency: this.getCacheEfficiency(),
            providerSwitchRate: this.getProviderSwitchRate(),
            averageSearchTime: Math.round(this.getAverageSearchTime()),
            failedOperations: this.vectorOperationMetrics.failedOperations,
            totalSearches: this.vectorOperationMetrics.similaritySearches,
            totalStores: this.vectorOperationMetrics.embeddingInserts
        };
    }
}

const globalMetricsCollector = new MetricsCollector();

export function getMetricsCollector(): MetricsCollector {
    return globalMetricsCollector;
}

export async function collectDatabaseMetrics(): Promise<DatabaseMetrics> {
    // This would collect real metrics from the database
    return {
        connectionPool: {
            totalConnections: 10,
            activeConnections: 5,
            idleConnections: 5,
            waitingClients: 0,
            maxConnections: 20
        },
        queryPerformance: {
            totalQueries: 1250,
            averageQueryTime: 45,
            slowQueries: 12,
            failedQueries: 3
        },
        vectorOperations: {
            embeddingInserts: 450,
            similaritySearches: 230,
            vectorIndexSize: 1500000,
            avgEmbeddingTime: 120
        },
        systemHealth: {
            diskUsage: 65.4,
            memoryUsage: 72.1,
            cpuUsage: 45.2,
            uptime: 86400
        }
    };
}