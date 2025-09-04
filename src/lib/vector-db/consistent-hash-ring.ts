import { createHash } from 'crypto';
import { ShardInfo } from './types';

/**
 * ConsistentHashRing implements a consistent hashing algorithm for distributing
 * vectors across database shards. It ensures that when the number of shards changes,
 * only a minimal amount of data needs to be redistributed.
 */
export class ConsistentHashRing {
  private ring: Map<number, ShardInfo>;
  private sortedKeys: number[];
  private virtualNodeCount: number;

  /**
   * Creates a new ConsistentHashRing
   * @param shards Initial set of shards to populate the ring
   * @param virtualNodeCount Number of virtual nodes per physical shard
   */
  constructor(shards: ShardInfo[] = [], virtualNodeCount = 100) {
    this.ring = new Map<number, ShardInfo>();
    this.sortedKeys = [];
    this.virtualNodeCount = virtualNodeCount;

    // Add all initial shards to the ring
    for (const shard of shards) {
      this.addShard(shard);
    }
  }

  /**
   * Adds a shard to the hash ring
   * @param shard The shard to add
   */
  public addShard(shard: ShardInfo): void {
    for (let i = 0; i < this.virtualNodeCount; i++) {
      const key = this.getHashKey(`${shard.id}-${i}`);
      this.ring.set(key, shard);
    }

    // Update the sorted keys
    this.updateSortedKeys();
  }

  /**
   * Removes a shard from the hash ring
   * @param shardId The ID of the shard to remove
   */
  public removeShard(shardId: string): void {
    // Find and remove all virtual nodes for this shard
    for (let i = 0; i < this.virtualNodeCount; i++) {
      const key = this.getHashKey(`${shardId}-${i}`);
      this.ring.delete(key);
    }

    // Update the sorted keys
    this.updateSortedKeys();
  }

  /**
   * Determines which shard should handle a given key
   * @param key The key to look up
   * @returns The shard that should handle this key, or undefined if the ring is empty
   */
  public getShard(key: string): ShardInfo | undefined {
    if (this.sortedKeys.length === 0) {
      return undefined;
    }

    const hash = this.getHashKey(key);
    
    // Find the first point in the ring with a value >= hash
    let idx = 0;
    while (idx < this.sortedKeys.length && this.sortedKeys[idx] < hash) {
      idx++;
    }

    // If we reached the end of the ring, wrap around to the first node
    if (idx >= this.sortedKeys.length) {
      idx = 0;
    }

    // Return the shard at this position
    return this.ring.get(this.sortedKeys[idx]);
  }

  /**
   * Gets all shards in the ring
   * @returns An array of unique shards
   */
  public getAllShards(): ShardInfo[] {
    const shardMap = new Map<string, ShardInfo>();
    
    for (const shard of this.ring.values()) {
      shardMap.set(shard.id, shard);
    }
    
    return Array.from(shardMap.values());
  }

  /**
   * Gets the number of unique shards in the ring
   * @returns The number of unique shards
   */
  public getShardCount(): number {
    const uniqueShards = new Set<string>();
    
    for (const shard of this.ring.values()) {
      uniqueShards.add(shard.id);
    }
    
    return uniqueShards.size;
  }

  /**
   * Gets multiple shards that would handle a key, useful for read/write operations
   * that need to access multiple replicas
   * @param key The key to look up
   * @param count The number of shards to return
   * @returns An array of shards
   */
  public getShards(key: string, count: number): ShardInfo[] {
    if (this.sortedKeys.length === 0) {
      return [];
    }

    const uniqueShards = new Set<string>();
    const result: ShardInfo[] = [];
    const hash = this.getHashKey(key);
    
    // Find the starting point in the ring
    let idx = 0;
    while (idx < this.sortedKeys.length && this.sortedKeys[idx] < hash) {
      idx++;
    }

    // If we reached the end, wrap around
    if (idx >= this.sortedKeys.length) {
      idx = 0;
    }

    // Collect shards, ensuring we don't include duplicates
    const startIdx = idx;
    while (result.length < count && result.length < this.getShardCount()) {
      const shard = this.ring.get(this.sortedKeys[idx])!;
      
      if (!uniqueShards.has(shard.id)) {
        uniqueShards.add(shard.id);
        result.push(shard);
      }
      
      idx = (idx + 1) % this.sortedKeys.length;
      
      // Break if we've gone all the way around
      if (idx === startIdx) {
        break;
      }
    }
    
    return result;
  }

  /**
   * Computes the distribution of keys across shards
   * @param keyCount Number of sample keys to generate
   * @returns A map of shard IDs to the number of keys they would handle
   */
  public getShardDistribution(keyCount: number): Map<string, number> {
    const distribution = new Map<string, number>();
    
    for (let i = 0; i < keyCount; i++) {
      const key = `sample-key-${i}`;
      const shard = this.getShard(key);
      
      if (shard) {
        const current = distribution.get(shard.id) || 0;
        distribution.set(shard.id, current + 1);
      }
    }
    
    return distribution;
  }

  /**
   * Calculates the standard deviation of the key distribution
   * @param keyCount Number of sample keys to generate
   * @returns The standard deviation as a percentage of the mean
   */
  public getDistributionStandardDeviation(keyCount: number): number {
    const distribution = this.getShardDistribution(keyCount);
    const shardCount = this.getShardCount();
    
    if (shardCount === 0) {
      return 0;
    }
    
    const mean = keyCount / shardCount;
    let sumSquaredDiff = 0;
    
    for (const count of distribution.values()) {
      const diff = count - mean;
      sumSquaredDiff += diff * diff;
    }
    
    const variance = sumSquaredDiff / shardCount;
    const stdDev = Math.sqrt(variance);
    
    // Return as percentage of mean
    return (stdDev / mean) * 100;
  }

  /**
   * Updates the sorted list of keys for binary search
   */
  private updateSortedKeys(): void {
    this.sortedKeys = Array.from(this.ring.keys()).sort((a, b) => a - b);
  }

  /**
   * Converts a string key to a numeric hash value
   * @param key The key to hash
   * @returns A numeric hash value
   */
  private getHashKey(key: string): number {
    const hash = createHash('md5').update(key).digest('hex');
    const truncated = hash.substring(0, 8);
    // Convert to a number (use parseInt with base 16 for hex)
    return parseInt(truncated, 16);
  }
}