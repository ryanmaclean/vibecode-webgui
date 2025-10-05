import crypto from 'crypto';
import { ShardInfo, ConsistentHashNode } from './sharding-types';

export class ConsistentHashRing {
    private nodes: ConsistentHashNode[] = [];
    private virtualNodeCount: number;

    constructor(virtualNodeCount: number = 150) {
        this.virtualNodeCount = virtualNodeCount;
    }

    private hash(key: string): number {
        return parseInt(crypto.createHash('md5').update(key).digest('hex').substring(0, 8), 16);
    }

    addShard(shard: ShardInfo): void {
        for (let i = 0; i < this.virtualNodeCount; i++) {
            const virtualNodeId = `${shard.id}:${i}`;
            const hash = this.hash(virtualNodeId);
            
            this.nodes.push({
                id: virtualNodeId,
                hash,
                shard
            });
        }
        
        this.nodes.sort((a, b) => a.hash - b.hash);
    }

    removeShard(shardId: string): void {
        this.nodes = this.nodes.filter(node => !node.id.startsWith(shardId + ':'));
    }

    getShardForKey(key: string): ShardInfo | null {
        if (this.nodes.length === 0) {
            return null;
        }

        const keyHash = this.hash(key);
        
        // Find the first node with hash >= keyHash
        for (const node of this.nodes) {
            if (node.hash >= keyHash) {
                return node.shard;
            }
        }
        
        // If no node found, wrap around to the first node
        return this.nodes[0].shard;
    }

    getHealthyShards(): ShardInfo[] {
        const shardMap = new Map<string, ShardInfo>();
        
        for (const node of this.nodes) {
            if (node.shard.isHealthy) {
                shardMap.set(node.shard.id, node.shard);
            }
        }
        
        return Array.from(shardMap.values());
    }

    getAllShards(): ShardInfo[] {
        const shardMap = new Map<string, ShardInfo>();
        
        for (const node of this.nodes) {
            shardMap.set(node.shard.id, node.shard);
        }
        
        return Array.from(shardMap.values());
    }
}