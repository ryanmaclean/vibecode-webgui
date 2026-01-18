import { ConsistentHashRing } from './ConsistentHashRing';
import { ShardInfo, VectorQuery, VectorQueryResult, ShardedQueryResult } from './sharding-types';
import VectorDBConnectionPool from './VectorDBConnectionPool';
// import { logger } from '@/lib/logger';
export class VectorShardingManager {
    private shardMap: Map<string, ShardInfo>;
    private consistentHashRing: ConsistentHashRing;
    private connectionPools: Map<string, VectorDBConnectionPool>;

    constructor() {
        this.shardMap = new Map();
        this.consistentHashRing = new ConsistentHashRing();
        this.connectionPools = new Map();
    }

    addShard(shard: ShardInfo): void {
        this.shardMap.set(shard.id, shard);
        this.consistentHashRing.addShard(shard);
        
        // Create connection pool for this shard
        const config = this.parseConnectionString(shard.connectionString);
        const pool = new VectorDBConnectionPool(config);
        this.connectionPools.set(shard.id, pool);
    }

    removeShard(shardId: string): void {
        this.shardMap.delete(shardId);
        this.consistentHashRing.removeShard(shardId);
        
        const pool = this.connectionPools.get(shardId);
        if (pool) {
            pool.close();
            this.connectionPools.delete(shardId);
        }
    }

    getShardForVector(vectorId: string): ShardInfo | null {
        return this.consistentHashRing.getShardForKey(vectorId);
    }

    async executeShardedQuery(query: VectorQuery): Promise<ShardedQueryResult> {
        const startTime = Date.now();
        const healthyShards = this.consistentHashRing.getHealthyShards();
        
        if (healthyShards.length === 0) {
            throw new Error('No healthy shards available');
        }

        const shardQueries = healthyShards.map(shard => 
            this.executeOnShard(query, shard)
        );

        const results = await Promise.allSettled(shardQueries);
        const successfulResults: VectorQueryResult[] = [];
        const queriedShards: string[] = [];

        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const shard = healthyShards[i];
            
            if (result.status === 'fulfilled') {
                successfulResults.push(...result.value);
                queriedShards.push(shard.id);
            } else {
                console.error(`Query failed on shard ${shard.id}:`, result.reason);
            }
        }

        const mergedResults = this.mergeAndRankResults(successfulResults, query.k);
        
        return {
            results: mergedResults,
            totalResults: successfulResults.length,
            queryTime: Date.now() - startTime,
            shardsQueried: queriedShards
        };
    }

    private async executeOnShard(query: VectorQuery, shard: ShardInfo): Promise<VectorQueryResult[]> {
        const pool = this.connectionPools.get(shard.id);
        if (!pool) {
            throw new Error(`No connection pool found for shard ${shard.id}`);
        }

        const client = await pool.getClient();
        try {
            const queryText = this.buildVectorQuery(query);
            const result = await client.query(queryText, [query.vector, query.k]);
            
            return result.rows.map(row => ({
                id: row.id,
                score: row.similarity_score,
                metadata: row.metadata,
                vector: row.embedding
            }));
        } finally {
            client.release();
        }
    }

    private buildVectorQuery(query: VectorQuery): string {
        let sql = `
            SELECT id, metadata, embedding, 
                   1 - (embedding <=> $1::vector) as similarity_score
            FROM vector_embeddings
        `;
        
        if (query.filters) {
            const filterConditions = Object.keys(query.filters)
                .map(key => `metadata->>'${key}' = '${query.filters![key]}'`)
                .join(' AND ');
            sql += ` WHERE ${filterConditions}`;
        }
        
        if (query.threshold) {
            const whereClause = query.filters ? ' AND' : ' WHERE';
            sql += `${whereClause} (1 - (embedding <=> $1::vector)) >= ${query.threshold}`;
        }
        
        sql += ` ORDER BY embedding <=> $1::vector LIMIT $2`;
        
        return sql;
    }

    private mergeAndRankResults(results: VectorQueryResult[], k: number): VectorQueryResult[] {
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, k);
    }

    private parseConnectionString(connectionString: string) {
        const url = new URL(connectionString);
        return {
            user: url.username,
            password: url.password,
            host: url.hostname,
            port: parseInt(url.port) || 5432,
            database: url.pathname.slice(1),
            pool: {
                min: 2,
                max: 10,
                idleTimeoutMillis: 30000,
                connectionTimeoutMillis: 2000,
            }
        };
    }

    async rebalanceShards(): Promise<void> {
        const shards = this.consistentHashRing.getAllShards();
        
        for (const shard of shards) {
            const pool = this.connectionPools.get(shard.id);
            if (pool) {
                const metrics = pool.getMetrics();
                
                if (metrics.healthStatus === 'unhealthy') {
                    console.warn(`Shard ${shard.id} is unhealthy, marking for rebalancing`);
                    shard.isHealthy = false;
                } else {
                    shard.isHealthy = true;
                }
            }
        }
    }

    async getShardHealth(): Promise<Map<string, boolean>> {
        const healthMap = new Map<string, boolean>();
        
        for (const [shardId, pool] of this.connectionPools) {
            const isHealthy = await pool.checkHealth();
            healthMap.set(shardId, isHealthy);
            
            const shard = this.shardMap.get(shardId);
            if (shard) {
                shard.isHealthy = isHealthy;
                shard.lastHealthCheck = new Date();
            }
        }
        
        return healthMap;
    }

    getShardMetrics(): Map<string, any> {
        const metricsMap = new Map();
        
        for (const [shardId, pool] of this.connectionPools) {
            metricsMap.set(shardId, pool.getMetrics());
        }
        
        return metricsMap;
    }

    async close(): Promise<void> {
        for (const pool of this.connectionPools.values()) {
            await pool.close();
        }
        this.connectionPools.clear();
    }
}