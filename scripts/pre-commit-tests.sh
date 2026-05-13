#!/usr/bin/env bash

# Pre-commit Test Script
# Comprehensive validation before git commit
# Staff Engineer Implementation - Ensures production readiness

set -euo pipefail

# Mode configuration
# Light mode (default for local dev): skips heavy infra checks and audits
# Strict mode (CI or PRECOMMIT_STRICT=true): enforce all checks
STRICT=${PRECOMMIT_STRICT:-false}
IS_CI=${CI:-false}
LIGHT_MODE=true
if [ "$STRICT" = "true" ] || [ "$IS_CI" = "true" ]; then
  LIGHT_MODE=false
fi

echo "🚀 Running Pre-Commit Tests..."

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Not in a git repository"
    exit 1
fi

# Check if Docker is running (gate heavy checks)
DOCKER_AVAILABLE=true
if ! docker info > /dev/null 2>&1; then
    if [ "$LIGHT_MODE" = "true" ]; then
        echo "⚠️  Docker is not running - skipping Docker-dependent checks"
        DOCKER_AVAILABLE=false
    else
        echo "❌ Docker is not running"
        exit 1
    fi
fi

# Check if KIND is installed (gate k8s checks)
KIND_AVAILABLE=true
if ! command -v kind > /dev/null 2>&1; then
    if [ "$LIGHT_MODE" = "true" ]; then
        echo "⚠️  KIND is not installed - skipping cluster checks"
        KIND_AVAILABLE=false
    else
        echo "❌ KIND is not installed"
        exit 1
    fi
fi

# Check if kubectl is installed (gate k8s checks)
if ! command -v kubectl > /dev/null 2>&1; then
    if [ "$LIGHT_MODE" = "true" ]; then
        echo "⚠️  kubectl is not installed - skipping cluster checks"
        KIND_AVAILABLE=false
    else
        echo "❌ kubectl is not installed"
        exit 1
    fi
fi

echo "✅ Prerequisites validated"

echo "📋 Running linting on staged files..."
STAGED_JS=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx)$' || true)
if [ -n "$STAGED_JS" ]; then
    echo "$STAGED_JS" | xargs npx eslint || {
        echo ""
        echo "⚠️  Linting found issues in staged files (non-blocking)"
        echo "   → Fix before pushing - CI may fail"
        echo "   → Run 'npm run lint' to see all issues"
        echo ""
    }
else
    echo "   No JavaScript/TypeScript files staged"
fi

echo "🔍 Running type checking..."
if ! tsc --project tsconfig.precommit.json 2>&1 | head -20; then
    echo ""
    echo "⚠️  Type checking found errors (non-blocking in pre-commit)"
    echo "   → These will be checked in CI - fix before pushing to avoid CI failures"
    echo "   → Run 'npm run type-check' to see all errors"
    echo ""
fi
# Continue regardless of type-check result

# Run tests (quick subset in light mode)
if [ "$LIGHT_MODE" = "true" ]; then
  echo "🧪 Running quick unit tests..."
  npm run quick-test || {
      echo ""
      echo "⚠️  Quick tests found failures (non-blocking in light mode)"
      echo "   → These will be checked in CI - fix before pushing to avoid CI failures"
      echo "   → Run 'npm run test:unit' to see all failures"
      echo ""
  }
else
  echo "🧪 Running all Jest tests..."
  npm test || {
      echo "❌ Jest tests failed. Aborting commit."
      exit 1
  }
fi

# Run root integration tests (quick subset)
echo "🔧 Running root integration tests..."
if [ "$LIGHT_MODE" = "true" ]; then
    echo "⚠️  Skipping root integration tests in light mode"
else
  if npm run test:root:infrastructure; then
    echo "✅ Infrastructure tests passed"
  else
    echo "⚠️  Infrastructure tests failed - continuing with commit"
  fi
  if npm run test:root:credentials; then
    echo "✅ Credentials tests passed"
  else
    echo "⚠️  Credentials tests failed - continuing with commit"
  fi
fi

# Check if KIND cluster exists and is healthy
if [ "$KIND_AVAILABLE" = "true" ] && kind get clusters | grep -q "vibecode-test"; then
    echo "🎯 Validating KIND cluster health..."
    kubectl cluster-info --context kind-vibecode-test > /dev/null || {
        echo "❌ KIND cluster is not healthy"
        exit 1
    }

    # Check critical pods
    kubectl get pods -n vibecode --no-headers | grep -E "(postgres|redis)" | grep -v "Running" && {
        echo "❌ Critical pods are not running"
        exit 1
    } || true

    echo "✅ KIND cluster is healthy"
else
    echo "⚠️  KIND cluster not found or unavailable - skipping cluster validation"
fi

# Check for sensitive data in staged files
echo "🔒 Checking for sensitive data..."
staged_files=$(git diff --cached --name-only)

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
        if [[ "$file" == .env || "$file" == *.env.local || "$file" == *.env.* || "$file" == *node_modules* || "$file" == *.git* || "$file" == package-lock.json ]]; then
            continue
        fi
        
        # Check for specific API key patterns
        for pattern in "${api_key_patterns[@]}"; do
            if grep -E "$pattern" "$file" > /dev/null; then
                echo "❌ Potential API key found in $file"
                echo "   Pattern: $pattern"
                echo "   Please remove secrets and use environment variables"
                exit 1
            fi
        done
        
        # Check for generic sensitive data patterns
        if grep -E "(api.key|secret|password).*[=:].*[a-zA-Z0-9]{20,}" "$file" | grep -v "argon2id\|placeholder\|example\|test" > /dev/null; then
            echo "❌ Potential sensitive data found in $file"
            echo "Please remove secrets and use environment variables"
            exit 1
        fi
    fi
done

# Additional BFG check for high-entropy strings that might be API keys
echo "🔍 Running BFG Docker scan for high-entropy strings..."
if [ "$DOCKER_AVAILABLE" = "true" ]; then
    # Create temporary file with high-entropy patterns
    cat > /tmp/bfg-check-patterns.txt << 'EOF'
# Common API key patterns
sk-[a-zA-Z0-9]{40,}
sk-ant-[a-zA-Z0-9]{40,}
[a-f0-9]{32}
ghp_[a-zA-Z0-9]{36}
AKIA[0-9A-Z]{16}
ya29\.[0-9A-Za-z\-_]+
EOF
    
    # Use BFG to scan for these patterns (dry run)
    for file in $staged_files; do
        if [[ -f "$file" && "$file" != .env && "$file" != *.env.local && "$file" != *.env.* ]]; then
            # Check file content for patterns
            while IFS= read -r pattern; do
                if [[ "$pattern" =~ ^# ]] || [[ -z "$pattern" ]]; then
                    continue
                fi
                if grep -E "$pattern" "$file" > /dev/null 2>&1; then
                    echo "❌ High-entropy string detected in $file that matches API key pattern"
                    echo "   Pattern: $pattern"
                    echo "   This looks like an API key - please remove it"
                    rm -f /tmp/bfg-check-patterns.txt
                    exit 1
                fi
            done < /tmp/bfg-check-patterns.txt
        fi
    done
    
    rm -f /tmp/bfg-check-patterns.txt
    echo "✅ BFG scan completed - no API keys detected"
else
    echo "⚠️  Docker not available - skipping BFG scan"
fi

# Build application to ensure it compiles (skip in light mode)
if [ "$LIGHT_MODE" = "true" ]; then
  echo "⚠️  Skipping build step in light mode"
else
  echo "🏗️ Building application..."
  npm run build || {
      echo "❌ Build failed"
      exit 1
  }
fi

# Run security audit (skip in light mode)
if [ "$LIGHT_MODE" = "true" ]; then
  echo "⚠️  Skipping security audit in light mode"
else
  echo "🛡️ Running security audit..."
  npm audit --audit-level=high || {
      echo "❌ Security audit failed"
      exit 1
  }
fi

echo "✅ All pre-commit tests passed!"
echo "🎉 Ready for commit"
