# Astro Link Audit — 2025-10-01
Scanned static output in `docs/dist/` after `npm run build`. Detected links that resolve to missing files when served locally with base `/vibecode-webgui`.
## Summary by prefix
- `.`: 165 missing references
- `..`: 99 missing references
- `api`: 21 missing references
- `wiki`: 11 missing references
- `monitoring`: 5 missing references
- `vibecode-webgui`: 4 missing references
- `docs`: 3 missing references
- `development`: 2 missing references
- `src`: 2 missing references
- `CODE_OF_CONDUCT.md`: 1 missing references
- `LICENSE`: 1 missing references
- `todo`: 1 missing references
- `ai-integration`: 1 missing references
- `.github`: 1 missing references
- `architecture`: 1 missing references
- `deployment`: 1 missing references
- `README.md`: 1 missing references
- `KIND_TROUBLESHOOTING_GUIDE.md`: 1 missing references
- `DOCKER_TROUBLESHOOTING_SUMMARY.md`: 1 missing references
- `REPOSITORY_SCAN_REPORT_JULY_2025.md`: 1 missing references
- `ENHANCED_AI_FEATURES.md`: 1 missing references
- `MISSING_AI_LIBRARIES_ANALYSIS.md`: 1 missing references
- `AUTHENTICATION_SUMMARY.md`: 1 missing references
- `AUTHENTICATION_TESTING_GUIDE.md`: 1 missing references
- `AZURE_INFRASTRUCTURE_SUMMARY.md`: 1 missing references
- `production-status.md`: 1 missing references
- `COMPREHENSIVE_TESTING_ASSESSMENT.md`: 1 missing references
- `CONTAINER_MANIFEST.md`: 1 missing references
- `GENAI_INTEGRATION_ARCHITECTURE.md`: 1 missing references
- `GENAI_ENHANCEMENT_SUMMARY.md`: 1 missing references
- `AI_CLI_TOOLS_IMPLEMENTATION_SUMMARY.md`: 1 missing references
- `DOCKER_MODEL_RUNNER_SETUP.md`: 1 missing references
- `PRISMA_PGVECTOR_TEST_RESULTS.md`: 1 missing references
- `REDIS_VALKEY_INTEGRATION_GUIDE.md`: 1 missing references
- `TEMPORAL_INTEGRATION_SUMMARY.md`: 1 missing references
- `DATADOG_COMPATIBILITY_SUMMARY.md`: 1 missing references
- `VSCODE_EXTENSION_CONFIGURATION.md`: 1 missing references
- `MASTRA_INTEGRATION_GUIDE.md`: 1 missing references
- `MICROSOFT_VSCODE_EXTENSIONS_MIT_BSD.md`: 1 missing references
- `THIRD_PARTY_NOTICES_EXTENSIONS.md`: 1 missing references
- `TEST_INFRASTRUCTURE_SUMMARY.md`: 1 missing references
- `PRECOMMIT_OPTIMIZATION_SUMMARY.md`: 1 missing references
- `COMPREHENSIVE_TEST_REPORT.md`: 1 missing references
- `KIND_VALIDATION_REPORT.md`: 1 missing references
- `ENV_VARIABLES.md`: 1 missing references
- `DEVELOPMENT_CREDENTIALS.md`: 1 missing references
- `DOCS_CONSOLIDATION_PLAN.md`: 1 missing references
- `LICENSE_SWEEP_GENAI_LIBRARIES.md`: 1 missing references
- `CONTRIBUTING.md`: 1 missing references
- `prisma`: 1 missing references

## Sample missing links
- `../../helm/` -> `/Users/ryan.maclean/vibecode-webgui/docs/dist/wiki-archive/helm/index.html`
- `../../charts/vibecode-platform/` -> `/Users/ryan.maclean/vibecode-webgui/docs/dist/wiki-archive/charts/vibecode-platform/index.html`
- `../../charts/vibecode-platform/README.md` -> `/Users/ryan.maclean/vibecode-webgui/docs/dist/wiki-archive/charts/vibecode-platform/README.md`
- `../../infrastructure/terraform/` -> `/Users/ryan.maclean/vibecode-webgui/docs/dist/wiki-archive/infrastructure/terraform/index.html`
- `../../infrastructure/terraform/azure/` -> `/Users/ryan.maclean/vibecode-webgui/docs/dist/wiki-archive/infrastructure/terraform/azure/index.html`
- `../../infrastructure/terraform/azure/README.md` -> `/Users/ryan.maclean/vibecode-webgui/docs/dist/wiki-archive/infrastructure/terraform/azure/README.md`
- `../../infrastructure/terraform/azure/terraform.tfvars.example` -> `/Users/ryan.maclean/vibecode-webgui/docs/dist/wiki-archive/infrastructure/terraform/azure/terraform.tfvars.example`
- `../../k8s/` -> `/Users/ryan.maclean/vibecode-webgui/docs/dist/wiki-archive/k8s/index.html`
- `../CODE_OF_CONDUCT.md` -> `/Users/ryan.maclean/vibecode-webgui/docs/dist/wiki-archive/CODE_OF_CONDUCT.md`
- `../CONTRIBUTING.md` -> `/Users/ryan.maclean/vibecode-webgui/docs/dist/wiki-archive/CONTRIBUTING.md`
- `../IMPLEMENTATION_COMPLETE.md` -> `/Users/ryan.maclean/vibecode-webgui/docs/dist/wiki-archive/IMPLEMENTATION_COMPLETE.md`
- `../PERFORMANCE_METRICS.md` -> `/Users/ryan.maclean/vibecode-webgui/docs/dist/wiki-archive/PERFORMANCE_METRICS.md`
- `../README.md` -> `/Users/ryan.maclean/vibecode-webgui/docs/dist/wiki-archive/README.md`
- `../SECURITY.md` -> `/Users/ryan.maclean/vibecode-webgui/docs/dist/wiki-archive/SECURITY.md`
- `../TAILWIND_V4_MIGRATION_NOTES.md` -> `/Users/ryan.maclean/vibecode-webgui/docs/dist/wiki-archive/TAILWIND_V4_MIGRATION_NOTES.md`
- `../docker/README.md` -> `/Users/ryan.maclean/vibecode-webgui/docs/dist/wiki-archive/docker/README.md`
- `../extensions/vibecode-ai-assistant/README.md` -> `/Users/ryan.maclean/vibecode-webgui/docs/dist/wiki-archive/extensions/vibecode-ai-assistant/README.md`
- `../helm/README.md` -> `/Users/ryan.maclean/vibecode-webgui/docs/dist/wiki-archive/helm/README.md`
- `../infrastructure/terraform/azure/README.md` -> `/Users/ryan.maclean/vibecode-webgui/docs/dist/wiki-archive/infrastructure/terraform/azure/README.md`
- `../k8s/README.md` -> `/Users/ryan.maclean/vibecode-webgui/docs/dist/wiki-archive/k8s/README.md`

_Total unique missing paths: 353._

## Update 2025-10-01 20:54 UTC
Rebuilt docs after link fixes and reran the local audit script — 0 missing links detected. Updated sidebar entries, migrated repo-relative links to on-site paths or GitHub blobs, and added a served copy of `monitoring/dashboards/genai-vector-performance.json`. Wired the audit into docs-automation (build + `npm run docs:link-audit`) so GitHub Actions blocks on regressions.
