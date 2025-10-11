---
title: redis valkey
description: redis valkey documentation
---

# Redis & Valkey Integration Guide for VibeCode

This guide covers how to integrate and use Redis and Valkey services with VibeCode WebGUI across different deployment scenarios.

## 🚀 **Overview**

VibeCode supports **three key-value storage options** to meet different performance, cost, and licensing requirements:

1. **[Azure Cache for Redis](https://azure.microsoft.com/en-us/products/cache)** - Microsoft's traditional managed Redis service
2. **[Azure Managed Redis](https://azure.microsoft.com/en-us/products/managed-redis)** - Microsoft's next-generation Redis service (Preview)
3. **[Valkey](https://valkey.io)** - Open-source Redis fork by Linux Foundation

## 📊 **Service Comparison Matrix**

| Feature | Azure Cache for Redis | Azure Managed Redis | Valkey (Self-Managed) |
|---------|----------------------|--------------------|-----------------------|
| **Licensing** | Proprietary | Proprietary | Open Source (BSD-3) |
| **Management** | Fully managed | Fully managed | Self-managed on AKS |
| **Redis Version** | 6.x/7.x | Enterprise 7.4+ | 8.x with enhancements |
| **Performance** | High | Very High | High (configurable) |
| **Multi-threading** | Limited | Enterprise | Enhanced |
| **Vector Search** | Limited | RediSearch module | Module compatible |
| **JSON Support** | Basic | RedisJSON module | Module compatible |
| **RDMA Support** | ❌ | ❌ | ✅ Experimental |
| **Cost (Est.)** | ~$200-800/month | ~$300-1200/month | Infrastructure only |
| **Support** | Microsoft Enterprise | Microsoft Enterprise | Community |
| **Backup** | Automated | Automated | Manual/Scripted |
| **Scaling** | Auto-scaling | Auto-scaling | Manual/HPA |

## 🏗️ **Architecture Integration**

### **VibeCode Application Stack**
```
┌─────────────────────────────────────────────────────────────┐
│                    VibeCode WebGUI                         │
├─────────────────────────────────────────────────────────────┤
│  Next.js App     │  Session Store  │  Cache Layer  │  RAG  │
│  ├─ Auth         │  ├─ User Sessions│  ├─ API Cache │  └─ AI│
│  ├─ API Routes   │  ├─ Form Data   │  ├─ Query Cache│      │
│  └─ Components   │  └─ Temp State  │  └─ Asset Cache│      │
├─────────────────────────────────────────────────────────────┤
│                Redis/Valkey Integration Layer              │
├─────────────────────────────────────────────────────────────┤
│  Choose One:                                                │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐   │
│  │Azure Cache  │ │Azure Managed│ │ Valkey on AKS       │   │
│  │for Redis    │ │Redis        │ │                     │   │
│  │             │ │             │ │ ┌─ Node 1 (Primary)│   │
│  │Premium Tier │ │Enterprise   │ │ ├─ Node 2 (Primary)│   │
│  │Zone Redundant│ │Multi-Module │ │ ├─ Node 3 (Primary)│   │
│  │Private Link │ │Vector Search│ │ └─ Replicas        │   │
│  └─────────────┘ └─────────────┘ └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 🔧 **Integration Code Examples**

### **1. Azure Cache for Redis Integration**

```typescript
// lib/redis-client.ts
import { Redis } from 'ioredis';

const redisClient = new Redis({
  host: process.env.AZURE_REDIS_HOST,
  port: 6380,
  password: process.env.AZURE_REDIS_PASSWORD,
  tls: {
    servername: process.env.AZURE_REDIS_HOST,
  },
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: 3,
});

export default redisClient;
```

**Environment Variables:**
```bash
AZURE_REDIS_HOST=vibecode-prod-redis.redis.cache.windows.net
AZURE_REDIS_PASSWORD=<from-key-vault>
REDIS_URL=rediss://:${AZURE_REDIS_PASSWORD}@${AZURE_REDIS_HOST}:6380
```

### **2. Azure Managed Redis Integration**

```typescript
// lib/managed-redis-client.ts
import { Redis } from 'ioredis';

const managedRedisClient = new Redis({
  host: process.env.AZURE_MANAGED_REDIS_HOST,
  port: 10000,
  password: process.env.AZURE_MANAGED_REDIS_PASSWORD,
  tls: {
    servername: process.env.AZURE_MANAGED_REDIS_HOST,
  },
  // Enhanced features for Managed Redis
  enableAutoPipelining: true,
  enableOfflineQueue: false,
});

// Use RediSearch for vector operations
export const vectorSearch = async (query: number[], topK: number = 10) => {
  return await managedRedisClient.call(
    'FT.SEARCH', 
    'code_index', 
    `*=>[KNN ${topK} @embedding $query_vector]`,
    'PARAMS', '2', 'query_vector', Buffer.from(new Float32Array(query).buffer),
    'RETURN', '2', 'content', 'score'
  );
};

export default managedRedisClient;
```

### **3. Valkey Integration**

```typescript
// lib/valkey-client.ts
import { Cluster } from 'ioredis';

const valkeyCluster = new Cluster([
  {
    host: 'valkey-0.valkey-service.valkey.svc.cluster.local',
    port: 6379,
  },
  {
    host: 'valkey-1.valkey-service.valkey.svc.cluster.local', 
    port: 6379,
  },
  {
    host: 'valkey-2.valkey-service.valkey.svc.cluster.local',
    port: 6379,
  }
], {
  redisOptions: {
    password: process.env.VALKEY_PASSWORD,
  },
  enableOfflineQueue: false,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
});

export default valkeyCluster;
```

**Environment Variables:**
```bash
VALKEY_PASSWORD=<from-kubernetes-secret>
VALKEY_ENDPOINTS=valkey-service.valkey.svc.cluster.local:6379
```

## 🎯 **Use Case Implementations**

### **Session Management**

```typescript
// lib/session-store.ts
import { getRedisClient } from './redis-client';

export class SessionStore {
  private redis = getRedisClient();

  async setSession(sessionId: string, data: any, ttl: number = 3600) {
    await this.redis.setex(
      `session:${sessionId}`, 
      ttl, 
      JSON.stringify(data)
    );
  }

  async getSession(sessionId: string) {
    const data = await this.redis.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(sessionId: string) {
    await this.redis.del(`session:${sessionId}`);
  }

  // Advanced session features (Azure Managed Redis only)
  async searchSessions(userId: string) {
    if (process.env.REDIS_TYPE === 'azure_managed') {
      return await this.redis.call(
        'FT.SEARCH', 
        'session_index',
        `@user_id:${userId}`
      );
    }
    // Fallback for other Redis types
    const keys = await this.redis.keys(`session:*`);
    // ... filter implementation
  }
}
```

### **Caching Layer**

```typescript
// lib/cache.ts
import { getRedisClient } from './redis-client';

export class CacheManager {
  private redis = getRedisClient();

  // API Response Caching
  async cacheApiResponse(endpoint: string, data: any, ttl: number = 300) {
    await this.redis.setex(
      `api:${endpoint}`, 
      ttl, 
      JSON.stringify(data)
    );
  }

  async getCachedResponse(endpoint: string) {
    const cached = await this.redis.get(`api:${endpoint}`);
    return cached ? JSON.parse(cached) : null;
  }

  // Code Analysis Caching
  async cacheCodeAnalysis(fileHash: string, analysis: any) {
    await this.redis.hset('code:analysis', fileHash, JSON.stringify(analysis));
  }

  async getCachedAnalysis(fileHash: string) {
    const cached = await this.redis.hget('code:analysis', fileHash);
    return cached ? JSON.parse(cached) : null;
  }

  // AI Response Caching (Vector-based for Managed Redis)
  async cacheAIResponse(promptHash: string, response: string, embedding?: number[]) {
    const key = `ai:response:${promptHash}`;
    await this.redis.hset(key, {
      response,
      timestamp: Date.now(),
      ...(embedding && { embedding: JSON.stringify(embedding) })
    });

    // Store in vector index for semantic search (Azure Managed Redis)
    if (process.env.REDIS_TYPE === 'azure_managed' && embedding) {
      await this.redis.call(
        'HSET',
        `ai:vector:${promptHash}`,
        'embedding', Buffer.from(new Float32Array(embedding).buffer),
        'response', response
      );
    }
  }
}
```

### **Real-time Features**

```typescript
// lib/realtime.ts
import { getRedisClient } from './redis-client';

export class RealtimeManager {
  private redis = getRedisClient();

  // Workspace collaboration
  async publishWorkspaceUpdate(workspaceId: string, update: any) {
    await this.redis.publish(
      `workspace:${workspaceId}`, 
      JSON.stringify(update)
    );
  }

  async subscribeToWorkspace(workspaceId: string, callback: Function) {
    const subscriber = this.redis.duplicate();
    await subscriber.subscribe(`workspace:${workspaceId}`);
    subscriber.on('message', (channel, message) => {
      callback(JSON.parse(message));
    });
    return subscriber;
  }

  // Code execution status
  async updateExecutionStatus(jobId: string, status: string) {
    await this.redis.hset(`execution:${jobId}`, {
      status,
      updated_at: Date.now()
    });
    
    // Publish to subscribers
    await this.redis.publish(`execution:${jobId}`, status);
  }

  // Rate limiting
  async checkRateLimit(userId: string, action: string, limit: number, window: number) {
    const key = `rate:${userId}:${action}`;
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, window);
    }
    
    return current <= limit;
  }
}
```

## 🔄 **Migration Strategies**

### **1. Gradual Migration (Recommended)**

```typescript
// lib/hybrid-client.ts
export class HybridRedisClient {
  private primaryClient: Redis;
  private secondaryClient: Redis;

  constructor() {
    this.primaryClient = getPrimaryRedisClient();
    this.secondaryClient = getSecondaryRedisClient();
  }

  async get(key: string) {
    try {
      // Try primary first
      const result = await this.primaryClient.get(key);
      if (result) return result;
      
      // Fallback to secondary
      return await this.secondaryClient.get(key);
    } catch (error) {
      // Fallback on primary failure
      return await this.secondaryClient.get(key);
    }
  }

  async set(key: string, value: string, ttl?: number) {
    // Write to both systems during migration
    const promises = [
      this.primaryClient.set(key, value, ...(ttl ? ['EX', ttl] : [])),
      this.secondaryClient.set(key, value, ...(ttl ? ['EX', ttl] : []))
    ];
    
    await Promise.allSettled(promises);
  }
}
```

### **2. Blue-Green Deployment**

```bash
# Step 1: Deploy new Redis service
terraform apply -target=module.valkey

# Step 2: Update application configuration
kubectl patch deployment vibecode-app -p '{"spec":{"template":{"spec":{"containers":[{"name":"vibecode","env":[{"name":"REDIS_TYPE","value":"valkey"}]}]}}}}'

# Step 3: Monitor and validate
kubectl logs -f deployment/vibecode-app | grep "Redis"

# Step 4: Remove old service when stable
terraform destroy -target=module.azure_cache_redis
```

## 📊 **Monitoring and Observability**

### **Redis Metrics Collection**

```typescript
// lib/metrics.ts
import { getRedisClient } from './redis-client';

export class RedisMetrics {
  private redis = getRedisClient();

  async collectMetrics() {
    const info = await this.redis.info();
    const metrics = this.parseRedisInfo(info);
    
    // Send to Datadog
    await fetch('/api/metrics/redis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(metrics)
    });
    
    return metrics;
  }

  private parseRedisInfo(info: string) {
    const lines = info.split('\r\n');
    const metrics: Record<string, any> = {};
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        metrics[key] = isNaN(Number(value)) ? value : Number(value);
      }
    }
    
    return {
      memory_used: metrics.used_memory,
      memory_peak: metrics.used_memory_peak,
      connections: metrics.connected_clients,
      operations_per_sec: metrics.instantaneous_ops_per_sec,
      keyspace_hits: metrics.keyspace_hits,
      keyspace_misses: metrics.keyspace_misses,
      hit_ratio: metrics.keyspace_hits / (metrics.keyspace_hits + metrics.keyspace_misses)
    };
  }
}
```

### **Health Checks**

```typescript
// pages/api/health/redis.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { getRedisClient } from '@/lib/redis-client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const redis = getRedisClient();
    
    // Basic connectivity test
    const ping = await redis.ping();
    if (ping !== 'PONG') {
      throw new Error('Redis ping failed');
    }
    
    // Performance test
    const start = Date.now();
    await redis.set('health:test', 'ok', 'EX', 10);
    const value = await redis.get('health:test');
    const latency = Date.now() - start;
    
    if (value !== 'ok') {
      throw new Error('Redis read/write test failed');
    }
    
    // Memory usage check
    const info = await redis.info('memory');
    const memoryUsed = parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0');
    const memoryMax = parseInt(info.match(/maxmemory:(\d+)/)?.[1] || '0');
    const memoryUsage = memoryMax > 0 ? (memoryUsed / memoryMax) * 100 : 0;
    
    res.status(200).json({
      status: 'healthy',
      service: process.env.REDIS_TYPE || 'redis',
      latency_ms: latency,
      memory_usage_percent: memoryUsage.toFixed(2),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      service: process.env.REDIS_TYPE || 'redis',
      timestamp: new Date().toISOString()
    });
  }
}
```

## 🛠️ **Troubleshooting Guide**

### **Common Issues**

**1. Connection Timeouts**
```bash
# Check network connectivity
kubectl exec -it deployment/vibecode-app -- nc -zv redis-host 6379

# Check DNS resolution
kubectl exec -it deployment/vibecode-app -- nslookup redis-host

# Verify certificates (for TLS)
kubectl exec -it deployment/vibecode-app -- openssl s_client -connect redis-host:6380
```

**2. Authentication Failures**
```bash
# Test Redis authentication
kubectl exec -it deployment/vibecode-app -- redis-cli -h redis-host -p 6379 -a "$REDIS_PASSWORD" ping

# Check Key Vault secret access
az keyvault secret show --vault-name vibecode-prod-kv --name redis-connection-string
```

**3. Performance Issues**
```bash
# Monitor Redis performance
kubectl exec -it deployment/vibecode-app -- redis-cli -h redis-host --latency-history

# Check memory usage
kubectl exec -it deployment/vibecode-app -- redis-cli -h redis-host info memory

# Monitor slow queries
kubectl exec -it deployment/vibecode-app -- redis-cli -h redis-host slowlog get 10
```

### **Performance Optimization**

**Connection Pooling:**
```typescript
// lib/redis-pool.ts
import IORedis from 'ioredis';

const redisPool = new IORedis({
  host: process.env.REDIS_HOST,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableOfflineQueue: false,
  lazyConnect: true,
  // Pool configuration
  maxRetriesPerRequest: 3,
  connectTimeout: 5000,
  commandTimeout: 5000,
});

export default redisPool;
```

**Pipelining for Bulk Operations:**
```typescript
// lib/bulk-operations.ts
export async function bulkSetCache(items: Array<{key: string, value: string, ttl?: number}>) {
  const redis = getRedisClient();
  const pipeline = redis.pipeline();
  
  items.forEach(item => {
    if (item.ttl) {
      pipeline.setex(item.key, item.ttl, item.value);
    } else {
      pipeline.set(item.key, item.value);
    }
  });
  
  return await pipeline.exec();
}
```

## 🎉 **Best Practices**

### **1. Security**
- ✅ Always use TLS for Redis connections
- ✅ Store passwords in Azure Key Vault  
- ✅ Use VNet integration and private endpoints
- ✅ Implement proper access controls and authentication
- ✅ Regular security audits and password rotation

### **2. Performance**
- ✅ Use connection pooling and reuse connections
- ✅ Implement proper error handling and retries
- ✅ Monitor memory usage and set appropriate policies
- ✅ Use pipelining for bulk operations
- ✅ Optimize data structures and expiration policies

### **3. Reliability**
- ✅ Implement graceful fallbacks for Redis failures
- ✅ Use Redis cluster mode for high availability
- ✅ Regular backups and disaster recovery testing
- ✅ Monitor key metrics and set up alerts
- ✅ Implement circuit breakers for external dependencies

### **4. Cost Optimization**
- ✅ Right-size your Redis instances based on usage
- ✅ Use appropriate TTL values to manage memory
- ✅ Monitor costs and optimize based on usage patterns
- ✅ Consider reserved instances for predictable workloads
- ✅ Use tiered storage for less frequently accessed data

## 📚 **Additional Resources**

- **[Azure Cache for Redis Documentation](https://learn.microsoft.com/en-us/azure/azure-cache-for-redis/)**
- **[Azure Managed Redis Documentation](https://learn.microsoft.com/en-us/azure/redis/)**  
- **[Valkey Official Documentation](https://valkey.io/docs/)**
- **[Redis Best Practices](https://redis.io/docs/getting-started/)**
- **[ioredis Client Library](https://github.com/redis/ioredis)**

## 🆘 **Support**

For Redis/Valkey integration issues:

1. **Check the troubleshooting section** above
2. **Review Azure service health** status  
3. **Monitor Datadog** for Redis-related alerts
4. **Check application logs** for connection errors
5. **Open an issue** in the VibeCode repository with detailed logs

---

**Ready to implement Redis/Valkey with VibeCode?** Choose your preferred option and follow the integration guide above! 🚀 