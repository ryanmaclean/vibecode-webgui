# Valkey Migration Guide: Redis → Valkey

**Document Version:** 1.0
**Date:** October 28, 2025
**Status:** Production-Ready
**Author:** VibeCode Platform Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Why Valkey?](#why-valkey)
3. [Architecture Overview](#architecture-overview)
4. [Compatibility Matrix](#compatibility-matrix)
5. [Migration Paths](#migration-paths)
6. [Configuration Migration](#configuration-migration)
7. [Application Code Changes](#application-code-changes)
8. [Testing & Verification](#testing--verification)
9. [Rollback Plan](#rollback-plan)
10. [Troubleshooting](#troubleshooting)

---

## Executive Summary

### What This Guide Covers

This document provides a complete migration path from Redis to Valkey for VibeCode's session storage and caching infrastructure.

### Key Points

- **Valkey is 100% Redis-compatible** - protocol, commands, and client libraries work unchanged
- **License Change**: Redis → RSAL/SSPL (restrictive), Valkey → BSD-3-Clause (permissive)
- **Zero Application Changes**: ioredis client works with both Redis and Valkey
- **Drop-in Replacement**: Same port (6379), same commands, same data structures
- **Migration Time**: ~2 hours for VM deployment, 4-8 hours for production with validation

### Migration Outcomes

✅ Open-source BSD-3-Clause licensed infrastructure
✅ No vendor lock-in or restrictive licensing
✅ Maintained by Linux Foundation
✅ Enhanced performance features
✅ Community-driven development

---

## Why Valkey?

### Redis License Change (March 2024)

Redis Labs changed Redis licensing from BSD to:
- **RSAL (Redis Source Available License)** - restrictive commercial terms
- **SSPL (Server Side Public License)** - requires open-sourcing entire stack if offered as service

**Impact**: Companies using Redis in cloud services or SaaS must either:
1. Open-source entire application stack (SSPL)
2. Pay Redis Labs for commercial license
3. Migrate to open-source alternative (Valkey)

### Valkey: The Linux Foundation Fork

**Valkey** is a fork of Redis 7.2.4 created by:
- Linux Foundation
- AWS, Google Cloud, Oracle, Ericsson
- Community contributors

**License**: BSD-3-Clause (fully permissive)

**Key Features**:
- 100% Redis protocol compatible
- All Redis 7.2+ commands supported
- Enhanced multi-threading (experimental)
- Community governance model
- No licensing restrictions

### VibeCode Decision

VibeCode uses Redis for:
- **Session storage** (user authentication, JWT tokens)
- **API caching** (reduce database load)
- **Rate limiting** (API throttling)
- **Real-time features** (WebSocket pub/sub)

**Decision**: Migrate to Valkey to:
1. Avoid restrictive licensing
2. Maintain open-source infrastructure
3. Ensure long-term sustainability
4. Support community-driven development

---

## Architecture Overview

### Current Architecture (Redis)

```
┌─────────────────────────────────────────────────────────────┐
│                   VibeCode Application                       │
│                    (Next.js 15 + React 19)                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
                   ioredis 5.7.0 Client
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                Redis 7-alpine (Docker)                       │
│                                                              │
│  - License: RSAL/SSPL (restrictive)                         │
│  - Port: 6379                                               │
│  - Persistence: AOF + RDB                                   │
│  - Use Cases: Sessions, Cache, Rate Limits                  │
└─────────────────────────────────────────────────────────────┘
```

### Target Architecture (Valkey)

```
┌─────────────────────────────────────────────────────────────┐
│                   VibeCode Application                       │
│                    (Next.js 15 + React 19)                   │
│                   NO CODE CHANGES REQUIRED                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
                   ioredis 5.7.0 Client
                   (same client library)
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                Valkey 7.2.6+ (Alpine ARM64)                  │
│                                                              │
│  - License: BSD-3-Clause (permissive)                       │
│  - Port: 6379 (same)                                        │
│  - Persistence: AOF + RDB (same)                            │
│  - Use Cases: Sessions, Cache, Rate Limits (same)           │
│  - Compatibility: 100% Redis protocol                       │
└─────────────────────────────────────────────────────────────┘
```

### Deployment Options

#### Option 1: vfkit VM (macOS ARM64)
```
┌─────────────────────────────────────────────────────────────┐
│                    macOS Host (ARM64)                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │        vfkit VM (Alpine ARM64)                        │  │
│  │  ┌─────────────────────────────────────────────────┐  │  │
│  │  │  Valkey Server                                  │  │  │
│  │  │  - Port: 6379 (forwarded to host)              │  │  │
│  │  │  - Memory: 512MB-1GB                           │  │  │
│  │  │  - Persistent storage: /var/lib/valkey         │  │  │
│  │  └─────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### Option 2: Kubernetes Deployment
```
┌─────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Valkey Deployment (Replicas: 1-3)                   │  │
│  │  ├─ ConfigMap: valkey-config                         │  │
│  │  ├─ Secret: valkey-auth                              │  │
│  │  ├─ PVC: valkey-pvc (8Gi)                            │  │
│  │  ├─ Service: valkey-service (ClusterIP)              │  │
│  │  └─ NetworkPolicy: valkey-network-policy             │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### Option 3: Docker Compose (Development)
```yaml
version: '3.8'
services:
  valkey:
    image: valkey/valkey:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - ./config/valkey/valkey-dev.conf:/etc/valkey/valkey.conf
      - valkey-data:/data
    command: valkey-server /etc/valkey/valkey.conf
volumes:
  valkey-data:
```

---

## Compatibility Matrix

### Protocol Compatibility

| Feature | Redis 7.2 | Valkey 7.2.6 | Compatible? |
|---------|-----------|--------------|-------------|
| RESP Protocol | ✅ | ✅ | ✅ 100% |
| Commands | ✅ | ✅ | ✅ 100% |
| Data Structures | ✅ | ✅ | ✅ 100% |
| Persistence (RDB) | ✅ | ✅ | ✅ 100% |
| Persistence (AOF) | ✅ | ✅ | ✅ 100% |
| Pub/Sub | ✅ | ✅ | ✅ 100% |
| Transactions | ✅ | ✅ | ✅ 100% |
| Lua Scripting | ✅ | ✅ | ✅ 100% |
| Cluster Mode | ✅ | ✅ | ✅ 100% |
| Sentinel | ✅ | ✅ | ✅ 100% |
| ACL System | ✅ | ✅ | ✅ 100% |
| TLS/SSL | ✅ | ✅ | ✅ 100% |

### Client Library Compatibility

| Client Library | Redis Support | Valkey Support | Notes |
|----------------|---------------|----------------|-------|
| **ioredis** (Node.js) | ✅ | ✅ | No changes required |
| **redis** (Node.js) | ✅ | ✅ | No changes required |
| **redis-py** (Python) | ✅ | ✅ | No changes required |
| **lettuce** (Java) | ✅ | ✅ | No changes required |
| **go-redis** (Go) | ✅ | ✅ | No changes required |
| **redis-cli** | ✅ | ✅ | Use `valkey-cli` or `redis-cli` |

### VibeCode Stack Compatibility

| Component | Current (Redis) | Target (Valkey) | Changes Required |
|-----------|-----------------|-----------------|------------------|
| **ioredis Client** | 5.7.0 | 5.7.0 | ❌ None |
| **Session Storage** | Redis | Valkey | ❌ None |
| **Cache Layer** | Redis | Valkey | ❌ None |
| **Rate Limiting** | Redis | Valkey | ❌ None |
| **WebSocket Pub/Sub** | Redis | Valkey | ❌ None |
| **Environment Variables** | `REDIS_*` | `REDIS_*` or `VALKEY_*` | ✅ Optional rename |
| **Connection String** | `redis://...` | `redis://...` | ❌ None |
| **Port** | 6379 | 6379 | ❌ None |
| **Data Format** | RDB/AOF | RDB/AOF | ❌ None |

---

## Migration Paths

### Path 1: VM Replacement (Recommended for Development)

**Timeline**: 2-4 hours
**Complexity**: Low
**Risk**: Low (development environment)
**Downtime**: 5-10 minutes

#### Steps

1. **Deploy Valkey VM**
   ```bash
   # Build Valkey VM with vfkit
   cd /Users/ryan.maclean/vibecode-webgui

   # Start Valkey VM
   vfkit --config config/vfkit/valkey-vm.yaml

   # Verify Valkey is running
   valkey-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 ping
   # Expected output: PONG
   ```

2. **Export Data from Redis (Optional)**
   ```bash
   # Save Redis snapshot
   redis-cli SAVE

   # Copy RDB file
   docker cp redis-container:/data/dump.rdb ./redis-backup.rdb
   ```

3. **Import Data to Valkey**
   ```bash
   # Copy RDB file to Valkey VM
   scp ./redis-backup.rdb valkey-vm:/var/lib/valkey/dump.rdb

   # Restart Valkey to load data
   ssh valkey-vm "rc-service valkey restart"

   # Verify data
   valkey-cli -h localhost -p 6379 -a VibeCodeChangeMe2025 KEYS "*"
   ```

4. **Update Application Configuration**
   ```bash
   # Update .env (no changes required if using localhost:6379)
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=VibeCodeChangeMe2025

   # Or use Valkey-specific variables
   VALKEY_HOST=localhost
   VALKEY_PORT=6379
   VALKEY_PASSWORD=VibeCodeChangeMe2025
   ```

5. **Restart Application**
   ```bash
   npm run dev
   # Application now connects to Valkey instead of Redis
   ```

### Path 2: Side-by-Side Migration (Recommended for Production)

**Timeline**: 4-8 hours
**Complexity**: Medium
**Risk**: Low (gradual migration)
**Downtime**: Near-zero

#### Steps

1. **Deploy Valkey Alongside Redis**
   ```bash
   # Deploy Valkey on different port temporarily
   kubectl apply -f k8s/valkey-deployment.yaml

   # Verify both services running
   kubectl get pods -n vibecode-platform
   # Should show: redis-xxx and valkey-xxx
   ```

2. **Implement Dual-Write Pattern**
   ```typescript
   // lib/cache/hybrid-client.ts
   import { Redis } from 'ioredis';

   const redisClient = new Redis({
     host: process.env.REDIS_HOST,
     port: parseInt(process.env.REDIS_PORT || '6379'),
     password: process.env.REDIS_PASSWORD,
   });

   const valkeyClient = new Redis({
     host: process.env.VALKEY_HOST,
     port: parseInt(process.env.VALKEY_PORT || '6379'),
     password: process.env.VALKEY_PASSWORD,
   });

   export async function set(key: string, value: string, ttl?: number) {
     // Write to both Redis and Valkey
     await Promise.allSettled([
       ttl
         ? redisClient.setex(key, ttl, value)
         : redisClient.set(key, value),
       ttl
         ? valkeyClient.setex(key, ttl, value)
         : valkeyClient.set(key, value),
     ]);
   }

   export async function get(key: string) {
     // Read from Redis (primary) with Valkey fallback
     try {
       const value = await redisClient.get(key);
       if (value) return value;
     } catch (error) {
       console.error('Redis read failed, falling back to Valkey', error);
     }

     return await valkeyClient.get(key);
   }
   ```

3. **Monitor Dual-Write Period**
   ```bash
   # Monitor both Redis and Valkey
   kubectl logs -f deployment/redis -n vibecode-platform
   kubectl logs -f deployment/valkey -n vibecode-platform

   # Check data consistency
   redis-cli DBSIZE
   valkey-cli DBSIZE
   # Should be approximately equal
   ```

4. **Switch Traffic to Valkey**
   ```bash
   # Update environment variables to use Valkey
   kubectl set env deployment/vibecode-app \
     REDIS_HOST=valkey-service.vibecode-platform.svc.cluster.local \
     -n vibecode-platform

   # Rolling update (zero downtime)
   kubectl rollout status deployment/vibecode-app -n vibecode-platform
   ```

5. **Monitor and Validate**
   ```bash
   # Check application logs
   kubectl logs -f deployment/vibecode-app -n vibecode-platform

   # Verify sessions working
   curl -X POST https://vibecode.yourdomain.com/api/auth/signin

   # Check Valkey metrics
   valkey-cli INFO stats
   ```

6. **Decommission Redis**
   ```bash
   # After 24-48 hours of successful operation:
   kubectl scale deployment redis --replicas=0 -n vibecode-platform

   # After 7 days:
   kubectl delete -f k8s/redis-deployment.yaml
   ```

### Path 3: Blue-Green Deployment (Recommended for Enterprise)

**Timeline**: 8-12 hours
**Complexity**: High
**Risk**: Very Low (instant rollback)
**Downtime**: Zero

#### Steps

1. **Deploy Green Environment (Valkey)**
   ```bash
   # Create new namespace for green deployment
   kubectl create namespace vibecode-platform-green

   # Deploy entire stack with Valkey
   helm install vibecode-green ./charts/vibecode-platform \
     --namespace vibecode-platform-green \
     --set redis.enabled=false \
     --set valkey.enabled=true
   ```

2. **Replicate Data to Green**
   ```bash
   # Use Redis replication to sync data
   # Configure Valkey as Redis replica temporarily
   valkey-cli CONFIG SET replicaof <redis-host> 6379
   valkey-cli CONFIG SET masterauth <redis-password>

   # Wait for sync to complete
   valkey-cli INFO replication
   # Check: master_link_status:up
   ```

3. **Switch Traffic at Load Balancer**
   ```bash
   # Update ingress to point to green environment
   kubectl patch ingress vibecode \
     -n vibecode-platform \
     --type='json' \
     -p='[{"op": "replace", "path": "/spec/rules/0/http/paths/0/backend/service/name", "value": "vibecode-green-service"}]'
   ```

4. **Monitor Green Environment**
   ```bash
   # Watch metrics in Datadog
   # Check error rates, latency, session success rate

   # If issues detected, instant rollback:
   kubectl patch ingress vibecode \
     -n vibecode-platform \
     --type='json' \
     -p='[{"op": "replace", "path": "/spec/rules/0/http/paths/0/backend/service/name", "value": "vibecode-service"}]'
   ```

5. **Promote Green to Blue**
   ```bash
   # After 48 hours of successful operation:

   # Delete old blue environment
   helm uninstall vibecode -n vibecode-platform

   # Rename green to blue
   kubectl label namespace vibecode-platform-green environment=production
   ```

---

## Configuration Migration

### Redis Configuration → Valkey Configuration

Valkey uses Redis-compatible configuration files. Most settings translate directly.

#### Configuration Mapping

| Redis Directive | Valkey Directive | Notes |
|-----------------|------------------|-------|
| `bind 0.0.0.0` | `bind 0.0.0.0` | Identical |
| `port 6379` | `port 6379` | Identical |
| `requirepass <password>` | `requirepass <password>` | Identical |
| `maxmemory 512mb` | `maxmemory 512mb` | Identical |
| `maxmemory-policy allkeys-lru` | `maxmemory-policy allkeys-lru` | Identical |
| `appendonly yes` | `appendonly yes` | Identical |
| `save 900 1` | `save 900 1` | Identical |
| `rename-command CONFIG ""` | `rename-command CONFIG ""` | Identical |

#### Convert redis.conf to valkey.conf

```bash
# Valkey can use Redis configuration files directly
cp /etc/redis/redis.conf /etc/valkey/valkey.conf

# No changes required for basic configuration
# Optional: Update comments to reflect Valkey branding
sed -i 's/Redis/Valkey/g' /etc/valkey/valkey.conf
```

### Environment Variables

#### Current (Redis)
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secret
REDIS_DB=0
REDIS_TLS=false
```

#### Option 1: Keep Same Variable Names (Recommended)
```bash
# No changes required
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secret
REDIS_DB=0
REDIS_TLS=false
```

#### Option 2: Rename to Valkey
```bash
VALKEY_HOST=localhost
VALKEY_PORT=6379
VALKEY_PASSWORD=secret
VALKEY_DB=0
VALKEY_TLS=false
```

#### Option 3: Support Both (Migration Period)
```typescript
// lib/cache/config.ts
export const cacheConfig = {
  host: process.env.VALKEY_HOST || process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.VALKEY_PORT || process.env.REDIS_PORT || '6379'),
  password: process.env.VALKEY_PASSWORD || process.env.REDIS_PASSWORD || '',
  db: parseInt(process.env.VALKEY_DB || process.env.REDIS_DB || '0'),
  tls: process.env.VALKEY_TLS === 'true' || process.env.REDIS_TLS === 'true',
};
```

---

## Application Code Changes

### Good News: Zero Code Changes Required!

Valkey is 100% Redis protocol compatible. All client libraries work without modification.

### Verification (Optional)

#### Before Migration: Redis Client
```typescript
// lib/cache/redis-client.ts
import { Redis } from 'ioredis';

const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

export default redisClient;
```

#### After Migration: Same Code, Different Server
```typescript
// lib/cache/redis-client.ts
// NO CHANGES REQUIRED - same code works with Valkey!
import { Redis } from 'ioredis';

const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',  // Now points to Valkey
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
});

export default redisClient;
```

### Optional: Rename for Clarity

```typescript
// lib/cache/valkey-client.ts
import { Redis } from 'ioredis';  // Still use ioredis library!

// Rename variable for clarity (optional)
const valkeyClient = new Redis({
  host: process.env.VALKEY_HOST || 'localhost',
  port: parseInt(process.env.VALKEY_PORT || '6379'),
  password: process.env.VALKEY_PASSWORD,
});

export default valkeyClient;
```

### Documentation Updates

Update code comments to reflect Valkey:

```typescript
/**
 * Valkey client for session storage and caching
 *
 * Valkey is a BSD-3-Clause licensed Redis fork maintained by Linux Foundation
 * 100% Redis protocol compatible, works with ioredis client library
 *
 * Connection: localhost:6379 (Valkey VM via vfkit)
 * License: BSD-3-Clause (https://valkey.io)
 *
 * @see config/vfkit/valkey-vm.yaml - VM configuration
 * @see config/valkey/valkey.conf - Valkey production config
 */
import { Redis } from 'ioredis';

export const cacheClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => Math.min(times * 50, 2000),
});
```

---

## Testing & Verification

### Pre-Migration Testing

#### Test 1: Verify Current Redis Functionality

```bash
# Connect to current Redis instance
redis-cli -h localhost -p 6379 -a $REDIS_PASSWORD

# Basic operations
> PING
PONG

> SET test:migration "Redis works"
OK

> GET test:migration
"Redis works"

> DEL test:migration
(integer) 1

# Session test
> SET session:test123 '{"userId":"123","email":"test@example.com"}' EX 3600
OK

> TTL session:test123
(integer) 3599

> GET session:test123
"{\"userId\":\"123\",\"email\":\"test@example.com\"}"
```

#### Test 2: Application Session Test

```bash
# Start application with Redis
npm run dev

# Create test session via API
curl -X POST http://localhost:3000/api/auth/test-session \
  -H "Content-Type: application/json" \
  -d '{"userId":"test123","email":"test@example.com"}'

# Verify session in Redis
redis-cli -a $REDIS_PASSWORD GET session:test123
```

### Post-Migration Testing

#### Test 1: Verify Valkey Functionality

```bash
# Connect to Valkey (use redis-cli or valkey-cli)
valkey-cli -h localhost -p 6379 -a $VALKEY_PASSWORD

# Basic operations (identical to Redis)
> PING
PONG

> SET test:migration "Valkey works"
OK

> GET test:migration
"Valkey works"

> DEL test:migration
(integer) 1

# Verify Valkey version
> INFO server
# Server
valkey_version:7.2.6
valkey_mode:standalone
os:Linux 6.1.0-26-arm64 aarch64
arch_bits:64
```

#### Test 2: Session Storage Test

```typescript
// tests/integration/valkey-session.test.ts
import { Redis } from 'ioredis';

describe('Valkey Session Storage', () => {
  let valkey: Redis;

  beforeAll(() => {
    valkey = new Redis({
      host: process.env.VALKEY_HOST || 'localhost',
      port: parseInt(process.env.VALKEY_PORT || '6379'),
      password: process.env.VALKEY_PASSWORD,
    });
  });

  afterAll(async () => {
    await valkey.quit();
  });

  test('should store and retrieve session', async () => {
    const sessionId = 'test:session:' + Date.now();
    const sessionData = JSON.stringify({
      userId: 'test123',
      email: 'test@vibecode.dev',
      role: 'developer',
    });

    // Set session with 1 hour TTL
    await valkey.setex(sessionId, 3600, sessionData);

    // Retrieve session
    const retrieved = await valkey.get(sessionId);
    expect(retrieved).toBe(sessionData);

    // Verify TTL
    const ttl = await valkey.ttl(sessionId);
    expect(ttl).toBeGreaterThan(3500);
    expect(ttl).toBeLessThanOrEqual(3600);

    // Cleanup
    await valkey.del(sessionId);
  });

  test('should handle session expiration', async () => {
    const sessionId = 'test:session:expiry';
    await valkey.setex(sessionId, 1, 'test');

    // Session exists
    let value = await valkey.get(sessionId);
    expect(value).toBe('test');

    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Session expired
    value = await valkey.get(sessionId);
    expect(value).toBeNull();
  });

  test('should support hash operations for cache', async () => {
    const cacheKey = 'test:cache:user:123';

    await valkey.hset(cacheKey, {
      name: 'John Doe',
      email: 'john@example.com',
      role: 'admin',
    });

    const user = await valkey.hgetall(cacheKey);
    expect(user.name).toBe('John Doe');
    expect(user.email).toBe('john@example.com');
    expect(user.role).toBe('admin');

    await valkey.del(cacheKey);
  });

  test('should support rate limiting', async () => {
    const rateLimitKey = 'test:ratelimit:api:' + Date.now();

    // Increment counter
    const count1 = await valkey.incr(rateLimitKey);
    expect(count1).toBe(1);

    // Set expiration
    await valkey.expire(rateLimitKey, 60);

    // Increment again
    const count2 = await valkey.incr(rateLimitKey);
    expect(count2).toBe(2);

    // Cleanup
    await valkey.del(rateLimitKey);
  });
});
```

#### Test 3: End-to-End Application Test

```bash
# Run full application test suite
npm test

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Verify no Redis-specific failures
```

#### Test 4: Performance Comparison

```bash
# Benchmark Redis
redis-benchmark -h localhost -p 6379 -a $REDIS_PASSWORD \
  -t set,get,incr,lpush,rpush -n 100000 -q

# Benchmark Valkey
redis-benchmark -h localhost -p 6379 -a $VALKEY_PASSWORD \
  -t set,get,incr,lpush,rpush -n 100000 -q

# Compare results (should be similar or better)
```

### Monitoring Checklist

- [ ] Valkey server is running (`valkey-cli PING`)
- [ ] Application connects successfully
- [ ] Sessions are created and retrieved
- [ ] Cache operations work correctly
- [ ] Rate limiting functions properly
- [ ] No error logs related to cache
- [ ] Response times are acceptable
- [ ] Memory usage is within limits
- [ ] Persistence (AOF/RDB) is working
- [ ] All tests pass

---

## Rollback Plan

### Quick Rollback (< 5 minutes)

#### Scenario: Immediate issues after migration

```bash
# Stop Valkey VM
vfkit stop valkey-vm

# Start Redis container
docker start redis-container

# Update environment variables
export REDIS_HOST=localhost
export REDIS_PORT=6379

# Restart application
npm run dev

# Verify application works
curl http://localhost:3000/api/health
```

### Kubernetes Rollback (< 10 minutes)

```bash
# Revert to previous deployment
kubectl rollout undo deployment/vibecode-app -n vibecode-platform

# Scale up Redis, scale down Valkey
kubectl scale deployment redis --replicas=1 -n vibecode-platform
kubectl scale deployment valkey --replicas=0 -n vibecode-platform

# Update service to point to Redis
kubectl patch service cache-service -n vibecode-platform \
  --type='json' \
  -p='[{"op": "replace", "path": "/spec/selector/app", "value": "redis"}]'

# Verify rollback
kubectl get pods -n vibecode-platform
curl https://vibecode.yourdomain.com/api/health
```

### Data Recovery

#### If data loss occurred:

```bash
# Restore from RDB backup
cp /backup/redis-dump.rdb /var/lib/redis/dump.rdb

# Restart Redis
docker restart redis-container

# Verify data restored
redis-cli KEYS "*" | wc -l
```

---

## Troubleshooting

### Issue 1: Connection Refused

**Symptoms**: Application cannot connect to Valkey

**Solution**:
```bash
# Check Valkey is running
valkey-cli PING

# Check port is accessible
nc -zv localhost 6379

# Check firewall rules
sudo iptables -L | grep 6379

# Check Valkey logs
tail -f /var/log/valkey/valkey.log
```

### Issue 2: Authentication Failed

**Symptoms**: `NOAUTH Authentication required`

**Solution**:
```bash
# Verify password in config
grep requirepass /etc/valkey/valkey.conf

# Connect with password
valkey-cli -a YOUR_PASSWORD PING

# Update application environment variables
export REDIS_PASSWORD=YOUR_PASSWORD
```

### Issue 3: Data Not Persisting

**Symptoms**: Data lost after Valkey restart

**Solution**:
```bash
# Check persistence configuration
valkey-cli CONFIG GET save
valkey-cli CONFIG GET appendonly

# Enable persistence
valkey-cli CONFIG SET appendonly yes
valkey-cli CONFIG SET save "900 1 300 10 60 10000"

# Verify AOF file exists
ls -lah /var/lib/valkey/appendonly.aof
```

### Issue 4: High Memory Usage

**Symptoms**: Valkey using more memory than expected

**Solution**:
```bash
# Check memory usage
valkey-cli INFO memory

# Check maxmemory setting
valkey-cli CONFIG GET maxmemory

# Set memory limit
valkey-cli CONFIG SET maxmemory 512mb
valkey-cli CONFIG SET maxmemory-policy allkeys-lru

# Analyze memory usage by key
valkey-cli --bigkeys
```

### Issue 5: Slow Performance

**Symptoms**: High latency in cache operations

**Solution**:
```bash
# Check slow log
valkey-cli SLOWLOG GET 10

# Monitor latency
valkey-cli --latency

# Check connected clients
valkey-cli CLIENT LIST

# Optimize configuration
valkey-cli CONFIG SET hz 10
valkey-cli CONFIG SET activerehashing yes
```

---

## Next Steps

After successful migration:

1. **Update Documentation**
   - ✅ Update AUTHENTICATION_STRATEGY.md
   - ✅ Update ARCHITECTURE.md
   - ✅ Update deployment guides
   - ✅ Update developer onboarding docs

2. **Monitor Performance**
   - Set up Datadog monitoring for Valkey
   - Create dashboards for key metrics
   - Set up alerts for issues
   - Monitor for 7 days before decommissioning Redis

3. **Optimize Configuration**
   - Fine-tune memory settings based on usage
   - Adjust persistence settings if needed
   - Configure replication for HA (if required)
   - Set up regular backups

4. **Team Training**
   - Brief team on Valkey vs Redis
   - Update operational runbooks
   - Document troubleshooting procedures
   - Share this migration guide

---

## Additional Resources

- **Valkey Official Site**: https://valkey.io
- **Valkey GitHub**: https://github.com/valkey-io/valkey
- **Valkey Documentation**: https://valkey.io/docs
- **Linux Foundation Announcement**: https://www.linuxfoundation.org/press/linux-foundation-launches-open-source-valkey-community
- **Redis vs Valkey License Comparison**: https://opensource.org/licenses/BSD-3-Clause
- **ioredis Client Documentation**: https://github.com/redis/ioredis

---

**Document Maintainer**: VibeCode Platform Team
**Last Updated**: October 28, 2025
**Next Review**: November 28, 2025

---
