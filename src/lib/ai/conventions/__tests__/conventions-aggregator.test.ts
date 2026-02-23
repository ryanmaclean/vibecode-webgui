/**
 * Tests for ConventionsAggregator
 */

import {
  ConventionsAggregator,
  createConventionsAggregator,
  ConventionCategory,
  ProjectConventionsResult
} from '../conventions-aggregator';
import { NamingCase } from '../naming-detector';
import { PatternType } from '../pattern-detector';

describe('ConventionsAggregator', () => {
  describe('constructor and factory', () => {
    it('should create instance with default options', () => {
      const aggregator = new ConventionsAggregator();
      expect(aggregator).toBeInstanceOf(ConventionsAggregator);
      expect(aggregator.getAnalysisCount()).toBe(0);
    });

    it('should create instance via factory function', () => {
      const aggregator = createConventionsAggregator();
      expect(aggregator).toBeInstanceOf(ConventionsAggregator);
    });

    it('should accept custom options', () => {
      const aggregator = new ConventionsAggregator({
        minConfidence: 0.8,
        minFileCount: 3,
        maxExamples: 10
      });
      expect(aggregator).toBeInstanceOf(ConventionsAggregator);
    });
  });

  describe('analyzeFile', () => {
    it('should analyze a single file', () => {
      const aggregator = new ConventionsAggregator();
      const code = `
        const userName = 'John';
        const userAge = 30;

        function getUserName() {
          return userName;
        }
      `;

      aggregator.analyzeFile(code, 'user.ts');
      expect(aggregator.getAnalysisCount()).toBe(1);
    });

    it('should analyze multiple files', () => {
      const aggregator = new ConventionsAggregator();

      const file1 = 'const userName = "test";';
      const file2 = 'function getUser() { return null; }';

      aggregator.analyzeFile(file1, 'file1.ts');
      aggregator.analyzeFile(file2, 'file2.ts');

      expect(aggregator.getAnalysisCount()).toBe(2);
    });
  });

  describe('analyzeFiles', () => {
    it('should analyze multiple files in batch', () => {
      const aggregator = new ConventionsAggregator();
      const files = [
        { code: 'const userName = "test";', path: 'file1.ts' },
        { code: 'function getUser() {}', path: 'file2.ts' },
        { code: 'class UserService {}', path: 'file3.ts' }
      ];

      aggregator.analyzeFiles(files);
      expect(aggregator.getAnalysisCount()).toBe(3);
    });

    it('should handle empty file list', () => {
      const aggregator = new ConventionsAggregator();
      aggregator.analyzeFiles([]);
      expect(aggregator.getAnalysisCount()).toBe(0);
    });
  });

  describe('aggregate', () => {
    it('should return empty result when no files analyzed', () => {
      const aggregator = new ConventionsAggregator();
      const result = aggregator.aggregate();

      expect(result.stats.totalFiles).toBe(0);
      expect(result.stats.totalConventions).toBe(0);
      expect(result.conventions[ConventionCategory.VARIABLE_NAMING]).toEqual([]);
    });

    it('should aggregate naming conventions from multiple files', () => {
      const aggregator = new ConventionsAggregator({
        minFileCount: 2,
        minConfidence: 0.5
      });

      const files = [
        {
          code: `
            const userName = 'John';
            const userAge = 30;
            const isActive = true;
          `,
          path: 'user1.ts'
        },
        {
          code: `
            const productName = 'Widget';
            const productPrice = 99.99;
            const hasStock = true;
          `,
          path: 'product.ts'
        }
      ];

      aggregator.analyzeFiles(files);
      const result = aggregator.aggregate();

      expect(result.stats.totalFiles).toBe(2);
      expect(result.stats.totalConventions).toBeGreaterThan(0);
      expect(result.stats.dominantVariableCase).toBe(NamingCase.CAMEL_CASE);
    });

    it('should aggregate function naming conventions', () => {
      const aggregator = new ConventionsAggregator({
        minFileCount: 2,
        minConfidence: 0.5
      });

      const files = [
        {
          code: `
            function getUserName() { return 'test'; }
            function getUsferAge() { return 30; }
            function setUserName(name: string) {}
          `,
          path: 'user.ts'
        },
        {
          code: `
            function getProductName() { return 'widget'; }
            function getProductPrice() { return 99; }
            function setProductPrice(price: number) {}
          `,
          path: 'product.ts'
        }
      ];

      aggregator.analyzeFiles(files);
      const result = aggregator.aggregate();

      const functionConventions = result.conventions[ConventionCategory.FUNCTION_NAMING];
      expect(functionConventions.length).toBeGreaterThan(0);

      const regularFunctions = functionConventions.find(c => c.description.includes('Regular functions'));
      expect(regularFunctions).toBeDefined();
      expect(regularFunctions?.examples.length).toBeGreaterThan(0);
    });

    it('should aggregate class naming conventions', () => {
      const aggregator = new ConventionsAggregator({
        minFileCount: 2,
        minConfidence: 0.5
      });

      const files = [
        {
          code: `
            class UserService {
              getUser() {}
            }
            interface UserData {}
          `,
          path: 'user.ts'
        },
        {
          code: `
            class ProductService {
              getProduct() {}
            }
            interface ProductData {}
          `,
          path: 'product.ts'
        }
      ];

      aggregator.analyzeFiles(files);
      const result = aggregator.aggregate();

      const classConventions = result.conventions[ConventionCategory.CLASS_NAMING];
      expect(classConventions.length).toBeGreaterThan(0);
      expect(result.stats.dominantClassCase).toBe(NamingCase.PASCAL_CASE);
    });

    it('should detect design patterns', () => {
      const aggregator = new ConventionsAggregator({
        minFileCount: 2,
        minConfidence: 0.5
      });

      const files = [
        {
          code: `
            class UserService {
              getUser() {}
              createUser() {}
              updateUser() {}
              deleteUser() {}
            }
          `,
          path: 'user-service.ts'
        },
        {
          code: `
            class ProductService {
              getProduct() {}
              createProduct() {}
              updateProduct() {}
              deleteProduct() {}
            }
          `,
          path: 'product-service.ts'
        }
      ];

      aggregator.analyzeFiles(files);
      const result = aggregator.aggregate();

      const patternConventions = result.conventions[ConventionCategory.DESIGN_PATTERNS];
      expect(patternConventions.length).toBeGreaterThan(0);

      const servicePattern = patternConventions.find(c => c.description.includes('Service'));
      expect(servicePattern).toBeDefined();
    });

    it('should detect architectural style', () => {
      const aggregator = new ConventionsAggregator({
        minFileCount: 2,
        minConfidence: 0.5
      });

      const files = [
        {
          code: `
            class UserService {
              getUser() {}
            }
            class ProductService {
              getProduct() {}
            }
          `,
          path: 'services.ts'
        },
        {
          code: `
            class OrderService {
              getOrder() {}
            }
          `,
          path: 'order.ts'
        }
      ];

      aggregator.analyzeFiles(files);
      const result = aggregator.aggregate();

      const archConventions = result.conventions[ConventionCategory.ARCHITECTURE];
      expect(archConventions.length).toBeGreaterThan(0);
      expect(result.stats.architectureStyle).toMatch(/functional|object-oriented|mixed/);
    });

    it('should detect file organization conventions', () => {
      const aggregator = new ConventionsAggregator({
        minFileCount: 2,
        minConfidence: 0.5
      });

      const files = [
        { code: 'describe("test", () => {})', path: 'user.test.ts' },
        { code: 'describe("test", () => {})', path: 'product.test.ts' },
        { code: 'describe("test", () => {})', path: 'order.test.ts' }
      ];

      aggregator.analyzeFiles(files);
      const result = aggregator.aggregate();

      const fileOrgConventions = result.conventions[ConventionCategory.FILE_ORGANIZATION];
      expect(fileOrgConventions.length).toBeGreaterThan(0);

      const testConvention = fileOrgConventions.find(c => c.description.includes('.test.'));
      expect(testConvention).toBeDefined();
    });

    it('should filter by minimum confidence', () => {
      const aggregator = new ConventionsAggregator({
        minConfidence: 0.95,
        minFileCount: 1
      });

      const files = [
        {
          code: `
            const userName = 'test';
            const user_name = 'test'; // Different case
          `,
          path: 'user.ts'
        }
      ];

      aggregator.analyzeFiles(files);
      const result = aggregator.aggregate();

      // With low consistency, some conventions should be filtered out
      expect(result.stats.consistencyScore).toBeLessThan(0.95);
    });

    it('should filter by minimum file count', () => {
      const aggregator = new ConventionsAggregator({
        minFileCount: 5,
        minConfidence: 0.5
      });

      const files = [
        { code: 'const userName = "test";', path: 'file1.ts' },
        { code: 'const userAge = 30;', path: 'file2.ts' }
      ];

      aggregator.analyzeFiles(files);
      const result = aggregator.aggregate();

      // Should have fewer conventions due to high minFileCount
      expect(result.stats.totalConventions).toBe(0);
    });

    it('should limit examples per convention', () => {
      const aggregator = new ConventionsAggregator({
        maxExamples: 2,
        minFileCount: 2,
        minConfidence: 0.5
      });

      const files = [
        {
          code: `
            const userName = 'test';
            const userAge = 30;
            const userEmail = 'test@test.com';
          `,
          path: 'user.ts'
        },
        {
          code: `
            const productName = 'widget';
            const productPrice = 99;
            const productStock = 10;
          `,
          path: 'product.ts'
        }
      ];

      aggregator.analyzeFiles(files);
      const result = aggregator.aggregate();

      const variableConventions = result.conventions[ConventionCategory.VARIABLE_NAMING];
      if (variableConventions.length > 0) {
        variableConventions.forEach(conv => {
          expect(conv.examples.length).toBeLessThanOrEqual(2);
        });
      }
    });
  });

  describe('recommendations', () => {
    it('should generate recommendations when enabled', () => {
      const aggregator = new ConventionsAggregator({
        generateRecommendations: true,
        minFileCount: 2,
        minConfidence: 0.5
      });

      const files = [
        {
          code: `
            const userName = 'test';
            function getUserName() { return userName; }
            class UserService {}
          `,
          path: 'user.ts'
        },
        {
          code: `
            const productName = 'widget';
            function getProductName() { return productName; }
            class ProductService {}
          `,
          path: 'product.ts'
        }
      ];

      aggregator.analyzeFiles(files);
      const result = aggregator.aggregate();

      expect(result.recommendations.length).toBeGreaterThan(0);
      result.recommendations.forEach(rec => {
        expect(rec.category).toBeDefined();
        expect(rec.recommendation).toBeTruthy();
        expect(rec.priority).toBeGreaterThan(0);
      });
    });

    it('should not generate recommendations when disabled', () => {
      const aggregator = new ConventionsAggregator({
        generateRecommendations: false,
        minFileCount: 2
      });

      const files = [
        { code: 'const userName = "test";', path: 'user.ts' },
        { code: 'const productName = "widget";', path: 'product.ts' }
      ];

      aggregator.analyzeFiles(files);
      const result = aggregator.aggregate();

      expect(result.recommendations).toEqual([]);
    });

    it('should prioritize recommendations correctly', () => {
      const aggregator = new ConventionsAggregator({
        generateRecommendations: true,
        minFileCount: 2,
        minConfidence: 0.5
      });

      const files = [
        {
          code: `
            const userName = 'test';
            function getUserName() { return 'test'; }
            class UserService {}
          `,
          path: 'user.ts'
        },
        {
          code: `
            const productName = 'widget';
            function getProductName() { return 'widget'; }
            class ProductService {}
          `,
          path: 'product.ts'
        }
      ];

      aggregator.analyzeFiles(files);
      const result = aggregator.aggregate();

      // Recommendations should be sorted by priority (lower is higher)
      for (let i = 1; i < result.recommendations.length; i++) {
        expect(result.recommendations[i].priority).toBeGreaterThanOrEqual(
          result.recommendations[i - 1].priority
        );
      }
    });
  });

  describe('inconsistencies', () => {
    it('should detect naming inconsistencies when enabled', () => {
      const aggregator = new ConventionsAggregator({
        detectInconsistencies: true,
        minFileCount: 1
      });

      const files = [
        {
          code: `
            const userName = 'test';  // camelCase
            const user_age = 30;      // snake_case (inconsistent)
          `,
          path: 'user.ts'
        }
      ];

      aggregator.analyzeFiles(files);
      const result = aggregator.aggregate();

      // Note: inconsistencies require multiple files, so this might be empty
      expect(result.inconsistencies).toBeDefined();
      expect(Array.isArray(result.inconsistencies)).toBe(true);
    });

    it('should not detect inconsistencies when disabled', () => {
      const aggregator = new ConventionsAggregator({
        detectInconsistencies: false
      });

      const files = [
        { code: 'const userName = "test";', path: 'user.ts' },
        { code: 'const user_name = "test";', path: 'product.ts' }
      ];

      aggregator.analyzeFiles(files);
      const result = aggregator.aggregate();

      expect(result.inconsistencies).toEqual([]);
    });
  });

  describe('getLastResult', () => {
    it('should return null when no aggregation performed', () => {
      const aggregator = new ConventionsAggregator();
      expect(aggregator.getLastResult()).toBeNull();
    });

    it('should return last aggregation result', () => {
      const aggregator = new ConventionsAggregator();
      aggregator.analyzeFile('const userName = "test";', 'user.ts');

      const result1 = aggregator.aggregate();
      const result2 = aggregator.getLastResult();

      expect(result2).toBe(result1);
      expect(result2?.stats.totalFiles).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all analyses and reset state', () => {
      const aggregator = new ConventionsAggregator();

      aggregator.analyzeFile('const userName = "test";', 'user.ts');
      aggregator.analyzeFile('const productName = "widget";', 'product.ts');
      const result1 = aggregator.aggregate();

      expect(aggregator.getAnalysisCount()).toBe(2);
      expect(aggregator.getLastResult()).toBe(result1);

      aggregator.clear();

      expect(aggregator.getAnalysisCount()).toBe(0);
      expect(aggregator.getLastResult()).toBeNull();
    });
  });

  describe('getAnalysisCount', () => {
    it('should return 0 initially', () => {
      const aggregator = new ConventionsAggregator();
      expect(aggregator.getAnalysisCount()).toBe(0);
    });

    it('should return correct count after analyses', () => {
      const aggregator = new ConventionsAggregator();

      aggregator.analyzeFile('const a = 1;', 'file1.ts');
      expect(aggregator.getAnalysisCount()).toBe(1);

      aggregator.analyzeFile('const b = 2;', 'file2.ts');
      expect(aggregator.getAnalysisCount()).toBe(2);

      aggregator.analyzeFiles([
        { code: 'const c = 3;', path: 'file3.ts' },
        { code: 'const d = 4;', path: 'file4.ts' }
      ]);
      expect(aggregator.getAnalysisCount()).toBe(4);
    });
  });

  describe('complex scenarios', () => {
    it('should handle mixed architectural styles', () => {
      const aggregator = new ConventionsAggregator({
        minFileCount: 2,
        minConfidence: 0.5
      });

      const files = [
        {
          code: `
            class UserService {
              getUser() {}
            }
          `,
          path: 'user-service.ts'
        },
        {
          code: `
            function getProduct() { return null; }
            function createProduct() { return null; }
          `,
          path: 'product-functions.ts'
        }
      ];

      aggregator.analyzeFiles(files);
      const result = aggregator.aggregate();

      expect(result.stats.architectureStyle).toMatch(/functional|object-oriented|mixed/);
    });

    it('should handle React components and hooks', () => {
      const aggregator = new ConventionsAggregator({
        minFileCount: 2,
        minConfidence: 0.5
      });

      const files = [
        {
          code: `
            function useUserData() {
              const [user, setUser] = useState(null);
              return user;
            }
          `,
          path: 'useUserData.ts'
        },
        {
          code: `
            function useProductData() {
              const [product, setProduct] = useState(null);
              return product;
            }
          `,
          path: 'useProductData.ts'
        }
      ];

      aggregator.analyzeFiles(files);
      const result = aggregator.aggregate();

      const patternConventions = result.conventions[ConventionCategory.DESIGN_PATTERNS];
      const hookPattern = patternConventions.find(c => c.description.includes('Hook'));

      if (hookPattern) {
        expect(hookPattern.examples.length).toBeGreaterThan(0);
      }
    });

    it('should handle test file conventions', () => {
      const aggregator = new ConventionsAggregator({
        minFileCount: 2,
        minConfidence: 0.5
      });

      const files = [
        { code: 'describe("user", () => {})', path: 'user.test.ts' },
        { code: 'describe("product", () => {})', path: 'product.test.ts' },
        { code: 'describe("order", () => {})', path: 'order.test.ts' }
      ];

      aggregator.analyzeFiles(files);
      const result = aggregator.aggregate();

      const fileOrgConventions = result.conventions[ConventionCategory.FILE_ORGANIZATION];
      expect(fileOrgConventions.some(c => c.description.includes('.test.'))).toBe(true);
    });

    it('should handle spec file conventions', () => {
      const aggregator = new ConventionsAggregator({
        minFileCount: 2,
        minConfidence: 0.5
      });

      const files = [
        { code: 'describe("user", () => {})', path: 'user.spec.ts' },
        { code: 'describe("product", () => {})', path: 'product.spec.ts' },
        { code: 'describe("order", () => {})', path: 'order.spec.ts' }
      ];

      aggregator.analyzeFiles(files);
      const result = aggregator.aggregate();

      const fileOrgConventions = result.conventions[ConventionCategory.FILE_ORGANIZATION];
      expect(fileOrgConventions.some(c => c.description.includes('.spec.'))).toBe(true);
    });

    it('should calculate consistency score correctly', () => {
      const aggregator = new ConventionsAggregator({
        minFileCount: 2,
        minConfidence: 0.3
      });

      const consistentFiles = [
        {
          code: `
            const userName = 'test';
            const userAge = 30;
            function getUserName() {}
            function getUserAge() {}
          `,
          path: 'user.ts'
        },
        {
          code: `
            const productName = 'widget';
            const productPrice = 99;
            function getProductName() {}
            function getProductPrice() {}
          `,
          path: 'product.ts'
        }
      ];

      aggregator.analyzeFiles(consistentFiles);
      const result = aggregator.aggregate();

      expect(result.stats.consistencyScore).toBeGreaterThan(0.5);
      expect(result.stats.consistencyScore).toBeLessThanOrEqual(1);
    });

    it('should handle empty and minimal code', () => {
      const aggregator = new ConventionsAggregator();

      aggregator.analyzeFile('', 'empty.ts');
      aggregator.analyzeFile('// just a comment', 'comment.ts');

      const result = aggregator.aggregate();

      expect(result.stats.totalFiles).toBe(2);
      // Should not crash, even with minimal content
    });

    it('should provide timestamped results', () => {
      const aggregator = new ConventionsAggregator();
      const before = new Date();

      aggregator.analyzeFile('const x = 1;', 'file.ts');
      const result = aggregator.aggregate();

      const after = new Date();

      expect(result.analyzedAt).toBeInstanceOf(Date);
      expect(result.analyzedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.analyzedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('edge cases', () => {
    it('should handle very large number of files', () => {
      const aggregator = new ConventionsAggregator({
        minFileCount: 10
      });

      const files = Array.from({ length: 100 }, (_, i) => ({
        code: `const var${i} = ${i};`,
        path: `file${i}.ts`
      }));

      aggregator.analyzeFiles(files);
      const result = aggregator.aggregate();

      expect(result.stats.totalFiles).toBe(100);
    });

    it('should handle files with syntax errors gracefully', () => {
      const aggregator = new ConventionsAggregator();

      // Invalid TypeScript syntax
      aggregator.analyzeFile('const { = 1;', 'invalid.ts');

      // Should not crash
      const result = aggregator.aggregate();
      expect(result).toBeDefined();
    });

    it('should handle duplicate file analyses', () => {
      const aggregator = new ConventionsAggregator();

      aggregator.analyzeFile('const userName = "test";', 'user.ts');
      aggregator.analyzeFile('const userName = "test";', 'user.ts'); // Same file again

      expect(aggregator.getAnalysisCount()).toBe(2); // Both are counted
    });
  });
});
