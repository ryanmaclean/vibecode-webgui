/**
 * Unit tests for context-optimizer.ts
 * Tests context optimization strategies and token management
 */

import {
  ContextOptimizer,
  createContextOptimizer,
  OptimizationStrategy,
  SourcePriority,
  ContextOptimizationOptions,
  OptimizationResult
} from '../context-optimizer';
import { ContextSource, SuggestionContext } from '../suggestion-context-builder';

describe('ContextOptimizer', () => {
  let optimizer: ContextOptimizer;

  beforeEach(() => {
    optimizer = new ContextOptimizer();
  });

  describe('Constructor', () => {
    it('should initialize with default options', () => {
      expect(optimizer).toBeDefined();
    });

    it('should initialize with custom options', () => {
      const customOptimizer = new ContextOptimizer({
        tokenBudget: 2000,
        strategy: OptimizationStrategy.GREEDY,
        minRelevanceScore: 0.5
      });
      expect(customOptimizer).toBeDefined();
    });
  });

  describe('Factory Function', () => {
    it('should create instance via factory', () => {
      const instance = createContextOptimizer();
      expect(instance).toBeInstanceOf(ContextOptimizer);
    });

    it('should create instance with options', () => {
      const instance = createContextOptimizer({ tokenBudget: 3000 });
      expect(instance).toBeInstanceOf(ContextOptimizer);
    });
  });

  describe('Basic Optimization', () => {
    it('should optimize empty sources array', () => {
      const result = optimizer.optimize([]);

      expect(result.optimizedSources).toEqual([]);
      expect(result.excludedSources).toEqual([]);
      expect(result.totalTokens).toBe(0);
      expect(result.stats.includedSources).toBe(0);
    });

    it('should optimize single source', () => {
      const sources: ContextSource[] = [
        {
          id: 'source-1',
          content: 'import React from "react";',
          metadata: {
            type: 'import',
            relevance: 0.8
          }
        }
      ];

      const result = optimizer.optimize(sources);

      expect(result.optimizedSources).toHaveLength(1);
      expect(result.excludedSources).toHaveLength(0);
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.utilizationPercent).toBeGreaterThan(0);
    });

    it('should filter by minimum relevance score', () => {
      const sources: ContextSource[] = [
        {
          id: 'source-1',
          content: 'High relevance source',
          metadata: { type: 'import', relevance: 0.8 }
        },
        {
          id: 'source-2',
          content: 'Low relevance source',
          metadata: { type: 'import', relevance: 0.05 }
        }
      ];

      const result = optimizer.optimize(sources, { minRelevanceScore: 0.1 });

      expect(result.optimizedSources).toHaveLength(1);
      expect(result.optimizedSources[0].id).toBe('source-1');
    });

    it('should respect token budget', () => {
      const sources: ContextSource[] = Array.from({ length: 100 }, (_, i) => ({
        id: `source-${i}`,
        content: 'A'.repeat(100), // ~25 tokens
        metadata: { type: 'import', relevance: 0.5 }
      }));

      const result = optimizer.optimize(sources, { tokenBudget: 500 });

      expect(result.totalTokens).toBeLessThanOrEqual(500);
      expect(result.optimizedSources.length).toBeLessThan(100);
    });
  });

  describe('Greedy Optimization Strategy', () => {
    it('should select by relevance score descending', () => {
      const sources: ContextSource[] = [
        {
          id: 'low',
          content: 'Low relevance',
          metadata: { type: 'import', relevance: 0.3 }
        },
        {
          id: 'high',
          content: 'High relevance',
          metadata: { type: 'import', relevance: 0.9 }
        },
        {
          id: 'medium',
          content: 'Medium relevance',
          metadata: { type: 'import', relevance: 0.6 }
        }
      ];

      const result = optimizer.optimize(sources, {
        strategy: OptimizationStrategy.GREEDY,
        tokenBudget: 100
      });

      expect(result.optimizedSources[0].id).toBe('high');
      expect(result.strategy).toBe(OptimizationStrategy.GREEDY);
    });

    it('should maximize total relevance', () => {
      const sources: ContextSource[] = Array.from({ length: 10 }, (_, i) => ({
        id: `source-${i}`,
        content: 'Content',
        metadata: { type: 'import', relevance: (i + 1) / 10 }
      }));

      const result = optimizer.optimize(sources, {
        strategy: OptimizationStrategy.GREEDY,
        tokenBudget: 200
      });

      // Should select highest relevance first
      const relevances = result.optimizedSources.map(s => s.metadata.relevance);
      for (let i = 1; i < relevances.length; i++) {
        expect(relevances[i]).toBeLessThanOrEqual(relevances[i - 1]);
      }
    });
  });

  describe('Priority Optimization Strategy', () => {
    it('should include required sources first', () => {
      const sources: ContextSource[] = [
        {
          id: 'required',
          content: 'Required source',
          metadata: { type: 'import', relevance: 0.5 }
        },
        {
          id: 'high-relevance',
          content: 'High relevance but optional',
          metadata: { type: 'import', relevance: 0.9 }
        }
      ];

      const result = optimizer.optimize(sources, {
        strategy: OptimizationStrategy.PRIORITY,
        requiredSources: ['required'],
        tokenBudget: 50 // Small budget
      });

      expect(result.optimizedSources.some(s => s.id === 'required')).toBe(true);
    });

    it('should respect type priorities', () => {
      const sources: ContextSource[] = [
        {
          id: 'type-1',
          content: 'Type priority source',
          metadata: { type: 'type', relevance: 0.5 }
        },
        {
          id: 'import-1',
          content: 'Import priority source',
          metadata: { type: 'import', relevance: 0.5 }
        }
      ];

      const result = optimizer.optimize(sources, {
        strategy: OptimizationStrategy.PRIORITY,
        typePriorities: {
          type: 0.9, // High priority
          import: 0.3 // Low priority
        }
      });

      if (result.optimizedSources.length > 0) {
        expect(result.optimizedSources[0].metadata.type).toBe('type');
      }
    });
  });

  describe('Knapsack Optimization Strategy', () => {
    it('should maximize value per token', () => {
      const sources: ContextSource[] = [
        {
          id: 'efficient',
          content: 'Small', // Few tokens
          metadata: { type: 'import', relevance: 0.8 }
        },
        {
          id: 'inefficient',
          content: 'Very long content that uses many tokens but has lower relevance score',
          metadata: { type: 'import', relevance: 0.7 }
        }
      ];

      const result = optimizer.optimize(sources, {
        strategy: OptimizationStrategy.KNAPSACK,
        tokenBudget: 50
      });

      expect(result.stats.tokenEfficiency).toBeGreaterThan(0);
    });
  });

  describe('Balanced Optimization Strategy', () => {
    it('should balance priority, relevance, and efficiency', () => {
      const sources: ContextSource[] = [
        {
          id: 'high-relevance',
          content: 'High relevance',
          metadata: { type: 'import', relevance: 0.9 }
        },
        {
          id: 'medium-relevance',
          content: 'Medium',
          metadata: { type: 'type', relevance: 0.6 }
        }
      ];

      const result = optimizer.optimize(sources, {
        strategy: OptimizationStrategy.BALANCED
      });

      expect(result.strategy).toBe(OptimizationStrategy.BALANCED);
      expect(result.optimizedSources.length).toBeGreaterThan(0);
    });

    it('should use balanced strategy by default', () => {
      const sources: ContextSource[] = [
        {
          id: 'source-1',
          content: 'Content',
          metadata: { type: 'import', relevance: 0.7 }
        }
      ];

      const result = optimizer.optimize(sources);

      expect(result.strategy).toBe(OptimizationStrategy.BALANCED);
    });
  });

  describe('Diverse Optimization Strategy', () => {
    it('should ensure variety of source types', () => {
      const sources: ContextSource[] = [
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `import-${i}`,
          content: 'Import',
          metadata: { type: 'import' as const, relevance: 0.9 }
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `type-${i}`,
          content: 'Type',
          metadata: { type: 'type' as const, relevance: 0.5 }
        }))
      ];

      const result = optimizer.optimize(sources, {
        strategy: OptimizationStrategy.DIVERSE,
        tokenBudget: 200
      });

      const types = new Set(result.optimizedSources.map(s => s.metadata.type));
      expect(types.size).toBeGreaterThan(1);
    });

    it('should round-robin between types', () => {
      const sources: ContextSource[] = [
        { id: 'import-1', content: 'A', metadata: { type: 'import', relevance: 0.9 } },
        { id: 'type-1', content: 'B', metadata: { type: 'type', relevance: 0.8 } },
        { id: 'import-2', content: 'C', metadata: { type: 'import', relevance: 0.7 } },
        { id: 'type-2', content: 'D', metadata: { type: 'type', relevance: 0.6 } }
      ];

      const result = optimizer.optimize(sources, {
        strategy: OptimizationStrategy.DIVERSE,
        tokenBudget: 100
      });

      expect(result.stats.sourcesByType.import).toBeGreaterThan(0);
      expect(result.stats.sourcesByType.type).toBeGreaterThan(0);
    });
  });

  describe('Source Exclusion', () => {
    it('should exclude specified sources', () => {
      const sources: ContextSource[] = [
        { id: 'include', content: 'Include', metadata: { type: 'import', relevance: 0.8 } },
        { id: 'exclude', content: 'Exclude', metadata: { type: 'import', relevance: 0.9 } }
      ];

      const result = optimizer.optimize(sources, {
        excludedSources: ['exclude']
      });

      expect(result.optimizedSources.some(s => s.id === 'exclude')).toBe(false);
      expect(result.optimizedSources.some(s => s.id === 'include')).toBe(true);
    });
  });

  describe('Max Sources Per Type', () => {
    it('should enforce max sources per type', () => {
      const sources: ContextSource[] = Array.from({ length: 10 }, (_, i) => ({
        id: `import-${i}`,
        content: 'Import',
        metadata: { type: 'import', relevance: 0.7 }
      }));

      const result = optimizer.optimize(sources, {
        maxSourcesPerType: 3
      });

      expect(result.optimizedSources.length).toBeLessThanOrEqual(3);
    });

    it('should apply limit across multiple types', () => {
      const sources: ContextSource[] = [
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `import-${i}`,
          content: 'Import',
          metadata: { type: 'import' as const, relevance: 0.8 }
        })),
        ...Array.from({ length: 5 }, (_, i) => ({
          id: `type-${i}`,
          content: 'Type',
          metadata: { type: 'type' as const, relevance: 0.7 }
        }))
      ];

      const result = optimizer.optimize(sources, {
        maxSourcesPerType: 2
      });

      expect(result.stats.sourcesByType.import).toBeLessThanOrEqual(2);
      expect(result.stats.sourcesByType.type).toBeLessThanOrEqual(2);
    });
  });

  describe('Order Preservation', () => {
    it('should preserve original order when requested', () => {
      const sources: ContextSource[] = [
        { id: 'first', content: 'A', metadata: { type: 'import', relevance: 0.5 } },
        { id: 'second', content: 'B', metadata: { type: 'import', relevance: 0.9 } },
        { id: 'third', content: 'C', metadata: { type: 'import', relevance: 0.7 } }
      ];

      const result = optimizer.optimize(sources, {
        preserveOrder: true
      });

      const ids = result.optimizedSources.map(s => s.id);
      const originalIds = sources.map(s => s.id).filter(id => ids.includes(id));

      expect(ids).toEqual(originalIds);
    });

    it('should not preserve order by default', () => {
      const sources: ContextSource[] = [
        { id: 'low', content: 'A', metadata: { type: 'import', relevance: 0.3 } },
        { id: 'high', content: 'B', metadata: { type: 'import', relevance: 0.9 } }
      ];

      const result = optimizer.optimize(sources, {
        strategy: OptimizationStrategy.GREEDY
      });

      if (result.optimizedSources.length > 1) {
        expect(result.optimizedSources[0].id).toBe('high');
      }
    });
  });

  describe('Statistics', () => {
    it('should calculate correct statistics', () => {
      const sources: ContextSource[] = [
        { id: '1', content: 'A', metadata: { type: 'import', relevance: 0.8 } },
        { id: '2', content: 'B', metadata: { type: 'type', relevance: 0.6 } },
        { id: '3', content: 'C', metadata: { type: 'import', relevance: 0.4 } }
      ];

      const result = optimizer.optimize(sources, { tokenBudget: 100 });

      expect(result.stats.totalSources).toBe(3);
      expect(result.stats.includedSources).toBeGreaterThan(0);
      expect(result.stats.averageRelevance).toBeGreaterThan(0);
      expect(result.stats.tokenEfficiency).toBeGreaterThan(0);
    });

    it('should track sources by type', () => {
      const sources: ContextSource[] = [
        { id: '1', content: 'A', metadata: { type: 'import', relevance: 0.8 } },
        { id: '2', content: 'B', metadata: { type: 'import', relevance: 0.7 } },
        { id: '3', content: 'C', metadata: { type: 'type', relevance: 0.6 } }
      ];

      const result = optimizer.optimize(sources);

      expect(result.stats.sourcesByType).toHaveProperty('import');
      if (result.stats.sourcesByType.type !== undefined) {
        expect(result.stats.sourcesByType.type).toBeGreaterThan(0);
      }
    });

    it('should calculate average excluded relevance', () => {
      const sources: ContextSource[] = [
        { id: '1', content: 'A'.repeat(1000), metadata: { type: 'import', relevance: 0.9 } },
        { id: '2', content: 'B'.repeat(1000), metadata: { type: 'import', relevance: 0.8 } },
        { id: '3', content: 'C'.repeat(1000), metadata: { type: 'import', relevance: 0.7 } }
      ];

      const result = optimizer.optimize(sources, { tokenBudget: 100 });

      if (result.stats.excludedSources > 0) {
        expect(result.stats.averageExcludedRelevance).toBeGreaterThan(0);
      }
    });

    it('should include duration metadata', () => {
      const sources: ContextSource[] = [
        { id: '1', content: 'A', metadata: { type: 'import', relevance: 0.8 } }
      ];

      const result = optimizer.optimize(sources);

      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Utilization', () => {
    it('should calculate utilization percentage', () => {
      const sources: ContextSource[] = [
        { id: '1', content: 'Small', metadata: { type: 'import', relevance: 0.8 } }
      ];

      const result = optimizer.optimize(sources, { tokenBudget: 1000 });

      expect(result.utilizationPercent).toBeGreaterThan(0);
      expect(result.utilizationPercent).toBeLessThanOrEqual(100);
    });

    it('should calculate remaining tokens', () => {
      const sources: ContextSource[] = [
        { id: '1', content: 'Content', metadata: { type: 'import', relevance: 0.8 } }
      ];

      const result = optimizer.optimize(sources, { tokenBudget: 1000 });

      expect(result.remainingTokens).toBe(1000 - result.totalTokens);
      expect(result.remainingTokens).toBeGreaterThanOrEqual(0);
    });

    it('should warn on low utilization', () => {
      const sources: ContextSource[] = [
        { id: '1', content: 'A', metadata: { type: 'import', relevance: 0.8 } }
      ];

      const result = optimizer.optimize(sources, { tokenBudget: 10000 });

      if (result.utilizationPercent < 50) {
        expect(result.metadata.warnings.some(w => w.includes('Low token utilization'))).toBe(true);
      }
    });
  });

  describe('Context Optimization', () => {
    it('should optimize suggestion context', () => {
      const context: SuggestionContext = {
        sourceCode: 'const x = 1;',
        sources: [
          { id: '1', content: 'Import', metadata: { type: 'import', relevance: 0.8 } },
          { id: '2', content: 'Type', metadata: { type: 'type', relevance: 0.6 } }
        ],
        imports: { imports: [], stats: { total: 0, default: 0, named: 0, namespace: 0, sideEffect: 0, typeOnly: 0 }, externalPackages: [], internalImports: [], errors: [] },
        types: { types: [], stats: { total: 0, interfaces: 0, typeAliases: 0, enums: 0, classes: 0, exported: 0 }, exportedTypes: [], errors: [] },
        functions: [],
        totalTokens: 100,
        relevanceScore: 0.7,
        stats: {
          totalSources: 2,
          importCount: 1,
          typeCount: 1,
          functionCount: 0,
          relatedCodeCount: 0,
          conventionCount: 0
        }
      };

      const optimized = optimizer.optimizeContext(context, { tokenBudget: 500 });

      expect(optimized.sources.length).toBeGreaterThan(0);
      expect(optimized.totalTokens).toBeGreaterThan(0);
      expect(optimized.relevanceScore).toBeGreaterThan(0);
    });

    it('should maintain context structure', () => {
      const context: SuggestionContext = {
        sourceCode: 'const x = 1;',
        sourceFile: 'test.ts',
        sources: [
          { id: '1', content: 'Content', metadata: { type: 'import', relevance: 0.8 } }
        ],
        imports: { imports: [], stats: { total: 0, default: 0, named: 0, namespace: 0, sideEffect: 0, typeOnly: 0 }, externalPackages: [], internalImports: [], errors: [] },
        types: { types: [], stats: { total: 0, interfaces: 0, typeAliases: 0, enums: 0, classes: 0, exported: 0 }, exportedTypes: [], errors: [] },
        functions: [],
        totalTokens: 100,
        relevanceScore: 0.7,
        stats: {
          totalSources: 1,
          importCount: 0,
          typeCount: 0,
          functionCount: 0,
          relatedCodeCount: 0,
          conventionCount: 0
        }
      };

      const optimized = optimizer.optimizeContext(context);

      expect(optimized.sourceCode).toBe(context.sourceCode);
      expect(optimized.sourceFile).toBe(context.sourceFile);
      expect(optimized.imports).toBe(context.imports);
      expect(optimized.types).toBe(context.types);
      expect(optimized.functions).toBe(context.functions);
    });
  });

  describe('Recommendations', () => {
    it('should provide recommendations for low utilization', () => {
      const result: OptimizationResult = {
        optimizedSources: [
          { id: '1', content: 'A', metadata: { type: 'import', relevance: 0.8 } }
        ],
        excludedSources: [],
        totalTokens: 100,
        remainingTokens: 3900,
        utilizationPercent: 2.5,
        strategy: OptimizationStrategy.BALANCED,
        stats: {
          totalSources: 1,
          includedSources: 1,
          excludedSources: 0,
          sourcesByType: { import: 1 },
          averageRelevance: 0.8,
          averageExcludedRelevance: 0,
          tokenEfficiency: 8
        },
        metadata: {
          durationMs: 1,
          warnings: []
        }
      };

      const recommendations = optimizer.getRecommendations(result);

      expect(recommendations.some(r => r.includes('utilization'))).toBe(true);
    });

    it('should provide recommendations for high exclusion rate', () => {
      const result: OptimizationResult = {
        optimizedSources: [
          { id: '1', content: 'A', metadata: { type: 'import', relevance: 0.8 } }
        ],
        excludedSources: Array.from({ length: 10 }, (_, i) => ({
          id: `excluded-${i}`,
          content: 'B',
          metadata: { type: 'import', relevance: 0.7 }
        })),
        totalTokens: 100,
        remainingTokens: 0,
        utilizationPercent: 100,
        strategy: OptimizationStrategy.BALANCED,
        stats: {
          totalSources: 11,
          includedSources: 1,
          excludedSources: 10,
          sourcesByType: { import: 1 },
          averageRelevance: 0.8,
          averageExcludedRelevance: 0.7,
          tokenEfficiency: 8
        },
        metadata: {
          durationMs: 1,
          warnings: []
        }
      };

      const recommendations = optimizer.getRecommendations(result);

      expect(recommendations.some(r => r.includes('excluded'))).toBe(true);
    });

    it('should provide recommendations for low relevance', () => {
      const result: OptimizationResult = {
        optimizedSources: [
          { id: '1', content: 'A', metadata: { type: 'import', relevance: 0.3 } }
        ],
        excludedSources: [],
        totalTokens: 100,
        remainingTokens: 3900,
        utilizationPercent: 2.5,
        strategy: OptimizationStrategy.BALANCED,
        stats: {
          totalSources: 1,
          includedSources: 1,
          excludedSources: 0,
          sourcesByType: { import: 1 },
          averageRelevance: 0.3,
          averageExcludedRelevance: 0,
          tokenEfficiency: 3
        },
        metadata: {
          durationMs: 1,
          warnings: []
        }
      };

      const recommendations = optimizer.getRecommendations(result);

      expect(recommendations.some(r => r.includes('relevance'))).toBe(true);
    });

    it('should provide recommendations for type imbalance', () => {
      const result: OptimizationResult = {
        optimizedSources: Array.from({ length: 15 }, (_, i) => ({
          id: `import-${i}`,
          content: 'A',
          metadata: { type: 'import', relevance: 0.8 }
        })),
        excludedSources: [],
        totalTokens: 100,
        remainingTokens: 3900,
        utilizationPercent: 2.5,
        strategy: OptimizationStrategy.BALANCED,
        stats: {
          totalSources: 15,
          includedSources: 15,
          excludedSources: 0,
          sourcesByType: { import: 15 },
          averageRelevance: 0.8,
          averageExcludedRelevance: 0,
          tokenEfficiency: 8
        },
        metadata: {
          durationMs: 1,
          warnings: []
        }
      };

      const recommendations = optimizer.getRecommendations(result);

      expect(recommendations.some(r => r.includes('diversity') || r.includes('DIVERSE'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle sources with zero relevance', () => {
      const sources: ContextSource[] = [
        { id: '1', content: 'A', metadata: { type: 'import', relevance: 0 } }
      ];

      const result = optimizer.optimize(sources, { minRelevanceScore: 0 });

      expect(result).toBeDefined();
    });

    it('should handle very large token budget', () => {
      const sources: ContextSource[] = [
        { id: '1', content: 'A', metadata: { type: 'import', relevance: 0.8 } }
      ];

      const result = optimizer.optimize(sources, { tokenBudget: 1000000 });

      expect(result.utilizationPercent).toBeLessThan(1);
    });

    it('should handle very small token budget', () => {
      const sources: ContextSource[] = [
        { id: '1', content: 'Very long content that exceeds budget', metadata: { type: 'import', relevance: 0.8 } }
      ];

      const result = optimizer.optimize(sources, { tokenBudget: 1 });

      expect(result.optimizedSources.length).toBe(0);
    });

    it('should handle identical relevance scores', () => {
      const sources: ContextSource[] = Array.from({ length: 5 }, (_, i) => ({
        id: `source-${i}`,
        content: 'Content',
        metadata: { type: 'import', relevance: 0.7 }
      }));

      const result = optimizer.optimize(sources);

      expect(result.optimizedSources.length).toBeGreaterThan(0);
    });

    it('should handle mixed content lengths', () => {
      const sources: ContextSource[] = [
        { id: 'short', content: 'A', metadata: { type: 'import', relevance: 0.5 } },
        { id: 'medium', content: 'A'.repeat(50), metadata: { type: 'import', relevance: 0.6 } },
        { id: 'long', content: 'A'.repeat(500), metadata: { type: 'import', relevance: 0.7 } }
      ];

      const result = optimizer.optimize(sources, { tokenBudget: 200 });

      expect(result.totalTokens).toBeLessThanOrEqual(200);
    });
  });

  describe('Performance', () => {
    it('should handle large number of sources efficiently', () => {
      const sources: ContextSource[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `source-${i}`,
        content: `Content ${i}`,
        metadata: { type: 'import', relevance: Math.random() }
      }));

      const startTime = Date.now();
      const result = optimizer.optimize(sources);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
      expect(result).toBeDefined();
    });

    it('should complete diverse optimization in reasonable time', () => {
      const sources: ContextSource[] = Array.from({ length: 100 }, (_, i) => ({
        id: `source-${i}`,
        content: `Content ${i}`,
        metadata: {
          type: ['import', 'type', 'function', 'convention'][i % 4] as any,
          relevance: Math.random()
        }
      }));

      const startTime = Date.now();
      const result = optimizer.optimize(sources, {
        strategy: OptimizationStrategy.DIVERSE
      });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500);
      expect(result.metadata.iterations).toBeDefined();
    });
  });
});
