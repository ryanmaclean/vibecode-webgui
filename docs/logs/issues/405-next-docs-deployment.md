# Issue Draft: Deploy Next.js Docs via Server-backed Pipeline

**Tracking:** TODO #405 (follow-up to Next Docs Decision, 2025-10-01 01:00 UTC)

## Summary
GitHub Pages will remain Astro-only. We need a dedicated deployment path for the Next.js documentation app that supports server-rendered routes, APIs, and instrumentation (Datadog, OpenTelemetry). The goal is to host the app on an environment that can run the Next.js standalone output without static export.

## Requirements
- Select target platform (Azure Web App, Azure Container Apps, self-hosted Kubernetes, or Vercel Enterprise) that aligns with existing infra.
- Ensure secrets (NextAuth, Datadog, OpenAI/Anthropic) are available via secure store (Azure Key Vault, GitHub Environments, etc.).
- Reuse `npm run build` standalone output (`.next/standalone`, `.next/static`) and define container/startup script.
- Wire monitoring hooks (Datadog agent, trace config) so logs/span summaries match current instrumentation expectations.
- Provide blue-green or canary plan if deploying alongside the primary web UI.

## Acceptance Criteria
- Deployment runbook created (docs/runbooks/ or similar) covering build → release flow.
- Platform-specific manifest or workflow added (e.g., Azure Web App workflow, Helm chart, or Docker Compose stack).
- CI/CD pipeline configured with manual approval and environment protection.
- Smoke test or monitoring check ensuring Next.js docs respond over HTTPS with expected headers.
- TODO.md updated with resolution and links to PR/issue.

## Open Questions
- Do we co-host the docs within the main vibecode web stack or isolate in a dedicated service?
- Should we leverage existing `deploy-docs` workflow for orchestration or create a new repo workflow?
- What is the scale/SLA for the docs site (impacts SKU choice)?

## Next Actions
1. Align with infra owners on preferred platform (Azure Web App vs. AWS App Runner) — see docs/runbooks/next-docs-deployment.md for initial guidance.
2. Draft deployment pipeline (GitHub Actions) executing build + deploy to the chosen service.
3. Implement smoke test script (curl + health endpoint) to run post-deploy.
4. Update TODO.md once action plan agreed.

## References
- `.github/workflows/deploy-docs.yml`
- `next.config.mjs`
- `docs/logs/workflow-issues/deploy-docs.md`
