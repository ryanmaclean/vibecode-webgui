---
title: Testing Guide
slug: testing-guide
---

# Testing Guide

VibeCode has a comprehensive testing strategy that includes unit tests, integration tests, end-to-end tests, and specialized root-level integration tests.

## 🧪 Test Structure

### Test Categories

#### 1. Unit Tests (`tests/unit/`)
- **Purpose**: Test individual components and functions in isolation
- **Framework**: Jest with React Testing Library
- **Run**: `npm run test:unit`
- **Coverage**: Individual functions, components, utilities

#### 2. Integration Tests (`tests/integration/`)
- **Purpose**: Test component interactions and API integrations
- **Framework**: Jest with real database connections
- **Run**: `npm run test:integration`
- **Coverage**: API endpoints, database operations, external services

#### 3. End-to-End Tests (`tests/e2e/`)
- **Purpose**: Test complete user workflows in browser
- **Framework**: Playwright
- **Run**: `npm run test:e2e`
- **Coverage**: User journeys, UI interactions, critical paths

#### 4. Root Integration Tests (`tests/root-tests/`)
- **Purpose**: Validate system-level functionality and external integrations
- **Framework**: Custom Node.js scripts
- **Run**: `npm run test:root`
- **Coverage**: Azure services, database performance, infrastructure

## 🔧 Root Tests Organization

The root tests are organized into specialized categories:

### Azure Embedding Tests (`tests/root-tests/azure-embedding/`)
- `test-azure-embedding-complete.js` - Complete Azure OpenAI workflow
- `test-azure-embedding-connection-pool.js` - Connection pool management
- `test-azure-embedding-direct.js` - Direct API integration
- `test-azure-embedding-managed-identity.js` - Managed identity authentication
- `test-azure-embedding-mocked.js` - Mocked service testing
- `test-azure-embedding-monitoring.js` - Monitoring and metrics
- `test-azure-embedding.js` - Basic Azure integration

**Requirements**: `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_ENDPOINT`

### Database Tests (`tests/root-tests/database/`)
- `test-db-connection-pooling.js` - Connection pool performance
- `test-db-connection.js` - Basic database connectivity
- `test-db-health-endpoint.js` - Health check validation
- `test-db-metrics.js` - Database performance metrics
- `test-vector-db-connection-pooling.js` - Vector database pools
- `test-vector-db-connection.js` - Vector database connectivity
- `test-robust-db-connection.js` - Robust connection handling
- `test-vector-db.js` - Vector database operations

**Requirements**: `DATABASE_URL`

### AI & Embedding Tests (`tests/root-tests/ai-embedding/`)
- `test-ai-generation.js` - AI content generation
- `test-embedding-factory.js` - Embedding service factory
- `test-embedding-final.js` - Final embedding pipeline
- `test-embedding-pipeline-e2e.js` - End-to-end embedding
- `test-embedding-service-robust.js` - Robust embedding service
- `test-embedding-with-env.js` - Environment-based embedding
- `test-openrouter-byok.js` - OpenRouter BYOK integration
- `test-openrouter-fixed.js` - OpenRouter service fixes
- `test-byok-embedding-service.js` - BYOK embedding service
- `test-direct-openai-embeddings.js` - Direct OpenAI integration

**Requirements**: `OPENAI_API_KEY`

### Infrastructure Tests (`tests/root-tests/infrastructure/`)
- `test-health-simple.cjs` - Simple health checks
- `test-infrastructure.cjs` - Infrastructure validation
- `test-pool-alerts.cjs` - Connection pool alerting
- `test-pool-exhaustion.cjs` - Pool exhaustion scenarios
- `test-datadog.yaml` - Datadog configuration
- `test-deployment.yaml` - Deployment validation
- `test-service.yaml` - Service configuration

**Requirements**: None (basic infrastructure validation)

### Workflow Tests (`tests/root-tests/workflow/`)
- `test-auth-direct.js` - Direct authentication testing
- `test-complete-workflow.js` - Complete application workflow
- `test-gui-auth.html` - GUI authentication testing
- `test-web-auth.html` - Web authentication testing

**Requirements**: `DATABASE_URL`, `REDIS_URL`

### Credentials Tests (`tests/root-tests/credentials/`)
- `test-credentials.js` - Credential validation and security

**Requirements**: `NEXTAUTH_SECRET`

## 🚀 Running Tests

### Individual Test Categories
```bash
# Run all root tests
npm run test:root

# Run specific categories
npm run test:root:azure          # Azure embedding tests
npm run test:root:database       # Database tests
npm run test:root:ai            # AI/embedding tests
npm run test:root:infrastructure # Infrastructure tests
npm run test:root:workflow      # Workflow tests
npm run test:root:credentials   # Credentials tests
```

### Test Runner Features
- **Environment Validation**: Checks required environment variables
- **Timeout Management**: Configurable timeouts per category
- **Error Handling**: Graceful failure handling
- **Progress Reporting**: Real-time test progress
- **Summary Reports**: Detailed test results

## 🔄 CI/CD Integration

### GitHub Actions
Root tests are integrated into the CI pipeline with:
- **Parallel Execution**: Tests run in parallel for faster feedback
- **Service Dependencies**: PostgreSQL and Redis services
- **Environment Variables**: Secure secret management
- **Artifact Collection**: Test results and logs uploaded

### Pre-commit Hooks
Quick validation tests run before commits:
- Infrastructure tests (basic validation)
- Credentials tests (security validation)
- Non-blocking failures (warnings only)

## 📊 Test Monitoring

### Metrics Tracked
- **Test Duration**: Execution time per category
- **Success Rate**: Pass/fail ratios
- **Coverage**: Code coverage metrics
- **Performance**: Database and API response times

### Reporting
- **Console Output**: Real-time progress and results
- **CI Artifacts**: Detailed logs and reports
- **Dashboard Integration**: Datadog monitoring

## 🛠️ Development Workflow

### Before Committing
```bash
# Run quick validation
npm run test:root:infrastructure
npm run test:root:credentials
```

### Before Pushing
```bash
# Run comprehensive tests
npm run test:root
```

### Local Development
```bash
# Run specific tests during development
npm run test:root:database  # When working on database features
npm run test:root:azure     # When working on Azure integration
```

## 🔧 Troubleshooting

### Common Issues

#### Environment Variables Missing
```bash
# Check required variables
echo $DATABASE_URL
echo $REDIS_URL
echo $OPENAI_API_KEY
```

#### Service Dependencies
```bash
# Start required services
docker-compose -f docker-compose.dev.yml up -d
```

#### Test Failures
```bash
# Run individual test files for debugging
node tests/root-tests/database/test-db-connection.js
```

### Debug Mode
```bash
# Enable debug logging
DEBUG=vibecode:* npm run test:root
```

## 📚 Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Library Documentation](https://testing-library.com/docs/)
- [CI/CD Pipeline](/wiki/production-deployment)

---

**Need Help?** 
- Check the [troubleshooting section](#troubleshooting)
- Review [API documentation](/wiki/api-reference)
- Run health checks: `npm run monitoring:health`
- View test results: `npm run test:e2e:report`
