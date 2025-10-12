/**
 * Cache Invalidation Integration Layer
 * Provides seamless integration between basic and production cache invalidation
 */

import { ProductionVectorCacheInvalidator } from './production-vector-cache-invalidator';
import { logger } from '@/lib/logger';
/**
 * Cache invalidation strategy configuration
 */
export interface CacheStrategy {
  strategy: 'basic' | 'production' | 'hybrid';
  fallbackEnabled: boolean;
  performanceMode: 'low' | 'balanced' | 'high';
  monitoringEnabled: boolean;
}

/**
 * Cache invalidation metrics
 */
export interface CacheMetrics {
  totalInvalidations: number;
  averageResponseTime: number;
  successRate: number;
  circuitBreakerTrips: number;
  batchEfficiency: number;
}

/**
 * Integrated cache invalidation system
 */
export class CacheInvalidationIntegration {
  private productionInvalidator: ProductionVectorCacheInvalidator;
  private strategy: CacheStrategy;
  private metrics: CacheMetrics = {
    totalInvalidations: 0,
    averageResponseTime: 0,
    successRate: 0,
    circuitBreakerTrips: 0,
    batchEfficiency: 0
  };

  constructor(strategy: Partial<CacheStrategy> = {}) {
    this.strategy = {
      strategy: 'production',
      fallbackEnabled: true,
      performanceMode: 'balanced',
      monitoringEnabled: true,
      ...strategy
    };

    // Initialize production invalidator
    this.productionInvalidator = new ProductionVectorCacheInvalidator({
      batchSize: this.getBatchSizeForPerformanceMode(),
      batchTimeoutMs: this.getBatchTimeoutForPerformanceMode(),
      enableMetrics: this.strategy.monitoringEnabled,
      enableLogging: this.strategy.monitoringEnabled
    });
  }

  /**
   * Smart cache invalidation with automatic strategy selection
   */
  public async invalidate(
    keys: string[], 
    options: {
      priority?: 'high' | 'medium' | 'low';
      source?: string;
      contentType?: string;
      workspaceId?: string;
      forceStrategy?: 'basic' | 'production';
    } = {}
  ): Promise<void> {
    const startTime = Date.now();
    const strategy = options.forceStrategy || this.selectOptimalStrategy(keys, options);

    try {
      switch (strategy) {
        case 'production':
          await this.productionInvalidator.invalidateCache(
            keys, 
            options.priority || 'medium',
            options.source || 'integration-layer',
            { contentType: options.contentType, workspaceId: options.workspaceId }
          );
          break;

        case 'basic':
          await this.basicInvalidation(keys);
          break;

        default:
          throw new Error(`Unknown invalidation strategy: ${strategy}`);
      }

      this.updateMetrics(Date.now() - startTime, true);

    } catch (error) {
      this.updateMetrics(Date.now() - startTime, false);

      if (this.strategy.fallbackEnabled && strategy === 'production') {
        logger.warn('Production invalidation failed, falling back to basic strategy', error);
        await this.basicInvalidation(keys);
      } else {
        throw error;
      }
    }
  }

  /**
   * Invalidate by content type with intelligent optimization
   */
  public async invalidateByContentType(
    contentType: string,
    workspaceId?: string,
    options: {
      priority?: 'high' | 'medium' | 'low';
      cascadeInvalidation?: boolean;
    } = {}
  ): Promise<void> {
    await this.productionInvalidator.invalidateByContentType(
      contentType,
      workspaceId,
      options.priority || 'medium'
    );

    // Cascade invalidation for related content types
    if (options.cascadeInvalidation) {
      const relatedTypes = this.getRelatedContentTypes(contentType);
      
      for (const relatedType of relatedTypes) {
        await this.productionInvalidator.invalidateByContentType(
          relatedType,
          workspaceId,
          'low'
        );
      }
    }
  }

  /**
   * File operation invalidation with dependency tracking
   */
  public async invalidateForFileOperation(
    fileId: string,
    operation: 'create' | 'update' | 'delete',
    workspaceId: string,
    options: {
      includeDependencies?: boolean;
      includeReferences?: boolean;
    } = {}
  ): Promise<void> {
    // Primary file invalidation
    await this.productionInvalidator.invalidateForFileOperation(fileId, operation, workspaceId);

    // Invalidate file dependencies
    if (options.includeDependencies) {
      const dependencies = await this.getFileDependencies(fileId, workspaceId);
      
      for (const depFileId of dependencies) {
        await this.productionInvalidator.invalidateForFileOperation(
          depFileId,
          'update',
          workspaceId
        );
      }
    }

    // Invalidate referencing files
    if (options.includeReferences) {
      const references = await this.getFileReferences(fileId, workspaceId);
      
      for (const refFileId of references) {
        await this.productionInvalidator.invalidateForFileOperation(
          refFileId,
          'update',
          workspaceId
        );
      }
    }
  }

  /**
   * Vector similarity invalidation with clustering
   */
  public async invalidateForVectorOperation(
    operation: 'embed' | 'search' | 'update',
    affectedKeys: string[],
    options: {
      similarityThreshold?: number;
      clusterInvalidation?: boolean;
      maxRelatedKeys?: number;
    } = {}
  ): Promise<void> {
    const similarity = options.similarityThreshold || 0.8;
    
    await this.productionInvalidator.invalidateForVectorOperation(
      operation,
      affectedKeys,
      similarity
    );

    // Cluster-based invalidation for highly related content
    if (options.clusterInvalidation) {
      const clusters = await this.identifyVectorClusters(affectedKeys, similarity);
      
      for (const cluster of clusters) {
        const clusterKeys = cluster.slice(0, options.maxRelatedKeys || 50);
        await this.productionInvalidator.invalidateCache(
          clusterKeys,
          'low',
          `cluster-invalidation:${operation}`
        );
      }
    }
  }

  /**
   * Workspace-wide invalidation with selective optimization
   */
  public async invalidateWorkspace(
    workspaceId: string,
    options: {
      contentTypes?: string[];
      excludePatterns?: string[];
      batchSize?: number;
    } = {}
  ): Promise<void> {
    const patterns = this.generateWorkspacePatterns(workspaceId, options);
    
    // Process patterns in batches to avoid overwhelming the system
    const batchSize = options.batchSize || 10;
    
    for (let i = 0; i < patterns.length; i += batchSize) {
      const batch = patterns.slice(i, i + batchSize);
      
      await Promise.all(batch.map(pattern =>
        this.productionInvalidator.invalidateByPattern(pattern, 'medium', 'workspace-invalidation')
      ));
      
      // Small delay between batches to prevent overload
      if (i + batchSize < patterns.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  /**
   * Performance testing and optimization
   */
  public async performanceTest(
    testConfig: {
      keyCount: number;
      iterations: number;
      strategy: 'basic' | 'production';
      concurrency?: number;
    }
  ): Promise<{
    averageTime: number;
    throughput: number;
    successRate: number;
    memoryUsage: number;
  }> {
    const { keyCount, iterations, strategy, concurrency = 1 } = testConfig;
    const results: number[] = [];
    let successCount = 0;
    
    const initialMemory = process.memoryUsage().heapUsed;
    const testKeys = Array(keyCount).fill(null).map((_, i) => `test:perf:${i}`);

    const executeTest = async () => {
      const startTime = Date.now();
      
      try {
        await this.invalidate(testKeys, { forceStrategy: strategy });
        successCount++;
      } catch (error) {
        logger.error('Performance test iteration failed:', error);
      }
      
      return Date.now() - startTime;
    };

    // Run tests
    for (let i = 0; i < iterations; i++) {
      if (concurrency === 1) {
        const time = await executeTest();
        results.push(time);
      } else {
        // Concurrent execution
        const promises = Array(concurrency).fill(null).map(() => executeTest());
        const times = await Promise.all(promises);
        results.push(...times);
      }
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const averageTime = results.reduce((sum, time) => sum + time, 0) / results.length;
    const totalOperations = iterations * (concurrency || 1);

    return {
      averageTime,
      throughput: totalOperations / (results.reduce((sum, time) => sum + time, 0) / 1000),
      successRate: successCount / totalOperations,
      memoryUsage: finalMemory - initialMemory
    };
  }

  /**
   * Get comprehensive cache invalidation statistics
   */
  public getStats(): {
    integration: CacheMetrics;
    production: any;
    strategy: CacheStrategy;
  } {
    return {
      integration: this.metrics,
      production: this.productionInvalidator.getStats(),
      strategy: this.strategy
    };
  }

  /**
   * Force flush all pending invalidations
   */
  public async flushAll(): Promise<void> {
    await this.productionInvalidator.flushAll();
  }

  /**
   * Update configuration at runtime
   */
  public updateStrategy(newStrategy: Partial<CacheStrategy>): void {
    this.strategy = { ...this.strategy, ...newStrategy };
    
    // Reinitialize if needed
    if (newStrategy.performanceMode || newStrategy.monitoringEnabled !== undefined) {
      this.productionInvalidator = new ProductionVectorCacheInvalidator({
        batchSize: this.getBatchSizeForPerformanceMode(),
        batchTimeoutMs: this.getBatchTimeoutForPerformanceMode(),
        enableMetrics: this.strategy.monitoringEnabled,
        enableLogging: this.strategy.monitoringEnabled
      });
    }
  }

  /**
   * Select optimal invalidation strategy based on context
   */
  private selectOptimalStrategy(
    keys: string[], 
    options: any
  ): 'basic' | 'production' {
    if (this.strategy.strategy === 'basic') {
      return 'basic';
    }

    if (this.strategy.strategy === 'production') {
      return 'production';
    }

    // Hybrid strategy logic
    if (keys.length < 5) {
      return 'basic'; // Small batches don't benefit from production features
    }

    if (options.priority === 'high') {
      return 'production'; // High priority gets production features
    }

    return 'production'; // Default to production for most cases
  }

  /**
   * Basic invalidation fallback
   */
  private async basicInvalidation(keys: string[]): Promise<void> {
    // Simulate basic cache invalidation
    for (const key of keys) {
      // This would integrate with your basic cache implementation
      await new Promise(resolve => setTimeout(resolve, 1)); // Simulate async operation
    }
  }

  /**
   * Update metrics tracking
   */
  private updateMetrics(duration: number, success: boolean): void {
    this.metrics.totalInvalidations++;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.totalInvalidations - 1) + duration) / 
      this.metrics.totalInvalidations;
    
    const successCount = Math.floor(this.metrics.successRate * (this.metrics.totalInvalidations - 1));
    this.metrics.successRate = (successCount + (success ? 1 : 0)) / this.metrics.totalInvalidations;
  }

  /**
   * Get batch size based on performance mode
   */
  private getBatchSizeForPerformanceMode(): number {
    switch (this.strategy.performanceMode) {
      case 'low': return 50;
      case 'balanced': return 100;
      case 'high': return 200;
      default: return 100;
    }
  }

  /**
   * Get batch timeout based on performance mode
   */
  private getBatchTimeoutForPerformanceMode(): number {
    switch (this.strategy.performanceMode) {
      case 'low': return 10000; // 10s
      case 'balanced': return 5000; // 5s
      case 'high': return 2000; // 2s
      default: return 5000;
    }
  }

  /**
   * Get related content types for cascade invalidation
   */
  private getRelatedContentTypes(contentType: string): string[] {
    const relationships: Record<string, string[]> = {
      'file': ['embedding', 'chunk', 'metadata'],
      'embedding': ['similarity', 'cluster'],
      'workspace': ['file', 'user', 'settings'],
      'user': ['session', 'preferences', 'activity']
    };

    return relationships[contentType] || [];
  }

  /**
   * Get file dependencies (mock implementation)
   */
  private async getFileDependencies(fileId: string, workspaceId: string): Promise<string[]> {
    // This would integrate with your dependency tracking system
    return [`dep1_${fileId}`, `dep2_${fileId}`];
  }

  /**
   * Get file references (mock implementation)
   */
  private async getFileReferences(fileId: string, workspaceId: string): Promise<string[]> {
    // This would integrate with your reference tracking system
    return [`ref1_${fileId}`, `ref2_${fileId}`];
  }

  /**
   * Identify vector clusters for optimization
   */
  private async identifyVectorClusters(keys: string[], similarity: number): Promise<string[][]> {
    // This would integrate with your vector clustering algorithm
    // For now, simulate cluster identification
    const clusters: string[][] = [];
    
    for (let i = 0; i < keys.length; i += 5) {
      const cluster = keys.slice(i, i + 5).map(key => `cluster_${key}`);
      clusters.push(cluster);
    }
    
    return clusters;
  }

  /**
   * Generate workspace invalidation patterns
   */
  private generateWorkspacePatterns(
    workspaceId: string, 
    options: { contentTypes?: string[]; excludePatterns?: string[] }
  ): string[] {
    const patterns = [
      `workspace:${workspaceId}:*`,
      `embedding:${workspaceId}:*`,
      `search:${workspaceId}:*`,
      `user:*:workspace:${workspaceId}`
    ];

    if (options.contentTypes) {
      for (const contentType of options.contentTypes) {
        patterns.push(`${contentType}:${workspaceId}:*`);
      }
    }

    // Filter out excluded patterns
    if (options.excludePatterns) {
      return patterns.filter(pattern => 
        !options.excludePatterns!.some(exclude => pattern.includes(exclude))
      );
    }

    return patterns;
  }
}