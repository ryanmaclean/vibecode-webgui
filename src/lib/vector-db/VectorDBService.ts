import VectorDBConnectionPool from './VectorDBConnectionPool';
import { VectorShardingManager } from './VectorShardingManager';
import { VectorDatabaseConfig } from './vector-db-config';

class VectorDBService {
    private static instance: VectorDBService;
    private connectionPool: VectorDBConnectionPool | null = null;
    private shardingManager: VectorShardingManager | null = null;
    private config: VectorDatabaseConfig;

    private constructor() {
        this.config = {
            user: process.env.POSTGRES_USER || 'postgres',
            host: process.env.POSTGRES_HOST || 'localhost',
            database: process.env.POSTGRES_DB || 'vibecode',
            password: process.env.POSTGRES_PASSWORD || 'password',
            port: parseInt(process.env.POSTGRES_PORT || '5432'),
            pool: {
                min: parseInt(process.env.CONNECTION_POOL_MIN_CONNECTIONS || '2'),
                max: parseInt(process.env.CONNECTION_POOL_MAX_CONNECTIONS || '10'),
                idleTimeoutMillis: parseInt(process.env.CONNECTION_POOL_IDLE_TIMEOUT || '30000'),
                connectionTimeoutMillis: parseInt(process.env.CONNECTION_POOL_ACQUIRE_TIMEOUT || '2000'),
            }
        };
    }

    static getInstance(): VectorDBService {
        if (!VectorDBService.instance) {
            VectorDBService.instance = new VectorDBService();
        }
        return VectorDBService.instance;
    }

    getConnectionPool(): VectorDBConnectionPool {
        if (!this.connectionPool) {
            this.connectionPool = new VectorDBConnectionPool(this.config);
        }
        return this.connectionPool;
    }

    getShardingManager(): VectorShardingManager {
        if (!this.shardingManager) {
            this.shardingManager = new VectorShardingManager();
            // Initialize with default shard if no sharding is configured
            this.initializeDefaultShard();
        }
        return this.shardingManager;
    }

    private initializeDefaultShard(): void {
        if (this.shardingManager && process.env.USE_SHARDING !== 'true') {
            const defaultShard = {
                id: 'default',
                connectionString: this.buildConnectionString(),
                weight: 1,
                isHealthy: true,
                totalDocuments: 0,
                lastHealthCheck: new Date()
            };
            
            this.shardingManager.addShard(defaultShard);
        }
    }

    private buildConnectionString(): string {
        const { user, password, host, port, database } = this.config;
        return `postgresql://${user}:${password}@${host}:${port}/${database}`;
    }

    async healthCheck(): Promise<{
        connectionPool: boolean;
        sharding: boolean;
        latency: number;
        metrics: any;
    }> {
        const startTime = Date.now();
        
        const poolHealth = await this.getConnectionPool().checkHealth();
        const shardingHealth = await this.checkShardingHealth();
        const metrics = this.getConnectionPool().getMetrics();
        
        return {
            connectionPool: poolHealth,
            sharding: shardingHealth,
            latency: Date.now() - startTime,
            metrics
        };
    }

    private async checkShardingHealth(): Promise<boolean> {
        if (!this.shardingManager) return true;
        
        try {
            const shardHealth = await this.shardingManager.getShardHealth();
            return Array.from(shardHealth.values()).some(health => health);
        } catch {
            return false;
        }
    }

    async close(): Promise<void> {
        if (this.connectionPool) {
            await this.connectionPool.close();
            this.connectionPool = null;
        }
        
        if (this.shardingManager) {
            await this.shardingManager.close();
            this.shardingManager = null;
        }
    }
}

export const vectorDBService = VectorDBService.getInstance();
export default VectorDBService;