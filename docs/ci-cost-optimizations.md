# CI Cost Optimization Plan

## Summary
Many workflows in `.github/workflows/disabled-expensive/` are currently disabled but still present in the repo. Review indicates large matrices, duplicate installs, and redundant jobs. This plan marks the high-cost automation we can continue to disable (or further trim) and tracks new adjustments.

## Recommendations

### 1. Keep `performance-gates.yml` disabled (very expensive)
- Two jobs (`performance-testing`, `performance-monitoring`) each run `npm ci`, `npm run test:performance`, and multiple follow-on scripts.
- Suggestion: retain in disabled folder; to re-enable, gate via manual trigger (`workflow_dispatch` only) and skip heavy steps unless `PERF_GATE=true`.

### 2. Remove duplicate `npm ci` runs when re-enabling workflows
- Many jobs run `npm ci` multiple times. When re-enabling, use `actions/cache` or restructure to share the install.

### 3. Merge simple test workflows
- `test-ci-simplified.yml` and `test-simple.yml` can be merged into a single minimal job if re-enabled.

### 4. Keep automated production deploys manual
- Workflows like `production-deployment.yml`, `azure-appservice-deploy.yml`, and `azure-webgui-deploy.yml` should remain manual to avoid accidental runs; keep in disabled path unless explicitly needed.

### 5. Document triggers
- Add README section summarizing which workflows remain offline and how to run them locally as needed.

## Next Steps
- Keep `performance-gates.yml` and other heavy workflows under `disabled-expensive/`.
- Update TODO board to note audit complete and record these recommendations.
- If re-enabling any, convert to manual/checklist-based triggers.
