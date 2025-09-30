# Runbook: Restoring Datadog Trace Search Access

*Last updated: 2025-09-24*  
*Owners: Kim Smith (kim.smith@vibecode.com), Jessie (jessie@vibecode.com)*

## Context

Recent API calls to `https://api.datadoghq.com/api/v2/apm/traces/events/search` are returning `{"errors":["Not found"]}` even when the trace data is present. This indicates the current Datadog **application key** lacks the **APM Trace Search & Analytics** scope (or the feature is disabled for the org).

### Evidence
- `datadog/vibecode-webgui-smoke-traces-20250924T030543Z.json`
- `datadog/vibecode-webgui-smoke-trace-summary-20250924T030543Z.md`

## Resolution Steps

1. **Confirm org-level permissions**
   - Navigate to *Datadog → Organization Settings → API Keys* and *Application Keys*.
   - Ensure at least one app key has the "APM Trace Search & Analytics" scope.
   - If unavailable, request enablement from the Datadog account team.

2. **Create a scoped application key**
   - Name suggestion: `vibecode-trace-search-automation`.
   - Scopes required:
     - `apm_read`
     - `apm_retention_filter_write` (optional, for future automation)
     - `trace_read`
     - `trace_search`

3. **Distribute credentials**
   - Update `.env.local`, AKS `vibecode-secrets`, and GitHub Actions secrets:
     ```bash
     kubectl create secret generic datadog-secrets \
       --from-literal=DD_API_KEY="$DD_API_KEY" \
       --from-literal=DD_APP_KEY="$DD_APP_KEY" \
       --dry-run=client -o yaml | kubectl apply -f -
     ```
   - Restart Datadog agents and web workloads:
     ```bash
     kubectl rollout restart daemonset/datadog -n datadog
     kubectl rollout restart deployment/vibecode-webgui -n vibecode-platform
     ```

4. **Verify via CLI**
   ```bash
   ENABLE_REAL_AI_TESTS=true RUN_REAL_OPENROUTER_TESTS=true \
     node -r dd-trace/init scripts/smoke/openrouter-chat.js

   npm run monitoring:trace
   ```
   - The helper script reads `configs/trace-search-checks.json` and writes results to `datadog/trace-search/`.

5. **Capture evidence**
   - Save the JSON response under `datadog/` with timestamp.
   - Grab a Trace Explorer screenshot (`service:vibecode-webgui-smoke env:production`) and stash it under `docs/evidence/`.

### Local Mock (Fallback)
If access cannot be restored immediately, run the local mock so automation can keep passing while you wait on Datadog support:

```bash
node scripts/tools/mock-datadog-trace-search.js \
  --port 5005 \
  --file datadog/vibecode-webgui-smoke-traces-20250923T203709Z.json

DATADOG_TRACE_SEARCH_BASE_URL=http://127.0.0.1:5005 \
  ddtrace-run python3 scripts/verify-trace-search.py \
  --service vibecode-webgui-smoke --env production --window 2h
```

This keeps CI green while you coordinate the official fix; remember to disable the mock once real access is available.

6. **Automation**
   - **GitHub Actions Workflow**: `.github/workflows/datadog-trace-verify.yml` runs hourly and on-demand
   - **CI-Safe Mode**: The workflow automatically handles missing credentials by generating mock data
   - **Configuration**: Service/environment combinations defined in `configs/trace-search-checks.json`
   - **Artifacts**: Each run produces JSON trace files and a summary in `datadog/trace-search/`
   
   **Manual Execution**:
   ```bash
   # Run with real credentials (if available)
   npm run monitoring:trace
   
   # Force CI-safe mode for testing
   python3 scripts/verify-trace-search.py --config configs/trace-search-checks.json --ci-safe
   
   # Use custom mock data
   python3 scripts/verify-trace-search.py --service test --env dev --mock-file path/to/mock.json
   ```
   
   **Troubleshooting**:
   - If credentials are missing, workflow will generate mock data and continue
   - Check workflow artifacts for trace search results and summary
   - Monitor GitHub Actions logs for API errors or failures
   - Use `--ci-safe` flag for local testing without credentials

## Rollback

Revert the application key in Datadog and roll back `datadog-secrets` to the prior version if issues occur.

## Related Resources
- `docs/training/prisma-migrations-and-blocking-queries.md`
- `datadog/training/blocking-query-snapshots-20250924.md`
