export interface ShardInfo {
    id: string;
    connectionString: string;
    weight: number;
    isHealthy: boolean;
    totalDocuments: number;
    lastHealthCheck: Date;
}

export interface VectorQuery {
    vector: number[];
    k: number;
    threshold?: number;
    filters?: Record<string, any>;
    collection?: string;
}

export interface VectorQueryResult {
    id: string;
    score: number;
    metadata: Record<string, any>;
    vector?: number[];
}

export interface ShardedQueryResult {
    results: VectorQueryResult[];
    totalResults: number;
    queryTime: number;
    shardsQueried: string[];
}

export interface ConsistentHashNode {
    id: string;
    hash: number;
    shard: ShardInfo;
}