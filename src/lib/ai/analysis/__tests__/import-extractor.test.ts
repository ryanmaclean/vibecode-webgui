/**
 * Unit tests for import-extractor.ts
 * Tests import extraction from TypeScript/JavaScript code
 */

import {
  ImportExtractor,
  createImportExtractor,
  ImportType,
  ImportExtractionResult,
  ImportExtractorOptions
} from '../import-extractor';

describe('ImportExtractor', () => {
  let extractor: ImportExtractor;

  beforeEach(() => {
    extractor = new ImportExtractor();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(extractor).toBeDefined();
      expect(extractor.getCacheStats().size).toBe(0);
    });

    it('should initialize with custom configuration', () => {
      const options: ImportExtractorOptions = {
        enableCache: false,
        includeSideEffects: false,
        includeTypeOnlyImports: false
      };
      const customExtractor = new ImportExtractor(options);

      expect(customExtractor).toBeDefined();
    });
  });

  describe('Default Imports', () => {
    it('should extract default import', () => {
      const code = `import React from 'react';`;
      const result = extractor.extract(code);

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].type).toBe(ImportType.DEFAULT);
      expect(result.imports[0].moduleSpecifier).toBe('react');
      expect(result.imports[0].bindings).toHaveLength(1);
      expect(result.imports[0].bindings[0].name).toBe('React');
      expect(result.imports[0].isTypeOnly).toBe(false);
    });

    it('should extract multiple default imports', () => {
      const code = `
        import React from 'react';
        import express from 'express';
      `;
      const result = extractor.extract(code);

      expect(result.imports).toHaveLength(2);
      expect(result.stats.default).toBe(2);
      expect(result.imports[0].bindings[0].name).toBe('React');
      expect(result.imports[1].bindings[0].name).toBe('express');
    });

    it('should track line numbers for default imports', () => {
      const code = `import React from 'react';`;
      const result = extractor.extract(code);

      expect(result.imports[0].line).toBe(1);
    });
  });

  describe('Named Imports', () => {
    it('should extract single named import', () => {
      const code = `import { useState } from 'react';`;
      const result = extractor.extract(code);

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].type).toBe(ImportType.NAMED);
      expect(result.imports[0].bindings).toHaveLength(1);
      expect(result.imports[0].bindings[0].name).toBe('useState');
    });

    it('should extract multiple named imports', () => {
      const code = `import { useState, useEffect, useCallback } from 'react';`;
      const result = extractor.extract(code);

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].bindings).toHaveLength(3);
      expect(result.imports[0].bindings[0].name).toBe('useState');
      expect(result.imports[0].bindings[1].name).toBe('useEffect');
      expect(result.imports[0].bindings[2].name).toBe('useCallback');
    });

    it('should extract aliased named imports', () => {
      const code = `import { useState as state, useEffect as effect } from 'react';`;
      const result = extractor.extract(code);

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].bindings).toHaveLength(2);
      expect(result.imports[0].bindings[0].name).toBe('state');
      expect(result.imports[0].bindings[0].propertyName).toBe('useState');
      expect(result.imports[0].bindings[1].name).toBe('effect');
      expect(result.imports[0].bindings[1].propertyName).toBe('useEffect');
    });

    it('should extract mixed aliased and non-aliased named imports', () => {
      const code = `import { useState, useEffect as effect } from 'react';`;
      const result = extractor.extract(code);

      expect(result.imports[0].bindings).toHaveLength(2);
      expect(result.imports[0].bindings[0].name).toBe('useState');
      expect(result.imports[0].bindings[0].propertyName).toBeUndefined();
      expect(result.imports[0].bindings[1].name).toBe('effect');
      expect(result.imports[0].bindings[1].propertyName).toBe('useEffect');
    });
  });

  describe('Namespace Imports', () => {
    it('should extract namespace import', () => {
      const code = `import * as React from 'react';`;
      const result = extractor.extract(code);

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].type).toBe(ImportType.NAMESPACE);
      expect(result.imports[0].bindings).toHaveLength(1);
      expect(result.imports[0].bindings[0].name).toBe('React');
    });

    it('should extract multiple namespace imports', () => {
      const code = `
        import * as React from 'react';
        import * as fs from 'fs';
      `;
      const result = extractor.extract(code);

      expect(result.imports).toHaveLength(2);
      expect(result.stats.namespace).toBe(2);
    });
  });

  describe('Side-Effect Imports', () => {
    it('should extract side-effect import', () => {
      const code = `import './styles.css';`;
      const result = extractor.extract(code);

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].type).toBe(ImportType.SIDE_EFFECT);
      expect(result.imports[0].bindings).toHaveLength(0);
      expect(result.imports[0].moduleSpecifier).toBe('./styles.css');
    });

    it('should filter side-effect imports when disabled', () => {
      const code = `import './styles.css';`;
      const customExtractor = new ImportExtractor({ includeSideEffects: false });
      const result = customExtractor.extract(code);

      expect(result.imports).toHaveLength(0);
    });
  });

  describe('Type-Only Imports', () => {
    it('should extract type-only default import', () => {
      const code = `import type React from 'react';`;
      const result = extractor.extract(code);

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].isTypeOnly).toBe(true);
      expect(result.stats.typeOnly).toBe(1);
    });

    it('should extract type-only named imports', () => {
      const code = `import type { FC, ReactNode } from 'react';`;
      const result = extractor.extract(code);

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].isTypeOnly).toBe(true);
    });

    it('should extract mixed type-only and regular named imports', () => {
      const code = `import { useState, type FC } from 'react';`;
      const result = extractor.extract(code);

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].bindings).toHaveLength(2);
      expect(result.imports[0].bindings[0].isTypeOnly).toBe(false);
      expect(result.imports[0].bindings[1].isTypeOnly).toBe(true);
    });

    it('should filter type-only imports when disabled', () => {
      const code = `import type { FC } from 'react';`;
      const customExtractor = new ImportExtractor({ includeTypeOnlyImports: false });
      const result = customExtractor.extract(code);

      expect(result.imports).toHaveLength(0);
    });
  });

  describe('External vs Internal Imports', () => {
    it('should categorize external package imports', () => {
      const code = `
        import React from 'react';
        import express from 'express';
      `;
      const result = extractor.extract(code);

      expect(result.externalPackages).toHaveLength(2);
      expect(result.externalPackages).toContain('react');
      expect(result.externalPackages).toContain('express');
      expect(result.internalImports).toHaveLength(0);
    });

    it('should categorize internal relative imports', () => {
      const code = `
        import { foo } from './foo';
        import { bar } from '../bar';
      `;
      const result = extractor.extract(code);

      expect(result.internalImports).toHaveLength(2);
      expect(result.internalImports).toContain('./foo');
      expect(result.internalImports).toContain('../bar');
      expect(result.externalPackages).toHaveLength(0);
    });

    it('should handle scoped packages', () => {
      const code = `import { styled } from '@emotion/styled';`;
      const result = extractor.extract(code);

      expect(result.externalPackages).toHaveLength(1);
      expect(result.externalPackages[0]).toBe('@emotion/styled');
    });

    it('should extract base package name from subpath imports', () => {
      const code = `import { Button } from 'react-bootstrap/Button';`;
      const result = extractor.extract(code);

      expect(result.externalPackages).toHaveLength(1);
      expect(result.externalPackages[0]).toBe('react-bootstrap');
    });
  });

  describe('Statistics', () => {
    it('should calculate correct statistics', () => {
      const code = `
        import React from 'react';
        import { useState, useEffect } from 'react';
        import * as fs from 'fs';
        import './styles.css';
        import type { FC } from 'react';
      `;
      const result = extractor.extract(code);

      expect(result.stats.total).toBe(5);
      expect(result.stats.default).toBe(1);
      expect(result.stats.named).toBe(2); // named imports + type-only named
      expect(result.stats.namespace).toBe(1);
      expect(result.stats.sideEffect).toBe(1);
      expect(result.stats.typeOnly).toBe(1);
    });

    it('should handle empty source code', () => {
      const code = '';
      const result = extractor.extract(code);

      expect(result.stats.total).toBe(0);
      expect(result.imports).toHaveLength(0);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle mixed import types from same module', () => {
      const code = `import React, { useState, useEffect } from 'react';`;
      const result = extractor.extract(code);

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].type).toBe(ImportType.DEFAULT);
      expect(result.imports[0].bindings).toHaveLength(3);
      expect(result.imports[0].bindings[0].name).toBe('React');
      expect(result.imports[0].bindings[1].name).toBe('useState');
      expect(result.imports[0].bindings[2].name).toBe('useEffect');
    });

    it('should extract imports from multi-line code', () => {
      const code = `
        import React from 'react';

        const Component = () => {
          return <div>Hello</div>;
        };

        import { useState } from 'react';
      `;
      const result = extractor.extract(code);

      expect(result.imports).toHaveLength(2);
    });

    it('should preserve original import text', () => {
      const code = `import { useState, useEffect } from 'react';`;
      const result = extractor.extract(code);

      expect(result.imports[0].text).toBe(code);
    });

    it('should handle comments and whitespace', () => {
      const code = `
        // Comment
        import React from 'react'; // Inline comment
        /* Block comment */
        import { useState } from 'react';
      `;
      const result = extractor.extract(code);

      expect(result.imports).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid syntax gracefully', () => {
      const code = `import { from 'react';`; // Invalid syntax
      const result = extractor.extract(code);

      // TypeScript parser is tolerant, might still extract partial info
      expect(result).toBeDefined();
      expect(result.imports).toBeDefined();
    });

    it('should handle empty imports', () => {
      const code = `import {} from 'react';`;
      const result = extractor.extract(code);

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].bindings).toHaveLength(0);
    });
  });

  describe('Caching', () => {
    it('should cache extraction results', () => {
      const code = `import React from 'react';`;

      const result1 = extractor.extract(code);
      const result2 = extractor.extract(code);

      const stats = extractor.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(result1).toEqual(result2);
    });

    it('should return different results for different code', () => {
      const code1 = `import React from 'react';`;
      const code2 = `import express from 'express';`;

      const result1 = extractor.extract(code1);
      const result2 = extractor.extract(code2);

      expect(result1.imports[0].moduleSpecifier).toBe('react');
      expect(result2.imports[0].moduleSpecifier).toBe('express');
    });

    it('should respect cache disabled option', () => {
      const customExtractor = new ImportExtractor({ enableCache: false });
      const code = `import React from 'react';`;

      customExtractor.extract(code);
      customExtractor.extract(code);

      const stats = customExtractor.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should clear cache', () => {
      const code = `import React from 'react';`;

      extractor.extract(code);
      expect(extractor.getCacheStats().size).toBeGreaterThan(0);

      extractor.clearCache();
      expect(extractor.getCacheStats().size).toBe(0);
      expect(extractor.getCacheStats().hits).toBe(0);
      expect(extractor.getCacheStats().misses).toBe(0);
    });

    it('should calculate hit rate correctly', () => {
      const code = `import React from 'react';`;

      extractor.extract(code); // miss
      extractor.extract(code); // hit
      extractor.extract(code); // hit

      const stats = extractor.getCacheStats();
      expect(stats.hitRate).toBeCloseTo(0.666, 2);
    });
  });

  describe('Factory Function', () => {
    it('should create extractor via factory function', () => {
      const extractor = createImportExtractor();

      expect(extractor).toBeInstanceOf(ImportExtractor);
    });

    it('should create extractor with options via factory function', () => {
      const options: ImportExtractorOptions = {
        enableCache: false
      };
      const extractor = createImportExtractor(options);

      expect(extractor).toBeInstanceOf(ImportExtractor);
    });
  });

  describe('Real-World Code Examples', () => {
    it('should extract imports from React component', () => {
      const code = `
        import React, { useState, useEffect } from 'react';
        import type { FC } from 'react';
        import { Button } from '@mui/material';
        import { formatDate } from '../utils/date';
        import './Component.css';

        export const Component: FC = () => {
          const [state, setState] = useState(0);
          return <Button>Click me</Button>;
        };
      `;
      const result = extractor.extract(code);

      expect(result.stats.total).toBe(5);
      expect(result.externalPackages).toContain('react');
      expect(result.externalPackages).toContain('@mui/material');
      expect(result.internalImports).toContain('../utils/date');
      expect(result.internalImports).toContain('./Component.css');
    });

    it('should extract imports from Node.js server file', () => {
      const code = `
        import express from 'express';
        import { Router } from 'express';
        import * as path from 'path';
        import { db } from './database';
      `;
      const result = extractor.extract(code);

      expect(result.stats.total).toBe(4);
      expect(result.stats.default).toBe(1);
      expect(result.stats.named).toBe(2);
      expect(result.stats.namespace).toBe(1);
      expect(result.externalPackages).toContain('express');
      expect(result.externalPackages).toContain('path');
    });

    it('should handle TypeScript decorators and imports', () => {
      const code = `
        import { Entity, Column } from 'typeorm';
        import type { Repository } from 'typeorm';

        @Entity()
        export class User {
          @Column()
          name: string;
        }
      `;
      const result = extractor.extract(code);

      expect(result.imports).toHaveLength(2);
      expect(result.stats.typeOnly).toBe(1);
    });
  });

  describe('Line Numbers', () => {
    it('should track correct line numbers for multiple imports', () => {
      const code = `import React from 'react';
import express from 'express';
import * as fs from 'fs';`;
      const result = extractor.extract(code);

      expect(result.imports[0].line).toBe(1);
      expect(result.imports[1].line).toBe(2);
      expect(result.imports[2].line).toBe(3);
    });

    it('should handle multi-line imports', () => {
      const code = `import {
  useState,
  useEffect,
  useCallback
} from 'react';`;
      const result = extractor.extract(code);

      expect(result.imports).toHaveLength(1);
      expect(result.imports[0].line).toBe(1);
      expect(result.imports[0].bindings).toHaveLength(3);
    });
  });

  describe('Performance', () => {
    it('should handle large files efficiently', () => {
      const imports = Array.from({ length: 100 }, (_, i) =>
        `import module${i} from 'package${i}';`
      ).join('\n');

      const start = Date.now();
      const result = extractor.extract(imports);
      const duration = Date.now() - start;

      expect(result.imports).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });

    it('should benefit from caching on repeated extractions', () => {
      const code = `import React from 'react';`;

      const start1 = Date.now();
      extractor.extract(code);
      const duration1 = Date.now() - start1;

      const start2 = Date.now();
      extractor.extract(code);
      const duration2 = Date.now() - start2;

      // Cached version should be faster
      expect(duration2).toBeLessThanOrEqual(duration1);
    });
  });
});
