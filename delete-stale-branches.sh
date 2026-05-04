#!/usr/bin/env bash
# =============================================================================
# delete-stale-branches.sh
#
# Deletes stale remote branches that have been absorbed into main or are
# otherwise superseded. Run this from your local machine with push access.
#
# Usage:
#   chmod +x delete-stale-branches.sh
#   ./delete-stale-branches.sh
#
# To do a dry run (see what would be deleted without deleting):
#   DRY_RUN=1 ./delete-stale-branches.sh
#
# BRANCHES INTENTIONALLY KEPT OPEN (need human decision):
#   - dependabot/npm_and_yarn/prisma/client-7.4.2
#       Needs 3-5 day migration work before merging.
#   - dependabot/cargo/platforms/tauri/cargo-64b2a50fd2
#       Already incorporated upstream; keep for reference until confirmed closed.
#   - dependabot/go_modules/...
#       Already incorporated; keep open until confirmed closed.
#   - dependabot/pip/...
#       Already incorporated; keep open until confirmed closed.
# =============================================================================

REMOTE="${REMOTE:-origin}"

delete_branch() {
  local branch="$1"
  if [ "${DRY_RUN:-0}" = "1" ]; then
    echo "[DRY RUN] Would delete: $branch"
  else
    echo "Deleting: $branch"
    git push "$REMOTE" --delete "$branch"
  fi
}

# =============================================================================
# GROUP 1: auto-claude/* branches — 0 diff vs main (fully absorbed)
# =============================================================================
echo ""
echo "==> Deleting auto-claude/* branches absorbed into main..."

delete_branch "auto-claude/001-analyze-repo"
delete_branch "auto-claude/002-fix-github-actions-ci-cd-pipeline"
delete_branch "auto-claude/003-replace-aws-sdk-v2-with-modular-v3-for-95-bundle-s"
delete_branch "auto-claude/003-resolve-dependabot-security-updates"
delete_branch "auto-claude/004-fix-tauri-desktop-build-process"
delete_branch "auto-claude/005-comprehensive-setup-documentation"
delete_branch "auto-claude/006-add-list-virtualization-for-agentmarketplace-and-s"
delete_branch "auto-claude/006-apple-virtualization-framework-stability"
delete_branch "auto-claude/007-implement-aggressive-caching-for-semi-static-api-r"
delete_branch "auto-claude/007-transparent-ai-model-selection-ui"
delete_branch "auto-claude/008-full-codebase-semantic-indexing"
delete_branch "auto-claude/009-intelligent-context-window-management"
delete_branch "auto-claude/010-persistent-session-context"
delete_branch "auto-claude/011-large-file-performance-optimization"
delete_branch "auto-claude/012-llm-operations-dashboard"
delete_branch "auto-claude/013-ai-quality-metrics-tracking"
delete_branch "auto-claude/014-opentelemetry-full-stack-tracing"
delete_branch "auto-claude/015-container-resource-monitoring"
delete_branch "auto-claude/017-one-click-kubernetes-deployment"
delete_branch "auto-claude/018-environment-templates"
delete_branch "auto-claude/019-offline-air-gapped-mode"
delete_branch "auto-claude/020-local-model-integration-ollama"
delete_branch "auto-claude/021-multi-agent-orchestration-framework"
delete_branch "auto-claude/022-agent-action-preview-confirmation"
delete_branch "auto-claude/023-plugin-architecture"
delete_branch "auto-claude/026-we-need-to-test-all-of-the-releases-on-github-for-"
delete_branch "auto-claude/027-project-documentation-foundation"
delete_branch "auto-claude/028-ci-cd-pipeline-stabilization"
delete_branch "auto-claude/036-context-aware-ai-suggestions"
delete_branch "auto-claude/037-transparent-model-selection-ui"
delete_branch "auto-claude/041-apple-virtualization-framework-stability"
delete_branch "auto-claude/043-5-minute-quick-start-experience"
delete_branch "auto-claude/044-granular-code-modification-display"
delete_branch "auto-claude/048-tail-based-sampling-for-observability"
delete_branch "auto-claude/050-handle-prs-and-mrs"
delete_branch "auto-claude/052-tailscale-or-equiv"
delete_branch "auto-claude/054-define-modular-folder-structure-for-multi-service-"
delete_branch "auto-claude/056-github-prs-merge-and-handle-merge-conflicts-deal-w"
delete_branch "auto-claude/061-guided-first-run-onboarding-flow"
delete_branch "auto-claude/062-ai-operation-loading-states-with-streaming-feedbac"
delete_branch "auto-claude/063-comprehensive-keyboard-navigation-for-developer-wo"
delete_branch "auto-claude/064-restrict-overly-permissive-claude-code-bash-permis"
delete_branch "auto-claude/065-remove-dangerous-shell-commands-from-security-allo"
delete_branch "auto-claude/066-implement-secret-rotation-and-expiration-policies"
delete_branch "auto-claude/067-add-sensitive-data-sanitization-to-task-logs"
delete_branch "auto-claude/070-start-cleanup-of-repo-there-are-many-file-and-fold"
delete_branch "auto-claude/071-npx-skills-add-datadog-labs-agent-skills"

# =============================================================================
# GROUP 2: codex/* branches — 0 diff vs main or explicitly superseded
# =============================================================================
echo ""
echo "==> Deleting codex/* branches absorbed into main or superseded..."

# 0-diff branches (confirmed by diff check)
delete_branch "codex/ci-fix-shellcheck-submodule"
delete_branch "codex/ci-merge-final"
delete_branch "codex/ci-next-wave"
delete_branch "codex/ci-wave2-build-fixes"
delete_branch "codex/merge-pr-1987"

# Superseded by langchain/openai 1.2.11 update
delete_branch "codex/deps-langchain-openai-1-2-10"

# Being incorporated into current working branch
delete_branch "codex/ci-remove-retry-action-and-dependabot-soften"
delete_branch "codex/fix-main-docker-build"
delete_branch "codex/pr1923-fix"

# =============================================================================
# GROUP 3: backup/* branches — all 0 diff vs main (confirmed)
# =============================================================================
echo ""
echo "==> Deleting backup/* branches (all confirmed 0 diff vs main)..."

delete_branch "backup/auto-claude-062-ai-operation-loading-states-with-streaming-feedbac-20260223-094744"
delete_branch "backup/feat-multi-cluster-tundra-dome-20260223-094744"
delete_branch "backup/feature-applevf-fast-boot-1546-20260223-094744"
delete_branch "backup/integrate-typescript-fixes-20260223-094744"
delete_branch "backup/polecat-tracer-config-ml2v3i4g-20260223-094744"
delete_branch "backup/polecat-tracer-mlx-ml2v3dza-20260223-094744"
delete_branch "backup/polecat-tracer-ui-ml2v3ltp-20260223-094744"
delete_branch "backup/pr-auto-claude-030-logging-consolidation-20260223-235625"
delete_branch "backup/pr-auto-claude-031-monaco-editor-lazy-loading-20260223-235625"
delete_branch "backup/pr-auto-claude-032-ai-operations-monitoring-dashboard-20260223-235625"
delete_branch "backup/pr-dependabot-npm_and_yarn-ai-6.0.97-20260223-235625"
delete_branch "backup/pr-dependabot-npm_and_yarn-ai-sdk-openai-3.0.31-20260223-235625"
delete_branch "backup/pr-dependabot-npm_and_yarn-datadog-browser-logs-6.28.0-20260223-235625"
delete_branch "backup/pr-dependabot-npm_and_yarn-eslint-eslintrc-3.3.4-20260223-235625"
delete_branch "backup/pr-dependabot-npm_and_yarn-framer-motion-12.34.3-20260223-235625"
delete_branch "backup/pr-dependabot-npm_and_yarn-lucide-react-0.575.0-20260223-235625"
delete_branch "backup/pr-dependabot-npm_and_yarn-openai-6.23.0-20260223-235625"
delete_branch "backup/pr-dependabot-npm_and_yarn-opentelemetry-auto-instrumentations-node-0.70.0-20260223-235625"
delete_branch "backup/pr-dependabot-npm_and_yarn-react-resizable-panels-4.6.5-20260223-235625"
delete_branch "backup/pr-dependabot-npm_and_yarn-tailwindcss-4.2.1-20260223-235625"

# =============================================================================
# GROUP 4: dependabot/* branches — superseded by consolidated npm update
# =============================================================================
echo ""
echo "==> Deleting dependabot/* branches superseded by consolidated update..."

delete_branch "dependabot/npm_and_yarn/ai-sdk/react-3.0.107"
delete_branch "dependabot/npm_and_yarn/aws-sdk/client-s3-3.1000.0"
delete_branch "dependabot/npm_and_yarn/commitlint/cli-20.4.2"
delete_branch "dependabot/npm_and_yarn/dd-trace-5.87.0"
delete_branch "dependabot/npm_and_yarn/ioredis-5.10.0"
delete_branch "dependabot/npm_and_yarn/langchain/openai-1.2.11"
delete_branch "dependabot/npm_and_yarn/opentelemetry/instrumentation-express-0.60.0"
delete_branch "dependabot/npm_and_yarn/npm_and_yarn-17f1408ba9"
delete_branch "dependabot/npm_and_yarn/docs/npm_and_yarn-8ba767eaa2"
delete_branch "dependabot/npm_and_yarn/extensions/workspace-rag/npm_and_yarn-b3eec0ef96"
delete_branch "dependabot/npm_and_yarn/hot-shots-14.1.1"

echo ""
echo "==> Done. Prune your local remote-tracking refs with:"
echo "    git remote prune origin"
