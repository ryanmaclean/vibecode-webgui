/**
 * Tests for SuggestionEnhancer
 */

import {
  SuggestionEnhancer,
  createSuggestionEnhancer,
  getDefaultEnhancer,
  resetDefaultEnhancer,
  SuggestionEnhancementQuery,
  EnhancedSuggestion
} from '../suggestion-enhancer';
import { OptimizationStrategy } from '../context-optimizer';

describe('SuggestionEnhancer', () => {
  let enhancer: SuggestionEnhancer;

  beforeEach(() => {
    enhancer = createSuggestionEnhancer();
    resetDefaultEnhancer();
  });

  afterEach(() => {
    enhancer.clearAllCaches();
  });

  describe('Basic Enhancement', () => {
    it('should enhance a simple code snippet', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: `
import { User } from './types';

export function getUserName(user: User): string {
  return user.name;
}
        `.trim()
      };

      const enhanced = await enhancer.enhance(query);

      expect(enhanced).toBeDefined();
      expect(enhanced.sourceCode).toBe(query.sourceCode);
      expect(enhanced.contextSources).toBeDefined();
      expect(enhanced.formattedContext).toBeDefined();
      expect(enhanced.totalTokens).toBeGreaterThan(0);
      expect(enhanced.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(enhanced.stats).toBeDefined();
    });

    it('should extract imports from code', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: `
import { useState, useEffect } from 'react';
import axios from 'axios';

export function MyComponent() {
  const [data, setData] = useState(null);
  return <div>{data}</div>;
}
        `.trim()
      };

      const enhanced = await enhancer.enhance(query);

      expect(enhanced.stats.importsIncluded).toBeGreaterThan(0);
    });

    it('should extract types from code', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: `
export interface User {
  id: number;
  name: string;
  email: string;
}

export type UserRole = 'admin' | 'user' | 'guest';
        `.trim()
      };

      const enhanced = await enhancer.enhance(query);

      expect(enhanced.stats.typesIncluded).toBeGreaterThan(0);
    });

    it('should extract functions from code', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: `
export function calculateTotal(items: number[]): number {
  return items.reduce((sum, item) => sum + item, 0);
}

export const processData = async (data: any) => {
  return data.map(x => x * 2);
};
        `.trim()
      };

      const enhanced = await enhancer.enhance(query);

      expect(enhanced.stats.functionsIncluded).toBeGreaterThan(0);
    });
  });

  describe('Context Options', () => {
    it('should respect includeRelatedCode option', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: 'const x = 1;',
        contextOptions: {
          includeRelatedCode: false
        }
      };

      const enhanced = await enhancer.enhance(query);

      expect(enhanced.stats.relatedCodeIncluded).toBe(0);
    });

    it('should respect includeConventions option', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: 'const x = 1;',
        contextOptions: {
          includeConventions: false
        }
      };

      const enhanced = await enhancer.enhance(query);

      expect(enhanced.stats.conventionsIncluded).toBe(0);
    });

    it('should respect maxRelatedElements option', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: 'const x = 1;',
        contextOptions: {
          maxRelatedElements: 5
        }
      };

      const enhanced = await enhancer.enhance(query);

      expect(enhanced.stats.relatedCodeIncluded).toBeLessThanOrEqual(5);
    });

    it('should respect minRelevanceScore option', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: 'const x = 1;',
        contextOptions: {
          minRelevanceScore: 0.5
        }
      };

      const enhanced = await enhancer.enhance(query);

      // All included sources should have relevance >= 0.5
      for (const source of enhanced.contextSources) {
        expect(source.metadata.relevance).toBeGreaterThanOrEqual(0.5);
      }
    });
  });

  describe('Optimization Options', () => {
    it('should respect token budget', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: `
import React from 'react';
import { User, Post, Comment } from './types';

export function MyComponent() {
  return <div>Hello</div>;
}
        `.trim(),
        optimizationOptions: {
          tokenBudget: 100
        }
      };

      const enhanced = await enhancer.enhance(query);

      expect(enhanced.totalTokens).toBeLessThanOrEqual(100);
    });

    it('should use specified optimization strategy', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: 'const x = 1;',
        optimizationOptions: {
          strategy: OptimizationStrategy.GREEDY
        }
      };

      const enhanced = await enhancer.enhance(query);

      expect(enhanced.stats.optimizationStrategy).toBe(OptimizationStrategy.GREEDY);
    });

    it('should filter by minimum relevance in optimization', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: 'const x = 1;',
        optimizationOptions: {
          minRelevanceScore: 0.3
        }
      };

      const enhanced = await enhancer.enhance(query);

      // All included sources should meet the optimization threshold
      for (const source of enhanced.contextSources) {
        expect(source.metadata.relevance).toBeGreaterThanOrEqual(0.3);
      }
    });

    it('should respect maxSourcesPerType limit', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: `
import A from 'a';
import B from 'b';
import C from 'c';
import D from 'd';
import E from 'e';
        `.trim(),
        optimizationOptions: {
          maxSourcesPerType: 2
        }
      };

      const enhanced = await enhancer.enhance(query);

      // Count sources by type
      const typeCount: Record<string, number> = {};
      for (const source of enhanced.contextSources) {
        const type = source.metadata.type;
        typeCount[type] = (typeCount[type] || 0) + 1;
      }

      // Each type should have at most 2 sources
      for (const count of Object.values(typeCount)) {
        expect(count).toBeLessThanOrEqual(2);
      }
    });
  });

  describe('Context Formatting', () => {
    it('should format context with detailed template', () => {
      const sources = [
        {
          id: 'import-1',
          content: "import React from 'react';",
          metadata: {
            title: 'React Import',
            type: 'import' as const,
            relevance: 0.9
          }
        }
      ];

      const formatted = enhancer.formatContext(sources, undefined, {
        template: 'detailed'
      });

      expect(formatted).toContain('Relevant Context');
      expect(formatted).toContain('React Import');
      expect(formatted).toContain('react');
    });

    it('should format context with compact template', () => {
      const sources = [
        {
          id: 'type-1',
          content: 'interface User { id: number; }',
          metadata: {
            title: 'User Interface',
            type: 'type' as const,
            relevance: 0.8
          }
        }
      ];

      const formatted = enhancer.formatContext(sources, undefined, {
        template: 'compact'
      });

      expect(formatted).toContain('User');
      expect(formatted).toContain('interface User');
    });

    it('should format context with minimal template', () => {
      const sources = [
        {
          id: 'func-1',
          content: 'function test() { return 1; }',
          metadata: {
            title: 'Test Function',
            type: 'function' as const,
            relevance: 0.7
          }
        }
      ];

      const formatted = enhancer.formatContext(sources, undefined, {
        template: 'minimal'
      });

      expect(formatted).toContain('test');
    });

    it('should group sources by type', () => {
      const sources = [
        {
          id: 'import-1',
          content: "import A from 'a';",
          metadata: { type: 'import' as const, relevance: 0.9 }
        },
        {
          id: 'type-1',
          content: 'type B = string;',
          metadata: { type: 'type' as const, relevance: 0.8 }
        },
        {
          id: 'import-2',
          content: "import C from 'c';",
          metadata: { type: 'import' as const, relevance: 0.7 }
        }
      ];

      const formatted = enhancer.formatContext(sources, undefined, {
        groupByType: true
      });

      expect(formatted).toContain('Imports');
      expect(formatted).toContain('Type Definitions');
    });

    it('should truncate long content', () => {
      const longContent = 'a'.repeat(1000);
      const sources = [
        {
          id: 'long-1',
          content: longContent,
          metadata: { type: 'function' as const, relevance: 0.5 }
        }
      ];

      const formatted = enhancer.formatContext(sources, undefined, {
        maxContentLength: 100
      });

      expect(formatted.length).toBeLessThan(longContent.length + 200);
      expect(formatted).toContain('...');
    });
  });

  describe('Caching', () => {
    it('should cache enhancement results', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: 'const x = 1;'
      };

      const result1 = await enhancer.enhance(query);
      const result2 = await enhancer.enhance(query);

      // Results should be identical (from cache)
      expect(result1).toBe(result2);
    });

    it('should use different cache entries for different queries', async () => {
      const query1: SuggestionEnhancementQuery = {
        sourceCode: 'const x = 1;'
      };

      const query2: SuggestionEnhancementQuery = {
        sourceCode: 'const y = 2;'
      };

      const result1 = await enhancer.enhance(query1);
      const result2 = await enhancer.enhance(query2);

      // Results should be different
      expect(result1).not.toBe(result2);
      expect(result1.sourceCode).not.toBe(result2.sourceCode);
    });

    it('should clear cache', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: 'const x = 1;'
      };

      await enhancer.enhance(query);
      expect(enhancer.getCacheStats().size).toBeGreaterThan(0);

      enhancer.clearCache();
      expect(enhancer.getCacheStats().size).toBe(0);
    });

    it('should respect cache TTL', async () => {
      const shortTTL = 100; // 100ms
      const shortEnhancer = createSuggestionEnhancer({ cacheTTL: shortTTL });

      const query: SuggestionEnhancementQuery = {
        sourceCode: 'const x = 1;'
      };

      await shortEnhancer.enhance(query);
      expect(shortEnhancer.getCacheStats().size).toBe(1);

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, shortTTL + 50));

      expect(shortEnhancer.getCacheStats().size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid source code gracefully', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: 'this is not valid typescript!@#$%'
      };

      const enhanced = await enhancer.enhance(query);

      // Should return minimal enhancement without crashing
      expect(enhanced).toBeDefined();
      expect(enhanced.sourceCode).toBe(query.sourceCode);
    });

    it('should handle empty source code', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: ''
      };

      const enhanced = await enhancer.enhance(query);

      expect(enhanced).toBeDefined();
      expect(enhanced.contextSources).toBeDefined();
    });

    it('should include warnings in optimization results', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: 'const x = 1;',
        optimizationOptions: {
          tokenBudget: 10000 // Very large budget
        }
      };

      const enhanced = await enhancer.enhance(query);

      // Should have low utilization warning
      if (enhanced.stats.tokenUtilization < 50) {
        expect(enhanced.optimization.warnings.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Batch Enhancement', () => {
    it('should enhance multiple queries in parallel', async () => {
      const queries: SuggestionEnhancementQuery[] = [
        { sourceCode: 'const x = 1;' },
        { sourceCode: 'const y = 2;' },
        { sourceCode: 'const z = 3;' }
      ];

      const results = await enhancer.enhanceMany(queries);

      expect(results).toHaveLength(3);
      expect(results[0].sourceCode).toBe('const x = 1;');
      expect(results[1].sourceCode).toBe('const y = 2;');
      expect(results[2].sourceCode).toBe('const z = 3;');
    });

    it('should handle mixed success and failure in batch', async () => {
      const queries: SuggestionEnhancementQuery[] = [
        { sourceCode: 'const valid = 1;' },
        { sourceCode: 'also valid' }
      ];

      const results = await enhancer.enhanceMany(queries);

      expect(results).toHaveLength(2);
      expect(results[0]).toBeDefined();
      expect(results[1]).toBeDefined();
    });
  });

  describe('Statistics', () => {
    it('should provide detailed statistics', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: `
import React from 'react';

interface Props {
  name: string;
}

export function MyComponent({ name }: Props) {
  return <div>{name}</div>;
}
        `.trim()
      };

      const enhanced = await enhancer.enhance(query);

      expect(enhanced.stats.importsIncluded).toBeGreaterThanOrEqual(0);
      expect(enhanced.stats.typesIncluded).toBeGreaterThanOrEqual(0);
      expect(enhanced.stats.functionsIncluded).toBeGreaterThanOrEqual(0);
      expect(enhanced.stats.tokenUtilization).toBeGreaterThanOrEqual(0);
      expect(enhanced.stats.optimizationStrategy).toBeDefined();
    });

    it('should track excluded sources', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: `
import A from 'a';
import B from 'b';
import C from 'c';
import D from 'd';
        `.trim(),
        optimizationOptions: {
          tokenBudget: 50 // Very limited budget
        }
      };

      const enhanced = await enhancer.enhance(query);

      if (enhanced.optimization.excludedSources.length > 0) {
        expect(enhanced.optimization.excludedSources[0]).toHaveProperty('id');
        expect(enhanced.optimization.excludedSources[0]).toHaveProperty('content');
      }
    });
  });

  describe('Recommendations', () => {
    it('should provide recommendations for low utilization', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: 'const x = 1;',
        optimizationOptions: {
          tokenBudget: 10000
        }
      };

      const enhanced = await enhancer.enhance(query);
      const recommendations = enhancer.getRecommendations(enhanced);

      if (enhanced.stats.tokenUtilization < 50) {
        expect(recommendations.length).toBeGreaterThan(0);
        expect(recommendations.some(r => r.includes('utilization'))).toBe(true);
      }
    });

    it('should provide recommendations for low relevance', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: 'const x = 1;',
        optimizationOptions: {
          minRelevanceScore: 0.05
        }
      };

      const enhanced = await enhancer.enhance(query);
      const recommendations = enhancer.getRecommendations(enhanced);

      if (enhanced.relevanceScore < 0.5) {
        expect(recommendations.length).toBeGreaterThan(0);
      }
    });

    it('should provide recommendations for missing conventions', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: 'const x = 1;',
        contextOptions: {
          includeConventions: true
        }
      };

      const enhanced = await enhancer.enhance(query);
      const recommendations = enhancer.getRecommendations(enhanced);

      if (enhanced.stats.conventionsIncluded === 0) {
        expect(recommendations.some(r => r.includes('convention'))).toBe(true);
      }
    });
  });

  describe('Factory Functions', () => {
    it('should create enhancer with factory', () => {
      const newEnhancer = createSuggestionEnhancer();

      expect(newEnhancer).toBeInstanceOf(SuggestionEnhancer);
    });

    it('should create enhancer with options', () => {
      const newEnhancer = createSuggestionEnhancer({
        cacheTTL: 1000,
        defaultOptimizationOptions: {
          tokenBudget: 2000
        }
      });

      expect(newEnhancer).toBeInstanceOf(SuggestionEnhancer);
      expect(newEnhancer.getCacheStats().ttl).toBe(1000);
    });

    it('should get default enhancer', () => {
      const defaultEnhancer1 = getDefaultEnhancer();
      const defaultEnhancer2 = getDefaultEnhancer();

      expect(defaultEnhancer1).toBe(defaultEnhancer2);
    });

    it('should reset default enhancer', () => {
      const defaultEnhancer1 = getDefaultEnhancer();
      resetDefaultEnhancer();
      const defaultEnhancer2 = getDefaultEnhancer();

      expect(defaultEnhancer1).not.toBe(defaultEnhancer2);
    });
  });

  describe('Cache Statistics', () => {
    it('should provide cache statistics', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: 'const x = 1;'
      };

      await enhancer.enhance(query);

      const stats = enhancer.getCacheStats();

      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('ttl');
      expect(stats).toHaveProperty('contextBuilder');
      expect(stats.size).toBeGreaterThanOrEqual(0);
    });

    it('should track cache keys', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: 'const x = 1;'
      };

      await enhancer.enhance(query);

      const stats = enhancer.getCacheStats();

      expect(stats.keys).toBeDefined();
      expect(Array.isArray(stats.keys)).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should integrate context building and optimization', async () => {
      const query: SuggestionEnhancementQuery = {
        sourceCode: `
import React, { useState } from 'react';

interface User {
  id: number;
  name: string;
}

export function UserProfile({ user }: { user: User }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div onClick={() => setIsExpanded(!isExpanded)}>
      <h1>{user.name}</h1>
    </div>
  );
}
        `.trim(),
        intent: 'create a user profile component',
        optimizationOptions: {
          tokenBudget: 1000,
          strategy: OptimizationStrategy.BALANCED
        }
      };

      const enhanced = await enhancer.enhance(query);

      expect(enhanced.contextSources.length).toBeGreaterThan(0);
      expect(enhanced.totalTokens).toBeLessThanOrEqual(1000);
      expect(enhanced.formattedContext).toBeDefined();
      expect(enhanced.stats.importsIncluded).toBeGreaterThan(0);
      expect(enhanced.stats.typesIncluded).toBeGreaterThan(0);
      expect(enhanced.stats.functionsIncluded).toBeGreaterThan(0);
    });
  });
});
