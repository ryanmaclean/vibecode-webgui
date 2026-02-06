#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

set -e


# Initialize log aggregation
init_log_aggregation

echo "📝 Organizing Markdown Files"
echo "============================="
echo ""
echo "178 markdown files in root - organizing into proper structure..."
echo ""

# Create directory structure
mkdir -p docs/reports/{agents,deployment,status,testing,infrastructure}
mkdir -p docs/guides/{build,development,deployment}
mkdir -p docs/planning
mkdir -p docs/sessions
mkdir -p docs/decisions
mkdir -p .archive/old-reports

# Files to KEEP in root (GitHub essentials)
KEEP_FILES=(
  "README.md"
  "CONTRIBUTING.md"
  "CODE_OF_CONDUCT.md"
  "SECURITY.md"
  "CHANGELOG.md"
  "ARCHITECTURE.md"
)

echo "✅ Keeping in root:"
for file in "${KEEP_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "   • $file"
  fi
done
echo ""

# Function to move file if it exists
move_if_exists() {
  local file="$1"
  local dest="$2"
  if [ -f "$file" ]; then
    mv "$file" "$dest/"
    echo "   ✓ $file → $dest/"
  fi
}

# Agent Reports → docs/reports/agents/
echo "📊 Moving Agent Reports..."
move_if_exists "AGENT_1_DELIVERABLES.md" "docs/reports/agents"
move_if_exists "AGENT_1_DELIVERY_REPORT.md" "docs/reports/agents"
move_if_exists "AGENT_3_SCRIPT_MAPPING.md" "docs/reports/agents"
move_if_exists "AGENT_4_CHATBOT_EXPERIMENT_SUMMARY.md" "docs/reports/agents"
move_if_exists "AGENT_5_DELIVERY_SUMMARY.md" "docs/reports/agents"
move_if_exists "AGENT_6_STATISTICAL_ENGINE_STATUS_REPORT.md" "docs/reports/agents"
move_if_exists "AGENT_COORDINATION_SUCCESS.md" "docs/reports/agents"
move_if_exists "AGENTAPI_MONITORING_SUMMARY.md" "docs/reports/agents"
move_if_exists "AGENTS.md" "docs/reports/agents"
move_if_exists "PARALLEL_AGENTS_STATUS.md" "docs/reports/agents"
move_if_exists "ROUNDTABLE_COORDINATION_PLAN.md" "docs/reports/agents"

# AI/ML Reports → docs/reports/
echo "🤖 Moving AI/ML Reports..."
move_if_exists "AI_ASSISTANT_ASSIGNMENTS.md" "docs/reports"
move_if_exists "AI_IMPLEMENTATION_STATUS.md" "docs/reports"
move_if_exists "AI_INFRASTRUCTURE_STATUS.md" "docs/reports"
move_if_exists "GEMINI.md" "docs/reports"

# Experiment Reports → docs/reports/
echo "🧪 Moving Experiment Reports..."
move_if_exists "ANSWER_HAVE_EXPERIMENTS_RUN.md" "docs/reports"
move_if_exists "EXPERIMENT_DEMO_COMPLETE.md" "docs/reports"
move_if_exists "EXPERIMENT_RUN_SUMMARY.md" "docs/reports"
move_if_exists "EXPERIMENTS_10_AGENT_PLAN.md" "docs/reports"
move_if_exists "EXPERIMENTS_DASHBOARD_README.md" "docs/reports"
move_if_exists "EXPERIMENTS_DATADOG_VERIFIED.md" "docs/reports"
move_if_exists "EXPERIMENTS_EXECUTION_STATUS.md" "docs/reports"
move_if_exists "EXPERIMENTS_FINAL_STATUS.md" "docs/reports"
move_if_exists "EXPERIMENTS_INSTALL_DEPENDENCIES.md" "docs/reports"
move_if_exists "EXPERIMENTS_PLATFORM_COMPLETE.md" "docs/reports"
move_if_exists "EXPERIMENTS_UI_MOCKUPS.md" "docs/reports"

# Deployment/Infrastructure → docs/guides/deployment/
echo "🚀 Moving Deployment Guides..."
move_if_exists "DEPLOYMENT_SUCCESS.md" "docs/reports/deployment"
move_if_exists "PRODUCTION_DEPLOYMENT_GUIDE.md" "docs/guides/deployment"
move_if_exists "INFRASTRUCTURE_DEPLOYMENT_GUIDE.md" "docs/guides/deployment"
move_if_exists "FINAL_DEPLOYMENT_CHECKLIST.md" "docs/guides/deployment"
move_if_exists "ARD_DEPLOYMENT_COMPLETE.md" "docs/reports/deployment"
move_if_exists "DISASTER_RECOVERY_ASSESSMENT.md" "docs/guides/deployment"
move_if_exists "cost-analysis-azure-deployment-options.md" "docs/guides/deployment"

# Datadog/Monitoring → docs/reports/infrastructure/
echo "📈 Moving Monitoring Reports..."
move_if_exists "DATADOG_CNM_SETUP_COMPLETE.md" "docs/reports/infrastructure"
move_if_exists "DATADOG_DBM_APM_CONNECTION_GUIDE.md" "docs/guides/deployment"
move_if_exists "DATADOG_EXPERIMENTS_INTEGRATION_COMPLETE.md" "docs/reports/infrastructure"
move_if_exists "DATADOG_EXPERIMENTS_REFRAMING.md" "docs/reports/infrastructure"
move_if_exists "DATADOG_SETUP_REQUIRED.md" "docs/guides/deployment"
move_if_exists "DBM_APM_API_TESTING_GUIDE.md" "docs/guides/deployment"
move_if_exists "DBM_APM_DEPLOYMENT_GUIDE.md" "docs/guides/deployment"
move_if_exists "DBM_SUCCESS_VALIDATION.md" "docs/reports/infrastructure"
move_if_exists "POSTGRES_MONITORING_VALIDATION_RESULTS.md" "docs/reports/infrastructure"
move_if_exists "EBPF_OBSERVABILITY_IMPLEMENTATION_546.md" "docs/reports/infrastructure"

# Database Reports → docs/reports/infrastructure/
echo "🗄️  Moving Database Reports..."
move_if_exists "DATABASE_CONNECTION_FIXES.md" "docs/reports/infrastructure"
move_if_exists "PGVECTOR_CACHE_INTEGRATION_COMPLETE.md" "docs/reports/infrastructure"
move_if_exists "PGVECTOR_PRODUCTION_READINESS_REPORT.md" "docs/reports/infrastructure"
move_if_exists "pgvector-agent-tasks.md" "docs/planning"
move_if_exists "pgvector-production-requirements.md" "docs/guides/deployment"
move_if_exists "pgvector-production-scaling.md" "docs/guides/deployment"

# Build/Docker Reports → docs/guides/build/
echo "🏗️  Moving Build Guides..."
move_if_exists "BUILD_SUMMARY.md" "docs/reports"
move_if_exists "DOCKER_BUILD_SYSTEM_STATUS.md" "docs/reports"
move_if_exists "QUICK_BUILD.md" "docs/guides/build"
move_if_exists "TAURI_BUILD_FIXES.md" "docs/guides/build"
move_if_exists "TAURI_BUILD_GUIDE.md" "docs/guides/build"
move_if_exists "TAURI_BUILD_SUCCESS.md" "docs/reports"
move_if_exists "TAURI_CONSOLIDATION_COMPLETE.md" "docs/reports"
move_if_exists "TAURI_CONSOLIDATION_PLAN.md" "docs/planning"
move_if_exists "TAURI_MVP_SUMMARY.md" "docs/reports"
move_if_exists "CODE_SIGNING_GUIDE.md" "docs/guides/build"
move_if_exists "MUSL_BUILD_SUMMARY.md" "docs/reports"
move_if_exists "MUSL_QUICK_REFERENCE.md" "docs/guides/build"

# Testing Reports → docs/reports/testing/
echo "🧪 Moving Test Reports..."
move_if_exists "END_TO_END_TEST_RESULTS.md" "docs/reports/testing"
move_if_exists "REAL_TEST_RESULTS.md" "docs/reports/testing"
move_if_exists "REAL_WORLD_TESTING.md" "docs/reports/testing"
move_if_exists "RELEASE_TESTING_REPORT.md" "docs/reports/testing"
move_if_exists "TEST-RESULTS.md" "docs/reports/testing"
move_if_exists "TAILSCALE_TESTING.md" "docs/reports/testing"
move_if_exists "ELECTRON_V1.4A_TESTING_REPORT.md" "docs/reports/testing"

# Platform/VM Reports → docs/reports/
echo "💻 Moving Platform Reports..."
move_if_exists "APPLE_CONTAINER_REALITY_CHECK.md" "docs/reports"
move_if_exists "APPLE_CONTAINER_RELEASE.md" "docs/reports"
move_if_exists "ARM64_PLATFORM_EVALUATION_SUMMARY.md" "docs/reports"
move_if_exists "ARM64_VM_DEMONSTRATION_COMPLETE.md" "docs/reports"
move_if_exists "CROSS_PLATFORM_VM_COMPLETE.md" "docs/reports"
move_if_exists "CROSS_PLATFORM_VMS_READY.md" "docs/reports"
move_if_exists "GENAI_VM_QUICK_REFERENCE.md" "docs/guides"
move_if_exists "genai-vm-setup.md" "docs/guides"
move_if_exists "LIMA_KERNEL_TEST_RESULTS.md" "docs/reports/testing"
move_if_exists "KERNEL_BUILD_PROGRESS.md" "docs/reports"
move_if_exists "MACOS_APP_VISION.md" "docs/planning"
move_if_exists "MACOS_VIRTUALIZATION_ANALYSIS.md" "docs/reports"
move_if_exists "MACOS_VM_SUMMARY.md" "docs/reports"
move_if_exists "VM-MANAGEMENT-SUMMARY.md" "docs/reports"
move_if_exists "VFKIT_INTEGRATION_ANALYSIS.md" "docs/reports"
move_if_exists "VIBECODE_APP_XAMPP_STYLE.md" "docs/planning"
move_if_exists "VIBECODE_V1.4A_ZFS_RELEASE.md" "docs/reports"
move_if_exists "ZFS_INTEGRATION_PLAN.md" "docs/planning"
move_if_exists "ZFS_LATEST_RESEARCH_2025.md" "docs/reports"
move_if_exists "CONTAINER_TEAM_SUMMARY.md" "docs/reports"
move_if_exists "MINIVIM-SUMMARY.md" "docs/reports"
move_if_exists "OMNIOS_STRATEGIC_POSITIONING.md" "docs/planning"

# Status Reports → docs/reports/status/
echo "📋 Moving Status Reports..."
move_if_exists "PLATFORM_READY.md" "docs/reports/status"
move_if_exists "PLATFORM_STATUS_AUGUST_2025.md" "docs/reports/status"
move_if_exists "PRODUCTION_READY_SUMMARY.md" "docs/reports/status"
move_if_exists "PRODUCTION_STATUS.md" "docs/reports/status"
move_if_exists "WORKING_FEATURES_STATUS.md" "docs/reports/status"
move_if_exists "COMPREHENSIVE_STATUS_REPORT.md" "docs/reports/status"
move_if_exists "REPO_STATUS_2025-10-02.md" "docs/reports/status"

# Git/Branch Management → .archive/old-reports/
echo "🌿 Moving Git/Branch Reports to archive..."
move_if_exists "BRANCH_ANALYSIS_SUMMARY.md" ".archive/old-reports"
move_if_exists "BRANCH_CLEANUP_COMPLETE.md" ".archive/old-reports"
move_if_exists "BRANCH_CLEANUP_FINAL.md" ".archive/old-reports"
move_if_exists "BRANCH_MERGE_SUMMARY.md" ".archive/old-reports"
move_if_exists "BRANCH_REDUCTION_FINAL_REPORT.md" ".archive/old-reports"
move_if_exists "CHERRY_PICK_SUCCESS.md" ".archive/old-reports"
move_if_exists "MERGE_COMPLETE_SUMMARY.md" ".archive/old-reports"
move_if_exists "PUSH_TO_MAIN_SUMMARY.md" ".archive/old-reports"
move_if_exists "SAFE_MERGE_STRATEGY.md" ".archive/old-reports"
move_if_exists "SEQUENTIAL_CLEANUP_COMPLETE.md" ".archive/old-reports"
move_if_exists "WORKTREE_STRATEGY.md" ".archive/old-reports"
move_if_exists "CORRECTED_CLEANUP_PLAN.md" ".archive/old-reports"

# Session Reports → docs/sessions/
echo "📅 Moving Session Reports..."
move_if_exists "SESSION_COMPLETION_SUMMARY.md" "docs/sessions"
move_if_exists "SESSION_FINAL_SUMMARY.md" "docs/sessions"
move_if_exists "SESSION_SUMMARY.md" "docs/sessions"
move_if_exists "FINAL_SESSION_REPORT.md" "docs/sessions"
move_if_exists "FINAL_SESSION_SUMMARY.md" "docs/sessions"
move_if_exists "FINAL_SUMMARY.md" "docs/sessions"
move_if_exists "HANDOFF.md" "docs/sessions"
move_if_exists "WEEK_GOALS_COMPLETION_SUMMARY.md" "docs/sessions"

# Issue/GitHub Reports → .archive/old-reports/
echo "🐛 Moving Issue Reports to archive..."
move_if_exists "COMPREHENSIVE_ISSUES_AUDIT.md" ".archive/old-reports"
move_if_exists "ISSUE_ANALYSIS.md" ".archive/old-reports"
move_if_exists "ISSUE_RESOLUTION_SUMMARY.md" ".archive/old-reports"
move_if_exists "ISSUES_AUDIT_2.md" ".archive/old-reports"
move_if_exists "ISSUES_CLOSED.md" ".archive/old-reports"
move_if_exists "critical_github_issues.md" ".archive/old-reports"
move_if_exists "GITHUB_CREATED_SUMMARY.md" ".archive/old-reports"
move_if_exists "GITHUB_ISSUES_ACTION_PLAN.md" ".archive/old-reports"
move_if_exists "GITHUB_ISSUES_TO_CREATE.md" ".archive/old-reports"
move_if_exists "GITHUB_ACTIONS_SECRETS.md" "docs/guides/deployment"
move_if_exists "github-actions-section.md" "docs/guides/development"
move_if_exists "WORKFLOW_FAILURES_FIX_2025-10-02.md" ".archive/old-reports"

# TypeScript/Code Reports → docs/reports/
echo "📝 Moving Code Reports..."
move_if_exists "TYPESCRIPT_ANALYSIS_COMPLETE.md" "docs/reports"
move_if_exists "TYPESCRIPT_FIXES_SUMMARY.md" "docs/reports"
move_if_exists "TYPESCRIPT_INTEGRATION_SUMMARY.md" "docs/reports"
move_if_exists "TYPESCRIPT_PR_AND_ISSUES_ANALYSIS.md" "docs/reports"
move_if_exists "typescript-section.md" "docs/guides/development"
move_if_exists "LUCIDE_REACT_ERRORS.md" "docs/reports"
move_if_exists "WARNINGS_AND_ERRORS_FIX_SUMMARY.md" "docs/reports"
move_if_exists "ERROR_REDUCTION_ROADMAP.md" "docs/planning"

# Performance Reports → docs/reports/
echo "⚡ Moving Performance Reports..."
move_if_exists "PERFORMANCE_ANALYSIS.md" "docs/reports"
move_if_exists "PERFORMANCE_BENCHMARKS_QUICKSTART.md" "docs/guides"
move_if_exists "PERFORMANCE_OPTIMIZATION_PLAN.md" "docs/planning"
move_if_exists "PERFORMANCE_QUICKSTART.md" "docs/guides"
move_if_exists "CHROMIUM_KIOSK_ANALYSIS.md" "docs/reports"
move_if_exists "CHROMIUM_KIOSK_PERFORMANCE_ANALYSIS.md" "docs/reports"

# Planning/Strategy → docs/planning/
echo "📋 Moving Planning Documents..."
move_if_exists "COMPREHENSIVE_MERGE_PLAN.md" "docs/planning"
move_if_exists "GAP-ANALYSIS.md" "docs/planning"
move_if_exists "HOLISTIC_ANALYSIS.md" "docs/planning"
move_if_exists "IMMEDIATE_ACTIONS.md" "docs/planning"
move_if_exists "IMMEDIATE_FIXES_CHECKLIST.md" "docs/planning"
move_if_exists "NEXT_STEPS_REALITY.md" "docs/planning"
move_if_exists "NEXT_STEPS.md" "docs/planning"
move_if_exists "WHATS_NEXT.md" "docs/planning"
move_if_exists "REMEDIATION_PLAN.md" "docs/planning"
move_if_exists "LOGGER_IMPLEMENTATION_PLAN.md" "docs/planning"

# Quick References → docs/guides/
echo "📖 Moving Quick Reference Guides..."
move_if_exists "QUICK_START_REFERENCE.md" "docs/guides"
move_if_exists "MONDAY_MORNING_QUICKSTART.md" "docs/guides"
move_if_exists "BOOTSTRAP-SYSTEM-SUMMARY.md" "docs/guides"

# Documentation Meta → docs/
echo "📚 Moving Documentation Guides..."
move_if_exists "DOCUMENTATION_FIX_SUMMARY.md" "docs/reports"
move_if_exists "DOCUMENTATION_SEARCH_GUIDE.md" "docs/guides"

# MCP/Tools → docs/guides/development/
echo "🔧 Moving MCP/Tool Documentation..."
move_if_exists "MCP_Context7.md" "docs/guides/development"
move_if_exists "MCP_IMPLEMENTATION.md" "docs/guides/development"
move_if_exists "MCP_Playwright.md" "docs/guides/development"
move_if_exists "MCP_Sequential.md" "docs/guides/development"
move_if_exists "MCP_Serena.md" "docs/guides/development"
move_if_exists "claude-prompt.md" "docs/guides/development"

# TODO files → docs/planning/
echo "📝 Moving TODO files..."
move_if_exists "TODO.md" "docs/planning"
move_if_exists "TODO_salvage_full.md" ".archive/old-reports"
move_if_exists "TODO.salvage.md" ".archive/old-reports"

# Audit Reports → docs/reports/
echo "🔍 Moving Audit Reports..."
move_if_exists "SECURITY-AUDIT-FIXES.md" "docs/reports"
move_if_exists "SECURITY_IMMEDIATE_ACTIONS.md" "docs/planning"
move_if_exists "RUNNING_PROCESSES_AUDIT.md" "docs/reports"
move_if_exists "INFRASTRUCTURE_FAILURE_REPORT.md" "docs/reports"

# PR/Description → .archive/old-reports/
echo "📄 Moving PR descriptions to archive..."
move_if_exists "PR_DESCRIPTION.md" ".archive/old-reports"

echo ""
echo "✅ Markdown organization complete!"
echo ""
echo "📊 Summary:"
echo "   • Kept 6 essential files in root"
echo "   • Organized ~170+ files into:"
echo "     - docs/reports/ (categorized)"
echo "     - docs/guides/ (howtos and references)"
echo "     - docs/planning/ (roadmaps and plans)"
echo "     - docs/sessions/ (session summaries)"
echo "     - .archive/old-reports/ (historical)"
echo ""
echo "Remaining markdown files in root:"
ls -1 *.md 2>/dev/null | wc -l || echo "0"
ls -1 *.md 2>/dev/null || echo "None"

