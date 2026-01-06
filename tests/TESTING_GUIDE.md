# VibeCode Test Infrastructure Guide

This document describes how to run integration tests locally with proper infrastructure setup.

## Overview

VibeCode has three types of tests:

1. **Unit Tests** - No external dependencies, fast, run anywhere
2. **Integration Tests** - Require infrastructure (Docker, Redis, PostgreSQL, MongoDB)
3. **E2E Tests** - Require full application stack and browser automation

## Quick Start

### Running Unit Tests Only

```bash
npm run test:unit
```

Unit tests don't require any infrastructure and should always pass.

### Running Integration Tests

Integration tests require Docker and test infrastructure:

```bash
# 1. Start test infrastructure
./tests/start-test-infrastructure.sh

# 2. Export environment variables (output by the script)
export DATABASE_URL='postgresql://vibecode_test:vibecode_test_password@localhost:5432/vibecode_test'
export REDIS_HOST='localhost'
export REDIS_PORT='6379'
export MONGODB_URI='mongodb://vibecode_test:vibecode_test_password@localhost:27017/vibecode_test'

# 3. Run integration tests
npm run test:integration

# 4. Stop infrastructure when done
./tests/stop-test-infrastructure.sh
```

### Running All Tests

```bash
# With infrastructure running:
npm run test:all
```

## Infrastructure Requirements

### Required for Integration Tests

| Service    | Required For | Default Port | Connection String |
|------------|--------------|--------------|-------------------|
| PostgreSQL | Vector DB, RAG, Database operations | 5432 | `postgresql://vibecode_test:vibecode_test_password@localhost:5432/vibecode_test` |
| Redis      | Caching, rate limiting | 6379 | `redis://localhost:6379` |
| MongoDB    | Chat UI, collaboration | 27017 | `mongodb://vibecode_test:vibecode_test_password@localhost:27017/vibecode_test` |
| Docker     | Container tests, K8s tests | - | - |
| kubectl    | Kubernetes tests | - | - |
| kind       | KIND cluster tests | - | - |

### Infrastructure Detection

The test suite automatically detects available infrastructure using `tests/jest.globalSetup.js`:

- **Docker**: Checks `docker ps` command
- **kubectl**: Checks `kubectl version --client` command
- **kind**: Checks `kind version` command
- **Redis**: Tests TCP connection to Redis host/port
- **PostgreSQL**: Tests TCP connection to DATABASE_URL
- **MongoDB**: Tests TCP connection to MONGODB_URI

When infrastructure is unavailable, related tests are automatically skipped.

## Test Infrastructure Setup

### Option 1: Docker Compose (Recommended)

Use the provided Docker Compose configuration:

```bash
# Start all test services
./tests/start-test-infrastructure.sh

# Services started:
# - PostgreSQL with pgvector extension
# - Redis/Valkey
# - MongoDB
# - Adminer (PostgreSQL admin UI)
# - Redis Commander (Redis admin UI)
# - Mongo Express (MongoDB admin UI)
```

Access admin tools:
- Adminer (PostgreSQL): http://localhost:8080
- Redis Commander: http://localhost:8081
- Mongo Express: http://localhost:8082 (admin/admin)

### Option 2: Manual Setup

If you prefer to manage services manually:

#### PostgreSQL with pgvector

```bash
docker run -d \
  --name vibecode-test-postgres \
  -e POSTGRES_DB=vibecode_test \
  -e POSTGRES_USER=vibecode_test \
  -e POSTGRES_PASSWORD=vibecode_test_password \
  -p 5432:5432 \
  pgvector/pgvector:pg16

# Initialize schema
psql -h localhost -U vibecode_test -d vibecode_test -f tests/init-test-db.sql
```

#### Redis/Valkey

```bash
docker run -d \
  --name vibecode-test-redis \
  -p 6379:6379 \
  valkey/valkey:7.2-alpine
```

#### MongoDB

```bash
docker run -d \
  --name vibecode-test-mongodb \
  -e MONGO_INITDB_ROOT_USERNAME=vibecode_test \
  -e MONGO_INITDB_ROOT_PASSWORD=vibecode_test_password \
  -p 27017:27017 \
  mongo:7.0
```

## Environment Variables

### Required for Integration Tests

```bash
# PostgreSQL
export DATABASE_URL='postgresql://vibecode_test:vibecode_test_password@localhost:5432/vibecode_test'

# Redis
export REDIS_HOST='localhost'
export REDIS_PORT='6379'

# MongoDB
export MONGODB_URI='mongodb://vibecode_test:vibecode_test_password@localhost:27017/vibecode_test'
```

### Optional Configuration

```bash
# Skip specific infrastructure tests
export SKIP_DOCKER_TESTS=1      # Skip Docker-dependent tests
export SKIP_K8S_TESTS=1          # Skip Kubernetes tests
export SKIP_KIND_TESTS=1         # Skip KIND cluster tests
export SKIP_REDIS_TESTS=1        # Skip Redis tests
export SKIP_POSTGRES_TESTS=1     # Skip PostgreSQL tests
export SKIP_MONGO_TESTS=1        # Skip MongoDB tests
```

## Test Organization

```
tests/
├── unit/                      # Unit tests (no infrastructure)
│   ├── lib/                   # Library unit tests
│   ├── components/            # React component tests
│   └── ...
├── integration/               # Integration tests (require infrastructure)
│   ├── cache-redis-*.test.ts       # Redis caching tests
│   ├── cache-pgvector-*.test.ts    # PostgreSQL vector tests
│   ├── chat-ui-mongodb.test.ts     # MongoDB chat tests
│   ├── docker-api.test.ts          # Docker API tests
│   └── ...
├── k8s/                       # Kubernetes integration tests
│   ├── kind-*.test.ts         # KIND cluster tests
│   └── ...
├── e2e/                       # End-to-end tests
│   └── ...
├── docker-compose.test.yml    # Test infrastructure definition
├── init-test-db.sql          # PostgreSQL schema initialization
├── jest.globalSetup.js       # Infrastructure detection
├── start-test-infrastructure.sh  # Start test services
├── stop-test-infrastructure.sh   # Stop test services
└── TESTING_GUIDE.md          # This file
```

## NPM Scripts

### Test Execution

```bash
npm test                     # Run all tests (default)
npm run test:unit           # Unit tests only (no infrastructure)
npm run test:integration    # Integration tests only (requires infrastructure)
npm run test:all            # All tests (unit + integration)
npm run test:watch          # Watch mode
npm run test:coverage       # Generate coverage report
```

### Infrastructure-Specific Tests

```bash
npm run test:k8s            # Kubernetes tests
npm run test:k8s:quick      # Quick K8s validation
npm run test:ws             # WebSocket tests
npm run test:monitoring     # Monitoring tests
npm run test:security       # Security tests
```

### E2E Tests

```bash
npm run test:e2e            # Playwright E2E tests
npm run test:e2e:headed     # E2E with visible browser
```

## Troubleshooting

### Tests Failing Due to Missing Infrastructure

**Symptom**: Integration tests are failing with connection errors.

**Solution**:
1. Check if Docker is running: `docker ps`
2. Start test infrastructure: `./tests/start-test-infrastructure.sh`
3. Verify services are healthy: `docker-compose -f tests/docker-compose.test.yml ps`
4. Check environment variables are set

### Redis Connection Errors

**Symptom**: Tests fail with "Redis connection refused" or similar.

**Solution**:
```bash
# Verify Redis is running
docker-compose -f tests/docker-compose.test.yml ps redis

# Check Redis connectivity
docker-compose -f tests/docker-compose.test.yml exec redis valkey-cli ping

# Verify environment variable
echo $REDIS_HOST  # Should be localhost
echo $REDIS_PORT  # Should be 6379
```

### PostgreSQL Connection Errors

**Symptom**: Tests fail with "database connection refused" or "authentication failed".

**Solution**:
```bash
# Verify PostgreSQL is running
docker-compose -f tests/docker-compose.test.yml ps postgres

# Check PostgreSQL connectivity
docker-compose -f tests/docker-compose.test.yml exec postgres pg_isready -U vibecode_test

# Verify DATABASE_URL
echo $DATABASE_URL  # Should match connection string

# Test connection
psql $DATABASE_URL -c "SELECT version();"
```

### MongoDB Connection Errors

**Symptom**: Tests fail with "MongoServerError" or connection timeout.

**Solution**:
```bash
# Verify MongoDB is running
docker-compose -f tests/docker-compose.test.yml ps mongodb

# Check MongoDB connectivity
docker-compose -f tests/docker-compose.test.yml exec mongodb mongosh --eval "db.adminCommand('ping')"

# Verify MONGODB_URI
echo $MONGODB_URI
```

### All Tests Being Skipped

**Symptom**: `jest.globalSetup.js` reports all infrastructure as unavailable.

**Solution**:
1. Ensure test infrastructure is running
2. Check firewall/network settings aren't blocking localhost connections
3. Verify port forwarding if using Docker Desktop on Mac
4. Try stopping and restarting infrastructure:
   ```bash
   ./tests/stop-test-infrastructure.sh --clean
   ./tests/start-test-infrastructure.sh
   ```

### Port Conflicts

**Symptom**: Services fail to start due to port already in use.

**Solution**:
```bash
# Check what's using the port
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :27017 # MongoDB

# Either stop the conflicting service or modify docker-compose.test.yml
# to use different ports
```

### Docker Not Available

**Symptom**: `jest.globalSetup.js` reports Docker unavailable.

**Solution**:
- **Mac**: Start Docker Desktop or Colima
- **Linux**: Ensure Docker daemon is running: `sudo systemctl start docker`
- **Windows**: Start Docker Desktop

Check Docker status: `docker info`

### KIND/kubectl Not Available

**Symptom**: Kubernetes tests are skipped.

**Solution**:
```bash
# Install kubectl
# Mac: brew install kubectl
# Linux: see https://kubernetes.io/docs/tasks/tools/

# Install kind
# Mac: brew install kind
# Linux: see https://kind.sigs.k8s.io/docs/user/quick-start/

# Verify installation
kubectl version --client
kind version
```

## CI/CD Integration

### GitHub Actions

The test infrastructure detection automatically handles CI environments:

```yaml
# Example GitHub Actions workflow
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_DB: vibecode_test
          POSTGRES_USER: vibecode_test
          POSTGRES_PASSWORD: vibecode_test_password
        ports:
          - 5432:5432

      redis:
        image: valkey/valkey:7.2-alpine
        ports:
          - 6379:6379

      mongodb:
        image: mongo:7.0
        env:
          MONGO_INITDB_ROOT_USERNAME: vibecode_test
          MONGO_INITDB_ROOT_PASSWORD: vibecode_test_password
        ports:
          - 27017:27017

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:all
        env:
          DATABASE_URL: postgresql://vibecode_test:vibecode_test_password@localhost:5432/vibecode_test
          REDIS_HOST: localhost
          REDIS_PORT: 6379
          MONGODB_URI: mongodb://vibecode_test:vibecode_test_password@localhost:27017/vibecode_test
```

## Best Practices

### For Test Authors

1. **Always check environment variables** before running infrastructure-dependent tests
2. **Use conditional describe blocks** to skip tests when infrastructure is unavailable
3. **Clean up test data** in `afterEach` or `afterAll` hooks
4. **Don't rely on test execution order** - tests should be independent
5. **Mock external APIs** that aren't part of the test infrastructure
6. **Use meaningful test names** that describe what's being tested

### Example Test Pattern

```typescript
// Skip tests if Redis is not available
const SKIP_REDIS_TESTS = process.env.SKIP_REDIS_TESTS === '1';
const describeIfRedis = SKIP_REDIS_TESTS ? describe.skip : describe;

describeIfRedis('Redis Cache Integration', () => {
  let redisClient: RedisClient;

  beforeAll(async () => {
    redisClient = await createRedisClient();
  });

  afterAll(async () => {
    await redisClient.disconnect();
  });

  afterEach(async () => {
    // Clean up test data
    await redisClient.flushdb();
  });

  test('should cache and retrieve data', async () => {
    // Test implementation
  });
});
```

## Contributing

When adding new integration tests:

1. Update this guide if you add new infrastructure requirements
2. Add appropriate skip logic using environment variables
3. Update `jest.globalSetup.js` if new infrastructure detection is needed
4. Document any special setup requirements
5. Ensure tests clean up after themselves

## References

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [KIND Documentation](https://kind.sigs.k8s.io/)
