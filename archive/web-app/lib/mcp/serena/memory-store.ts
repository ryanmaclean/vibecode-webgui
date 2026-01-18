/**
 * MCP Serena Memory Store
 * Memory storage implementation for Serena
 */

import {
  SerenaMemoryEntry,
  SerenaSearchResult,
  ISerenaMemoryStore
} from './interfaces';

/**
 * SerenaMemoryStore class for managing memory entries
 */
export class SerenaMemoryStore implements ISerenaMemoryStore {
  private entries: Map<string, SerenaMemoryEntry>;
  private projectEntries: Map<string, Set<string>>;

  /**
   * Creates a new SerenaMemoryStore
   */
  constructor() {
    this.entries = new Map();
    this.projectEntries = new Map();
  }

  /**
   * Add a memory entry
   * @param entry Memory entry data (without ID and timestamp)
   * @returns Entry ID
   */
  async addEntry(entry: Omit<SerenaMemoryEntry, 'id' | 'timestamp'>): Promise<string> {
    // Generate ID
    const id = `entry-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    // Create entry with ID and timestamp
    const fullEntry: SerenaMemoryEntry = {
      ...entry,
      id,
      timestamp: Date.now()
    };
    
    // Store entry
    this.entries.set(id, fullEntry);
    
    // Add to project entries
    let projectEntries = this.projectEntries.get(entry.projectId);
    if (!projectEntries) {
      projectEntries = new Set();
      this.projectEntries.set(entry.projectId, projectEntries);
    }
    projectEntries.add(id);
    
    return id;
  }

  /**
   * Get a memory entry by ID
   * @param id Entry ID
   * @returns Memory entry or null if not found
   */
  async getEntry(id: string): Promise<SerenaMemoryEntry | null> {
    return this.entries.get(id) || null;
  }

  /**
   * Update a memory entry
   * @param id Entry ID
   * @param updates Partial entry updates
   * @returns Success flag
   */
  async updateEntry(id: string, updates: Partial<SerenaMemoryEntry>): Promise<boolean> {
    const entry = this.entries.get(id);
    if (!entry) {
      return false;
    }
    
    // Update entry
    this.entries.set(id, {
      ...entry,
      ...updates,
      id // Ensure ID doesn't change
    });
    
    // If project ID changed, update project entries
    if (updates.projectId && updates.projectId !== entry.projectId) {
      // Remove from old project
      const oldProjectEntries = this.projectEntries.get(entry.projectId);
      if (oldProjectEntries) {
        oldProjectEntries.delete(id);
      }
      
      // Add to new project
      let newProjectEntries = this.projectEntries.get(updates.projectId);
      if (!newProjectEntries) {
        newProjectEntries = new Set();
        this.projectEntries.set(updates.projectId, newProjectEntries);
      }
      newProjectEntries.add(id);
    }
    
    return true;
  }

  /**
   * Delete a memory entry
   * @param id Entry ID
   * @returns Success flag
   */
  async deleteEntry(id: string): Promise<boolean> {
    const entry = this.entries.get(id);
    if (!entry) {
      return false;
    }
    
    // Remove from project entries
    const projectEntries = this.projectEntries.get(entry.projectId);
    if (projectEntries) {
      projectEntries.delete(id);
    }
    
    // Delete entry
    this.entries.delete(id);
    
    return true;
  }

  /**
   * Search for memory entries by query string
   * @param query Search query
   * @param options Search options
   * @returns Search results
   */
  async search(query: string, options?: {
    projectId?: string;
    type?: string;
    limit?: number;
    tags?: string[];
  }): Promise<SerenaSearchResult[]> {
    const results: SerenaSearchResult[] = [];
    const limit = options?.limit || 10;
    
    // Get entries to search
    const entriesToSearch: SerenaMemoryEntry[] = [];
    
    if (options?.projectId) {
      // Get entries for specific project
      const projectEntryIds = this.projectEntries.get(options.projectId);
      if (projectEntryIds) {
        for (const id of projectEntryIds) {
          const entry = this.entries.get(id);
          if (entry) {
            entriesToSearch.push(entry);
          }
        }
      }
    } else {
      // Get all entries
      entriesToSearch.push(...this.entries.values());
    }
    
    // Filter by type
    const filteredByType = options?.type
      ? entriesToSearch.filter(entry => entry.type === options.type)
      : entriesToSearch;
    
    // Filter by tags
    const filteredByTags = options?.tags
      ? filteredByType.filter(entry => 
          options.tags!.every(tag => entry.tags.includes(tag))
        )
      : filteredByType;
    
    // Search by query
    const queryLower = query.toLowerCase();
    for (const entry of filteredByTags) {
      const contentLower = entry.content.toLowerCase();
      if (contentLower.includes(queryLower)) {
        // Calculate search score (simple implementation)
        const score = contentLower.split(queryLower).length - 1;
        
        // Get context around match
        const matchIndex = contentLower.indexOf(queryLower);
        const startIndex = Math.max(0, matchIndex - 50);
        const endIndex = Math.min(entry.content.length, matchIndex + query.length + 50);
        const context = entry.content.substring(startIndex, endIndex);
        
        results.push({
          entry,
          score,
          context
        });
      }
    }
    
    // Sort by score and limit results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Search for memory entries by vector similarity
   * @param embedding Vector embedding
   * @param options Search options
   * @returns Search results
   */
  async searchSimilar(embedding: number[], options?: {
    projectId?: string;
    type?: string;
    limit?: number;
    tags?: string[];
  }): Promise<SerenaSearchResult[]> {
    const results: SerenaSearchResult[] = [];
    const limit = options?.limit || 10;
    
    // Get entries to search
    const entriesToSearch: SerenaMemoryEntry[] = [];
    
    if (options?.projectId) {
      // Get entries for specific project
      const projectEntryIds = this.projectEntries.get(options.projectId);
      if (projectEntryIds) {
        for (const id of projectEntryIds) {
          const entry = this.entries.get(id);
          if (entry && entry.embedding) {
            entriesToSearch.push(entry);
          }
        }
      }
    } else {
      // Get all entries with embeddings
      for (const entry of this.entries.values()) {
        if (entry.embedding) {
          entriesToSearch.push(entry);
        }
      }
    }
    
    // Filter by type
    const filteredByType = options?.type
      ? entriesToSearch.filter(entry => entry.type === options.type)
      : entriesToSearch;
    
    // Filter by tags
    const filteredByTags = options?.tags
      ? filteredByType.filter(entry => 
          options.tags!.every(tag => entry.tags.includes(tag))
        )
      : filteredByType;
    
    // Calculate similarity scores
    for (const entry of filteredByTags) {
      if (!entry.embedding) continue;
      
      // Calculate cosine similarity
      const score = this.cosineSimilarity(embedding, entry.embedding);
      
      results.push({
        entry,
        score,
        context: entry.content.substring(0, 100) // Simple context for vector search
      });
    }
    
    // Sort by score and limit results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get insights for a project
   * @param projectId Project ID
   * @returns Project insights
   */
  async getProjectInsights(projectId: string): Promise<any> {
    // Get project entries
    const projectEntryIds = this.projectEntries.get(projectId);
    if (!projectEntryIds) {
      return {
        entryCount: 0,
        typeDistribution: {},
        recentActivity: [],
        topTags: []
      };
    }
    
    const projectEntries: SerenaMemoryEntry[] = [];
    for (const id of projectEntryIds) {
      const entry = this.entries.get(id);
      if (entry) {
        projectEntries.push(entry);
      }
    }
    
    // Calculate type distribution
    const typeDistribution: Record<string, number> = {};
    for (const entry of projectEntries) {
      typeDistribution[entry.type] = (typeDistribution[entry.type] || 0) + 1;
    }
    
    // Get recent activity
    const recentActivity = projectEntries
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
    
    // Calculate top tags
    const tagCounts: Record<string, number> = {};
    for (const entry of projectEntries) {
      for (const tag of entry.tags) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
    
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));
    
    return {
      entryCount: projectEntries.length,
      typeDistribution,
      recentActivity,
      topTags
    };
  }

  /**
   * Get session history for a project
   * @param projectId Project ID
   * @param sessionId Session ID
   * @returns Session history entries
   */
  async getSessionHistory(projectId: string, sessionId: string): Promise<SerenaMemoryEntry[]> {
    // Get project entries
    const projectEntryIds = this.projectEntries.get(projectId);
    if (!projectEntryIds) {
      return [];
    }
    
    // Filter by session ID in metadata
    const sessionEntries: SerenaMemoryEntry[] = [];
    for (const id of projectEntryIds) {
      const entry = this.entries.get(id);
      if (entry && entry.metadata.sessionId === sessionId) {
        sessionEntries.push(entry);
      }
    }
    
    // Sort by timestamp
    return sessionEntries.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Prune old memory entries for a project
   * @param projectId Project ID
   * @param olderThan Optional timestamp threshold
   * @returns Number of pruned entries
   */
  async pruneMemory(projectId: string, olderThan?: number): Promise<number> {
    const projectEntryIds = this.projectEntries.get(projectId);
    if (!projectEntryIds) {
      return 0;
    }
    
    const threshold = olderThan || Date.now() - (90 * 24 * 60 * 60 * 1000); // Default: 90 days
    let prunedCount = 0;
    
    const entriesIdsToDelete: string[] = [];
    for (const id of projectEntryIds) {
      const entry = this.entries.get(id);
      if (entry && entry.timestamp < threshold) {
        entriesIdsToDelete.push(id);
      }
    }
    
    // Delete entries
    for (const id of entriesIdsToDelete) {
      this.entries.delete(id);
      projectEntryIds.delete(id);
      prunedCount++;
    }
    
    return prunedCount;
  }

  /**
   * Export memory for a project
   * @param projectId Project ID
   * @returns Exported memory data
   */
  async exportMemory(projectId: string): Promise<any> {
    const projectEntryIds = this.projectEntries.get(projectId);
    if (!projectEntryIds) {
      return { entries: [] };
    }
    
    const exportedEntries: SerenaMemoryEntry[] = [];
    for (const id of projectEntryIds) {
      const entry = this.entries.get(id);
      if (entry) {
        exportedEntries.push(entry);
      }
    }
    
    return {
      projectId,
      exportTimestamp: Date.now(),
      entries: exportedEntries
    };
  }

  /**
   * Import memory for a project
   * @param projectId Project ID
   * @param data Imported memory data
   * @returns Success flag
   */
  async importMemory(projectId: string, data: any): Promise<boolean> {
    if (!data.entries || !Array.isArray(data.entries)) {
      return false;
    }
    
    // Create project entry set if it doesn't exist
    let projectEntries = this.projectEntries.get(projectId);
    if (!projectEntries) {
      projectEntries = new Set();
      this.projectEntries.set(projectId, projectEntries);
    }
    
    // Import entries
    for (const entry of data.entries) {
      // Ensure entry has correct project ID
      const importedEntry: SerenaMemoryEntry = {
        ...entry,
        projectId
      };
      
      this.entries.set(entry.id, importedEntry);
      projectEntries.add(entry.id);
    }
    
    return true;
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param a First vector
   * @param b Second vector
   * @returns Similarity score between -1 and 1
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same dimensions');
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);
    
    if (normA === 0 || normB === 0) {
      return 0;
    }
    
    return dotProduct / (normA * normB);
  }
}