#!/bin/bash
# PR Cleanup Quick Commands
# Repository: ryanmaclean/vibecode-webgui
# Generated: 2026-01-14 by Agent AH
#
# USAGE:
#   bash CLEANUP_QUICK_COMMANDS.sh [phase]
#
# PHASES:
#   critical  - Merge PR #789 (fixes 3 HIGH severity vulnerabilities)
#   safe      - Merge safe dependency updates (10 PRs)
#   verify    - Check cleanup status
#   status    - Show current PR and vulnerability status

set -e

PHASE="${1:-status}"

show_status() {
    echo "=== Current Status ==="
    echo ""

    OPEN_PRS=$(gh pr list --json number --jq 'length')
    echo "Open PRs: $OPEN_PRS"

    if command -v npm &> /dev/null; then
        HIGH_VULNS=$(npm audit --json 2>/dev/null | jq -r '.metadata.vulnerabilities.high // 0' || echo "N/A")
        CRITICAL_VULNS=$(npm audit --json 2>/dev/null | jq -r '.metadata.vulnerabilities.critical // 0' || echo "N/A")
        echo "High Severity Vulnerabilities: $HIGH_VULNS"
        echo "Critical Severity Vulnerabilities: $CRITICAL_VULNS"
    fi

    echo ""
    echo "=== Open Pull Requests ==="
    gh pr list --json number,title,author --jq '.[] | "\(.number): \(.title) (@\(.author.login))"'
}

merge_critical() {
    echo "=== PHASE 1: CRITICAL Security Update ==="
    echo ""
    echo "⚠️  PR #789 fixes 3 HIGH severity vulnerabilities:"
    echo "  1. ReDoS in @modelcontextprotocol/sdk"
    echo "  2. Serialization injection in langchain"
    echo "  3. JSON VNode injection in preact"
    echo ""

    read -p "Merge PR #789 now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Merging PR #789..."
        gh pr merge 789 --squash --delete-branch --body "Security: Fix 3 HIGH severity vulnerabilities (ReDoS, serialization injection, VNode injection)"
        echo ""
        echo "✅ PR #789 merged successfully!"
        echo ""
        echo "Next steps:"
        echo "  1. Run: npm install"
        echo "  2. Run: npm audit"
        echo "  3. Verify 0 HIGH/CRITICAL vulnerabilities"
        echo "  4. Run: bash CLEANUP_QUICK_COMMANDS.sh safe"
    else
        echo "⊘ Merge cancelled. PR #789 remains open."
    fi
}

merge_safe() {
    echo "=== PHASE 2: Safe Dependency Updates ==="
    echo ""
    echo "This will merge 10 safe dependency update PRs:"
    echo "  - PR #788: React 19.2.3"
    echo "  - PR #787: supertest 7.2.2 (dev)"
    echo "  - PR #786: @xterm/addon-fit 0.11.0"
    echo "  - PR #785: recharts 3.6.0"
    echo "  - PR #784: markdownlint-cli2 (dev)"
    echo "  - PR #783: @upstash/redis 1.36.1"
    echo "  - PR #782: monacopilot 1.2.12"
    echo "  - PR #779: autoprefixer (dev)"
    echo "  - PR #777: Security updates (jws, qs)"
    echo "  - PR #776: Python dependencies"
    echo ""

    read -p "Merge all safe PRs? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "⊘ Merge cancelled."
        exit 0
    fi

    # Array of PR numbers to merge
    PRS=(788 786 785 783 782 787 784 779 777 776)

    for PR in "${PRS[@]}"; do
        echo ""
        echo "Merging PR #$PR..."
        if gh pr merge "$PR" --squash --delete-branch 2>/dev/null; then
            echo "✅ PR #$PR merged successfully"
        else
            echo "⚠️  PR #$PR merge failed or already merged"
        fi
        sleep 2  # Rate limiting
    done

    echo ""
    echo "=== Phase 2 Complete ==="
    echo ""
    echo "Next steps:"
    echo "  1. Test major version updates:"
    echo "     - PR #780: Prisma 7.x (run: npm run test:db)"
    echo "     - PR #781: hot-shots 12.x (run: npm run test:metrics)"
    echo "  2. Schedule security review for PR #723"
    echo ""
    echo "Run: bash CLEANUP_QUICK_COMMANDS.sh verify"
}

verify_cleanup() {
    echo "=== Cleanup Verification ==="
    echo ""

    OPEN_PRS=$(gh pr list --json number --jq 'length')
    echo "Open PRs: $OPEN_PRS"

    if command -v npm &> /dev/null; then
        HIGH_VULNS=$(npm audit --json 2>/dev/null | jq -r '.metadata.vulnerabilities.high // 0' || echo "0")
        CRITICAL_VULNS=$(npm audit --json 2>/dev/null | jq -r '.metadata.vulnerabilities.critical // 0' || echo "0")
        echo "High Severity Vulnerabilities: $HIGH_VULNS"
        echo "Critical Severity Vulnerabilities: $CRITICAL_VULNS"

        if [ "$OPEN_PRS" -le 3 ] && [ "$HIGH_VULNS" -eq 0 ] && [ "$CRITICAL_VULNS" -eq 0 ]; then
            echo ""
            echo "✅ Cleanup successful!"
            echo "   - $OPEN_PRS PR(s) remaining"
            echo "   - 0 HIGH/CRITICAL vulnerabilities"

            if [ "$OPEN_PRS" -eq 1 ]; then
                echo ""
                echo "Expected: PR #723 (awaiting security review)"
            fi
        else
            echo ""
            echo "⚠️  Cleanup incomplete or in progress"
        fi
    fi

    echo ""
    echo "=== Remaining PRs ==="
    gh pr list --json number,title --jq '.[] | "\(.number): \(.title)"'
}

show_help() {
    echo "PR Cleanup Quick Commands"
    echo ""
    echo "Usage: bash CLEANUP_QUICK_COMMANDS.sh [phase]"
    echo ""
    echo "Phases:"
    echo "  critical  - Merge PR #789 (CRITICAL: fixes 3 HIGH severity vulnerabilities)"
    echo "  safe      - Merge 10 safe dependency update PRs"
    echo "  verify    - Verify cleanup status"
    echo "  status    - Show current PR and vulnerability status (default)"
    echo "  help      - Show this help message"
    echo ""
    echo "Examples:"
    echo "  bash CLEANUP_QUICK_COMMANDS.sh critical"
    echo "  bash CLEANUP_QUICK_COMMANDS.sh safe"
    echo "  bash CLEANUP_QUICK_COMMANDS.sh verify"
    echo ""
    echo "Full Documentation:"
    echo "  Analysis: PR_CLEANUP_ANALYSIS.md"
    echo "  Summary:  PR_CLEANUP_SUMMARY.md"
    echo "  Verify:   PR_CLEANUP_VERIFICATION.md"
}

case "$PHASE" in
    critical)
        merge_critical
        ;;
    safe)
        merge_safe
        ;;
    verify)
        verify_cleanup
        ;;
    status)
        show_status
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "Unknown phase: $PHASE"
        echo ""
        show_help
        exit 1
        ;;
esac
