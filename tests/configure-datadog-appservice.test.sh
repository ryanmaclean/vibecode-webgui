#!/usr/bin/env bash
set -euo pipefail

OUTPUT=$(./scripts/configure-datadog-appservice.sh \
  --resource-group demo-rg \
  --app-name demo-app \
  --service demo-service \
  --env staging \
  --version 2.0.0 \
  --tags feature:llm \
  --dry-run)

grep -q "DD_APPSEC_ENABLED=true" <<< "$OUTPUT"
grep -q "DD_IAST_ENABLED=true" <<< "$OUTPUT"
grep -q "DD_TAGS=env:staging,service:demo-service,version:2.0.0,team:core-llm,component:web,feature:llm" <<< "$OUTPUT"
grep -q "instances:" <<< "$OUTPUT"

echo "configure-datadog-appservice.sh dry-run test: PASS"
