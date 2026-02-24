/**
 * Unit tests for related-code-finder.ts
 * Tests related code discovery from TypeScript/JavaScript code
 */

import {
  RelatedCodeFinder,
  findRelatedCode,
  findRelatedCodeWithResolver,
  RelationshipType,
  RelatedCodeFinderOptions,
  RelatedCodeResult,
  RelatedCodeElement
} from '../related-code-finder';

describe('RelatedCodeFinder', () => {
  let finder: RelatedCodeFinder;

  beforeEach(() => {
    finder = new RelatedCodeFinder();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(finder).toBeDefined();
      expect(finder.getCacheStats().size).toBe(0);
    });

    it('should initialize with custom configuration', () => {
      const options: RelatedCodeFinderOptions = {
        enableCache: false,
        maxDepth: 3,
        minRelevanceScore: 0.5,
        maxResults: 50,
        includeTransitive: false
      };
      const customFinder = new RelatedCodeFinder(options);

      expect(customFinder).toBeDefined();
    });
  });

  describe('Import Relationships', () => {
    it('should find related code from default imports', () => {
      const code = `import React from 'react';`;
      const result = finder.findRelated('test.ts', code);

      expect(result.relatedElements.length).toBeGreaterThan(0);
      const reactElement = result.relatedElements.find(el => el.name === 'React');
      expect(reactElement).toBeDefined();
      expect(reactElement?.relationshipType).toBe(RelationshipType.IMPORT);
      expect(reactElement?.filePath).toContain('react');
    });

    it('should find related code from named imports', () => {
      const code = `import { useState, useEffect } from 'react';`;
      const result = finder.findRelated('test.ts', code);

      expect(result.relatedElements.length).toBeGreaterThanOrEqual(2);
      const useStateElement = result.relatedElements.find(el => el.name === 'useState');
      const useEffectElement = result.relatedElements.find(el => el.name === 'useEffect');

      expect(useStateElement).toBeDefined();
      expect(useStateElement?.relationshipType).toBe(RelationshipType.IMPORT);
      expect(useEffectElement).toBeDefined();
      expect(useEffectElement?.relationshipType).toBe(RelationshipType.IMPORT);
    });

    it('should find related code from namespace imports', () => {
      const code = `import * as React from 'react';`;
      const result = finder.findRelated('test.ts', code);

      expect(result.relatedElements.length).toBeGreaterThan(0);
      const reactElement = result.relatedElements.find(el => el.name === 'React');
      expect(reactElement).toBeDefined();
      expect(reactElement?.elementType).toBe('module');
      expect(reactElement?.relationshipType).toBe(RelationshipType.IMPORT);
    });

    it('should find related code from relative imports', () => {
      const code = `import { MyComponent } from './components/MyComponent';`;
      const result = finder.findRelated('src/index.ts', code);

      expect(result.relatedElements.length).toBeGreaterThan(0);
      const componentElement = result.relatedElements.find(el => el.name === 'MyComponent');
      expect(componentElement).toBeDefined();
      expect(componentElement?.filePath).toContain('components');
    });

    it('should track direct dependencies', () => {
      const code = `
        import React from 'react';
        import { useState } from 'react';
        import { MyComponent } from './MyComponent';
      `;
      const result = finder.findRelated('test.ts', code);

      expect(result.directDependencies.length).toBeGreaterThan(0);
    });
  });

  describe('Type Relationships', () => {
    it('should find related interfaces', () => {
      const code = `
        interface User {
          id: string;
          name: string;
        }
      `;
      const result = finder.findRelated('test.ts', code);

      const userInterface = result.relatedElements.find(el => el.name === 'User');
      expect(userInterface).toBeDefined();
      expect(userInterface?.elementType).toBe('interface');
      expect(userInterface?.relationshipType).toBe(RelationshipType.SAME_MODULE);
    });

    it('should find related type aliases', () => {
      const code = `
        type UserId = string;
        type Status = 'active' | 'inactive';
      `;
      const result = finder.findRelated('test.ts', code);

      const userIdType = result.relatedElements.find(el => el.name === 'UserId');
      const statusType = result.relatedElements.find(el => el.name === 'Status');

      expect(userIdType).toBeDefined();
      expect(userIdType?.elementType).toBe('type');
      expect(statusType).toBeDefined();
      expect(statusType?.elementType).toBe('type');
    });

    it('should find related classes', () => {
      const code = `
        class UserService {
          constructor() {}
          getUser(id: string) {}
        }
      `;
      const result = finder.findRelated('test.ts', code);

      const userServiceClass = result.relatedElements.find(el => el.name === 'UserService');
      expect(userServiceClass).toBeDefined();
      expect(userServiceClass?.elementType).toBe('class');
    });

    it('should find related enums', () => {
      const code = `
        enum UserRole {
          Admin,
          User,
          Guest
        }
      `;
      const result = finder.findRelated('test.ts', code);

      const roleEnum = result.relatedElements.find(el => el.name === 'UserRole');
      expect(roleEnum).toBeDefined();
      expect(roleEnum?.elementType).toBe('enum');
    });

    it('should find parent type relationships', () => {
      const code = `
        interface BaseEntity {
          id: string;
        }

        interface User extends BaseEntity {
          name: string;
        }
      `;
      const result = finder.findRelated('test.ts', code);

      const baseEntity = result.relatedElements.find(
        el => el.name === 'BaseEntity' && el.relationshipType === RelationshipType.PARENT_CHILD
      );
      expect(baseEntity).toBeDefined();
    });
  });

  describe('Function Relationships', () => {
    it('should find related functions', () => {
      const code = `
        function calculateTotal(items: number[]): number {
          return items.reduce((sum, item) => sum + item, 0);
        }

        function processOrder(orderId: string) {
          // implementation
        }
      `;
      const result = finder.findRelated('test.ts', code);

      const calculateTotal = result.relatedElements.find(el => el.name === 'calculateTotal');
      const processOrder = result.relatedElements.find(el => el.name === 'processOrder');

      expect(calculateTotal).toBeDefined();
      expect(calculateTotal?.elementType).toBe('function');
      expect(processOrder).toBeDefined();
      expect(processOrder?.elementType).toBe('function');
    });

    it('should find related methods and their parent class', () => {
      const code = `
        class OrderService {
          processOrder(id: string) {
            return this.validateOrder(id);
          }

          private validateOrder(id: string) {
            return true;
          }
        }
      `;
      const result = finder.findRelated('test.ts', code);

      const processOrder = result.relatedElements.find(
        el => el.name === 'processOrder' && el.elementType === 'function'
      );
      const validateOrder = result.relatedElements.find(
        el => el.name === 'validateOrder' && el.elementType === 'function'
      );
      const orderServiceClass = result.relatedElements.find(
        el => el.name === 'OrderService' && el.elementType === 'class'
      );

      expect(processOrder).toBeDefined();
      expect(validateOrder).toBeDefined();
      expect(orderServiceClass).toBeDefined();
    });

    it('should find arrow functions', () => {
      const code = `
        const add = (a: number, b: number) => a + b;
        const multiply = (a: number, b: number) => a * b;
      `;
      const result = finder.findRelated('test.ts', code);

      expect(result.relatedElements.length).toBeGreaterThan(0);
    });
  });

  describe('Relevance Scoring', () => {
    it('should assign higher relevance to direct imports', () => {
      const code = `
        import { useState } from 'react';
        function Component() {}
      `;
      const result = finder.findRelated('test.ts', code);

      const importElement = result.relatedElements.find(
        el => el.relationshipType === RelationshipType.IMPORT
      );
      const sameModuleElement = result.relatedElements.find(
        el => el.relationshipType === RelationshipType.SAME_MODULE
      );

      if (importElement && sameModuleElement) {
        expect(importElement.relevanceScore).toBeGreaterThan(sameModuleElement.relevanceScore);
      }
    });

    it('should filter by minimum relevance score', () => {
      const options: RelatedCodeFinderOptions = {
        minRelevanceScore: 0.7
      };
      const customFinder = new RelatedCodeFinder(options);

      const code = `
        import React from 'react';
        function test() {}
      `;
      const result = customFinder.findRelated('test.ts', code);

      result.relatedElements.forEach(el => {
        expect(el.relevanceScore).toBeGreaterThanOrEqual(0.7);
      });
    });

    it('should sort by relevance score', () => {
      const code = `
        import { useState, useEffect } from 'react';
        interface User { id: string; }
        function getUser() {}
      `;
      const result = finder.findRelated('test.ts', code);

      for (let i = 1; i < result.relatedElements.length; i++) {
        expect(result.relatedElements[i - 1].relevanceScore)
          .toBeGreaterThanOrEqual(result.relatedElements[i].relevanceScore);
      }
    });
  });

  describe('Result Grouping', () => {
    it('should group elements by relationship type', () => {
      const code = `
        import React from 'react';
        interface User { id: string; }
        function getUser() {}
      `;
      const result = finder.findRelated('test.ts', code);

      expect(result.byRelationship[RelationshipType.IMPORT].length).toBeGreaterThan(0);
      expect(result.byRelationship[RelationshipType.SAME_MODULE].length).toBeGreaterThan(0);
    });

    it('should group elements by element type', () => {
      const code = `
        import React from 'react';
        interface User { id: string; }
        function getUser() {}
      `;
      const result = finder.findRelated('test.ts', code);

      expect(result.byElementType).toBeDefined();
      if (result.byElementType['interface']) {
        expect(result.byElementType['interface'].length).toBeGreaterThan(0);
      }
      if (result.byElementType['function']) {
        expect(result.byElementType['function'].length).toBeGreaterThan(0);
      }
    });
  });

  describe('Statistics', () => {
    it('should calculate correct statistics', () => {
      const code = `
        import { useState, useEffect } from 'react';
        interface User { id: string; }
        function getUser() {}
      `;
      const result = finder.findRelated('test.ts', code);

      expect(result.stats.total).toBe(result.relatedElements.length);
      expect(result.stats.averageRelevance).toBeGreaterThan(0);
      expect(result.stats.averageRelevance).toBeLessThanOrEqual(1);
    });

    it('should count by relationship type', () => {
      const code = `
        import React from 'react';
        import { useState } from 'react';
      `;
      const result = finder.findRelated('test.ts', code);

      expect(result.stats.byRelationship[RelationshipType.IMPORT]).toBeGreaterThan(0);
    });

    it('should count by element type', () => {
      const code = `
        interface User { id: string; }
        type UserId = string;
        function getUser() {}
      `;
      const result = finder.findRelated('test.ts', code);

      expect(result.stats.byElementType).toBeDefined();
    });
  });

  describe('Caching', () => {
    it('should cache results', () => {
      const code = `import React from 'react';`;

      const result1 = finder.findRelated('test.ts', code);
      const result2 = finder.findRelated('test.ts', code);

      expect(result1).toEqual(result2);
      expect(finder.getCacheStats().size).toBe(1);
    });

    it('should respect cache TTL', () => {
      const shortTtlFinder = new RelatedCodeFinder({
        cacheTtl: 0 // Expire immediately
      });

      const code = `import React from 'react';`;
      shortTtlFinder.findRelated('test.ts', code);

      // Wait a bit for TTL to expire
      setTimeout(() => {
        shortTtlFinder.findRelated('test.ts', code);
      }, 10);
    });

    it('should allow disabling cache', () => {
      const noCacheFinder = new RelatedCodeFinder({
        enableCache: false
      });

      const code = `import React from 'react';`;
      noCacheFinder.findRelated('test.ts', code);

      expect(noCacheFinder.getCacheStats().size).toBe(0);
    });

    it('should clear cache', () => {
      const code = `import React from 'react';`;
      finder.findRelated('test.ts', code);

      expect(finder.getCacheStats().size).toBeGreaterThan(0);

      finder.clearCache();

      expect(finder.getCacheStats().size).toBe(0);
    });

    it('should evict old entries when cache is full', () => {
      const smallCacheFinder = new RelatedCodeFinder({
        maxCacheSize: 2
      });

      smallCacheFinder.findRelated('test1.ts', 'import A from "a";');
      smallCacheFinder.findRelated('test2.ts', 'import B from "b";');
      smallCacheFinder.findRelated('test3.ts', 'import C from "c";');

      expect(smallCacheFinder.getCacheStats().size).toBeLessThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle empty code', () => {
      const result = finder.findRelated('test.ts', '');

      expect(result.relatedElements).toEqual([]);
      expect(result.stats.total).toBe(0);
      expect(result.errors.length).toBe(0);
    });

    it('should handle invalid TypeScript code gracefully', () => {
      const code = `this is not valid typescript code {{{`;
      const result = finder.findRelated('test.ts', code);

      expect(result).toBeDefined();
      // May have errors but shouldn't throw
    });

    it('should handle code with only comments', () => {
      const code = `
        // This is a comment
        /* This is a block comment */
      `;
      const result = finder.findRelated('test.ts', code);

      expect(result.relatedElements.length).toBe(0);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle mixed imports and declarations', () => {
      const code = `
        import React, { useState, useEffect } from 'react';
        import { User } from './types';

        interface Props {
          userId: string;
        }

        export function UserComponent({ userId }: Props) {
          const [user, setUser] = useState<User | null>(null);

          useEffect(() => {
            // fetch user
          }, [userId]);

          return null;
        }
      `;
      const result = finder.findRelated('components/UserComponent.tsx', code);

      expect(result.relatedElements.length).toBeGreaterThan(0);
      expect(result.stats.total).toBeGreaterThan(0);
    });

    it('should handle class inheritance', () => {
      const code = `
        class BaseService {
          protected apiUrl: string;
        }

        class UserService extends BaseService {
          getUser(id: string) {}
        }
      `;
      const result = finder.findRelated('services/UserService.ts', code);

      const baseService = result.relatedElements.find(el => el.name === 'BaseService');
      expect(baseService).toBeDefined();
    });

    it('should handle generic types', () => {
      const code = `
        interface Container<T> {
          value: T;
        }

        type StringContainer = Container<string>;
      `;
      const result = finder.findRelated('test.ts', code);

      expect(result.relatedElements.length).toBeGreaterThan(0);
    });
  });

  describe('Options', () => {
    it('should respect maxResults option', () => {
      const limitedFinder = new RelatedCodeFinder({
        maxResults: 5
      });

      const code = `
        import { a, b, c, d, e, f, g, h } from 'module';
        function fn1() {}
        function fn2() {}
        function fn3() {}
      `;
      const result = limitedFinder.findRelated('test.ts', code);

      expect(result.relatedElements.length).toBeLessThanOrEqual(5);
    });

    it('should use custom import resolver', () => {
      const customResolver = (importPath: string, fromFile: string): string | null => {
        if (importPath === './custom') {
          return '/absolute/path/to/custom.ts';
        }
        return null;
      };

      const customFinder = new RelatedCodeFinder({
        resolveImport: customResolver
      });

      const code = `import { Something } from './custom';`;
      const result = customFinder.findRelated('test.ts', code);

      const element = result.relatedElements.find(el => el.name === 'Something');
      expect(element?.filePath).toBe('/absolute/path/to/custom.ts');
    });
  });

  describe('Convenience Functions', () => {
    it('should work with findRelatedCode helper', () => {
      const code = `import React from 'react';`;
      const result = findRelatedCode('test.ts', code);

      expect(result).toBeDefined();
      expect(result.relatedElements.length).toBeGreaterThan(0);
    });

    it('should work with findRelatedCodeWithResolver helper', () => {
      const resolver = (importPath: string) => importPath + '.ts';
      const code = `import { Test } from './test';`;
      const result = findRelatedCodeWithResolver('index.ts', code, resolver);

      expect(result).toBeDefined();
    });

    it('should pass options to convenience functions', () => {
      const code = `import React from 'react';`;
      const result = findRelatedCode('test.ts', code, {
        maxResults: 10,
        minRelevanceScore: 0.5
      });

      expect(result.relatedElements.length).toBeLessThanOrEqual(10);
      result.relatedElements.forEach(el => {
        expect(el.relevanceScore).toBeGreaterThanOrEqual(0.5);
      });
    });
  });

  describe('Import Statement Preservation', () => {
    it('should preserve original import statement', () => {
      const code = `import { useState } from 'react';`;
      const result = finder.findRelated('test.ts', code);

      const element = result.relatedElements.find(el => el.name === 'useState');
      expect(element?.importStatement).toBeDefined();
      expect(element?.importStatement?.moduleSpecifier).toBe('react');
    });
  });

  describe('Documentation Extraction', () => {
    it('should extract JSDoc comments from functions', () => {
      const code = `
        /**
         * Gets a user by ID
         * @param id User identifier
         */
        function getUser(id: string) {}
      `;
      const result = finder.findRelated('test.ts', code);

      const getUserFn = result.relatedElements.find(el => el.name === 'getUser');
      expect(getUserFn?.documentation).toBeDefined();
    });

    it('should extract JSDoc comments from types', () => {
      const code = `
        /**
         * Represents a user in the system
         */
        interface User {
          id: string;
        }
      `;
      const result = finder.findRelated('test.ts', code);

      const userInterface = result.relatedElements.find(el => el.name === 'User');
      expect(userInterface?.documentation).toBeDefined();
    });
  });

  describe('Line Number Tracking', () => {
    it('should track line numbers for imports', () => {
      const code = `
import React from 'react';
import { useState } from 'react';
      `;
      const result = finder.findRelated('test.ts', code);

      result.relatedElements.forEach(el => {
        if (el.relationshipType === RelationshipType.IMPORT && el.line) {
          expect(el.line).toBeGreaterThan(0);
        }
      });
    });

    it('should track line numbers for functions', () => {
      const code = `
function first() {}

function second() {}
      `;
      const result = finder.findRelated('test.ts', code);

      const functions = result.relatedElements.filter(el => el.elementType === 'function');
      functions.forEach(fn => {
        expect(fn.line).toBeGreaterThan(0);
      });
    });
  });

  describe('Distance Calculation', () => {
    it('should set distance to 0 for same-module elements', () => {
      const code = `
        function test() {}
        interface User {}
      `;
      const result = finder.findRelated('test.ts', code);

      result.relatedElements.forEach(el => {
        if (el.relationshipType === RelationshipType.SAME_MODULE) {
          expect(el.distance).toBe(0);
        }
      });
    });

    it('should set distance to 0 for direct imports', () => {
      const code = `import React from 'react';`;
      const result = finder.findRelated('test.ts', code);

      result.relatedElements.forEach(el => {
        if (el.relationshipType === RelationshipType.IMPORT) {
          expect(el.distance).toBe(0);
        }
      });
    });
  });
});
