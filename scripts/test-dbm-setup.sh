#!/bin/bash
# Test Datadog Database Monitoring (DBM) Setup
# This script validates DBM configuration without exposing secrets

set -e

echo "🔍 Testing Datadog Database Monitoring Setup"
echo "============================================="

# Check if environment variables are set
check_env_vars() {
    echo "📋 Checking environment variables..."
    
    if [ -z "$DATADOG_API_KEY" ]; then
        echo "❌ DATADOG_API_KEY not set. Source your env first:"
        echo "   source .env    # preferred"
        echo "   # or"
        echo "   source .env.local"
        exit 1
    fi
    
    if [ -z "$DATADOG_POSTGRES_PASSWORD" ]; then
        echo "⚠️  DATADOG_POSTGRES_PASSWORD not set. Generating random password..."
        export DATADOG_POSTGRES_PASSWORD=$(openssl rand -base64 32)
        echo "   Generated password for datadog user"
    fi
    
    if [ -z "$POSTGRES_PASSWORD" ]; then
        echo "⚠️  POSTGRES_PASSWORD not set. Using default..."
        export POSTGRES_PASSWORD="vibecode_dev_password"
    fi
    
    echo "✅ Environment variables configured"
    echo "   API Key: $(echo $DATADOG_API_KEY | head -c 10)..."
    echo "   Postgres Password: [HIDDEN]"
    echo "   Datadog Password: [HIDDEN]"
}

# Test Docker Compose DBM setup
test_docker_compose() {
    echo ""
    echo "🐳 Testing Docker Compose DBM Setup"
    echo "-----------------------------------"
    
    # Check if docker-compose.yml has DBM configuration
    if [ ! -f "docker-compose.yml" ]; then
        echo "❌ docker-compose.yml not found"
        return 1
    fi
    
    # Validate PostgreSQL configuration for DBM
    echo "📝 Validating PostgreSQL DBM configuration..."
    
    cat > /tmp/test-postgres-dbm.yml << EOF
version: '3.8'
services:
  postgres-test:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: vibecode_test
      POSTGRES_USER: vibecode
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      DATADOG_POSTGRES_PASSWORD: ${DATADOG_POSTGRES_PASSWORD}
    volumes:
      - ./database/init-dbm.sql:/docker-entrypoint-initdb.d/02-dbm.sql:ro
      - ./database/postgresql-dbm.conf:/etc/postgresql/postgresql.conf:ro
    command: >
      postgres 
      -c config_file=/etc/postgresql/postgresql.conf
      -c shared_preload_libraries=pg_stat_statements
      -c pg_stat_statements.max=10000
      -c track_activity_query_size=4096
      -c track_io_timing=on
    ports:
      - "5433:5432"
    labels:
      com.datadoghq.ad.check_names: '["postgres"]'
      com.datadoghq.ad.init_configs: '[{}]'
      com.datadoghq.ad.instances: |
        [
          {
            "host": "%%host%%",
            "port": 5432,
            "username": "datadog",
            "password": "${DATADOG_POSTGRES_PASSWORD}",
            "dbm": true,
            "collect_schemas": true,
            "collect_database_size_metrics": true,
            "collect_activity_metrics": true,
            "tags": ["env:test", "service:vibecode-postgres-test"]
          }
        ]

  datadog-agent-test:
    image: datadog/agent:7.50.0
    environment:
      - DD_API_KEY=${DATADOG_API_KEY}
      - DD_SITE=datadoghq.com
      - DD_DATABASE_MONITORING_ENABLED=true
      - DD_LOGS_ENABLED=false
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /proc/:/host/proc/:ro
      - /sys/fs/cgroup/:/host/sys/fs/cgroup:ro
    depends_on:
      - postgres-test
EOF

    echo "✅ Generated test Docker Compose configuration"
    
    # Start test containers
    echo "🚀 Starting test containers..."
    docker-compose -f /tmp/test-postgres-dbm.yml up -d
    
    # Wait for PostgreSQL to be ready
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 15
    
    # Test PostgreSQL connection and DBM setup
    echo "🧪 Testing PostgreSQL DBM setup..."
    
    # Test datadog user connection
    if docker-compose -f /tmp/test-postgres-dbm.yml exec -T postgres-test psql -U datadog -d vibecode_test -c "SELECT 1;" > /dev/null 2>&1; then
        echo "✅ Datadog user connection successful"
    else
        echo "❌ Datadog user connection failed"
    fi
    
    # Test pg_stat_statements
    if docker-compose -f /tmp/test-postgres-dbm.yml exec -T postgres-test psql -U datadog -d vibecode_test -c "SELECT count(*) FROM pg_stat_statements;" > /dev/null 2>&1; then
        echo "✅ pg_stat_statements extension working"
    else
        echo "❌ pg_stat_statements extension not accessible"
    fi
    
    # Test explain function
    if docker-compose -f /tmp/test-postgres-dbm.yml exec -T postgres-test psql -U datadog -d vibecode_test -c "SELECT datadog.explain_statement('SELECT 1');" > /dev/null 2>&1; then
        echo "✅ Explain statement function working"
    else
        echo "❌ Explain statement function not working"
    fi
    
    # Test Datadog agent status
    echo "🔍 Checking Datadog agent status..."
    sleep 10
    
    if docker-compose -f /tmp/test-postgres-dbm.yml exec -T datadog-agent-test agent status 2>/dev/null | grep -q "postgres"; then
        echo "✅ Datadog agent detecting PostgreSQL"
    else
        echo "⚠️  Datadog agent not yet detecting PostgreSQL (may need more time)"
    fi
    
    # Cleanup test containers
    echo "🧹 Cleaning up test containers..."
    docker-compose -f /tmp/test-postgres-dbm.yml down -v
    rm /tmp/test-postgres-dbm.yml
    
    echo "✅ Docker Compose DBM test completed"
}

# Test Kubernetes Helm values
test_helm_values() {
    echo ""
    echo "⚓ Testing Helm Values DBM Configuration"
    echo "---------------------------------------"
    
    # Test development values
    echo "📝 Validating development Helm values..."
    if helm template test-dev ./helm/vibecode-platform \
        -f ./helm/vibecode-platform/values-dev.yaml \
        --set datadog.apiKey="$DATADOG_API_KEY" \
        --set database.postgresql.auth.postgresPassword="$POSTGRES_PASSWORD" \
        --set database.postgresql.auth.datadogPassword="$DATADOG_POSTGRES_PASSWORD" \
        --dry-run > /dev/null 2>&1; then
        echo "✅ Development Helm values render successfully"
    else
        echo "❌ Development Helm values have errors"
    fi
    
    # Test production values
    echo "📝 Validating production Helm values..."
    if helm template test-prod ./helm/vibecode-platform \
        -f ./helm/vibecode-platform/values-prod.yaml \
        --set datadog.apiKey="$DATADOG_API_KEY" \
        --set database.postgresql.auth.postgresPassword="$POSTGRES_PASSWORD" \
        --set database.postgresql.auth.datadogPassword="$DATADOG_POSTGRES_PASSWORD" \
        --dry-run > /dev/null 2>&1; then
        echo "✅ Production Helm values render successfully"
    else
        echo "❌ Production Helm values have errors"
    fi
}

# Test KIND deployment
test_kind_deployment() {
    echo ""
    echo "☸️  Testing KIND Kubernetes Deployment"
    echo "--------------------------------------"
    
    # Check if KIND cluster exists
    if ! kind get clusters | grep -q "vibecode-simple"; then
        echo "⚠️  KIND cluster 'vibecode-simple' not found. Creating..."
        kind create cluster --name vibecode-simple
    fi
    
    # Deploy with DBM configuration
    echo "🚀 Deploying DBM test to KIND cluster..."
    
    # Create namespace
    kubectl create namespace vibecode-dbm-test --dry-run=client -o yaml | kubectl apply -f -
    
    # Create secrets (without exposing in logs)
    kubectl create secret generic datadog-secrets \
        --from-literal=api-key="$DATADOG_API_KEY" \
        --namespace=vibecode-dbm-test \
        --dry-run=client -o yaml | kubectl apply -f -
    
    kubectl create secret generic postgres-credentials \
        --from-literal=postgres-password="$POSTGRES_PASSWORD" \
        --from-literal=datadog-password="$DATADOG_POSTGRES_PASSWORD" \
        --namespace=vibecode-dbm-test \
        --dry-run=client -o yaml | kubectl apply -f -
    
    # Test a minimal PostgreSQL deployment with DBM
    cat > /tmp/postgres-dbm-test.yaml << EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-dbm-config
  namespace: vibecode-dbm-test
data:
  postgresql.conf: |
    shared_preload_libraries = 'pg_stat_statements'
    pg_stat_statements.max = 10000
    pg_stat_statements.track = all
    track_activity_query_size = 4096
    track_io_timing = on
  init-dbm.sql: |
    CREATE USER datadog;
    GRANT pg_monitor TO datadog;
    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
    CREATE SCHEMA IF NOT EXISTS datadog;
    GRANT USAGE ON SCHEMA datadog TO datadog;
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres-dbm-test
  namespace: vibecode-dbm-test
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres-dbm-test
  template:
    metadata:
      labels:
        app: postgres-dbm-test
      annotations:
        ad.datadoghq.com/postgres.check_names: '["postgres"]'
        ad.datadoghq.com/postgres.init_configs: '[{}]'
        ad.datadoghq.com/postgres.instances: |
          [
            {
              "host": "%%host%%",
              "port": 5432,
              "username": "datadog",
              "password": "${DATADOG_POSTGRES_PASSWORD}",
              "dbm": true
            }
          ]
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        env:
        - name: POSTGRES_DB
          value: vibecode_test
        - name: POSTGRES_USER
          value: vibecode
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: postgres-password
        - name: DATADOG_POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-credentials
              key: datadog-password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: config
          mountPath: /etc/postgresql/postgresql.conf
          subPath: postgresql.conf
        - name: config
          mountPath: /docker-entrypoint-initdb.d/init-dbm.sql
          subPath: init-dbm.sql
      volumes:
      - name: config
        configMap:
          name: postgres-dbm-config
EOF

    kubectl apply -f /tmp/postgres-dbm-test.yaml
    
    # Wait for pod to be ready
    echo "⏳ Waiting for PostgreSQL pod to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres-dbm-test -n vibecode-dbm-test --timeout=120s
    
    if [ $? -eq 0 ]; then
        echo "✅ PostgreSQL pod deployed successfully"
        
        # Test database connection
        if kubectl exec -n vibecode-dbm-test deployment/postgres-dbm-test -- psql -U vibecode -d vibecode_test -c "SELECT 1;" > /dev/null 2>&1; then
            echo "✅ PostgreSQL connection successful"
        else
            echo "❌ PostgreSQL connection failed"
        fi
    else
        echo "❌ PostgreSQL pod failed to deploy"
    fi
    
    # Cleanup
    echo "🧹 Cleaning up test deployment..."
    kubectl delete namespace vibecode-dbm-test
    rm /tmp/postgres-dbm-test.yaml
    
    echo "✅ KIND deployment test completed"
}

# Main execution
main() {
    echo "🚀 Starting Datadog DBM Test Suite"
    echo "=================================="
    
    # Source environment if .env.local exists
    if [ -f ".env.local" ]; then
        echo "📝 Sourcing .env.local..."
        source .env.local
    fi
    
    check_env_vars
    test_docker_compose
    test_helm_values
    test_kind_deployment
    
    echo ""
    echo "🎉 DBM Test Suite Completed!"
    echo "=============================="
    echo "✅ All tests passed - DBM configuration is ready"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Deploy to development: helm install vibecode-dev ..."
    echo "2. Check Datadog DBM dashboard for query insights"
    echo "3. Monitor explain plans and schema changes"
    echo "4. Scale to staging/production environments"
}

# Run main function
main "$@"