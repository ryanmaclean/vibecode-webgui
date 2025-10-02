import { Pool, PoolClient, QueryResult } from 'pg';
import { VectorDatabaseConfig } from '@/lib/vector-db/vector-db-config';

interface PoolMetrics {
    totalConnections: number;
    idleConnections: number;
    waitingClients: number;
    queriesExecuted: number;
    totalQueryTime: number;
    averageQueryTime: number;
    failedQueries: number;
    connectionFailures: number;
    lastHealthCheck: Date;
    healthStatus: 'healthy' | 'degraded' | 'unhealthy';
}

interface ConnectionValidationResult {
    isValid: boolean;
    latency: number;
    error?: string;
}

class VectorDBConnectionPool {
    private pool: Pool;
    private metrics: PoolMetrics;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private config: VectorDatabaseConfig;

    constructor(config: VectorDatabaseConfig) {
        this.config = config;
        this.pool = new Pool({
            user: config.user,
            host: config.host,
            database: config.database,
            password: config.password,
            port: config.port,
            min: config.pool?.min ?? 2,
            max: config.pool?.max ?? 10,
            idleTimeoutMillis: config.pool?.idleTimeoutMillis ?? 30000,
            connectionTimeoutMillis: config.pool?.connectionTimeoutMillis ?? 2000,
        });

        this.metrics = {
            totalConnections: 0,
            idleConnections: 0,
            waitingClients: 0,
            queriesExecuted: 0,
            totalQueryTime: 0,
            averageQueryTime: 0,
            failedQueries: 0,
            connectionFailures: 0,
            lastHealthCheck: new Date(),
            healthStatus: 'healthy'
        };

        this.setupEventHandlers();
        this.startHealthMonitoring();
    }

    private setupEventHandlers(): void {
        this.pool.on('connect', () => {
            this.metrics.totalConnections++;
        });

        this.pool.on('acquire', () => {
            this.updatePoolMetrics();
        });

        this.pool.on('error', (err) => {
            console.error('Pool error:', err);
            this.metrics.connectionFailures++;
            this.metrics.healthStatus = 'degraded';
        });

        this.pool.on('remove', () => {
            this.metrics.totalConnections--;
        });
    }

    private startHealthMonitoring(): void {
        this.healthCheckInterval = setInterval(async () => {
            await this.performHealthCheck();
        }, 30000); // Check every 30 seconds
    }

    private async performHealthCheck(): Promise<void> {
        const validation = await this.validateConnection();
        this.metrics.lastHealthCheck = new Date();
        
        if (!validation.isValid) {
            this.metrics.healthStatus = 'unhealthy';
        } else if (validation.latency > 500) {
            this.metrics.healthStatus = 'degraded';
        } else {
            this.metrics.healthStatus = 'healthy';
        }
    }

    private updatePoolMetrics(): void {
        this.metrics.totalConnections = this.pool.totalCount;
        this.metrics.idleConnections = this.pool.idleCount;
        this.metrics.waitingClients = this.pool.waitingCount;
    }

    async validateConnection(): Promise<ConnectionValidationResult> {
        const startTime = Date.now();
        try {
            const client = await this.pool.connect();
            await client.query('SELECT 1');
            client.release();
            const latency = Date.now() - startTime;
            return { isValid: true, latency };
        } catch (error) {
            const latency = Date.now() - startTime;
            return { 
                isValid: false, 
                latency, 
                error: error instanceof Error ? error.message : 'Unknown error' 
            };
        }
    }

    async adaptPoolSize(): Promise<void> {
        const currentLoad = this.metrics.waitingClients;
        const totalConnections = this.metrics.totalConnections;
        const maxConnections = this.config.pool?.max ?? 10;
        
        if (currentLoad > totalConnections * 0.8 && totalConnections < maxConnections) {
            // Scale up if load is high and we haven't reached max
            console.log('High load detected, pool will auto-scale up');
        } else if (currentLoad === 0 && this.metrics.idleConnections > (this.config.pool?.min ?? 2)) {
            // Scale down if no waiting clients and many idle connections
            console.log('Low load detected, pool will naturally scale down');
        }
    }

    getMetrics(): PoolMetrics {
        this.updatePoolMetrics();
        if (this.metrics.queriesExecuted > 0) {
            this.metrics.averageQueryTime = this.metrics.totalQueryTime / this.metrics.queriesExecuted;
        }
        return { ...this.metrics };
    }

    async query(text: string, params: any[]): Promise<QueryResult> {
        const startTime = Date.now();
        const client = await this.pool.connect();
        try {
            const result = await client.query(text, params);
            this.metrics.queriesExecuted++;
            this.metrics.totalQueryTime += Date.now() - startTime;
            return result;
        } catch (error) {
            this.metrics.failedQueries++;
            throw error;
        } finally {
            client.release();
        }
    }

    async checkHealth(): Promise<boolean> {
        const validation = await this.validateConnection();
        return validation.isValid;
    }

    async getClient(): Promise<PoolClient> {
        return this.pool.connect();
    }

    async close(): Promise<void> {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        await this.pool.end();
    }
}

export default VectorDBConnectionPool;
