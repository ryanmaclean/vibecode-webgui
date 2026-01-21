/**
 * Multi-Agent Memory Infrastructure
 * Issue #884: Design memory tier architecture with hot/warm/cold storage
 */

/**
 * Memory tier levels with different characteristics
 */
export type MemoryTier = 'hot' | 'warm' | 'cold' | 'archive';

/**
 * Memory entry stored in tiered storage
 */
export interface MemoryEntry {
  id: string;
  agentId: string;
  key: string;
  value: unknown;
  tier: MemoryTier;
  createdAt: Date;
  accessedAt: Date;
  accessCount: number;
  ttl?: number;
  metadata: Record<string, unknown>;
}

/**
 * Configuration for each memory tier
 */
export interface TierConfig {
  tier: MemoryTier;
  maxSize: number;
  ttlSeconds: number;
  evictionPolicy: 'lru' | 'lfu' | 'fifo' | 'ttl';
  persistToDisk: boolean;
  compressionEnabled: boolean;
}

/**
 * Default tier configurations
 */
export const DEFAULT_TIER_CONFIGS: Record<MemoryTier, TierConfig> = {
  hot: {
    tier: 'hot',
    maxSize: 1000,
    ttlSeconds: 300, // 5 minutes
    evictionPolicy: 'lru',
    persistToDisk: false,
    compressionEnabled: false,
  },
  warm: {
    tier: 'warm',
    maxSize: 10000,
    ttlSeconds: 3600, // 1 hour
    evictionPolicy: 'lfu',
    persistToDisk: true,
    compressionEnabled: false,
  },
  cold: {
    tier: 'cold',
    maxSize: 100000,
    ttlSeconds: 86400, // 24 hours
    evictionPolicy: 'ttl',
    persistToDisk: true,
    compressionEnabled: true,
  },
  archive: {
    tier: 'archive',
    maxSize: -1, // unlimited
    ttlSeconds: -1, // no expiry
    evictionPolicy: 'fifo',
    persistToDisk: true,
    compressionEnabled: true,
  },
};

/**
 * Memory store interface for tier implementations
 */
export interface MemoryStore {
  get(key: string): Promise<MemoryEntry | undefined>;
  set(key: string, entry: MemoryEntry): Promise<void>;
  delete(key: string): Promise<boolean>;
  has(key: string): Promise<boolean>;
  clear(): Promise<void>;
  size(): Promise<number>;
  keys(): Promise<string[]>;
}

/**
 * In-memory store implementation for hot tier
 */
export class InMemoryStore implements MemoryStore {
  private store: Map<string, MemoryEntry> = new Map();

  async get(key: string): Promise<MemoryEntry | undefined> {
    const entry = this.store.get(key);
    if (entry) {
      entry.accessedAt = new Date();
      entry.accessCount++;
    }
    return entry;
  }

  async set(key: string, entry: MemoryEntry): Promise<void> {
    this.store.set(key, entry);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async size(): Promise<number> {
    return this.store.size;
  }

  async keys(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}

/**
 * Tiered memory manager
 */
export class TieredMemoryManager {
  private tiers: Map<MemoryTier, MemoryStore> = new Map();
  private configs: Map<MemoryTier, TierConfig> = new Map();

  constructor(configs: Partial<Record<MemoryTier, TierConfig>> = {}) {
    // Initialize with defaults, override with provided configs
    for (const tier of ['hot', 'warm', 'cold', 'archive'] as MemoryTier[]) {
      this.configs.set(tier, configs[tier] || DEFAULT_TIER_CONFIGS[tier]);
      this.tiers.set(tier, new InMemoryStore());
    }
  }

  async get(key: string, tier: MemoryTier = 'hot'): Promise<MemoryEntry | undefined> {
    return this.tiers.get(tier)?.get(key);
  }

  async set(key: string, value: unknown, agentId: string, tier: MemoryTier = 'hot'): Promise<void> {
    const entry: MemoryEntry = {
      id: `${agentId}-${key}-${Date.now()}`,
      agentId,
      key,
      value,
      tier,
      createdAt: new Date(),
      accessedAt: new Date(),
      accessCount: 0,
      metadata: {},
    };
    await this.tiers.get(tier)?.set(key, entry);
  }

  async promote(key: string, fromTier: MemoryTier, toTier: MemoryTier): Promise<boolean> {
    const entry = await this.tiers.get(fromTier)?.get(key);
    if (!entry) return false;

    entry.tier = toTier;
    await this.tiers.get(toTier)?.set(key, entry);
    await this.tiers.get(fromTier)?.delete(key);
    return true;
  }

  async demote(key: string, fromTier: MemoryTier, toTier: MemoryTier): Promise<boolean> {
    return this.promote(key, fromTier, toTier);
  }

  getConfig(tier: MemoryTier): TierConfig | undefined {
    return this.configs.get(tier);
  }
}

export const globalMemoryManager = new TieredMemoryManager();
