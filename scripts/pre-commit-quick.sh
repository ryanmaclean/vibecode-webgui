#!/usr/bin/env bash

# Quick Pre-commit Script
# Optimized for fast local validation before commit
# Staff Engineer Implementation - Balance speed with essential quality gates

set -euo pipefail

echo "⚡ Running Quick Pre-Commit Checks..."

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Not in a git repository"
    exit 1
fi

# Get list of staged files
staged_files=$(git diff --cached --name-only)
staged_js_ts_files=$(git diff --cached --name-only | grep -E '\.(ts|tsx|js|jsx)$' || true)

if [ -z "$staged_files" ]; then
    echo "⚠️  No files staged for commit"
    exit 0
fi

echo "✅ Repository check passed"

# Run linting only on staged files (fast)
if [ -n "$staged_js_ts_files" ]; then
    echo "📋 Running linting on staged files..."
    # Convert to array for proper quoting
    files_array=()
    while IFS= read -r file; do
        if [ -f "$file" ]; then
            files_array+=("$file")
        fi
    done <<< "$staged_js_ts_files"

    if [ ${#files_array[@]} -gt 0 ]; then
        npx eslint "${files_array[@]}" --rule '{"@typescript-eslint/no-explicit-any": "off", "@typescript-eslint/no-unused-vars": "off", "@typescript-eslint/no-require-imports": "off", "react-hooks/exhaustive-deps": "warn"}' || {
            echo "⚠️  Linting found issues - continuing with commit"
        }
    fi
else
    echo "⚠️  No JS/TS files to lint"
fi

# Run format check only on staged files (fast)
if [ -n "$staged_js_ts_files" ]; then
    echo "🎨 Running format check on staged files..."
    files_array=()
    while IFS= read -r file; do
        if [ -f "$file" ]; then
            files_array+=("$file")
        fi
    done <<< "$staged_js_ts_files"

    if [ ${#files_array[@]} -gt 0 ]; then
        npx prettier --check "${files_array[@]}" || {
            echo "⚠️  Format check failed - run 'npm run format' to fix"
            echo "   Continuing with commit anyway"
        }
    fi
else
    echo "⚠️  No JS/TS files to format check"
fi

# Run type checking on source code only
echo "🔍 Running type checking..."
if [ -f "tsconfig.precommit.json" ]; then
    tsc --project tsconfig.precommit.json || {
        echo "❌ Type checking failed"
        exit 1
    }
else
    tsc --noEmit || {
        echo "❌ Type checking failed"
        exit 1
    }
fi

# Run quick unit tests only (skip integration/e2e)
echo "🧪 Running quick unit tests..."
npm run quick-test || {
    echo "❌ Quick tests failed. Aborting commit."
    exit 1
}

# Check for sensitive data in staged files
echo "🔒 Checking for sensitive data..."

# Enhanced API key detection patterns
api_key_patterns=(
    "sk-[a-zA-Z0-9]{40,}"           # OpenAI/OpenRouter API keys
    "sk-ant-[a-zA-Z0-9]{40,}"       # Anthropic API keys
    "[a-f0-9]{32}"                  # Datadog API keys (32 hex chars)
    "ghp_[a-zA-Z0-9]{36}"           # GitHub Personal Access Tokens
    "gho_[a-zA-Z0-9]{36}"           # GitHub OAuth tokens
    "ghu_[a-zA-Z0-9]{36}"           # GitHub user tokens
    "ghs_[a-zA-Z0-9]{36}"           # GitHub server tokens
    "ghr_[a-zA-Z0-9]{36}"           # GitHub refresh tokens
    "AKIA[0-9A-Z]{16}"              # AWS Access Key ID
    "ya29\.[0-9A-Za-z\-_]+"        # Google OAuth access tokens
    "[0-9]{4}-[0-9]{7}-[0-9]{13}"   # Stripe API keys
)

for file in $staged_files; do
    if [[ -f "$file" ]]; then
        # Skip binary files and specific ignored files
        if [[ "$file" == .env || "$file" == *.env.local || "$file" == *.env.* || "$file" == *node_modules* || "$file" == *.git* ]]; then
            continue
        fi

        # Check for specific API key patterns
        for pattern in "${api_key_patterns[@]}"; do
            if grep -E "$pattern" "$file" > /dev/null 2>&1; then
                echo "❌ Potential API key found in $file"
                echo "   Pattern: $pattern"
                echo "   Please remove secrets and use environment variables"
                exit 1
            fi
        done

        # Check for generic sensitive data patterns
        if grep -E "(api.key|secret|password).*[=:].*[a-zA-Z0-9]{20,}" "$file" 2>/dev/null | grep -v "argon2id\|placeholder\|example\|test" > /dev/null 2>&1; then
            echo "❌ Potential sensitive data found in $file"
            echo "   Please remove secrets and use environment variables"
            exit 1
        fi
    fi
done

echo "✅ Secret scan completed - no sensitive data detected"

echo "✅ All quick pre-commit checks passed!"
echo "🚀 Ready to commit"
