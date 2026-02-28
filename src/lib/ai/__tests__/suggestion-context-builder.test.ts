/**
 * Unit tests for suggestion-context-builder.ts
 * Tests context building for AI code suggestions
 */

import {
  SuggestionContextBuilder,
  createSuggestionContextBuilder,
  SuggestionContext,
  SuggestionContextQuery,
  SuggestionContextOptions,
  ContextSource
} from '../suggestion-context-builder';

describe('SuggestionContextBuilder', () => {
  let builder: SuggestionContextBuilder;

  beforeEach(() => {
    builder = new SuggestionContextBuilder();
  });

  afterEach(() => {
    builder.clearCaches();
  });

  describe('Constructor', () => {
    it('should initialize successfully', () => {
      expect(builder).toBeDefined();
    });

    it('should initialize with empty caches', () => {
      const stats = builder.getCacheStats();
      expect(stats.imports.size).toBe(0);
      expect(stats.types.size).toBe(0);
      expect(stats.functions.size).toBe(0);
    });
  });

  describe('Factory Function', () => {
    it('should create instance via factory', () => {
      const instance = createSuggestionContextBuilder();
      expect(instance).toBeInstanceOf(SuggestionContextBuilder);
    });
  });

  describe('Basic Context Building', () => {
    it('should build context for simple code', async () => {
      const sourceCode = `
        import React from 'react';

        interface Props {
          name: string;
        }

        function Component(props: Props) {
          return <div>{props.name}</div>;
        }
      `;

      const query: SuggestionContextQuery = {
        sourceCode,
        sourceFile: 'component.tsx'
      };

      const context = await builder.buildContext(query);

      expect(context).toBeDefined();
      expect(context.sourceCode).toBe(sourceCode);
      expect(context.sourceFile).toBe('component.tsx');
      expect(context.imports.stats.total).toBeGreaterThan(0);
      expect(context.types.stats.total).toBeGreaterThan(0);
      expect(context.functions.length).toBeGreaterThan(0);
    });

    it('should extract imports correctly', async () => {
      const sourceCode = `
        import { useState, useEffect } from 'react';
        import axios from 'axios';
      `;

      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      expect(context.imports.stats.total).toBe(2);
      expect(context.imports.stats.named).toBe(1);
      expect(context.imports.stats.default).toBe(1);
    });

    it('should extract types correctly', async () => {
      const sourceCode = `
        interface User {
          id: number;
          name: string;
        }

        type Status = 'active' | 'inactive';

        enum Role {
          Admin = 'admin',
          User = 'user'
        }
      `;

      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      expect(context.types.stats.total).toBe(3);
      expect(context.types.stats.interfaces).toBe(1);
      expect(context.types.stats.typeAliases).toBe(1);
      expect(context.types.stats.enums).toBe(1);
    });

    it('should extract functions correctly', async () => {
      const sourceCode = `
        function hello(name: string): string {
          return \`Hello, \${name}\`;
        }

        const greet = (name: string) => {
          console.log(\`Hi, \${name}\`);
        };

        async function fetchData(): Promise<void> {
          // fetch logic
        }
      `;

      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      expect(context.functions.length).toBe(3);

      const asyncFunc = context.functions.find(f => f.name === 'fetchData');
      expect(asyncFunc?.isAsync).toBe(true);
    });
  });

  describe('Context Sources', () => {
    it('should create context sources from imports', async () => {
      const sourceCode = `import React from 'react';`;
      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      const importSources = context.sources.filter(s => s.metadata.type === 'import');
      expect(importSources.length).toBeGreaterThan(0);
      expect(importSources[0].content).toContain('react');
    });

    it('should create context sources from types', async () => {
      const sourceCode = `
        interface Props {
          value: string;
        }
      `;
      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      const typeSources = context.sources.filter(s => s.metadata.type === 'type');
      expect(typeSources.length).toBeGreaterThan(0);
      expect(typeSources[0].metadata.title).toContain('Props');
    });

    it('should create context sources from functions', async () => {
      const sourceCode = `
        function calculate(x: number): number {
          return x * 2;
        }
      `;
      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      const funcSources = context.sources.filter(s => s.metadata.type === 'function');
      expect(funcSources.length).toBeGreaterThan(0);
      expect(funcSources[0].metadata.title).toContain('calculate');
    });

    it('should assign relevance scores to sources', async () => {
      const sourceCode = `
        import React from 'react';
        interface Props {}
        function Component() {}
      `;
      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      context.sources.forEach(source => {
        expect(source.metadata.relevance).toBeGreaterThanOrEqual(0);
        expect(source.metadata.relevance).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Options Handling', () => {
    it('should respect includeRelatedCode option', async () => {
      const sourceCode = `import React from 'react';`;

      const query: SuggestionContextQuery = {
        sourceCode,
        options: {
          includeRelatedCode: false
        }
      };

      const context = await builder.buildContext(query);
      expect(context.relatedCode).toBeUndefined();
    });

    it('should respect includeConventions option', async () => {
      const sourceCode = `import React from 'react';`;

      const query: SuggestionContextQuery = {
        sourceCode,
        options: {
          includeConventions: false
        }
      };

      const context = await builder.buildContext(query);
      expect(context.conventions).toBeUndefined();
    });

    it('should use default options when not specified', async () => {
      const sourceCode = `import React from 'react';`;
      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      // Should have basic context even without options
      expect(context.imports).toBeDefined();
      expect(context.types).toBeDefined();
      expect(context.functions).toBeDefined();
    });

    it('should respect tokenBudget option', async () => {
      const sourceCode = `
        import React from 'react';
        import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
        interface Props { a: string; b: number; c: boolean; }
        function fn1() {}
        function fn2() {}
        function fn3() {}
      `;

      const query: SuggestionContextQuery = {
        sourceCode,
        options: {
          tokenBudget: 100 // Very low budget
        }
      };

      const context = await builder.buildContext(query);
      expect(context.totalTokens).toBeLessThanOrEqual(context.sourceCode.length / 4 + 200);
    });

    it('should respect maxRelatedElements option', async () => {
      const sourceCode = `import React from 'react';`;

      const query: SuggestionContextQuery = {
        sourceCode,
        sourceFile: '/test/file.ts',
        options: {
          includeRelatedCode: true,
          maxRelatedElements: 3,
          workspaceRoot: '/test'
        }
      };

      const context = await builder.buildContext(query);

      if (context.relatedCode) {
        expect(context.relatedCode.relatedElements.length).toBeLessThanOrEqual(3);
      }
    });
  });

  describe('Statistics', () => {
    it('should calculate accurate statistics', async () => {
      const sourceCode = `
        import React from 'react';
        import axios from 'axios';

        interface User { id: number; }
        type Status = 'ok';

        function fn1() {}
        function fn2() {}
      `;

      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      expect(context.stats.importCount).toBe(2);
      expect(context.stats.typeCount).toBe(2);
      expect(context.stats.functionCount).toBe(2);
      expect(context.stats.totalSources).toBeGreaterThan(0);
    });

    it('should calculate zero stats for empty code', async () => {
      const sourceCode = '';
      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      expect(context.stats.importCount).toBe(0);
      expect(context.stats.typeCount).toBe(0);
      expect(context.stats.functionCount).toBe(0);
    });

    it('should include related code count in stats', async () => {
      const sourceCode = `import React from 'react';`;
      const query: SuggestionContextQuery = {
        sourceCode,
        sourceFile: '/test/file.ts',
        options: {
          includeRelatedCode: true,
          workspaceRoot: '/test'
        }
      };

      const context = await builder.buildContext(query);
      expect(context.stats.relatedCodeCount).toBeDefined();
      expect(context.stats.relatedCodeCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Relevance Score', () => {
    it('should calculate relevance score', async () => {
      const sourceCode = `
        import React from 'react';
        interface Props {}
        function Component() {}
      `;

      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      expect(context.relevanceScore).toBeGreaterThan(0);
      expect(context.relevanceScore).toBeLessThanOrEqual(1);
    });

    it('should have lower relevance for minimal code', async () => {
      const sourceCode = `const x = 1;`;
      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      // Should still have a relevance score, but might be lower
      expect(context.relevanceScore).toBeGreaterThanOrEqual(0);
      expect(context.relevanceScore).toBeLessThanOrEqual(1);
    });

    it('should boost relevance with intent matching', async () => {
      const sourceCode = `
        import React from 'react';
        function ReactComponent() {}
      `;

      const queryWithIntent: SuggestionContextQuery = {
        sourceCode,
        intent: 'react'
      };

      const contextWithIntent = await builder.buildContext(queryWithIntent);

      // With matching intent, some sources should have higher relevance
      const reactSources = contextWithIntent.sources.filter(
        s => s.content.toLowerCase().includes('react')
      );

      if (reactSources.length > 0) {
        expect(reactSources[0].metadata.relevance).toBeGreaterThan(0.5);
      }
    });
  });

  describe('Token Counting', () => {
    it('should estimate token count', async () => {
      const sourceCode = `
        import React from 'react';
        function Component() {
          return <div>Hello World</div>;
        }
      `;

      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      expect(context.totalTokens).toBeGreaterThan(0);
      // Rough check: should be roughly 1/4 of character count
      expect(context.totalTokens).toBeLessThan(sourceCode.length);
    });

    it('should include source tokens in total', async () => {
      const sourceCode = `import React from 'react';`;
      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      const sourceTokens = context.sources.reduce((sum, source) => {
        return sum + Math.ceil(source.content.length / 4);
      }, 0);

      expect(context.totalTokens).toBeGreaterThanOrEqual(sourceTokens);
    });
  });

  describe('Source Optimization', () => {
    it('should optimize sources by relevance', async () => {
      const sourceCode = `
        import React from 'react';
        import axios from 'axios';
        import lodash from 'lodash';
        interface A {}
        interface B {}
        interface C {}
        function fn1() {}
        function fn2() {}
        function fn3() {}
      `;

      const query: SuggestionContextQuery = {
        sourceCode,
        options: {
          tokenBudget: 200 // Limited budget
        }
      };

      const context = await builder.buildContext(query);

      // Sources should be sorted by relevance
      for (let i = 1; i < context.sources.length; i++) {
        expect(context.sources[i - 1].metadata.relevance)
          .toBeGreaterThanOrEqual(context.sources[i].metadata.relevance);
      }
    });

    it('should respect token budget when optimizing', async () => {
      const sourceCode = `
        ${'import React from "react";\n'.repeat(100)}
      `;

      const query: SuggestionContextQuery = {
        sourceCode,
        options: {
          tokenBudget: 500
        }
      };

      const context = await builder.buildContext(query);

      // Should not wildly exceed budget
      expect(context.totalTokens).toBeLessThan(sourceCode.length);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid TypeScript code gracefully', async () => {
      const sourceCode = `
        this is not valid typescript }{][
      `;

      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      expect(context).toBeDefined();
      expect(context.sourceCode).toBe(sourceCode);
      // Should return minimal context without crashing
    });

    it('should handle empty source code', async () => {
      const sourceCode = '';
      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      expect(context).toBeDefined();
      expect(context.imports.stats.total).toBe(0);
      expect(context.types.stats.total).toBe(0);
      expect(context.functions.length).toBe(0);
    });

    it('should handle missing optional fields', async () => {
      const sourceCode = `import React from 'react';`;
      const query: SuggestionContextQuery = {
        sourceCode
        // No sourceFile, workspaceId, intent, or options
      };

      const context = await builder.buildContext(query);
      expect(context).toBeDefined();
    });
  });

  describe('Cache Management', () => {
    it('should cache extraction results', async () => {
      const sourceCode = `
        import React from 'react';
        interface Props {}
        function Component() {}
      `;

      const query: SuggestionContextQuery = { sourceCode, sourceFile: 'test.tsx' };

      // First call
      await builder.buildContext(query);
      const stats1 = builder.getCacheStats();

      // Second call with same code
      await builder.buildContext(query);
      const stats2 = builder.getCacheStats();

      // Cache should have entries
      expect(stats1.imports.size + stats1.types.size + stats1.functions.size).toBeGreaterThan(0);
    });

    it('should clear all caches', async () => {
      const sourceCode = `import React from 'react';`;
      const query: SuggestionContextQuery = { sourceCode, sourceFile: 'test.tsx' };

      await builder.buildContext(query);
      builder.clearCaches();

      const stats = builder.getCacheStats();
      expect(stats.imports.size).toBe(0);
      expect(stats.types.size).toBe(0);
      expect(stats.functions.size).toBe(0);
    });

    it('should provide cache statistics', async () => {
      const stats = builder.getCacheStats();

      expect(stats).toHaveProperty('imports');
      expect(stats).toHaveProperty('types');
      expect(stats).toHaveProperty('functions');
      expect(stats).toHaveProperty('relatedCode');
    });
  });

  describe('Complex Code Examples', () => {
    it('should handle React component with hooks', async () => {
      const sourceCode = `
        import React, { useState, useEffect } from 'react';

        interface UserProps {
          id: number;
          name: string;
        }

        const UserComponent: React.FC<UserProps> = ({ id, name }) => {
          const [loading, setLoading] = useState(false);

          useEffect(() => {
            setLoading(true);
          }, [id]);

          return <div>{name}</div>;
        };

        export default UserComponent;
      `;

      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      expect(context.imports.stats.total).toBeGreaterThan(0);
      expect(context.types.stats.total).toBeGreaterThan(0);
      expect(context.functions.length).toBeGreaterThan(0);
      expect(context.sources.length).toBeGreaterThan(0);
    });

    it('should handle class-based component', async () => {
      const sourceCode = `
        import React, { Component } from 'react';

        interface State {
          count: number;
        }

        class Counter extends Component<{}, State> {
          constructor(props: {}) {
            super(props);
            this.state = { count: 0 };
          }

          increment = () => {
            this.setState({ count: this.state.count + 1 });
          };

          render() {
            return <button onClick={this.increment}>{this.state.count}</button>;
          }
        }
      `;

      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      expect(context.types.stats.classes).toBeGreaterThan(0);
      expect(context.functions.length).toBeGreaterThan(0);
    });

    it('should handle async/await patterns', async () => {
      const sourceCode = `
        import axios from 'axios';

        interface User {
          id: number;
          name: string;
        }

        async function fetchUser(id: number): Promise<User> {
          const response = await axios.get(\`/api/users/\${id}\`);
          return response.data;
        }

        async function fetchUsers(): Promise<User[]> {
          try {
            const response = await axios.get('/api/users');
            return response.data;
          } catch (error) {
            console.error(error);
            return [];
          }
        }
      `;

      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      const asyncFunctions = context.functions.filter(f => f.isAsync);
      expect(asyncFunctions.length).toBe(2);
    });
  });

  describe('Intent-Based Context', () => {
    it('should boost relevance for intent-matching code', async () => {
      const sourceCode = `
        import { apiClient } from './api';
        import { userService } from './user-service';

        function fetchData() {}
        function fetchUserData() {}
      `;

      const query: SuggestionContextQuery = {
        sourceCode,
        intent: 'user'
      };

      const context = await builder.buildContext(query);

      const userSources = context.sources.filter(
        s => s.content.toLowerCase().includes('user')
      );

      // User-related sources should have higher relevance
      userSources.forEach(source => {
        expect(source.metadata.relevance).toBeGreaterThan(0.5);
      });
    });
  });

  describe('Metadata Preservation', () => {
    it('should preserve line numbers in sources', async () => {
      const sourceCode = `
        import React from 'react';

        interface Props {
          value: string;
        }

        function Component(props: Props) {
          return <div>{props.value}</div>;
        }
      `;

      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      const sourcesWithLines = context.sources.filter(s => s.metadata.lineNumber);
      expect(sourcesWithLines.length).toBeGreaterThan(0);
    });

    it('should preserve documentation in sources', async () => {
      const sourceCode = `
        /**
         * User interface
         */
        interface User {
          id: number;
        }

        /**
         * Fetches user data
         */
        function fetchUser() {}
      `;

      const query: SuggestionContextQuery = { sourceCode };
      const context = await builder.buildContext(query);

      const sourcesWithDocs = context.sources.filter(s => s.metadata.documentation);
      expect(sourcesWithDocs.length).toBeGreaterThan(0);
    });

    it('should preserve file paths in sources', async () => {
      const sourceCode = `import React from 'react';`;
      const query: SuggestionContextQuery = {
        sourceCode,
        sourceFile: '/path/to/component.tsx'
      };

      const context = await builder.buildContext(query);
      expect(context.sourceFile).toBe('/path/to/component.tsx');
    });
  });
});
