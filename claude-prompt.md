# Claude AI Prompt for Vector Cache Optimization

## Project Context

This prompt is designed for Claude to assist with implementing and optimizing the ValKey caching system for pgVector similarity searches in the VibeCode WebGUI project.

## Feature Description

The ValKey Vector Caching system provides an efficient caching layer for pgVector similarity searches, significantly improving performance for repeated queries and similar embedding lookups. The implementation includes:

1. **Vector Cache Strategy**: Specialized caching for pgVector similarity searches with smart cache key generation
2. **Cache Invalidation**: Automatic invalidation when vector data changes in the database
3. **Performance Benchmarking**: Tools to measure and validate cache effectiveness
4. **Integration with Vector Store**: Seamless integration with existing vector search functionality

## Key Technical Concepts

- **Vector Similarity Caching**: Caching results from cosine similarity searches in pgVector
- **Smart Cache Key Generation**: Vector fingerprinting that preserves similarity characteristics
- **Automatic Cache Invalidation**: Database triggers and Prisma middleware for real-time invalidation
- **Metrics Collection**: Performance tracking and hit rate monitoring

## Prompting Guidelines

When prompting Claude for help with this feature, use the following structure:

```
I'm working on the ValKey vector caching system for pgVector in the VibeCode WebGUI project. I need help with [specific problem or enhancement].

The current implementation includes:
- Vector cache strategy with fingerprinting for stable cache keys
- Cache invalidation through database triggers and Prisma middleware
- Performance benchmarking tools for measuring effectiveness
- Integration with the existing vector store

[Specific code snippet or error message if applicable]

How can I [specific question about optimization, implementation, or debugging]?
```

## Example Prompts

### Optimizing Cache Key Generation

```
I'm working on the ValKey vector caching system for pgVector. I need to optimize the cache key generation for high-dimensional embeddings.

Current implementation:
```typescript
private static getVectorFingerprint(vector: number[]): string {
  if (!vector || vector.length === 0) {
    return 'empty';
  }
  
  // For performance, use a sampling technique for high-dim vectors
  // Take 16 evenly distributed values as a fingerprint
  const sampleCount = 16;
  const step = Math.max(1, Math.floor(vector.length / sampleCount));
  
  const samples: number[] = [];
  for (let i = 0; i < vector.length && samples.length < sampleCount; i += step) {
    // Round to 3 decimal places to stabilize key length
    samples.push(Math.round(vector[i] * 1000) / 1000);
  }
  
  // Create stable string representation
  return samples.join('_');
}
```

How can I make this more efficient while still preserving similarity characteristics?
```

### Cache Invalidation Strategy

```
I'm working on the ValKey vector caching system for pgVector. I need to improve the cache invalidation strategy to be more selective.

Current implementation uses Prisma middleware to track database changes:

```typescript
// Add middleware to track RAGChunk changes
(prisma as any).$use(async (params: PrismaMiddlewareParams, next: PrismaMiddlewareNext) => {
  // Track start time for performance monitoring
  const startTime = Date.now();
  
  // Capture original action
  const action = params.action;
  const model = params.model;
  
  // Skip if not relevant to vector data
  if (!this.isVectorModel(model)) {
    return next(params);
  }
  
  // Execute the database operation
  const result = await next(params);
  
  // Process result and invalidate cache when necessary
  if (this.shouldInvalidateCache(action, model, result) && model) {
    await this.invalidateModelCache(model, result);
  }
  
  // Track duration and report metrics
  const duration = Date.now() - startTime;
  metrics.histogram('vector_cache.invalidation.middleware.duration', duration);
  
  return result;
});
```

How can I make the invalidation more granular to only invalidate affected cache entries?
```

### Performance Benchmarking

```
I'm working on the ValKey vector caching system for pgVector. I need to create more comprehensive benchmarks to validate performance in production scenarios.

Current benchmark method:
```typescript
static async benchmarkSimilaritySearch(options: { runs?: number; embedding?: number[]; contentType?: string; minSimilarity?: number; limit?: number; cleanCache?: boolean; } = {}): Promise<{ withCache: BenchmarkResults; withoutCache: BenchmarkResults; improvement: number; }>
```

How can I expand this to simulate realistic traffic patterns and measure overall system impact?
```

## Technical Specifications

- **Languages**: TypeScript, SQL (PostgreSQL/pgVector)
- **Key Dependencies**: 
  - ValKey (Redis-compatible cache)
  - pgVector (PostgreSQL vector extension)
  - Prisma (ORM)
- **Metrics**: Datadog integration for monitoring
- **Performance Targets**: 
  - 50%+ improvement in query response time
  - 80%+ cache hit rate for repeated queries
  - <1ms overhead for cache key generation

## Reference Files

- `/src/lib/cache/vector-cache-strategy.ts` - Core caching strategy for vector searches
- `/src/lib/cache/pgvector-search.ts` - Integration with PostgreSQL/pgVector
- `/src/lib/cache/vector-cache-invalidator.ts` - Cache invalidation system
- `/src/lib/cache/vector-cache-benchmark.ts` - Performance benchmarking tools
- `/tests/lib/cache/vector-cache-strategy.test.ts` - Tests for the caching system