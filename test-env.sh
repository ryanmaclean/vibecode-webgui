#!/usr/bin/env bash
# Test environment configuration for deployment testing

# Azure Configuration
export RESOURCE_GROUP=vibecode-test-rg
export CLUSTER_NAME=vibecode-test-aks
export ACR_NAME=vibecodetestcr
export LOCATION=eastus

# Database Configuration
export POSTGRES_PASSWORD=test_postgres_password_123
export DATABASE_URL="postgresql://postgres:test_postgres_password_123@postgresql:5432/vibecode"

# Authentication
export NEXTAUTH_SECRET=test_nextauth_secret_for_deployment_testing_only
export NEXTAUTH_URL=https://vibecode-test.eastus.cloudapp.azure.com

# AI Services (test keys)
export OPENROUTER_API_KEY=sk-test-key-for-testing-only

# Datadog Configuration (for log aggregation testing)
export DD_API_KEY=test_datadog_api_key_here
export DD_APP_KEY=test_datadog_app_key_here
export DD_SITE=datadoghq.com

# Application Configuration
export NODE_ENV=development
export ADMIN_EMAIL=admin@test.vibecode.dev
export ADMIN_PASSWORD=test_admin_password_123

# Deployment Configuration
export NAMESPACE=vibecode-platform
export SKIP_CLUSTER_VALIDATION=true
export SKIP_ACR_LOGIN=true
export ENABLE_MONITORING=false
export IMAGE_TAG=test

echo "✅ Test environment variables loaded"
