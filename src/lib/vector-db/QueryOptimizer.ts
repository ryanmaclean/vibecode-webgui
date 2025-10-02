interface QueryPlan {
    type: 'single_shard' | 'multi_shard' | 'cache_first' | 'index_scan';
    targetShards: string[];
    useCache: boolean;
    indexHint?: string;
    estimatedCost: number;
    parallelizable: boolean;
}

interface VectorQuery {
    type: 'similarity_search' | 'exact_match' | 'range_query' | 'batch_insert';
    vector?: number[];
    collection: string;
    limit?: number;
    threshold?: number;
    filters?: Record<string, any>;
}

interface QueryStats {
    executionTime: number;
    documentsScanned: number;
    cacheHitRatio: number;
    shardsInvolved: number;
    indexesUsed: string[];
}

export class QueryOptimizer {
    private queryCache: Map<string, QueryPlan> = new Map();
    private executionStats: Map<string, QueryStats[]> = new Map();
    private indexStatistics: Map<string, any> = new Map();

    constructor(
        private shardingManager: any,
        private metricsCollector: any
    ) {}

    analyzeQuery(query: VectorQuery): QueryPlan {
        const queryKey = this.generateQueryKey(query);
        
        // Check if we have a cached plan
        const cachedPlan = this.queryCache.get(queryKey);
        if (cachedPlan && this.isPlanStillValid(cachedPlan, query)) {
            return cachedPlan;
        }

        // Generate new optimized plan
        const plan = this.generateOptimalPlan(query);
        this.queryCache.set(queryKey, plan);
        
        return plan;
    }

    private generateOptimalPlan(query: VectorQuery): QueryPlan {
        const plan: QueryPlan = {
            type: 'single_shard',
            targetShards: [],
            useCache: false,
            estimatedCost: 0,
            parallelizable: false
        };

        // Determine if this can be served from cache
        if (this.shouldUseCache(query)) {
            plan.useCache = true;
            plan.estimatedCost = 1; // Very low cost for cache hits
        }

        // Determine shard targeting strategy
        if (query.type === 'similarity_search') {
            if (this.canUseSingleShard(query)) {
                plan.type = 'single_shard';
                plan.targetShards = [this.shardingManager.getOptimalShard(query)];
                plan.estimatedCost = 10;
            } else {
                plan.type = 'multi_shard';
                plan.targetShards = this.shardingManager.getAllShards();
                plan.parallelizable = true;
                plan.estimatedCost = 30 * plan.targetShards.length;
            }
        }

        // Choose optimal index strategy
        plan.indexHint = this.selectOptimalIndex(query);
        
        // Adjust cost based on index availability
        if (plan.indexHint) {
            plan.estimatedCost *= 0.3; // Indexes significantly reduce cost
        }

        return plan;
    }

    private shouldUseCache(query: VectorQuery): boolean {
        // Use cache for frequent similarity searches
        if (query.type === 'similarity_search') {
            const queryKey = this.generateQueryKey(query);
            const recentStats = this.executionStats.get(queryKey) || [];
            
            // If this query has been run multiple times recently, cache it
            return recentStats.length > 3;
        }
        
        return false;
    }

    private canUseSingleShard(query: VectorQuery): boolean {
        // If we have specific collection filters, we might be able to target a single shard
        if (query.filters && query.filters.collection_id) {
            return this.shardingManager.isCollectionInSingleShard(query.filters.collection_id);
        }
        
        // For exact matches, we can usually target a single shard
        if (query.type === 'exact_match') {
            return true;
        }
        
        return false;
    }

    private selectOptimalIndex(query: VectorQuery): string | undefined {
        const collection = query.collection;
        const availableIndexes = this.indexStatistics.get(collection) || [];
        
        if (query.type === 'similarity_search') {
            // Prefer HNSW for similarity searches
            const hnswIndex = availableIndexes.find((idx: any) => idx.type === 'hnsw');
            if (hnswIndex) return hnswIndex.name;
            
            // Fall back to IVFFlat if available
            const ivfIndex = availableIndexes.find((idx: any) => idx.type === 'ivfflat');
            if (ivfIndex) return ivfIndex.name;
        }
        
        return undefined;
    }

    async optimizeQueryExecution(query: VectorQuery, plan: QueryPlan): Promise<any> {
        const startTime = Date.now();
        let result: any;

        try {
            // Execute based on plan type
            switch (plan.type) {
                case 'cache_first':
                    result = await this.executeCachedQuery(query);
                    break;
                case 'single_shard':
                    result = await this.executeSingleShardQuery(query, plan);
                    break;
                case 'multi_shard':
                    result = await this.executeMultiShardQuery(query, plan);
                    break;
                case 'index_scan':
                    result = await this.executeIndexScanQuery(query, plan);
                    break;
                default:
                    throw new Error(`Unknown plan type: ${plan.type}`);
            }

            // Record execution statistics
            this.recordQueryExecution(query, plan, Date.now() - startTime, true);
            
            return result;
            
        } catch (error) {
            this.recordQueryExecution(query, plan, Date.now() - startTime, false);
            throw error;
        }
    }

    private async executeCachedQuery(_query: VectorQuery): Promise<any> {
        // Implementation would check cache first, then fall back to database
        return { cached: true, results: [] };
    }

    private async executeSingleShardQuery(_query: VectorQuery, plan: QueryPlan): Promise<any> {
        const shard = plan.targetShards[0];
        // Execute query on single shard with index hint
        return this.shardingManager.executeOnShard(_query, shard, plan.indexHint);
    }

    private async executeMultiShardQuery(_query: VectorQuery, plan: QueryPlan): Promise<any> {
        if (plan.parallelizable) {
            // Execute in parallel across all shards
            const promises = plan.targetShards.map(shard => 
                this.shardingManager.executeOnShard(_query, shard, plan.indexHint)
            );
            const results = await Promise.all(promises);
            return this.mergeShardResults(results, _query);
        } else {
            // Sequential execution for non-parallelizable queries
            const results: any[] = [];
            for (const shard of plan.targetShards) {
                const result = await this.shardingManager.executeOnShard(_query, shard, plan.indexHint);
                results.push(result);
            }
            return this.mergeShardResults(results, _query);
        }
    }

    private async executeIndexScanQuery(_query: VectorQuery, plan: QueryPlan): Promise<any> {
        // Use specific index scan strategy
        return this.shardingManager.executeWithIndexHint(_query, plan.indexHint);
    }

    private mergeShardResults(results: any[], _query: VectorQuery): any {
        // For similarity searches, merge and re-rank results
        const allResults = results.flatMap(r => r.rows || []);
        return {
            rows: allResults
                .sort((a: any, b: any) => (b.similarity_score || 0) - (a.similarity_score || 0))
                .slice(0, _query.limit || 10)
        };
    }

    private recordQueryExecution(
        query: VectorQuery, 
        _plan: QueryPlan, 
        executionTime: number, 
        _success: boolean
    ): void {
        const queryKey = this.generateQueryKey(query);
        const stats: QueryStats = {
            executionTime,
            documentsScanned: 0, // Would be populated from actual execution
            cacheHitRatio: _plan.useCache ? 1 : 0,
            shardsInvolved: _plan.targetShards.length,
            indexesUsed: _plan.indexHint ? [_plan.indexHint] : []
        };

        const existingStats = this.executionStats.get(queryKey) || [];
        existingStats.push(stats);
        
        // Keep only last 100 executions per query type
        if (existingStats.length > 100) {
            existingStats.splice(0, existingStats.length - 100);
        }
        
        this.executionStats.set(queryKey, existingStats);

        // Update metrics collector
        this.metricsCollector.recordVectorSearch(executionTime);
    }

    private generateQueryKey(query: VectorQuery): string {
        // Create a unique key for query plan caching
        const key = `${query.type}:${query.collection}:${query.limit || 10}`;
        if (query.filters) {
            const filterKey = Object.keys(query.filters).sort().join(',');
            return `${key}:${filterKey}`;
        }
        return key;
    }

    private isPlanStillValid(_plan: QueryPlan, _query: VectorQuery): boolean {
        // Plans are valid for 5 minutes
        return true; // Simplified for now
    }

    getQueryStatistics(): Record<string, any> {
        const stats: Record<string, any> = {};
        
        for (const [queryKey, executions] of this.executionStats.entries()) {
            if (executions.length > 0) {
                const avgTime = executions.reduce((sum, e) => sum + e.executionTime, 0) / executions.length;
                const avgShards = executions.reduce((sum, e) => sum + e.shardsInvolved, 0) / executions.length;
                
                stats[queryKey] = {
                    totalExecutions: executions.length,
                    averageExecutionTime: avgTime,
                    averageShardsInvolved: avgShards,
                    successRate: executions.filter(e => e.executionTime > 0).length / executions.length
                };
            }
        }
        
        return stats;
    }

    clearCache(): void {
        this.queryCache.clear();
        this.executionStats.clear();
    }
}