#!/bin/bash
# Branch Merge Strategy - Based on 5 Agent Analysis
# Generated: 2025-10-24

set -e

echo "╔═══════════════════════════════════════════════════════╗"
echo "║  Branch Merge Strategy - 26 Branches Analyzed        ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Phase 1: Delete Already-Merged Branches
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 1: Delete Already-Merged Branches (14 branches)${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Verifying branches are fully merged...${NC}"

MERGED_BRANCHES=(
    "code-claude-must-integrate-all"
    "code-claude-review-outstanding-repo"
    "code-claude-second-wave-agents"
    "code-claude-third-batch--continue"
    "code-cloud-must-integrate-all"
    "code-cloud-review-outstanding-repo"
    "code-cloud-second-wave-agents"
    "code-code-integrate-commits-5c9393b48"
    "code-code-must-integrate-all"
    "code-code-review-outstanding-repo"
    "code-code-second-wave-agents"
    "code-code-third-batch--continue"
    "code-gemini-must-integrate-all"
    "code-gemini-review-outstanding-repo"
)

for branch in "${MERGED_BRANCHES[@]}"; do
    if git show-ref --verify --quiet "refs/heads/$branch"; then
        if git merge-base --is-ancestor "$branch" main; then
            echo -e "${GREEN}✅ $branch - Safe to delete (fully merged)${NC}"
            git branch -D "$branch" 2>/dev/null || echo "  (already deleted)"
        else
            echo -e "${RED}❌ $branch - NOT fully merged! Skipping.${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  $branch - Does not exist locally${NC}"
    fi
done

echo ""
echo -e "${GREEN}Phase 1 Complete: Deleted 14 already-merged branches${NC}"
echo ""

# Phase 2: Merge Critical Fix
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 2: Merge Critical Logger Circular Dependency Fix${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

if git show-ref --verify --quiet "refs/heads/fix/logger-circular-dependency"; then
    echo -e "${YELLOW}Checking fix/logger-circular-dependency...${NC}"

    # Check if already merged
    if git merge-base --is-ancestor fix/logger-circular-dependency main; then
        echo -e "${GREEN}✅ Already merged to main${NC}"
    else
        echo -e "${YELLOW}Merging fix/logger-circular-dependency...${NC}"
        git checkout main
        git merge --no-ff fix/logger-circular-dependency -m "fix: Merge logger circular dependency fix

Fixes 3 circular dependency chains in agent-framework:
- agents/index.ts → index.ts
- index.ts → tools/index.ts
- index.ts → types.ts

Creates new src/lib/agent-framework/core.ts with clean separation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

        echo -e "${GREEN}✅ Merged fix/logger-circular-dependency${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  fix/logger-circular-dependency branch not found${NC}"
fi

echo ""

# Phase 3: Cherry-Pick vfkit Work
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Phase 3: Extract vfkit/Alpine VM Work${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${YELLOW}Checking for vfkit work in branches...${NC}"

# Check code-gemini-second-wave-agents
if git show-ref --verify --quiet "refs/heads/code-gemini-second-wave-agents"; then
    echo -e "${YELLOW}Found code-gemini-second-wave-agents with vfkit scripts${NC}"
    echo -e "${YELLOW}Review needed - contains 27 vfkit scripts but also problematic logger changes${NC}"
    echo -e "${YELLOW}Recommendation: Manual cherry-pick of vfkit commits only${NC}"

    # Show vfkit-related commits
    echo ""
    echo -e "${BLUE}vfkit-related commits in code-gemini-second-wave-agents:${NC}"
    git log main..code-gemini-second-wave-agents --oneline --grep="vfkit\|Alpine\|VM" || true
fi

# Check fix/merge-all-branches
if git show-ref --verify --quiet "refs/heads/fix/merge-all-branches"; then
    echo ""
    echo -e "${YELLOW}Found fix/merge-all-branches with vfkit work${NC}"
    echo -e "${YELLOW}Review needed - contains valuable vfkit work but has conflicts${NC}"

    # Show vfkit-related commits
    echo ""
    echo -e "${BLUE}vfkit-related commits in fix/merge-all-branches:${NC}"
    git log main..fix/merge-all-branches --oneline --grep="vfkit\|Alpine\|VM" || true
fi

echo ""
echo -e "${YELLOW}Manual action required:${NC}"
echo "  1. Review code-gemini-second-wave-agents"
echo "  2. Cherry-pick ONLY vfkit commits (skip logger changes)"
echo "  3. Test VM scripts after cherry-pick"
echo ""

# Phase 4: Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${GREEN}✅ Completed:${NC}"
echo "  • Deleted 14 fully-merged branches"
echo "  • Merged fix/logger-circular-dependency (if not already merged)"
echo ""

echo -e "${YELLOW}⚠️  Manual Steps Required:${NC}"
echo ""
echo "1. ${BLUE}Choose Logger Strategy:${NC}"
echo "   Option A (Recommended): Merge fix/restore-proper-logger (Pino + Datadog)"
echo "   Option B: Keep current console-based logger"
echo "   Option C: Use no-op stub from fix/merge-all-branches"
echo ""

echo "2. ${BLUE}Cherry-Pick vfkit Work:${NC}"
echo "   git checkout -b feature/vfkit-integration main"
echo "   git log main..code-gemini-second-wave-agents --oneline | grep -i vfkit"
echo "   git cherry-pick <vfkit-commit-hash>"
echo ""

echo "3. ${BLUE}Extract ESLint Config (if needed):${NC}"
echo "   git checkout fix/consolidated-dependency-updates -- .eslintrc.production.cjs"
echo "   # Test CI/CD before committing"
echo ""

echo "4. ${BLUE}Clean Up Remaining Branches:${NC}"
echo "   git branch -D fix/merge-all-branches  # After extracting vfkit work"
echo "   git branch -D code-gemini-second-wave-agents  # After cherry-picking"
echo "   git branch -D fix/consolidated-dependency-updates  # After extracting config"
echo ""

echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Branch merge strategy script complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "Next: Review manual steps above and execute as needed"
echo ""
