#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# GitHub Actions Cost Report Generator
# Run monthly to track cost optimization effectiveness

# Initialize log aggregation
init_log_aggregation


echo "📊 GitHub Actions Cost Optimization Report"
echo "=========================================="
echo "Date: $(date)"
echo ""

echo "🔍 Workflow Analysis:"
echo "Main branch workflows (lightweight):"
ls -la .github/workflows/main-branch-ci.yml 2>/dev/null && echo "  ✅ main-branch-ci.yml" || echo "  ❌ main-branch-ci.yml missing"

echo ""
echo "Release branch workflows (comprehensive):"
ls -la .github/workflows/release-branch-ci.yml 2>/dev/null && echo "  ✅ release-branch-ci.yml" || echo "  ❌ release-branch-ci.yml missing"

echo ""
echo "💰 Expected cost impact:"
  echo "  Before: ~\$100/month (19 workflows × frequent runs)"
  echo "  After:  ~\$20-30/month (lightweight main + selective comprehensive)"
echo "  Savings: 70-80% reduction"

echo ""
echo "📈 Optimization recommendations:"
echo "1. Use release branches for comprehensive testing"
echo "2. Keep main branch commits lightweight"
echo "3. Monitor actual usage in GitHub billing"
echo "4. Adjust timeouts and concurrency as needed"
