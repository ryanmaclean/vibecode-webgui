#!/bin/bash

# Production Deployment Script for Vector Performance Optimizations

set -e

echo "🚀 DEPLOYING VECTOR PERFORMANCE OPTIMIZATIONS TO PRODUCTION"

# Build check
echo "📦 Building project..."
npm run build || { echo "❌ Build failed"; exit 1; }

# Type check
echo "🔍 Type checking..."
npm run type-check || { echo "❌ Type check failed"; exit 1; }

# Test performance endpoints
echo "🧪 Testing performance endpoints..."
node scripts/test-performance-endpoints.js || { echo "❌ Endpoint tests failed"; exit 1; }

# Production environment variables check
echo "⚙️  Checking production environment variables..."
REQUIRED_VARS=(
    "DATABASE_URL"
    "OPENROUTER_API_KEY"
    "NEXT_PUBLIC_APP_URL"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
        echo "❌ Missing required environment variable: $var"
        exit 1
    fi
done

echo "✅ All checks passed - ready for production deployment"

# Production configuration recommendations
cat << EOF

📋 PRODUCTION DEPLOYMENT CHECKLIST:

✅ Build successful
✅ Type check passed  
✅ Performance endpoints operational
✅ Environment variables validated

🔧 RECOMMENDED PRODUCTION SETTINGS:

Environment Variables:
- DB_CONNECTION_LIMIT=20
- CONNECTION_POOL_MIN_CONNECTIONS=2
- CONNECTION_POOL_MAX_CONNECTIONS=20
- CONNECTION_POOL_ACQUIRE_TIMEOUT=30000
- CONNECTION_POOL_IDLE_TIMEOUT=300000

Performance Monitoring:
- Vector metrics: /api/health/vector-metrics
- Connection pool: /api/health/connection-pool  
- Database health: /api/health/database/metrics

🚀 Deploy with confidence!

EOF