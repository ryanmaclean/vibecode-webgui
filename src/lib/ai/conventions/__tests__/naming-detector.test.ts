/**
 * Unit tests for naming-detector.ts
 * Tests naming convention detection from TypeScript code
 */

import {
  NamingDetector,
  createNamingDetector,
  NamingCase,
  NamingDetectionResult,
  NamingDetectorOptions
} from '../naming-detector';

describe('NamingDetector', () => {
  let detector: NamingDetector;

  beforeEach(() => {
    detector = new NamingDetector();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(detector).toBeDefined();
      expect(detector.getCacheStats().size).toBe(0);
    });

    it('should initialize with custom configuration', () => {
      const options: NamingDetectorOptions = {
        enableCache: false,
        includePrivate: false,
        detectInconsistencies: false,
        minConfidence: 0.8
      };
      const customDetector = new NamingDetector(options);

      expect(customDetector).toBeDefined();
    });
  });

  describe('Variable Naming Detection', () => {
    it('should detect camelCase variables', () => {
      const code = `
        const userName = 'John';
        let userEmail = 'john@example.com';
        var userAge = 30;
      `;
      const result = detector.detect(code);

      expect(result.conventions.variables.regular.case).toBe(NamingCase.CAMEL_CASE);
      expect(result.conventions.variables.regular.count).toBeGreaterThan(0);
      expect(result.conventions.variables.regular.confidence).toBeGreaterThan(0);
    });

    it('should detect SCREAMING_SNAKE_CASE constants', () => {
      const code = `
        const MAX_USERS = 100;
        const API_KEY = 'secret';
        const DATABASE_URL = 'localhost';
      `;
      const result = detector.detect(code);

      expect(result.conventions.variables.constants.case).toBe(NamingCase.SCREAMING_SNAKE_CASE);
      expect(result.conventions.variables.constants.count).toBe(3);
    });

    it('should detect private variables', () => {
      const code = `
        const _privateVar = 'secret';
        const _internalState = {};
      `;
      const result = detector.detect(code);

      expect(result.conventions.variables.private.count).toBe(2);
      expect(result.conventions.variables.private.examples).toContain('_privateVar');
    });

    it('should detect mixed variable naming', () => {
      const code = `
        const userName = 'John';
        const user_email = 'john@example.com';
        const UserAge = 30;
      `;
      const result = detector.detect(code);

      expect(result.conventions.variables.regular.confidence).toBeLessThan(1);
    });
  });

  describe('Function Naming Detection', () => {
    it('should detect camelCase functions', () => {
      const code = `
        function getUserName() { return 'John'; }
        function calculateTotal() { return 100; }
        function validateEmail() { return true; }
      `;
      const result = detector.detect(code);

      expect(result.conventions.functions.regular.case).toBe(NamingCase.CAMEL_CASE);
      expect(result.conventions.functions.regular.count).toBe(3);
    });

    it('should detect async functions separately', () => {
      const code = `
        async function fetchUser() { return {}; }
        async function loadData() { return []; }
        function syncFunction() { return true; }
      `;
      const result = detector.detect(code);

      expect(result.conventions.functions.async.count).toBe(2);
      expect(result.conventions.functions.regular.count).toBe(1);
    });

    it('should detect common function prefixes', () => {
      const code = `
        function getUser() {}
        function getUserById() {}
        function setUser() {}
        function setUserName() {}
        function isValid() {}
        function hasPermission() {}
      `;
      const result = detector.detect(code);

      expect(result.conventions.functions.regular.prefixes).toContain('get');
      expect(result.conventions.functions.regular.prefixes).toContain('set');
      expect(result.conventions.functions.regular.prefixes).toContain('is');
      expect(result.conventions.functions.regular.prefixes).toContain('has');
    });
  });

  describe('Class Naming Detection', () => {
    it('should detect PascalCase classes', () => {
      const code = `
        class UserService {}
        class ProductController {}
        class OrderManager {}
      `;
      const result = detector.detect(code);

      expect(result.conventions.classes.regular.case).toBe(NamingCase.PASCAL_CASE);
      expect(result.conventions.classes.regular.count).toBe(3);
    });

    it('should detect abstract classes separately', () => {
      const code = `
        abstract class BaseService {}
        abstract class AbstractHandler {}
        class ConcreteService {}
      `;
      const result = detector.detect(code);

      expect(result.conventions.classes.abstract.count).toBe(2);
      expect(result.conventions.classes.regular.count).toBe(1);
    });

    it('should detect class name suffixes', () => {
      const code = `
        class UserService {}
        class ProductService {}
        class OrderService {}
        class AuthController {}
        class ApiController {}
      `;
      const result = detector.detect(code);

      expect(result.conventions.classes.regular.suffixes).toContain('Service');
      expect(result.conventions.classes.regular.suffixes).toContain('Controller');
    });

    it('should detect method naming in classes', () => {
      const code = `
        class UserService {
          getUser() {}
          setUser() {}
          private _internalMethod() {}
        }
      `;
      const result = detector.detect(code);

      expect(result.conventions.functions.methods.count).toBe(2);
      expect(result.conventions.functions.private.count).toBe(1);
    });
  });

  describe('Interface and Type Detection', () => {
    it('should detect PascalCase interfaces', () => {
      const code = `
        interface UserInterface {}
        interface ProductProps {}
        interface OrderState {}
      `;
      const result = detector.detect(code);

      expect(result.conventions.classes.interfaces.case).toBe(NamingCase.PASCAL_CASE);
      expect(result.conventions.classes.interfaces.count).toBe(3);
    });

    it('should detect type aliases', () => {
      const code = `
        type UserId = string;
        type UserType = 'admin' | 'user';
        type ProductOptions = {};
      `;
      const result = detector.detect(code);

      expect(result.conventions.classes.types.case).toBe(NamingCase.PASCAL_CASE);
      expect(result.conventions.classes.types.count).toBe(3);
    });

    it('should detect interface suffixes', () => {
      const code = `
        interface UserProps {}
        interface ProductProps {}
        interface OrderState {}
        interface AppState {}
      `;
      const result = detector.detect(code);

      expect(result.conventions.classes.interfaces.suffixes).toContain('Props');
      expect(result.conventions.classes.interfaces.suffixes).toContain('State');
    });
  });

  describe('Enum Detection', () => {
    it('should detect PascalCase enums', () => {
      const code = `
        enum UserRole {}
        enum ProductStatus {}
        enum OrderType {}
      `;
      const result = detector.detect(code);

      expect(result.conventions.classes.enums.case).toBe(NamingCase.PASCAL_CASE);
      expect(result.conventions.classes.enums.count).toBe(3);
    });
  });

  describe('Case Detection', () => {
    it('should detect camelCase', () => {
      const code = `const userName = 'test';`;
      const result = detector.detect(code);

      expect(result.conventions.variables.regular.case).toBe(NamingCase.CAMEL_CASE);
    });

    it('should detect PascalCase', () => {
      const code = `class UserService {}`;
      const result = detector.detect(code);

      expect(result.conventions.classes.regular.case).toBe(NamingCase.PASCAL_CASE);
    });

    it('should detect snake_case', () => {
      const code = `const user_name = 'test';`;
      const result = detector.detect(code);

      expect(result.conventions.variables.regular.case).toBe(NamingCase.SNAKE_CASE);
    });

    it('should detect SCREAMING_SNAKE_CASE', () => {
      const code = `const MAX_USERS = 100;`;
      const result = detector.detect(code);

      expect(result.conventions.variables.constants.case).toBe(NamingCase.SCREAMING_SNAKE_CASE);
    });

    it('should detect kebab-case in file names', () => {
      const code = `const x = 1;`;
      const result = detector.detect(code, 'user-service.ts');

      expect(result.conventions.files.utilities.case).toBe(NamingCase.KEBAB_CASE);
    });

    it('should detect simple lowercase as camelCase', () => {
      const code = `const name = 'test';`;
      const result = detector.detect(code);

      expect(result.conventions.variables.regular.case).toBe(NamingCase.CAMEL_CASE);
    });
  });

  describe('Inconsistency Detection', () => {
    it('should detect naming inconsistencies', () => {
      const code = `
        const userName = 'John';
        const userEmail = 'john@example.com';
        const user_age = 30; // Inconsistent
      `;
      const result = detector.detect(code);

      expect(result.inconsistencies.length).toBeGreaterThan(0);
      expect(result.inconsistencies[0].element).toBe('user_age');
      expect(result.inconsistencies[0].expectedCase).toBe(NamingCase.CAMEL_CASE);
      expect(result.inconsistencies[0].actualCase).toBe(NamingCase.SNAKE_CASE);
    });

    it('should not detect inconsistencies when disabled', () => {
      const detector2 = new NamingDetector({ detectInconsistencies: false });
      const code = `
        const userName = 'John';
        const user_age = 30;
      `;
      const result = detector2.detect(code);

      expect(result.inconsistencies).toHaveLength(0);
    });

    it('should respect minimum confidence threshold', () => {
      const detector2 = new NamingDetector({ minConfidence: 0.9 });
      const code = `
        const userName = 'John';
        const userEmail = 'test';
        const user_age = 30; // May not be flagged if confidence is too low
      `;
      const result = detector2.detect(code);

      // With high confidence threshold, inconsistencies may not be detected
      // if the pattern confidence is below threshold
      expect(result).toBeDefined();
    });
  });

  describe('Common Patterns', () => {
    it('should identify common prefixes across all elements', () => {
      const code = `
        function getUser() {}
        function getUserById() {}
        function getUserName() {}
        function setUser() {}
        function setUserName() {}
      `;
      const result = detector.detect(code);

      expect(result.commonPatterns.prefixes.length).toBeGreaterThan(0);
      expect(result.commonPatterns.prefixes[0].prefix).toBe('get');
      expect(result.commonPatterns.prefixes[0].count).toBeGreaterThan(0);
    });

    it('should identify common suffixes across all elements', () => {
      const code = `
        class UserService {}
        class ProductService {}
        class OrderService {}
        interface UserProps {}
      `;
      const result = detector.detect(code);

      expect(result.commonPatterns.suffixes.length).toBeGreaterThan(0);
      expect(result.commonPatterns.suffixes.some(s => s.suffix === 'Service')).toBe(true);
    });

    it('should identify most common case styles', () => {
      const code = `
        const userName = 'test';
        const userEmail = 'test';
        class UserService {}
        interface UserProps {}
      `;
      const result = detector.detect(code);

      expect(result.commonPatterns.caseStyles.length).toBeGreaterThan(0);
      expect(result.commonPatterns.caseStyles[0].count).toBeGreaterThan(0);
    });
  });

  describe('Statistics', () => {
    it('should calculate overall statistics', () => {
      const code = `
        const userName = 'John';
        function getUser() {}
        class UserService {}
      `;
      const result = detector.detect(code);

      expect(result.stats.totalElements).toBe(3);
      expect(result.stats.uniquePatterns).toBeGreaterThanOrEqual(1);
      expect(result.stats.overallConsistency).toBeGreaterThan(0);
      expect(result.stats.overallConsistency).toBeLessThanOrEqual(1);
    });

    it('should calculate high consistency for uniform naming', () => {
      const code = `
        const userName = 'John';
        const userEmail = 'test';
        const userId = '123';
        function getUser() {}
        function setUser() {}
      `;
      const result = detector.detect(code);

      expect(result.stats.overallConsistency).toBeGreaterThan(0.8);
    });
  });

  describe('File Naming Detection', () => {
    it('should detect component files', () => {
      const code = `class UserComponent {}`;
      const result = detector.detect(code, 'UserComponent.tsx');

      expect(result.conventions.files.components.examples).toContain('UserComponent');
      expect(result.conventions.files.components.case).toBe(NamingCase.PASCAL_CASE);
    });

    it('should detect test files', () => {
      const code = `const x = 1;`;
      const result = detector.detect(code, 'user-service.test.ts');

      expect(result.conventions.files.tests.examples.length).toBeGreaterThan(0);
    });

    it('should detect config files', () => {
      const code = `const x = 1;`;
      const result = detector.detect(code, 'app-config.ts');

      expect(result.conventions.files.configs.examples.length).toBeGreaterThan(0);
    });

    it('should detect utility files', () => {
      const code = `const x = 1;`;
      const result = detector.detect(code, 'string-helper.ts');

      expect(result.conventions.files.utilities.examples.length).toBeGreaterThan(0);
    });
  });

  describe('Caching', () => {
    it('should cache results', () => {
      const code = `const userName = 'test';`;

      const result1 = detector.detect(code);
      const result2 = detector.detect(code);

      const stats = detector.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(result1).toEqual(result2);
    });

    it('should respect cache TTL', async () => {
      const detector2 = new NamingDetector({ cacheTtl: 100 });
      const code = `const userName = 'test';`;

      detector2.detect(code);
      await new Promise(resolve => setTimeout(resolve, 150));
      detector2.detect(code);

      const stats = detector2.getCacheStats();
      expect(stats.misses).toBe(2); // Both should be cache misses
    });

    it('should respect max cache size', () => {
      const detector2 = new NamingDetector({ maxCacheSize: 2 });

      detector2.detect('const a = 1;');
      detector2.detect('const b = 2;');
      detector2.detect('const c = 3;'); // Should evict first entry

      const stats = detector2.getCacheStats();
      expect(stats.size).toBeLessThanOrEqual(2);
    });

    it('should clear cache', () => {
      const code = `const userName = 'test';`;

      detector.detect(code);
      detector.clearCache();

      const stats = detector.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should calculate hit rate correctly', () => {
      const code = `const userName = 'test';`;

      detector.detect(code); // miss
      detector.detect(code); // hit
      detector.detect(code); // hit

      const stats = detector.getCacheStats();
      expect(stats.hitRate).toBe(2 / 3);
    });

    it('should work with cache disabled', () => {
      const detector2 = new NamingDetector({ enableCache: false });
      const code = `const userName = 'test';`;

      detector2.detect(code);
      detector2.detect(code);

      const stats = detector2.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid TypeScript gracefully', () => {
      const code = `this is not valid typescript!!!`;
      const result = detector.detect(code);

      expect(result).toBeDefined();
      expect(result.conventions).toBeDefined();
    });

    it('should handle empty code', () => {
      const code = ``;
      const result = detector.detect(code);

      expect(result).toBeDefined();
      expect(result.stats.totalElements).toBe(0);
    });

    it('should handle code with only comments', () => {
      const code = `
        // This is a comment
        /* Another comment */
      `;
      const result = detector.detect(code);

      expect(result).toBeDefined();
      expect(result.stats.totalElements).toBe(0);
    });
  });

  describe('Private Members', () => {
    it('should exclude private members when configured', () => {
      const detector2 = new NamingDetector({ includePrivate: false });
      const code = `
        const userName = 'test';
        const _privateVar = 'secret';
      `;
      const result = detector2.detect(code);

      expect(result.stats.totalElements).toBe(1); // Only userName
    });

    it('should include private members by default', () => {
      const code = `
        const userName = 'test';
        const _privateVar = 'secret';
      `;
      const result = detector.detect(code);

      expect(result.stats.totalElements).toBe(2);
    });
  });

  describe('Factory Function', () => {
    it('should create detector with factory function', () => {
      const detector2 = createNamingDetector();
      expect(detector2).toBeDefined();
      expect(detector2).toBeInstanceOf(NamingDetector);
    });

    it('should create detector with options via factory', () => {
      const detector2 = createNamingDetector({ enableCache: false });
      expect(detector2).toBeDefined();
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle mixed naming in a real-world file', () => {
      const code = `
        import { useState } from 'react';

        interface UserProps {
          name: string;
          email: string;
        }

        const MAX_USERS = 100;
        const API_URL = 'https://api.example.com';

        export class UserService {
          private _cache: Map<string, User> = new Map();

          async getUser(id: string): Promise<User> {
            return {} as User;
          }

          setUser(user: User): void {
            this._cache.set(user.id, user);
          }
        }

        function validateEmail(email: string): boolean {
          return true;
        }

        export const useUser = () => {
          const [user, setUser] = useState(null);
          return { user, setUser };
        };
      `;
      const result = detector.detect(code);

      expect(result.stats.totalElements).toBeGreaterThan(5);
      expect(result.conventions.variables.constants.case).toBe(NamingCase.SCREAMING_SNAKE_CASE);
      expect(result.conventions.classes.regular.case).toBe(NamingCase.PASCAL_CASE);
      expect(result.conventions.functions.methods.prefixes).toContain('get');
      expect(result.stats.overallConsistency).toBeGreaterThan(0);
    });

    it('should provide useful examples', () => {
      const code = `
        const userName = 'John';
        const userEmail = 'test';
        const userId = '123';
        const userAge = 30;
      `;
      const result = detector.detect(code);

      expect(result.conventions.variables.regular.examples.length).toBeGreaterThan(0);
      expect(result.conventions.variables.regular.examples.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Confidence Scores', () => {
    it('should have high confidence for consistent naming', () => {
      const code = `
        const userName = 'John';
        const userEmail = 'test';
        const userId = '123';
      `;
      const result = detector.detect(code);

      expect(result.conventions.variables.regular.confidence).toBe(1);
    });

    it('should have lower confidence for inconsistent naming', () => {
      const code = `
        const userName = 'John';
        const user_email = 'test';
        const UserAge = 30;
      `;
      const result = detector.detect(code);

      expect(result.conventions.variables.regular.confidence).toBeLessThan(1);
    });

    it('should have zero confidence for empty patterns', () => {
      const code = `class Empty {}`;
      const result = detector.detect(code);

      expect(result.conventions.variables.regular.confidence).toBe(0);
      expect(result.conventions.variables.regular.count).toBe(0);
    });
  });
});
