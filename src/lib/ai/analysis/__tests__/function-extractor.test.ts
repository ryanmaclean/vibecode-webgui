/**
 * Unit tests for function-extractor.ts
 * Tests function signature extraction from TypeScript/JavaScript code
 */

import {
  FunctionExtractor,
  createFunctionExtractor,
  FunctionKind,
  FunctionExtractionResult,
  FunctionExtractorOptions
} from '../function-extractor';

describe('FunctionExtractor', () => {
  let extractor: FunctionExtractor;

  beforeEach(() => {
    extractor = new FunctionExtractor();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(extractor).toBeDefined();
      expect(extractor.getCacheStats().size).toBe(0);
    });

    it('should initialize with custom configuration', () => {
      const options: FunctionExtractorOptions = {
        enableCache: false,
        includeNonExported: false,
        includeArrowFunctions: false
      };
      const customExtractor = new FunctionExtractor(options);

      expect(customExtractor).toBeDefined();
    });
  });

  describe('Function Declarations', () => {
    it('should extract simple function declaration', () => {
      const code = `function greet() { return 'hello'; }`;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].kind).toBe(FunctionKind.FUNCTION);
      expect(result.functions[0].name).toBe('greet');
      expect(result.functions[0].parameters).toHaveLength(0);
      expect(result.functions[0].isAsync).toBe(false);
      expect(result.functions[0].isGenerator).toBe(false);
    });

    it('should extract function with parameters', () => {
      const code = `function add(a: number, b: number) { return a + b; }`;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].parameters).toHaveLength(2);
      expect(result.functions[0].parameters[0].name).toBe('a');
      expect(result.functions[0].parameters[0].type).toBe('number');
      expect(result.functions[0].parameters[1].name).toBe('b');
      expect(result.functions[0].parameters[1].type).toBe('number');
    });

    it('should extract function with return type', () => {
      const code = `function getName(): string { return 'John'; }`;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].returnType).toBe('string');
    });

    it('should extract async function', () => {
      const code = `async function fetchData() { return await fetch('/api'); }`;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].isAsync).toBe(true);
      expect(result.stats.async).toBe(1);
    });

    it('should extract generator function', () => {
      const code = `function* numbers() { yield 1; yield 2; }`;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].isGenerator).toBe(true);
    });

    it('should extract exported function', () => {
      const code = `export function calculate() { return 42; }`;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].isExported).toBe(true);
      expect(result.exportedFunctions).toContain('calculate');
    });

    it('should extract default exported function', () => {
      const code = `export default function main() { return true; }`;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].isDefaultExport).toBe(true);
    });
  });

  describe('Arrow Functions', () => {
    it('should extract arrow function from variable declaration', () => {
      const code = `const greet = () => 'hello';`;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].kind).toBe(FunctionKind.ARROW_FUNCTION);
      expect(result.functions[0].name).toBe('greet');
    });

    it('should extract arrow function with parameters', () => {
      const code = `const add = (a: number, b: number) => a + b;`;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].parameters).toHaveLength(2);
      expect(result.functions[0].parameters[0].name).toBe('a');
      expect(result.functions[0].parameters[0].type).toBe('number');
    });

    it('should extract arrow function with return type', () => {
      const code = `const getName = (): string => 'John';`;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].returnType).toBe('string');
    });

    it('should extract async arrow function', () => {
      const code = `const fetchData = async () => await fetch('/api');`;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].isAsync).toBe(true);
    });

    it('should extract exported arrow function', () => {
      const code = `export const calculate = () => 42;`;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].isExported).toBe(true);
    });

    it('should skip arrow functions when disabled', () => {
      const code = `const greet = () => 'hello';`;
      const customExtractor = new FunctionExtractor({ includeArrowFunctions: false });
      const result = customExtractor.extract(code);

      expect(result.functions).toHaveLength(0);
    });
  });

  describe('Function Expressions', () => {
    it('should extract function expression', () => {
      const code = `const greet = function() { return 'hello'; };`;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].kind).toBe(FunctionKind.FUNCTION_EXPRESSION);
      expect(result.functions[0].name).toBe('greet');
    });

    it('should extract async function expression', () => {
      const code = `const fetchData = async function() { return await fetch('/api'); };`;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].isAsync).toBe(true);
    });

    it('should extract generator function expression', () => {
      const code = `const numbers = function*() { yield 1; };`;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].isGenerator).toBe(true);
    });
  });

  describe('Class Methods', () => {
    it('should extract class methods', () => {
      const code = `
        class Calculator {
          add(a: number, b: number): number {
            return a + b;
          }
        }
      `;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].kind).toBe(FunctionKind.METHOD);
      expect(result.functions[0].name).toBe('add');
      expect(result.functions[0].parentClass).toBe('Calculator');
    });

    it('should extract class constructor', () => {
      const code = `
        class User {
          constructor(name: string) {
            this.name = name;
          }
        }
      `;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].kind).toBe(FunctionKind.CONSTRUCTOR);
      expect(result.functions[0].name).toBe('constructor');
      expect(result.functions[0].parameters).toHaveLength(1);
    });

    it('should extract static methods', () => {
      const code = `
        class MathUtils {
          static square(x: number): number {
            return x * x;
          }
        }
      `;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].isStatic).toBe(true);
    });

    it('should extract async methods', () => {
      const code = `
        class ApiClient {
          async fetchData(): Promise<any> {
            return await fetch('/api');
          }
        }
      `;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].isAsync).toBe(true);
    });

    it('should extract private methods', () => {
      const code = `
        class Service {
          private validate(): boolean {
            return true;
          }
        }
      `;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].visibility).toBe('private');
    });

    it('should extract protected methods', () => {
      const code = `
        class BaseClass {
          protected helper(): void {}
        }
      `;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].visibility).toBe('protected');
    });

    it('should extract public methods', () => {
      const code = `
        class Service {
          public execute(): void {}
        }
      `;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].visibility).toBe('public');
    });

    it('should skip methods when disabled', () => {
      const code = `
        class Calculator {
          add(a: number, b: number): number {
            return a + b;
          }
        }
      `;
      const customExtractor = new FunctionExtractor({ includeMethods: false });
      const result = customExtractor.extract(code);

      expect(result.functions).toHaveLength(0);
    });
  });

  describe('Function Parameters', () => {
    it('should extract optional parameters', () => {
      const code = `function greet(name?: string) { }`;
      const result = extractor.extract(code);

      expect(result.functions[0].parameters).toHaveLength(1);
      expect(result.functions[0].parameters[0].optional).toBe(true);
    });

    it('should extract rest parameters', () => {
      const code = `function sum(...numbers: number[]) { }`;
      const result = extractor.extract(code);

      expect(result.functions[0].parameters).toHaveLength(1);
      expect(result.functions[0].parameters[0].isRest).toBe(true);
    });

    it('should extract parameters with default values', () => {
      const code = `function greet(name = 'World') { }`;
      const result = extractor.extract(code);

      expect(result.functions[0].parameters).toHaveLength(1);
      expect(result.functions[0].parameters[0].defaultValue).toBe("'World'");
    });

    it('should extract complex parameter types', () => {
      const code = `function process(data: { id: number; name: string }) { }`;
      const result = extractor.extract(code);

      expect(result.functions[0].parameters).toHaveLength(1);
      expect(result.functions[0].parameters[0].type).toBe('{ id: number; name: string }');
    });
  });

  describe('Generics', () => {
    it('should extract function with type parameters', () => {
      const code = `function identity<T>(value: T): T { return value; }`;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].typeParameters).toHaveLength(1);
      expect(result.functions[0].typeParameters[0]).toBe('T');
    });

    it('should extract function with multiple type parameters', () => {
      const code = `function pair<K, V>(key: K, value: V): [K, V] { return [key, value]; }`;
      const result = extractor.extract(code);

      expect(result.functions[0].typeParameters).toHaveLength(2);
      expect(result.functions[0].typeParameters[0]).toBe('K');
      expect(result.functions[0].typeParameters[1]).toBe('V');
    });

    it('should extract function with constrained type parameters', () => {
      const code = `function getLength<T extends { length: number }>(obj: T): number { return obj.length; }`;
      const result = extractor.extract(code);

      expect(result.functions[0].typeParameters).toHaveLength(1);
    });
  });

  describe('Statistics', () => {
    it('should calculate correct statistics', () => {
      const code = `
        function regularFunc() {}
        const arrowFunc = () => {};
        const funcExpr = function() {};
        async function asyncFunc() {}
        export function exportedFunc() {}

        class MyClass {
          constructor() {}
          method() {}
        }
      `;
      const result = extractor.extract(code);

      expect(result.stats.total).toBe(7);
      expect(result.stats.functions).toBe(3);
      expect(result.stats.arrowFunctions).toBe(1);
      expect(result.stats.functionExpressions).toBe(1);
      expect(result.stats.methods).toBe(1);
      expect(result.stats.constructors).toBe(1);
      expect(result.stats.async).toBe(1);
      expect(result.stats.exported).toBe(1);
    });

    it('should handle empty source code', () => {
      const code = '';
      const result = extractor.extract(code);

      expect(result.stats.total).toBe(0);
      expect(result.functions).toHaveLength(0);
    });
  });

  describe('JSDoc Documentation', () => {
    it('should extract JSDoc comments from functions', () => {
      const code = `
        /**
         * Adds two numbers together
         */
        function add(a: number, b: number): number {
          return a + b;
        }
      `;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].documentation).toBeDefined();
      expect(result.functions[0].documentation).toContain('Adds two numbers together');
    });

    it('should extract JSDoc from methods', () => {
      const code = `
        class Calculator {
          /**
           * Multiplies two numbers
           */
          multiply(a: number, b: number): number {
            return a * b;
          }
        }
      `;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].documentation).toBeDefined();
    });
  });

  describe('Line Numbers', () => {
    it('should track correct line numbers', () => {
      const code = `function first() {}
function second() {}
function third() {}`;
      const result = extractor.extract(code);

      expect(result.functions[0].line).toBe(1);
      expect(result.functions[1].line).toBe(2);
      expect(result.functions[2].line).toBe(3);
    });

    it('should handle multi-line function declarations', () => {
      const code = `function complex(
  a: number,
  b: string
): boolean {
  return true;
}`;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].line).toBe(1);
    });
  });

  describe('Function Signature Text', () => {
    it('should extract signature without body for regular functions', () => {
      const code = `function add(a: number, b: number): number { return a + b; }`;
      const result = extractor.extract(code);

      expect(result.functions[0].text).toContain('function add(a: number, b: number): number');
      expect(result.functions[0].text).not.toContain('return a + b');
    });

    it('should extract signature for arrow functions', () => {
      const code = `const add = (a: number, b: number): number => a + b;`;
      const result = extractor.extract(code);

      expect(result.functions[0].text).toContain('=>');
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple functions in same file', () => {
      const code = `
        function func1() {}
        function func2() {}
        const func3 = () => {};

        class MyClass {
          method1() {}
          method2() {}
        }
      `;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(5);
    });

    it('should handle nested classes', () => {
      const code = `
        class Outer {
          outerMethod() {}

          class Inner {
            innerMethod() {}
          }
        }
      `;
      const result = extractor.extract(code);

      expect(result.functions.length).toBeGreaterThan(0);
    });

    it('should handle React components', () => {
      const code = `
        import React from 'react';

        function MyComponent(props: any) {
          return <div>Hello</div>;
        }

        const MyOtherComponent = () => {
          return <div>World</div>;
        };
      `;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(2);
    });

    it('should handle Express route handlers', () => {
      const code = `
        import express from 'express';
        const app = express();

        app.get('/api/users', async (req, res) => {
          const users = await getUsers();
          res.json(users);
        });
      `;
      const result = extractor.extract(code);

      expect(result.functions.some(f => f.isAsync)).toBe(true);
    });
  });

  describe('Filter Options', () => {
    it('should filter non-exported functions when disabled', () => {
      const code = `
        function privateFunc() {}
        export function publicFunc() {}
      `;
      const customExtractor = new FunctionExtractor({ includeNonExported: false });
      const result = customExtractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('publicFunc');
    });
  });

  describe('Caching', () => {
    it('should cache extraction results', () => {
      const code = `function test() {}`;

      const result1 = extractor.extract(code);
      const result2 = extractor.extract(code);

      const stats = extractor.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(result1).toEqual(result2);
    });

    it('should return different results for different code', () => {
      const code1 = `function first() {}`;
      const code2 = `function second() {}`;

      const result1 = extractor.extract(code1);
      const result2 = extractor.extract(code2);

      expect(result1.functions[0].name).toBe('first');
      expect(result2.functions[0].name).toBe('second');
    });

    it('should respect cache disabled option', () => {
      const customExtractor = new FunctionExtractor({ enableCache: false });
      const code = `function test() {}`;

      customExtractor.extract(code);
      customExtractor.extract(code);

      const stats = customExtractor.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should clear cache', () => {
      const code = `function test() {}`;

      extractor.extract(code);
      expect(extractor.getCacheStats().size).toBeGreaterThan(0);

      extractor.clearCache();
      expect(extractor.getCacheStats().size).toBe(0);
      expect(extractor.getCacheStats().hits).toBe(0);
      expect(extractor.getCacheStats().misses).toBe(0);
    });

    it('should calculate hit rate correctly', () => {
      const code = `function test() {}`;

      extractor.extract(code); // miss
      extractor.extract(code); // hit
      extractor.extract(code); // hit

      const stats = extractor.getCacheStats();
      expect(stats.hitRate).toBeCloseTo(0.666, 2);
    });
  });

  describe('Factory Function', () => {
    it('should create extractor via factory function', () => {
      const extractor = createFunctionExtractor();

      expect(extractor).toBeInstanceOf(FunctionExtractor);
    });

    it('should create extractor with options via factory function', () => {
      const options: FunctionExtractorOptions = {
        enableCache: false
      };
      const extractor = createFunctionExtractor(options);

      expect(extractor).toBeInstanceOf(FunctionExtractor);
    });
  });

  describe('Real-World Examples', () => {
    it('should extract from utility library', () => {
      const code = `
        export function debounce<T extends (...args: any[]) => any>(
          func: T,
          wait: number
        ): (...args: Parameters<T>) => void {
          let timeout: NodeJS.Timeout;
          return (...args: Parameters<T>) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func(...args), wait);
          };
        }
      `;
      const result = extractor.extract(code);

      expect(result.functions.length).toBeGreaterThan(0);
      expect(result.exportedFunctions).toContain('debounce');
    });

    it('should extract from API service', () => {
      const code = `
        class ApiService {
          private baseUrl: string;

          constructor(baseUrl: string) {
            this.baseUrl = baseUrl;
          }

          async get<T>(endpoint: string): Promise<T> {
            const response = await fetch(this.baseUrl + endpoint);
            return response.json();
          }

          async post<T>(endpoint: string, data: any): Promise<T> {
            const response = await fetch(this.baseUrl + endpoint, {
              method: 'POST',
              body: JSON.stringify(data)
            });
            return response.json();
          }
        }
      `;
      const result = extractor.extract(code);

      expect(result.stats.constructors).toBe(1);
      expect(result.stats.methods).toBe(2);
      expect(result.stats.async).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid syntax gracefully', () => {
      const code = `function ( { }`;
      const result = extractor.extract(code);

      expect(result).toBeDefined();
      expect(result.functions).toBeDefined();
    });

    it('should handle empty function bodies', () => {
      const code = `function empty() {}`;
      const result = extractor.extract(code);

      expect(result.functions).toHaveLength(1);
      expect(result.functions[0].name).toBe('empty');
    });
  });

  describe('Performance', () => {
    it('should handle large files efficiently', () => {
      const functions = Array.from({ length: 100 }, (_, i) =>
        `function func${i}() { return ${i}; }`
      ).join('\n');

      const start = Date.now();
      const result = extractor.extract(functions);
      const duration = Date.now() - start;

      expect(result.functions).toHaveLength(100);
      expect(duration).toBeLessThan(1000);
    });

    it('should benefit from caching on repeated extractions', () => {
      const code = `function test() {}`;

      const start1 = Date.now();
      extractor.extract(code);
      const duration1 = Date.now() - start1;

      const start2 = Date.now();
      extractor.extract(code);
      const duration2 = Date.now() - start2;

      expect(duration2).toBeLessThanOrEqual(duration1);
    });
  });
});
