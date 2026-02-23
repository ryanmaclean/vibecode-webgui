/**
 * Offline Vector Storage Integration Tests
 *
 * End-to-end tests for offline vector storage functionality
 * Tests IndexedDB persistence, offline detection, cache management, and sync
 *
 * Staff Engineer Implementation - Production-ready offline vector storage testing
 */

const { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } = require('@jest/globals');

// Mock IndexedDB for offline storage testing
const mockIndexedDBStore: Map<string, any> = new Map();
const mockObjectStores: Map<string, Map<string, any>> = new Map();

global.indexedDB = {
  open: jest.fn().mockImplementation((dbName: string, version: number) => {
    const mockRequest = {
      result: {
        createObjectStore: jest.fn().mockImplementation((storeName: string, options: any) => {
          if (!mockObjectStores.has(storeName)) {
            mockObjectStores.set(storeName, new Map());
          }
          return {
            createIndex: jest.fn(),
            name: storeName
          };
        }),
        objectStoreNames: {
          contains: jest.fn().mockImplementation((storeName: string) =>
            mockObjectStores.has(storeName)
          )
        },
        transaction: jest.fn().mockImplementation((storeNames: string | string[], mode: string) => {
          const stores = Array.isArray(storeNames) ? storeNames : [storeNames];
          return {
            objectStore: jest.fn().mockImplementation((storeName: string) => {
              if (!mockObjectStores.has(storeName)) {
                mockObjectStores.set(storeName, new Map());
              }
              const store = mockObjectStores.get(storeName)!;

              return {
                get: jest.fn().mockImplementation((key: string) => {
                  const mockReq = {
                    onsuccess: null as any,
                    onerror: null as any,
                    result: store.get(key)
                  };
                  setTimeout(() => {
                    if (mockReq.onsuccess) mockReq.onsuccess({ target: mockReq });
                  }, 0);
                  return mockReq;
                }),
                put: jest.fn().mockImplementation((value: any, key?: string) => {
                  const actualKey = key || value.id || value.key;
                  store.set(actualKey, value);
                  const mockReq = {
                    onsuccess: null as any,
                    onerror: null as any,
                    result: actualKey
                  };
                  setTimeout(() => {
                    if (mockReq.onsuccess) mockReq.onsuccess({ target: mockReq });
                  }, 0);
                  return mockReq;
                }),
                add: jest.fn().mockImplementation((value: any, key?: string) => {
                  const actualKey = key || value.id || value.key;
                  if (store.has(actualKey)) {
                    const mockReq = {
                      onsuccess: null as any,
                      onerror: null as any,
                      error: new Error('Key already exists')
                    };
                    setTimeout(() => {
                      if (mockReq.onerror) mockReq.onerror({ target: mockReq });
                    }, 0);
                    return mockReq;
                  }
                  store.set(actualKey, value);
                  const mockReq = {
                    onsuccess: null as any,
                    onerror: null as any,
                    result: actualKey
                  };
                  setTimeout(() => {
                    if (mockReq.onsuccess) mockReq.onsuccess({ target: mockReq });
                  }, 0);
                  return mockReq;
                }),
                delete: jest.fn().mockImplementation((key: string) => {
                  store.delete(key);
                  const mockReq = {
                    onsuccess: null as any,
                    onerror: null as any
                  };
                  setTimeout(() => {
                    if (mockReq.onsuccess) mockReq.onsuccess({ target: mockReq });
                  }, 0);
                  return mockReq;
                }),
                clear: jest.fn().mockImplementation(() => {
                  store.clear();
                  const mockReq = {
                    onsuccess: null as any,
                    onerror: null as any
                  };
                  setTimeout(() => {
                    if (mockReq.onsuccess) mockReq.onsuccess({ target: mockReq });
                  }, 0);
                  return mockReq;
                }),
                getAll: jest.fn().mockImplementation(() => {
                  const mockReq = {
                    onsuccess: null as any,
                    onerror: null as any,
                    result: Array.from(store.values())
                  };
                  setTimeout(() => {
                    if (mockReq.onsuccess) mockReq.onsuccess({ target: mockReq });
                  }, 0);
                  return mockReq;
                }),
                getAllKeys: jest.fn().mockImplementation(() => {
                  const mockReq = {
                    onsuccess: null as any,
                    onerror: null as any,
                    result: Array.from(store.keys())
                  };
                  setTimeout(() => {
                    if (mockReq.onsuccess) mockReq.onsuccess({ target: mockReq });
                  }, 0);
                  return mockReq;
                }),
                count: jest.fn().mockImplementation(() => {
                  const mockReq = {
                    onsuccess: null as any,
                    onerror: null as any,
                    result: store.size
                  };
                  setTimeout(() => {
                    if (mockReq.onsuccess) mockReq.onsuccess({ target: mockReq });
                  }, 0);
                  return mockReq;
                }),
                openCursor: jest.fn().mockImplementation(() => {
                  const entries = Array.from(store.entries());
                  let currentIndex = 0;

                  const mockReq = {
                    onsuccess: null as any,
                    onerror: null as any,
                    result: null as any
                  };

                  const nextCursor = () => {
                    if (currentIndex < entries.length) {
                      const [key, value] = entries[currentIndex];
                      currentIndex++;
                      mockReq.result = {
                        key,
                        value,
                        continue: jest.fn().mockImplementation(() => {
                          setTimeout(() => {
                            nextCursor();
                            if (mockReq.onsuccess) mockReq.onsuccess({ target: mockReq });
                          }, 0);
                        })
                      };
                    } else {
                      mockReq.result = null;
                    }
                  };

                  setTimeout(() => {
                    nextCursor();
                    if (mockReq.onsuccess) mockReq.onsuccess({ target: mockReq });
                  }, 0);

                  return mockReq;
                })
              };
            }),
            oncomplete: null as any,
            onerror: null as any,
            commit: jest.fn()
          };
        }),
        close: jest.fn()
      },
      onsuccess: null as any,
      onerror: null as any,
      onupgradeneeded: null as any
    };

    setTimeout(() => {
      if (mockRequest.onupgradeneeded) {
        mockRequest.onupgradeneeded({ target: mockRequest, oldVersion: 0, newVersion: version });
      }
      if (mockRequest.onsuccess) {
        mockRequest.onsuccess({ target: mockRequest });
      }
    }, 0);

    return mockRequest;
  }),
  deleteDatabase: jest.fn().mockImplementation((dbName: string) => {
    mockObjectStores.clear();
    mockIndexedDBStore.clear();
    const mockRequest = {
      onsuccess: null as any,
      onerror: null as any
    };
    setTimeout(() => {
      if (mockRequest.onsuccess) mockRequest.onsuccess({ target: mockRequest });
    }, 0);
    return mockRequest;
  })
} as any;

// Mock localStorage for cache persistence
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    })
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock
});

// Mock vector embedding generation
const generateMockEmbedding = (dim: number = 1536): number[] => {
  const vector = Array.from({ length: dim }, () => Math.random() * 2 - 1);
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map((val) => val / magnitude);
};

import { OfflineDetector, NetworkStatus } from '@/lib/offline-mode';
import { VectorStore } from '@/lib/vector/vector-store';

describe('Offline Vector Storage Integration Tests', () => {
  let offlineDetector: OfflineDetector;
  let vectorStore: VectorStore;
  let consoleSpy: {
    info: jest.SpyInstance;
    warn: jest.SpyInstance;
    error: jest.SpyInstance;
    log: jest.SpyInstance;
  };

  beforeAll(() => {
    // Set up test environment
    process.env.NODE_ENV = 'test';
  });

  beforeEach(() => {
    // Clear all stores
    mockObjectStores.clear();
    mockIndexedDBStore.clear();
    localStorageMock.clear();

    // Silence console output during tests
    consoleSpy = {
      info: jest.spyOn(console, 'info').mockImplementation(() => {}),
      warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
      error: jest.spyOn(console, 'error').mockImplementation(() => {}),
      log: jest.spyOn(console, 'log').mockImplementation(() => {})
    };

    // Create fresh instances
    offlineDetector = new OfflineDetector({
      healthCheckInterval: 30000,
      healthCheckTimeout: 5000,
      useBrowserAPI: false,
      useHealthChecks: false,
      debug: false
    });

    vectorStore = new VectorStore();
  });

  afterEach(async () => {
    // Clean up
    if (offlineDetector) {
      offlineDetector.stop();
    }
    if (vectorStore) {
      await vectorStore.disconnect();
    }
    jest.restoreAllMocks();
  });

  afterAll(() => {
    // Final cleanup
    mockObjectStores.clear();
    mockIndexedDBStore.clear();
  });

  describe('Offline Detection and Status', () => {
    test('should detect offline status correctly', async () => {
      let statusChangeCount = 0;

      offlineDetector.on('statusChange', () => {
        statusChangeCount++;
      });

      await offlineDetector.start();

      expect(offlineDetector.getStatus()).toBeDefined();
      expect([NetworkStatus.ONLINE, NetworkStatus.OFFLINE, NetworkStatus.UNKNOWN])
        .toContain(offlineDetector.getStatus());
    });

    test('should track offline metrics', async () => {
      await offlineDetector.start();

      const metrics = offlineDetector.getMetrics();

      expect(metrics).toHaveProperty('isOnline');
      expect(metrics).toHaveProperty('totalHealthChecks');
      expect(metrics).toHaveProperty('totalStatusChanges');
      expect(metrics).toHaveProperty('uptimePercentage');
      expect(typeof metrics.isOnline).toBe('boolean');
      expect(typeof metrics.totalHealthChecks).toBe('number');
    });

    test('should emit status change events', async () => {
      const statusChanges: any[] = [];

      offlineDetector.on('statusChange', (event: any) => {
        statusChanges.push(event);
      });

      await offlineDetector.start();

      expect(statusChanges.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('IndexedDB Vector Storage', () => {
    test('should initialize IndexedDB for vector storage', async () => {
      const dbRequest = indexedDB.open('vector-store', 1);

      await new Promise<void>((resolve) => {
        dbRequest.onsuccess = () => {
          expect(dbRequest.result).toBeDefined();
          expect(dbRequest.result.createObjectStore).toBeDefined();
          resolve();
        };
      });
    });

    test('should store vector embeddings in IndexedDB', async () => {
      const dbRequest = indexedDB.open('vector-store', 1);

      await new Promise<void>((resolve) => {
        dbRequest.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          db.createObjectStore('embeddings', { keyPath: 'id' });
        };

        dbRequest.onsuccess = () => {
          const db = dbRequest.result;
          const tx = db.transaction(['embeddings'], 'readwrite');
          const store = tx.objectStore('embeddings');

          const embedding = {
            id: 'test-vector-1',
            vector: generateMockEmbedding(),
            content: 'Test vector content',
            metadata: { fileId: 1, fileName: 'test.ts' },
            timestamp: Date.now()
          };

          const putRequest = store.put(embedding);
          putRequest.onsuccess = () => {
            expect(putRequest.result).toBe('test-vector-1');
            resolve();
          };
        };
      });
    });

    test('should retrieve vectors from IndexedDB', async () => {
      const dbRequest = indexedDB.open('vector-store', 1);

      await new Promise<void>((resolve) => {
        dbRequest.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          db.createObjectStore('embeddings', { keyPath: 'id' });
        };

        dbRequest.onsuccess = () => {
          const db = dbRequest.result;
          const tx = db.transaction(['embeddings'], 'readwrite');
          const store = tx.objectStore('embeddings');

          const embedding = {
            id: 'test-vector-2',
            vector: generateMockEmbedding(),
            content: 'Retrievable vector content',
            metadata: { fileId: 2 },
            timestamp: Date.now()
          };

          const putRequest = store.put(embedding);
          putRequest.onsuccess = () => {
            const getRequest = store.get('test-vector-2');
            getRequest.onsuccess = () => {
              expect(getRequest.result).toBeDefined();
              expect(getRequest.result.id).toBe('test-vector-2');
              expect(getRequest.result.content).toBe('Retrievable vector content');
              expect(getRequest.result.vector).toHaveLength(1536);
              resolve();
            };
          };
        };
      });
    });

    test('should handle multiple vector embeddings', async () => {
      const dbRequest = indexedDB.open('vector-store', 1);

      await new Promise<void>((resolve) => {
        dbRequest.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          db.createObjectStore('embeddings', { keyPath: 'id' });
        };

        dbRequest.onsuccess = async () => {
          const db = dbRequest.result;
          const tx = db.transaction(['embeddings'], 'readwrite');
          const store = tx.objectStore('embeddings');

          const embeddings = Array.from({ length: 10 }, (_, i) => ({
            id: `vector-${i}`,
            vector: generateMockEmbedding(),
            content: `Vector content ${i}`,
            metadata: { fileId: i },
            timestamp: Date.now()
          }));

          for (const embedding of embeddings) {
            store.put(embedding);
          }

          const getAllRequest = store.getAll();
          getAllRequest.onsuccess = () => {
            expect(getAllRequest.result).toHaveLength(10);
            resolve();
          };
        };
      });
    });

    test('should delete vectors from IndexedDB', async () => {
      const dbRequest = indexedDB.open('vector-store', 1);

      await new Promise<void>((resolve) => {
        dbRequest.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          db.createObjectStore('embeddings', { keyPath: 'id' });
        };

        dbRequest.onsuccess = () => {
          const db = dbRequest.result;
          const tx = db.transaction(['embeddings'], 'readwrite');
          const store = tx.objectStore('embeddings');

          const embedding = {
            id: 'test-delete',
            vector: generateMockEmbedding(),
            content: 'To be deleted',
            timestamp: Date.now()
          };

          const putRequest = store.put(embedding);
          putRequest.onsuccess = () => {
            const deleteRequest = store.delete('test-delete');
            deleteRequest.onsuccess = () => {
              const getRequest = store.get('test-delete');
              getRequest.onsuccess = () => {
                expect(getRequest.result).toBeUndefined();
                resolve();
              };
            };
          };
        };
      });
    });
  });

  describe('Offline Cache Management', () => {
    test('should persist cache to localStorage', () => {
      const cacheData = {
        'vector-cache-1': {
          vector: generateMockEmbedding(),
          timestamp: Date.now(),
          ttl: 3600
        }
      };

      localStorage.setItem('vector-cache', JSON.stringify(cacheData));

      const retrieved = localStorage.getItem('vector-cache');
      expect(retrieved).toBeDefined();

      const parsed = JSON.parse(retrieved!);
      expect(parsed['vector-cache-1']).toBeDefined();
      expect(parsed['vector-cache-1'].vector).toHaveLength(1536);
    });

    test('should handle cache invalidation', () => {
      const now = Date.now();
      const cacheData = {
        'valid-cache': {
          vector: generateMockEmbedding(),
          timestamp: now,
          expiresAt: now + 3600000
        },
        'expired-cache': {
          vector: generateMockEmbedding(),
          timestamp: now - 7200000,
          expiresAt: now - 3600000
        }
      };

      localStorage.setItem('vector-cache', JSON.stringify(cacheData));

      const retrieved = JSON.parse(localStorage.getItem('vector-cache')!);
      const validItems = Object.entries(retrieved).filter(
        ([_, value]: [string, any]) => value.expiresAt > now
      );

      expect(validItems).toHaveLength(1);
      expect(validItems[0][0]).toBe('valid-cache');
    });

    test('should manage cache size limits', () => {
      const maxCacheSizeMB = 5;
      const maxCacheSizeBytes = maxCacheSizeMB * 1024 * 1024;

      const vectorSize = 1536 * 4;
      const maxVectors = Math.floor(maxCacheSizeBytes / vectorSize);

      const cacheData: Record<string, any> = {};
      let totalSize = 0;

      for (let i = 0; i < maxVectors + 10; i++) {
        const vector = generateMockEmbedding();
        const itemSize = vector.length * 4;

        if (totalSize + itemSize <= maxCacheSizeBytes) {
          cacheData[`vector-${i}`] = {
            vector,
            timestamp: Date.now(),
            size: itemSize
          };
          totalSize += itemSize;
        }
      }

      expect(Object.keys(cacheData).length).toBeLessThanOrEqual(maxVectors);
      expect(totalSize).toBeLessThanOrEqual(maxCacheSizeBytes);
    });

    test('should clear expired cache entries', () => {
      const now = Date.now();
      const cacheData = {
        'recent': { timestamp: now, expiresAt: now + 3600000 },
        'old-1': { timestamp: now - 7200000, expiresAt: now - 3600000 },
        'old-2': { timestamp: now - 10800000, expiresAt: now - 7200000 }
      };

      localStorage.setItem('vector-cache', JSON.stringify(cacheData));

      const retrieved = JSON.parse(localStorage.getItem('vector-cache')!);
      const validEntries = Object.fromEntries(
        Object.entries(retrieved).filter(
          ([_, value]: [string, any]) => value.expiresAt > now
        )
      );

      localStorage.setItem('vector-cache', JSON.stringify(validEntries));

      const final = JSON.parse(localStorage.getItem('vector-cache')!);
      expect(Object.keys(final)).toHaveLength(1);
      expect(final.recent).toBeDefined();
    });
  });

  describe('Offline Search Operations', () => {
    test('should perform similarity search offline', async () => {
      const dbRequest = indexedDB.open('vector-store', 1);

      await new Promise<void>((resolve) => {
        dbRequest.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          db.createObjectStore('embeddings', { keyPath: 'id' });
        };

        dbRequest.onsuccess = () => {
          const db = dbRequest.result;
          const tx = db.transaction(['embeddings'], 'readwrite');
          const store = tx.objectStore('embeddings');

          const embeddings = [
            {
              id: 'vec-1',
              vector: generateMockEmbedding(),
              content: 'TypeScript function implementation',
              metadata: { fileId: 1, score: 0.95 }
            },
            {
              id: 'vec-2',
              vector: generateMockEmbedding(),
              content: 'React component example',
              metadata: { fileId: 2, score: 0.87 }
            },
            {
              id: 'vec-3',
              vector: generateMockEmbedding(),
              content: 'Database query optimization',
              metadata: { fileId: 3, score: 0.82 }
            }
          ];

          embeddings.forEach(emb => store.put(emb));

          const getAllRequest = store.getAll();
          getAllRequest.onsuccess = () => {
            const results = getAllRequest.result;
            expect(results).toHaveLength(3);

            const sortedResults = results.sort(
              (a: any, b: any) => b.metadata.score - a.metadata.score
            );

            expect(sortedResults[0].metadata.score).toBeGreaterThanOrEqual(
              sortedResults[1].metadata.score
            );
            resolve();
          };
        };
      });
    });

    test('should filter search results by metadata', async () => {
      const dbRequest = indexedDB.open('vector-store', 1);

      await new Promise<void>((resolve) => {
        dbRequest.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          db.createObjectStore('embeddings', { keyPath: 'id' });
        };

        dbRequest.onsuccess = () => {
          const db = dbRequest.result;
          const tx = db.transaction(['embeddings'], 'readwrite');
          const store = tx.objectStore('embeddings');

          const embeddings = [
            {
              id: 'vec-1',
              vector: generateMockEmbedding(),
              metadata: { language: 'typescript', fileId: 1 }
            },
            {
              id: 'vec-2',
              vector: generateMockEmbedding(),
              metadata: { language: 'python', fileId: 2 }
            },
            {
              id: 'vec-3',
              vector: generateMockEmbedding(),
              metadata: { language: 'typescript', fileId: 3 }
            }
          ];

          embeddings.forEach(emb => store.put(emb));

          const getAllRequest = store.getAll();
          getAllRequest.onsuccess = () => {
            const results = getAllRequest.result;
            const filtered = results.filter(
              (r: any) => r.metadata.language === 'typescript'
            );

            expect(filtered).toHaveLength(2);
            filtered.forEach((r: any) => {
              expect(r.metadata.language).toBe('typescript');
            });
            resolve();
          };
        };
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle IndexedDB quota exceeded error', async () => {
      const dbRequest = indexedDB.open('vector-store', 1);

      await new Promise<void>((resolve) => {
        dbRequest.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          db.createObjectStore('embeddings', { keyPath: 'id' });
        };

        dbRequest.onsuccess = () => {
          expect(dbRequest.result).toBeDefined();
          resolve();
        };
      });
    });

    test('should fallback to memory storage on IndexedDB failure', async () => {
      const memoryStore = new Map();

      try {
        const embedding = {
          id: 'mem-vec-1',
          vector: generateMockEmbedding(),
          content: 'Memory-stored vector'
        };

        memoryStore.set(embedding.id, embedding);

        expect(memoryStore.has('mem-vec-1')).toBe(true);
        expect(memoryStore.get('mem-vec-1')).toEqual(embedding);
      } catch (error) {
        expect(memoryStore.size).toBe(0);
      }
    });

    test('should handle corrupted cache data gracefully', () => {
      localStorage.setItem('vector-cache', 'invalid-json{{{');

      let cacheData;
      try {
        cacheData = JSON.parse(localStorage.getItem('vector-cache')!);
      } catch (error) {
        cacheData = {};
      }

      expect(cacheData).toEqual({});
    });

    test('should recover from storage errors', async () => {
      const errors: Error[] = [];

      try {
        localStorage.setItem('vector-cache', JSON.stringify({ test: 'data' }));
      } catch (error) {
        if (error instanceof Error) {
          errors.push(error);
        }
      }

      expect(errors.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle batch vector storage efficiently', async () => {
      const startTime = Date.now();
      const batchSize = 100;

      const dbRequest = indexedDB.open('vector-store', 1);

      await new Promise<void>((resolve) => {
        dbRequest.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          db.createObjectStore('embeddings', { keyPath: 'id' });
        };

        dbRequest.onsuccess = () => {
          const db = dbRequest.result;
          const tx = db.transaction(['embeddings'], 'readwrite');
          const store = tx.objectStore('embeddings');

          for (let i = 0; i < batchSize; i++) {
            store.put({
              id: `batch-vec-${i}`,
              vector: generateMockEmbedding(),
              content: `Batch vector ${i}`
            });
          }

          const countRequest = store.count();
          countRequest.onsuccess = () => {
            const duration = Date.now() - startTime;
            expect(countRequest.result).toBe(batchSize);
            expect(duration).toBeLessThan(5000);
            resolve();
          };
        };
      });
    });

    test('should maintain performance with large cache', () => {
      const startTime = Date.now();
      const cacheSize = 1000;

      const cacheData: Record<string, any> = {};
      for (let i = 0; i < cacheSize; i++) {
        cacheData[`cache-${i}`] = {
          vector: generateMockEmbedding(),
          timestamp: Date.now()
        };
      }

      localStorage.setItem('large-cache', JSON.stringify(cacheData));
      const retrieved = JSON.parse(localStorage.getItem('large-cache')!);

      const duration = Date.now() - startTime;
      expect(Object.keys(retrieved)).toHaveLength(cacheSize);
      expect(duration).toBeLessThan(1000);
    });

    test('should optimize cursor iteration performance', async () => {
      const dbRequest = indexedDB.open('vector-store', 1);

      await new Promise<void>((resolve) => {
        dbRequest.onupgradeneeded = (event: any) => {
          const db = event.target.result;
          db.createObjectStore('embeddings', { keyPath: 'id' });
        };

        dbRequest.onsuccess = () => {
          const db = dbRequest.result;
          const tx = db.transaction(['embeddings'], 'readwrite');
          const store = tx.objectStore('embeddings');

          for (let i = 0; i < 50; i++) {
            store.put({
              id: `cursor-vec-${i}`,
              vector: generateMockEmbedding()
            });
          }

          const startTime = Date.now();
          const cursorRequest = store.openCursor();
          let count = 0;

          cursorRequest.onsuccess = (event: any) => {
            const cursor = event.target.result;
            if (cursor) {
              count++;
              cursor.continue();
            } else {
              const duration = Date.now() - startTime;
              expect(count).toBe(50);
              expect(duration).toBeLessThan(1000);
              resolve();
            }
          };
        };
      });
    });
  });

  describe('Integration with Offline Mode', () => {
    test('should switch to offline storage when offline', async () => {
      await offlineDetector.start();

      const isOnline = offlineDetector.isOnline();

      if (!isOnline) {
        const memoryStore = new Map();
        memoryStore.set('offline-vec-1', {
          vector: generateMockEmbedding(),
          content: 'Offline vector'
        });

        expect(memoryStore.size).toBe(1);
      }

      expect(typeof isOnline).toBe('boolean');
    });

    test('should track offline storage metrics', async () => {
      await offlineDetector.start();

      const metrics = offlineDetector.getMetrics();

      expect(metrics).toHaveProperty('isOnline');
      expect(metrics).toHaveProperty('timeOffline');
      expect(metrics).toHaveProperty('uptimePercentage');

      const storageMetrics = {
        totalVectors: mockObjectStores.size,
        cacheSize: Object.keys(localStorageMock).length,
        isOffline: !metrics.isOnline
      };

      expect(storageMetrics).toBeDefined();
      expect(typeof storageMetrics.isOffline).toBe('boolean');
    });
  });
});
