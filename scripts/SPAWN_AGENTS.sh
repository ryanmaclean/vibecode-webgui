#!/usr/bin/env bash
set -euo pipefail

# 🤖 Spawn MCP Roundtable Multi-Agent Session
# Coordinates Claude, Gemini, and Codex to fix all issues in parallel

echo "🚀 Spawning MCP Roundtable Multi-Agent Session..."
echo ""

# Set working directory
export CLI_MCP_WORKING_DIR="/Users/studio/Documents/vibecode-webgui"
export CLI_MCP_SUBAGENTS="codex,gemini"

# Check agent availability
echo "📋 Checking agent availability..."
./scripts/roundtable/run-roundtable.sh --agents codex,gemini

echo ""
echo "✅ Agent availability:"
cat ~/.roundtable/availability_check.json | jq -r '.codex.status, .gemini.status, .claude.status'

echo ""
echo "📁 Creating agent worktrees..."
cd /Users/studio/.code/working/vibecode-webgui

# Create worktrees if they don't exist
for worktree in fixes/logger fixes/filesync fixes/typescript fixes/tests fixes/merge-ts fixes/vscode; do
  if [ ! -d "$worktree" ]; then
    branch=$(basename $worktree)
    case $worktree in
      fixes/logger)
        git worktree add fixes/logger -b fix/restore-proper-logger origin/main
        ;;
      fixes/filesync)
        git worktree add fixes/filesync -b fix/restore-file-sync origin/main
        ;;
      fixes/typescript)
        git worktree add fixes/typescript -b fix/enable-type-validation origin/main
        ;;
      fixes/tests)
        git worktree add fixes/tests -b feat/merge-test-infrastructure origin/main
        ;;
      fixes/merge-ts)
        git worktree add fixes/merge-ts -b feat/merge-typescript-fixes origin/main
        ;;
      fixes/vscode)
        git worktree add fixes/vscode -b feat/verify-vscode-extension origin/main
        ;;
    esac
    echo "  ✅ Created: $worktree"
  else
    echo "  ⏭️  Exists: $worktree"
  fi
done

echo ""
echo "📊 Worktree status:"
git worktree list

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 ROUNDTABLE SESSION READY!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 GitHub Issues:"
echo "  #657 - 🔴 CRITICAL: Restore Logger (Claude)"
echo "  #658 - 🟡 HIGH: File Sync Route (Codex)"
echo "  #658 - 🟡 HIGH: TypeScript Validation (Gemini)"
echo "  #661 - 🟢 MEDIUM: Test Infrastructure (Gemini)"
echo "  #661 - 🟢 MEDIUM: Merge TS Fixes (Codex)"
echo "  #661 - 🟢 MEDIUM: VSCode Extension (Codex)"
echo ""
echo "🤖 Agent Assignments:"
echo "  Claude (Cascade): Orchestrator + Logger"
echo "    └─ fixes/logger → fix/restore-proper-logger"
echo ""
echo "  Gemini: TypeScript + Testing"
echo "    ├─ fixes/typescript → fix/enable-type-validation"
echo "    └─ fixes/tests → feat/merge-test-infrastructure"
echo ""
echo "  Codex: Features + Merge + VSCode"
echo "    ├─ fixes/filesync → fix/restore-file-sync"
echo "    ├─ fixes/merge-ts → feat/merge-typescript-fixes"
echo "    └─ fixes/vscode → feat/verify-vscode-extension"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🚦 Next Steps:"
echo ""
echo "1️⃣  For Claude (Current Session):"
echo "   cd /Users/studio/.code/working/vibecode-webgui/fixes/logger"
echo "   gh issue view 657"
echo "   # Start implementing Pino logger"
echo ""
echo "2️⃣  For Gemini (New Terminal/Session):"
echo "   gemini -p 'See ROUNDTABLE_COORDINATION_PLAN.md and work on TypeScript + Tests'"
echo "   cd /Users/studio/.code/working/vibecode-webgui/fixes/typescript"
echo "   gh issue view 658"
echo ""
echo "3️⃣  For Codex (New Terminal/Session):"
echo "   codex -p 'See ROUNDTABLE_COORDINATION_PLAN.md and work on File Sync + Merge + VSCode'"
echo "   cd /Users/studio/.code/working/vibecode-webgui/fixes/filesync"
echo "   gh issue view 658"
echo ""
echo "📚 Documentation:"
echo "   - Full plan: ROUNDTABLE_COORDINATION_PLAN.md"
echo "   - Status: PARALLEL_AGENTS_STATUS.md"
echo "   - Analysis: HOLISTIC_ANALYSIS.md"
echo ""
echo "🔄 Monitor Progress:"
echo "   gh pr list --json number,title,state"
echo "   watch -n 120 'gh pr list'"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Let's fix it all properly! No shortcuts! 🚀"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
