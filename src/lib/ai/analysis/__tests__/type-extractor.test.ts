/**
 * Unit tests for type-extractor.ts
 * Tests type definition extraction from TypeScript code
 */

import {
  TypeExtractor,
  createTypeExtractor,
  TypeDefinitionKind,
  TypeExtractionResult,
  TypeExtractorOptions
} from '../type-extractor';

describe('TypeExtractor', () => {
  let extractor: TypeExtractor;

  beforeEach(() => {
    extractor = new TypeExtractor();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(extractor).toBeDefined();
      expect(extractor.getCacheStats().size).toBe(0);
    });

    it('should initialize with custom configuration', () => {
      const options: TypeExtractorOptions = {
        enableCache: false,
        includeNonExported: false,
        includeMemberDetails: false
      };
      const customExtractor = new TypeExtractor(options);

      expect(customExtractor).toBeDefined();
    });
  });

  describe('Interface Extraction', () => {
    it('should extract simple interface', () => {
      const code = `interface User {
        name: string;
        age: number;
      }`;
      const result = extractor.extract(code);

      expect(result.types).toHaveLength(1);
      expect(result.types[0].kind).toBe(TypeDefinitionKind.INTERFACE);
      expect(result.types[0].name).toBe('User');
      expect(result.types[0].members).toHaveLength(2);
      expect(result.types[0].members[0].name).toBe('name');
      expect(result.types[0].members[0].type).toBe('string');
      expect(result.types[0].members[1].name).toBe('age');
      expect(result.types[0].members[1].type).toBe('number');
    });

    it('should extract exported interface', () => {
      const code = `export interface User {
        name: string;
      }`;
      const result = extractor.extract(code);

      expect(result.types[0].isExported).toBe(true);
      expect(result.exportedTypes).toContain('User');
    });

    it('should extract interface with optional properties', () => {
      const code = `interface User {
        name: string;
        email?: string;
      }`;
      const result = extractor.extract(code);

      expect(result.types[0].members[0].optional).toBe(false);
      expect(result.types[0].members[1].optional).toBe(true);
    });

    it('should extract interface with readonly properties', () => {
      const code = `interface User {
        readonly id: string;
        name: string;
      }`;
      const result = extractor.extract(code);

      expect(result.types[0].members[0].readonly).toBe(true);
      expect(result.types[0].members[1].readonly).toBe(false);
    });

    it('should extract interface with generics', () => {
      const code = `interface Response<T> {
        data: T;
      }`;
      const result = extractor.extract(code);

      expect(result.types[0].typeParameters).toHaveLength(1);
      expect(result.types[0].typeParameters[0].name).toBe('T');
    });

    it('should extract interface with constrained generics', () => {
      const code = `interface Response<T extends string> {
        data: T;
      }`;
      const result = extractor.extract(code);

      expect(result.types[0].typeParameters[0].name).toBe('T');
      expect(result.types[0].typeParameters[0].constraint).toBe('string');
    });

    it('should extract interface with heritage', () => {
      const code = `interface User extends Person {
        email: string;
      }`;
      const result = extractor.extract(code);

      expect(result.types[0].heritage).toHaveLength(1);
      expect(result.types[0].heritage[0]).toBe('Person');
    });

    it('should extract interface with multiple heritage', () => {
      const code = `interface User extends Person, Entity {
        email: string;
      }`;
      const result = extractor.extract(code);

      expect(result.types[0].heritage).toHaveLength(2);
      expect(result.types[0].heritage).toContain('Person');
      expect(result.types[0].heritage).toContain('Entity');
    });
  });

  describe('Type Alias Extraction', () => {
    it('should extract simple type alias', () => {
      const code = `type UserId = string;`;
      const result = extractor.extract(code);

      expect(result.types).toHaveLength(1);
      expect(result.types[0].kind).toBe(TypeDefinitionKind.TYPE_ALIAS);
      expect(result.types[0].name).toBe('UserId');
    });

    it('should extract exported type alias', () => {
      const code = `export type UserId = string;`;
      const result = extractor.extract(code);

      expect(result.types[0].isExported).toBe(true);
      expect(result.exportedTypes).toContain('UserId');
    });

    it('should extract type alias with object type', () => {
      const code = `type User = {
        name: string;
        age: number;
      };`;
      const result = extractor.extract(code);

      expect(result.types[0].members).toHaveLength(2);
      expect(result.types[0].members[0].name).toBe('name');
      expect(result.types[0].members[0].type).toBe('string');
    });

    it('should extract type alias with generics', () => {
      const code = `type Response<T> = {
        data: T;
      };`;
      const result = extractor.extract(code);

      expect(result.types[0].typeParameters).toHaveLength(1);
      expect(result.types[0].typeParameters[0].name).toBe('T');
    });

    it('should extract union type alias', () => {
      const code = `type Status = 'active' | 'inactive';`;
      const result = extractor.extract(code);

      expect(result.types[0].kind).toBe(TypeDefinitionKind.TYPE_ALIAS);
      expect(result.types[0].name).toBe('Status');
    });
  });

  describe('Enum Extraction', () => {
    it('should extract simple enum', () => {
      const code = `enum Status {
        Active,
        Inactive
      }`;
      const result = extractor.extract(code);

      expect(result.types).toHaveLength(1);
      expect(result.types[0].kind).toBe(TypeDefinitionKind.ENUM);
      expect(result.types[0].name).toBe('Status');
      expect(result.types[0].members).toHaveLength(2);
      expect(result.types[0].members[0].name).toBe('Active');
      expect(result.types[0].members[1].name).toBe('Inactive');
    });

    it('should extract exported enum', () => {
      const code = `export enum Status {
        Active,
        Inactive
      }`;
      const result = extractor.extract(code);

      expect(result.types[0].isExported).toBe(true);
      expect(result.exportedTypes).toContain('Status');
    });

    it('should extract enum with values', () => {
      const code = `enum Status {
        Active = 1,
        Inactive = 0
      }`;
      const result = extractor.extract(code);

      expect(result.types[0].members[0].type).toBe('1');
      expect(result.types[0].members[1].type).toBe('0');
    });

    it('should extract string enum', () => {
      const code = `enum Status {
        Active = 'active',
        Inactive = 'inactive'
      }`;
      const result = extractor.extract(code);

      expect(result.types[0].members[0].type).toBe("'active'");
      expect(result.types[0].members[1].type).toBe("'inactive'");
    });
  });

  describe('Class Extraction', () => {
    it('should extract simple class', () => {
      const code = `class User {
        name: string;
        age: number;
      }`;
      const result = extractor.extract(code);

      expect(result.types).toHaveLength(1);
      expect(result.types[0].kind).toBe(TypeDefinitionKind.CLASS);
      expect(result.types[0].name).toBe('User');
      expect(result.types[0].members).toHaveLength(2);
    });

    it('should extract exported class', () => {
      const code = `export class User {
        name: string;
      }`;
      const result = extractor.extract(code);

      expect(result.types[0].isExported).toBe(true);
      expect(result.exportedTypes).toContain('User');
    });

    it('should extract class with methods', () => {
      const code = `class User {
        getName(): string {
          return this.name;
        }
      }`;
      const result = extractor.extract(code);

      expect(result.types[0].members).toHaveLength(1);
      expect(result.types[0].members[0].name).toBe('getName');
      expect(result.types[0].members[0].type).toBe('() => string');
    });

    it('should extract class with method parameters', () => {
      const code = `class User {
        setName(name: string): void {
          this.name = name;
        }
      }`;
      const result = extractor.extract(code);

      expect(result.types[0].members[0].type).toBe('(name: string) => void');
    });

    it('should extract class with generics', () => {
      const code = `class Response<T> {
        data: T;
      }`;
      const result = extractor.extract(code);

      expect(result.types[0].typeParameters).toHaveLength(1);
      expect(result.types[0].typeParameters[0].name).toBe('T');
    });

    it('should extract class with heritage', () => {
      const code = `class User extends Person {
        email: string;
      }`;
      const result = extractor.extract(code);

      expect(result.types[0].heritage).toHaveLength(1);
      expect(result.types[0].heritage[0]).toBe('Person');
    });

    it('should extract class with implements', () => {
      const code = `class User implements IUser {
        name: string;
      }`;
      const result = extractor.extract(code);

      expect(result.types[0].heritage).toHaveLength(1);
      expect(result.types[0].heritage[0]).toBe('IUser');
    });

    it('should extract class with readonly properties', () => {
      const code = `class User {
        readonly id: string;
      }`;
      const result = extractor.extract(code);

      expect(result.types[0].members[0].readonly).toBe(true);
    });
  });

  describe('Statistics', () => {
    it('should calculate correct statistics', () => {
      const code = `
        interface User {
          name: string;
        }

        type UserId = string;

        enum Status {
          Active,
          Inactive
        }

        class Person {
          name: string;
        }
      `;
      const result = extractor.extract(code);

      expect(result.stats.total).toBe(4);
      expect(result.stats.interfaces).toBe(1);
      expect(result.stats.typeAliases).toBe(1);
      expect(result.stats.enums).toBe(1);
      expect(result.stats.classes).toBe(1);
    });

    it('should count exported types', () => {
      const code = `
        export interface User {
          name: string;
        }

        interface Internal {
          id: string;
        }

        export type UserId = string;
      `;
      const result = extractor.extract(code);

      expect(result.stats.exported).toBe(2);
      expect(result.exportedTypes).toHaveLength(2);
      expect(result.exportedTypes).toContain('User');
      expect(result.exportedTypes).toContain('UserId');
    });

    it('should handle empty source code', () => {
      const code = '';
      const result = extractor.extract(code);

      expect(result.stats.total).toBe(0);
      expect(result.types).toHaveLength(0);
    });
  });

  describe('Options', () => {
    it('should filter non-exported types when includeNonExported is false', () => {
      const code = `
        export interface User {
          name: string;
        }

        interface Internal {
          id: string;
        }
      `;
      const customExtractor = new TypeExtractor({ includeNonExported: false });
      const result = customExtractor.extract(code);

      expect(result.types).toHaveLength(1);
      expect(result.types[0].name).toBe('User');
    });

    it('should skip member details when includeMemberDetails is false', () => {
      const code = `interface User {
        name: string;
        age: number;
      }`;
      const customExtractor = new TypeExtractor({ includeMemberDetails: false });
      const result = customExtractor.extract(code);

      expect(result.types[0].members).toHaveLength(0);
    });
  });

  describe('Line Numbers', () => {
    it('should track correct line numbers for type definitions', () => {
      const code = `interface User {
  name: string;
}

type UserId = string;

enum Status {
  Active
}`;
      const result = extractor.extract(code);

      expect(result.types[0].line).toBe(1); // interface
      expect(result.types[1].line).toBe(5); // type
      expect(result.types[2].line).toBe(7); // enum
    });
  });

  describe('Complex Scenarios', () => {
    it('should extract all types from a complex file', () => {
      const code = `
        export interface User {
          name: string;
          email?: string;
          readonly id: string;
        }

        export type UserId = string;

        export type UserStatus = 'active' | 'inactive';

        export enum Role {
          Admin = 'admin',
          User = 'user'
        }

        export class UserService {
          getUser(id: UserId): User {
            return null as any;
          }
        }
      `;
      const result = extractor.extract(code);

      expect(result.stats.total).toBe(5);
      expect(result.stats.exported).toBe(5);
      expect(result.exportedTypes).toHaveLength(5);
    });

    it('should preserve original type definition text', () => {
      const code = `interface User {
  name: string;
}`;
      const result = extractor.extract(code);

      expect(result.types[0].text).toContain('interface User');
      expect(result.types[0].text).toContain('name: string');
    });

    it('should handle nested generic constraints', () => {
      const code = `interface Response<T extends { id: string }> {
        data: T;
      }`;
      const result = extractor.extract(code);

      expect(result.types[0].typeParameters[0].constraint).toContain('id: string');
    });

    it('should handle multiple generic parameters', () => {
      const code = `interface Map<K, V> {
        get(key: K): V;
      }`;
      const result = extractor.extract(code);

      expect(result.types[0].typeParameters).toHaveLength(2);
      expect(result.types[0].typeParameters[0].name).toBe('K');
      expect(result.types[0].typeParameters[1].name).toBe('V');
    });
  });

  describe('Caching', () => {
    it('should cache extraction results', () => {
      const code = `interface User {
        name: string;
      }`;

      const result1 = extractor.extract(code);
      const result2 = extractor.extract(code);

      const stats = extractor.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(result1).toEqual(result2);
    });

    it('should return different results for different code', () => {
      const code1 = `interface User { name: string; }`;
      const code2 = `interface Post { title: string; }`;

      const result1 = extractor.extract(code1);
      const result2 = extractor.extract(code2);

      expect(result1.types[0].name).toBe('User');
      expect(result2.types[0].name).toBe('Post');
    });

    it('should respect cache disabled option', () => {
      const customExtractor = new TypeExtractor({ enableCache: false });
      const code = `interface User { name: string; }`;

      customExtractor.extract(code);
      customExtractor.extract(code);

      const stats = customExtractor.getCacheStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should clear cache', () => {
      const code = `interface User { name: string; }`;

      extractor.extract(code);
      expect(extractor.getCacheStats().size).toBeGreaterThan(0);

      extractor.clearCache();
      expect(extractor.getCacheStats().size).toBe(0);
      expect(extractor.getCacheStats().hits).toBe(0);
      expect(extractor.getCacheStats().misses).toBe(0);
    });

    it('should calculate hit rate correctly', () => {
      const code = `interface User { name: string; }`;

      extractor.extract(code); // miss
      extractor.extract(code); // hit
      extractor.extract(code); // hit

      const stats = extractor.getCacheStats();
      expect(stats.hitRate).toBeCloseTo(0.666, 2);
    });
  });

  describe('Factory Function', () => {
    it('should create extractor via factory function', () => {
      const extractor = createTypeExtractor();

      expect(extractor).toBeInstanceOf(TypeExtractor);
    });

    it('should create extractor with options via factory function', () => {
      const options: TypeExtractorOptions = {
        enableCache: false
      };
      const extractor = createTypeExtractor(options);

      expect(extractor).toBeInstanceOf(TypeExtractor);
    });
  });

  describe('Real-World Code Examples', () => {
    it('should extract types from React component file', () => {
      const code = `
        import React from 'react';

        export interface UserProps {
          name: string;
          email?: string;
        }

        export type UserId = string;

        export const UserComponent: React.FC<UserProps> = ({ name, email }) => {
          return <div>{name}</div>;
        };
      `;
      const result = extractor.extract(code);

      expect(result.stats.total).toBe(2);
      expect(result.exportedTypes).toContain('UserProps');
      expect(result.exportedTypes).toContain('UserId');
    });

    it('should extract types from API response file', () => {
      const code = `
        export interface ApiResponse<T> {
          data: T;
          status: number;
          message?: string;
        }

        export type UserResponse = ApiResponse<User>;

        export enum HttpStatus {
          OK = 200,
          BadRequest = 400,
          NotFound = 404
        }
      `;
      const result = extractor.extract(code);

      expect(result.stats.total).toBe(3);
      expect(result.stats.interfaces).toBe(1);
      expect(result.stats.typeAliases).toBe(1);
      expect(result.stats.enums).toBe(1);
    });

    it('should extract types from service class', () => {
      const code = `
        export class UserService {
          private users: Map<string, User>;

          constructor() {
            this.users = new Map();
          }

          getUser(id: string): User | undefined {
            return this.users.get(id);
          }

          addUser(user: User): void {
            this.users.set(user.id, user);
          }
        }
      `;
      const result = extractor.extract(code);

      expect(result.types).toHaveLength(1);
      expect(result.types[0].kind).toBe(TypeDefinitionKind.CLASS);
      expect(result.types[0].members.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid syntax gracefully', () => {
      const code = `interface User {`; // Invalid syntax
      const result = extractor.extract(code);

      // TypeScript parser is tolerant
      expect(result).toBeDefined();
      expect(result.types).toBeDefined();
    });

    it('should handle empty interface', () => {
      const code = `interface Empty {}`;
      const result = extractor.extract(code);

      expect(result.types).toHaveLength(1);
      expect(result.types[0].members).toHaveLength(0);
    });
  });

  describe('Performance', () => {
    it('should handle large files efficiently', () => {
      const interfaces = Array.from({ length: 100 }, (_, i) =>
        `interface Type${i} { name: string; }`
      ).join('\n');

      const start = Date.now();
      const result = extractor.extract(interfaces);
      const duration = Date.now() - start;

      expect(result.types).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });

    it('should benefit from caching on repeated extractions', () => {
      const code = `interface User { name: string; }`;

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
