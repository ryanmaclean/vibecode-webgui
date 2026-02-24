/**
 * Unit tests for pattern-detector.ts
 * Tests design pattern detection from TypeScript code
 */

import {
  PatternDetector,
  createPatternDetector,
  PatternType,
  PatternDetectionResult,
  PatternDetectorOptions
} from '../pattern-detector';

describe('PatternDetector', () => {
  let detector: PatternDetector;

  beforeEach(() => {
    detector = new PatternDetector();
  });

  describe('Constructor', () => {
    it('should initialize with default configuration', () => {
      expect(detector).toBeDefined();
      expect(detector.getCacheStats().size).toBe(0);
    });

    it('should initialize with custom configuration', () => {
      const options: PatternDetectorOptions = {
        enableCache: false,
        minConfidence: 0.8,
        includeLowConfidence: true,
        detectReactPatterns: false
      };
      const customDetector = new PatternDetector(options);

      expect(customDetector).toBeDefined();
    });
  });

  describe('Singleton Pattern Detection', () => {
    it('should detect singleton with getInstance method', () => {
      const code = `
        export class DatabaseConnection {
          private static instance: DatabaseConnection;

          private constructor() {}

          static getInstance(): DatabaseConnection {
            if (!this.instance) {
              this.instance = new DatabaseConnection();
            }
            return this.instance;
          }
        }
      `;
      const result = detector.detect(code);

      const singleton = result.patterns.find(p => p.type === PatternType.SINGLETON);
      expect(singleton).toBeDefined();
      expect(singleton?.name).toBe('DatabaseConnection');
      expect(singleton?.confidence).toBeGreaterThan(0.6);
      expect(singleton?.evidence).toContain('Has getInstance method');
    });

    it('should detect singleton with private constructor and instance property', () => {
      const code = `
        class Logger {
          private static instance: Logger;

          private constructor() {}

          public static getInstance() {
            return Logger.instance;
          }
        }
      `;
      const result = detector.detect(code);

      expect(result.stats.singleton).toBeGreaterThan(0);
    });

    it('should not detect singleton without key characteristics', () => {
      const code = `
        class RegularClass {
          constructor() {}

          someMethod() {}
        }
      `;
      const result = detector.detect(code);

      const singleton = result.patterns.find(p => p.type === PatternType.SINGLETON);
      expect(singleton).toBeUndefined();
    });
  });

  describe('Factory Pattern Detection', () => {
    it('should detect factory class with create methods', () => {
      const code = `
        export class UserFactory {
          createUser(name: string) {
            return { name, role: 'user' };
          }

          createAdmin(name: string) {
            return { name, role: 'admin' };
          }
        }
      `;
      const result = detector.detect(code);

      const factory = result.patterns.find(p =>
        p.type === PatternType.FACTORY && p.name === 'UserFactory'
      );
      expect(factory).toBeDefined();
      expect(factory?.confidence).toBeGreaterThan(0.6);
    });

    it('should detect factory function', () => {
      const code = `
        export function createConnection(config: any) {
          return new Connection(config);
        }
      `;
      const result = detector.detect(code);

      const factory = result.patterns.find(p => p.type === PatternType.FACTORY);
      expect(factory).toBeDefined();
      expect(factory?.metadata.implementationType).toBe('function');
    });

    it('should detect arrow function factory', () => {
      const code = `
        export const createLogger = (level: string) => {
          return { level, log: () => {} };
        };
      `;
      const result = detector.detect(code);

      const factory = result.patterns.find(p =>
        p.type === PatternType.FACTORY && p.name === 'createLogger'
      );
      expect(factory).toBeDefined();
    });
  });

  describe('Service Pattern Detection', () => {
    it('should detect service class with CRUD methods', () => {
      const code = `
        export class UserService {
          async findById(id: string) {}
          async create(data: any) {}
          async update(id: string, data: any) {}
          async delete(id: string) {}
        }
      `;
      const result = detector.detect(code);

      const service = result.patterns.find(p => p.type === PatternType.SERVICE);
      expect(service).toBeDefined();
      expect(service?.evidence).toContain('Name ends with "Service"');
    });

    it('should detect service by naming convention', () => {
      const code = `
        class AuthService {
          login() {}
          logout() {}
          validateToken() {}
        }
      `;
      const result = detector.detect(code);

      expect(result.stats.service).toBeGreaterThan(0);
    });

    it('should detect service with business logic methods', () => {
      const code = `
        class OrderService {
          fetchOrders() {}
          saveOrder() {}
          loadOrderDetails() {}
          updateOrderStatus() {}
        }
      `;
      const result = detector.detect(code);

      const service = result.patterns.find(p =>
        p.type === PatternType.SERVICE && p.name === 'OrderService'
      );
      expect(service).toBeDefined();
    });
  });

  describe('React Hook Pattern Detection', () => {
    it('should detect hook with useState', () => {
      const code = `
        export function useCounter() {
          const [count, setCount] = useState(0);
          return { count, setCount };
        }
      `;
      const result = detector.detect(code);

      const hook = result.patterns.find(p => p.type === PatternType.HOOK);
      expect(hook).toBeDefined();
      expect(hook?.name).toBe('useCounter');
      expect(hook?.evidence).toContain('Name starts with "use"');
    });

    it('should detect hook with multiple React hooks', () => {
      const code = `
        function useFetch(url: string) {
          const [data, setData] = useState(null);
          const [loading, setLoading] = useState(true);

          useEffect(() => {
            fetch(url).then(setData);
          }, [url]);

          return { data, loading };
        }
      `;
      const result = detector.detect(code);

      const hook = result.patterns.find(p => p.type === PatternType.HOOK);
      expect(hook).toBeDefined();
      expect(hook?.metadata.stateVariables).toBeDefined();
    });

    it('should detect arrow function hook', () => {
      const code = `
        export const useLocalStorage = (key: string) => {
          const [value, setValue] = useState(() => localStorage.getItem(key));

          useEffect(() => {
            localStorage.setItem(key, value);
          }, [key, value]);

          return [value, setValue];
        };
      `;
      const result = detector.detect(code);

      const hook = result.patterns.find(p =>
        p.type === PatternType.HOOK && p.name === 'useLocalStorage'
      );
      expect(hook).toBeDefined();
    });

    it('should not detect functions that start with "use" but are not hooks', () => {
      const code = `
        function username() {
          return 'john';
        }
      `;
      const result = detector.detect(code);

      const hook = result.patterns.find(p => p.type === PatternType.HOOK);
      expect(hook).toBeUndefined();
    });
  });

  describe('HOC Pattern Detection', () => {
    it('should detect HOC with component parameter', () => {
      const code = `
        export function withAuth(Component: any) {
          return function AuthenticatedComponent(props: any) {
            return <Component {...props} />;
          };
        }
      `;
      const result = detector.detect(code);

      const hoc = result.patterns.find(p => p.type === PatternType.HOC);
      expect(hoc).toBeDefined();
      expect(hoc?.name).toBe('withAuth');
    });

    it('should detect HOC with naming convention', () => {
      const code = `
        function withLoading(Component: React.ComponentType) {
          return (props: any) => {
            return props.loading ? <Spinner /> : <Component {...props} />;
          };
        }
      `;
      const result = detector.detect(code);

      const hoc = result.patterns.find(p => p.type === PatternType.HOC);
      expect(hoc).toBeDefined();
    });

    it('should detect arrow function HOC', () => {
      const code = `
        export const enhanceComponent = (Component: any) => {
          return (props: any) => <Component enhanced {...props} />;
        };
      `;
      const result = detector.detect(code);

      const hoc = result.patterns.find(p =>
        p.type === PatternType.HOC && p.name === 'enhanceComponent'
      );
      expect(hoc).toBeDefined();
    });
  });

  describe('Builder Pattern Detection', () => {
    it('should detect builder with builder methods', () => {
      const code = `
        class QueryBuilder {
          withSelect(fields: string[]) { return this; }
          withWhere(condition: string) { return this; }
          withLimit(limit: number) { return this; }
          build() { return 'query'; }
        }
      `;
      const result = detector.detect(code);

      const builder = result.patterns.find(p => p.type === PatternType.BUILDER);
      expect(builder).toBeDefined();
      expect(builder?.evidence).toContain('Name ends with "Builder"');
    });

    it('should detect builder with set methods', () => {
      const code = `
        export class UserBuilder {
          setName(name: string) { return this; }
          setEmail(email: string) { return this; }
          setAge(age: number) { return this; }
          build() {}
        }
      `;
      const result = detector.detect(code);

      expect(result.stats.builder).toBeGreaterThan(0);
    });
  });

  describe('Repository Pattern Detection', () => {
    it('should detect repository with data access methods', () => {
      const code = `
        export class UserRepository {
          findById(id: string) {}
          findAll() {}
          save(user: any) {}
          update(user: any) {}
          delete(id: string) {}
        }
      `;
      const result = detector.detect(code);

      const repo = result.patterns.find(p => p.type === PatternType.REPOSITORY);
      expect(repo).toBeDefined();
      expect(repo?.name).toBe('UserRepository');
    });

    it('should detect repository by naming', () => {
      const code = `
        class OrderStore {
          getOrder(id: string) {}
          queryOrders() {}
          insertOrder(order: any) {}
        }
      `;
      const result = detector.detect(code);

      const repo = result.patterns.find(p => p.type === PatternType.REPOSITORY);
      expect(repo).toBeDefined();
    });
  });

  describe('Controller Pattern Detection', () => {
    it('should detect controller with handler methods', () => {
      const code = `
        export class UserController {
          handleGetUser() {}
          handleCreateUser() {}
          handleUpdateUser() {}
          handleDeleteUser() {}
        }
      `;
      const result = detector.detect(code);

      const controller = result.patterns.find(p => p.type === PatternType.CONTROLLER);
      expect(controller).toBeDefined();
    });

    it('should detect controller with HTTP methods', () => {
      const code = `
        class ApiController {
          get() {}
          post() {}
          put() {}
          delete() {}
        }
      `;
      const result = detector.detect(code);

      const controller = result.patterns.find(p => p.type === PatternType.CONTROLLER);
      expect(controller).toBeDefined();
    });
  });

  describe('Observer Pattern Detection', () => {
    it('should detect observer with event methods', () => {
      const code = `
        export class EventEmitter {
          private listeners: any[] = [];

          on(event: string, handler: Function) {}
          off(event: string, handler: Function) {}
          emit(event: string, data: any) {}
        }
      `;
      const result = detector.detect(code);

      const observer = result.patterns.find(p => p.type === PatternType.OBSERVER);
      expect(observer).toBeDefined();
      expect(observer?.evidence.length).toBeGreaterThan(0);
    });

    it('should detect observer with subscription methods', () => {
      const code = `
        class MessageBus {
          private subscribers: any;

          subscribe(topic: string) {}
          unsubscribe(topic: string) {}
          notify(message: any) {}
        }
      `;
      const result = detector.detect(code);

      const observer = result.patterns.find(p => p.type === PatternType.OBSERVER);
      expect(observer).toBeDefined();
    });
  });

  describe('Provider Pattern Detection', () => {
    it('should detect provider with provide methods', () => {
      const code = `
        export class ServiceProvider {
          provide(service: string) {}
          register(name: string, service: any) {}
          resolve(name: string) {}
        }
      `;
      const result = detector.detect(code);

      const provider = result.patterns.find(p => p.type === PatternType.PROVIDER);
      expect(provider).toBeDefined();
    });

    it('should detect provider by naming', () => {
      const code = `
        class ConfigProvider {
          get(key: string) {}
        }
      `;
      const result = detector.detect(code);

      const provider = result.patterns.find(p => p.type === PatternType.PROVIDER);
      expect(provider).toBeDefined();
    });
  });

  describe('Utility Pattern Detection', () => {
    it('should detect utility class with static methods', () => {
      const code = `
        export class StringUtils {
          static capitalize(str: string) {}
          static trim(str: string) {}
          static split(str: string) {}
        }
      `;
      const result = detector.detect(code);

      const utility = result.patterns.find(p => p.type === PatternType.UTILITY);
      expect(utility).toBeDefined();
    });

    it('should detect utility function', () => {
      const code = `
        export function formatDate(date: Date) {
          return date.toISOString();
        }
      `;
      const result = detector.detect(code);

      const utility = result.patterns.find(p =>
        p.type === PatternType.UTILITY && p.name === 'formatDate'
      );
      expect(utility).toBeDefined();
    });

    it('should detect helper class', () => {
      const code = `
        class ArrayHelper {
          static unique(arr: any[]) {}
          static flatten(arr: any[]) {}
        }
      `;
      const result = detector.detect(code);

      const utility = result.patterns.find(p => p.type === PatternType.UTILITY);
      expect(utility).toBeDefined();
    });
  });

  describe('Multiple Patterns', () => {
    it('should detect multiple patterns in one file', () => {
      const code = `
        export class UserService {
          findAll() {}
          create() {}
        }

        export class UserRepository {
          findById() {}
          save() {}
        }

        export function createUser() {
          return {};
        }
      `;
      const result = detector.detect(code);

      expect(result.patterns.length).toBeGreaterThan(2);
      expect(result.stats.service).toBeGreaterThan(0);
      expect(result.stats.repository).toBeGreaterThan(0);
      expect(result.stats.factory).toBeGreaterThan(0);
    });

    it('should detect pattern combinations', () => {
      const code = `
        export class DatabaseService {
          private static instance: DatabaseService;

          private constructor() {}

          static getInstance() {
            return DatabaseService.instance;
          }

          findAll() {}
          save() {}
        }
      `;
      const result = detector.detect(code);

      expect(result.combinations.length).toBeGreaterThan(0);
    });
  });

  describe('Architecture Assessment', () => {
    it('should detect object-oriented architecture', () => {
      const code = `
        class UserService {
          findAll() {}
        }

        class UserRepository {
          save() {}
        }

        class UserController {
          handleGet() {}
        }
      `;
      const result = detector.detect(code);

      expect(result.architecture.style).toBe('object-oriented');
    });

    it('should detect functional architecture', () => {
      const code = `
        export function createUser() {}
        export function deleteUser() {}
        export function updateUser() {}
        export const formatUser = () => {};
      `;
      const result = detector.detect(code);

      expect(['functional', 'mixed']).toContain(result.architecture.style);
    });

    it('should identify dominant pattern', () => {
      const code = `
        class UserService {
          get() {}
        }

        class OrderService {
          get() {}
        }

        class ProductService {
          get() {}
        }
      `;
      const result = detector.detect(code);

      expect(result.architecture.dominantPattern).toBe(PatternType.SERVICE);
    });
  });

  describe('Configuration Options', () => {
    it('should respect minConfidence threshold', () => {
      const code = `
        class MaybeFactory {
          create() {}
        }
      `;

      const strictDetector = new PatternDetector({ minConfidence: 0.9 });
      const lenientDetector = new PatternDetector({ minConfidence: 0.3 });

      const strictResult = strictDetector.detect(code);
      const lenientResult = lenientDetector.detect(code);

      expect(lenientResult.patterns.length).toBeGreaterThanOrEqual(strictResult.patterns.length);
    });

    it('should disable React pattern detection when configured', () => {
      const code = `
        export function useCustomHook() {
          const [state, setState] = useState();
          return state;
        }
      `;

      const noReactDetector = new PatternDetector({ detectReactPatterns: false });
      const result = noReactDetector.detect(code);

      const hook = result.patterns.find(p => p.type === PatternType.HOOK);
      expect(hook).toBeUndefined();
    });

    it('should include low confidence patterns when configured', () => {
      const code = `
        class AmbiguousClass {
          someMethod() {}
        }
      `;

      const detector1 = new PatternDetector({ includeLowConfidence: false, minConfidence: 0.6 });
      const detector2 = new PatternDetector({ includeLowConfidence: true, minConfidence: 0.6 });

      const result1 = detector1.detect(code);
      const result2 = detector2.detect(code);

      expect(result2.patterns.length).toBeGreaterThanOrEqual(result1.patterns.length);
    });
  });

  describe('Cache Management', () => {
    it('should cache detection results', () => {
      const code = `export class UserService { get() {} }`;

      detector.detect(code);
      detector.detect(code);

      const stats = detector.getCacheStats();
      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });

    it('should clear cache', () => {
      const code = `export class UserService { get() {} }`;

      detector.detect(code);
      detector.clearCache();

      const stats = detector.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
    });

    it('should calculate hit rate', () => {
      const code1 = `export class Service1 { get() {} }`;
      const code2 = `export class Service2 { get() {} }`;

      detector.detect(code1);
      detector.detect(code1);
      detector.detect(code2);
      detector.detect(code2);

      const stats = detector.getCacheStats();
      expect(stats.hitRate).toBe(0.5);
    });

    it('should respect cache TTL', async () => {
      const shortTtlDetector = new PatternDetector({ cacheTtl: 10 }); // 10ms
      const code = `export class UserService { get() {} }`;

      shortTtlDetector.detect(code);
      await new Promise(resolve => setTimeout(resolve, 20));
      shortTtlDetector.detect(code);

      const stats = shortTtlDetector.getCacheStats();
      expect(stats.hits).toBe(0); // Cache should have expired
      expect(stats.misses).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid TypeScript code gracefully', () => {
      const code = `this is not valid typescript @#$%`;

      const result = detector.detect(code);

      expect(result).toBeDefined();
      expect(result.patterns).toBeDefined();
    });

    it('should return empty result for empty code', () => {
      const result = detector.detect('');

      expect(result.patterns).toHaveLength(0);
      expect(result.stats.total).toBe(0);
    });

    it('should handle complex nested structures', () => {
      const code = `
        export class OuterService {
          method() {
            class InnerFactory {
              create() {}
            }
          }
        }
      `;

      expect(() => detector.detect(code)).not.toThrow();
    });
  });

  describe('Factory Function', () => {
    it('should create detector with default options', () => {
      const detector = createPatternDetector();
      expect(detector).toBeDefined();
    });

    it('should create detector with custom options', () => {
      const detector = createPatternDetector({ minConfidence: 0.8 });
      expect(detector).toBeDefined();
    });
  });

  describe('Export Detection', () => {
    it('should detect exported patterns', () => {
      const code = `
        export class UserService {
          get() {}
        }
      `;
      const result = detector.detect(code);

      const service = result.patterns.find(p => p.type === PatternType.SERVICE);
      expect(service?.isExported).toBe(true);
    });

    it('should detect non-exported patterns', () => {
      const code = `
        class InternalService {
          get() {}
        }
      `;
      const result = detector.detect(code);

      const service = result.patterns.find(p => p.type === PatternType.SERVICE);
      expect(service?.isExported).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should calculate correct statistics', () => {
      const code = `
        export class UserService { get() {} }
        export class OrderService { get() {} }
        export function createUser() {}
      `;
      const result = detector.detect(code);

      expect(result.stats.total).toBeGreaterThan(0);
      expect(result.stats.service).toBeGreaterThan(0);
      expect(result.stats.total).toBe(result.patterns.length);
    });

    it('should track all pattern types in stats', () => {
      const result = detector.detect('');

      expect(result.stats).toHaveProperty('total');
      expect(result.stats).toHaveProperty('singleton');
      expect(result.stats).toHaveProperty('factory');
      expect(result.stats).toHaveProperty('service');
      expect(result.stats).toHaveProperty('hoc');
      expect(result.stats).toHaveProperty('hook');
    });
  });

  describe('Real-World Patterns', () => {
    it('should detect Express.js controller pattern', () => {
      const code = `
        export class UsersController {
          async get(req: any, res: any) {}
          async post(req: any, res: any) {}
          async put(req: any, res: any) {}
          async delete(req: any, res: any) {}
        }
      `;
      const result = detector.detect(code);

      const controller = result.patterns.find(p => p.type === PatternType.CONTROLLER);
      expect(controller).toBeDefined();
    });

    it('should detect TypeORM repository pattern', () => {
      const code = `
        export class UserRepository {
          findOne(id: string) {}
          find(options: any) {}
          save(entity: any) {}
          remove(entity: any) {}
        }
      `;
      const result = detector.detect(code);

      const repo = result.patterns.find(p => p.type === PatternType.REPOSITORY);
      expect(repo).toBeDefined();
    });

    it('should detect NestJS service pattern', () => {
      const code = `
        export class AuthService {
          async validateUser() {}
          async login() {}
          async register() {}
        }
      `;
      const result = detector.detect(code);

      const service = result.patterns.find(p => p.type === PatternType.SERVICE);
      expect(service).toBeDefined();
    });
  });
});
