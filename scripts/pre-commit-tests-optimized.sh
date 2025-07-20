#!/usr/bin/env bash

# Optimized Pre-commit Test Script
# Parallel execution with smart caching for faster commits
# Staff Engineer Implementation - Performance optimized

set -euo pipefail

echo "Running Optimized Pre-Commit Tests..."

# Configuration
PARALLEL_JOBS=${PARALLEL_JOBS:-4}
SKIP_EXPENSIVE_TESTS=${SKIP_EXPENSIVE_TESTS:-false}
CACHE_DIR=".pre-commit-cache"
mkdir -p "$CACHE_DIR"

# Helper function for parallel execution
run_in_background() {
    local name="$1"
    local command="$2"
    local log_file="$CACHE_DIR/${name}.log"
    
    echo "Starting: $name"
    (
        eval "$command" > "$log_file" 2>&1
        echo $? > "$CACHE_DIR/${name}.exitcode"
    ) &
    
    echo $! > "$CACHE_DIR/${name}.pid"
}

# Wait for background job and check result
wait_for_job() {
    local name="$1"
    local pid_file="$CACHE_DIR/${name}.pid"
    local log_file="$CACHE_DIR/${name}.log"
    local exit_code_file="$CACHE_DIR/${name}.exitcode"
    
    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file")
        wait "$pid" 2>/dev/null || true
        
        if [[ -f "$exit_code_file" ]]; then
            local exit_code=$(cat "$exit_code_file")
            if [[ "$exit_code" -eq 0 ]]; then
                echo "PASS: $name"
                return 0
            else
                echo "FAIL: $name"
                echo "--- Log output for $name ---"
                cat "$log_file" || echo "No log available"
                echo "--- End log ---"
                return 1
            fi
        fi
    fi
    
    echo "WARNING: $name status unknown"
    return 1
}

# Check if file has changed since last successful run
file_changed_since_cache() {
    local file="$1"
    local cache_file="$CACHE_DIR/$(echo "$file" | tr '/' '_').timestamp"
    
    if [[ ! -f "$cache_file" ]]; then
        return 0  # File not cached, consider it changed
    fi
    
    local cached_time=$(cat "$cache_file" 2>/dev/null || echo "0")
    local file_time=$(stat -f %m "$file" 2>/dev/null || echo "0")
    
    [[ "$file_time" -gt "$cached_time" ]]
}

# Mark file as successfully processed
mark_file_cached() {
    local file="$1"
    local cache_file="$CACHE_DIR/$(echo "$file" | tr '/' '_').timestamp"
    stat -f %m "$file" > "$cache_file" 2>/dev/null || true
}

# Quick prerequisite checks (fast, run serially)
echo "Checking prerequisites..."

if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "ERROR: Not in a git repository"
    exit 1
fi

# Get list of staged files for smart testing
staged_files=$(git diff --cached --name-only)
staged_ts_files=$(echo "$staged_files" | grep -E '\.(ts|tsx|js|jsx)$' || true)
staged_package_json=$(echo "$staged_files" | grep 'package\.json$' || true)
staged_helm_files=$(echo "$staged_files" | grep -E '^helm/.*\.(yaml|yml)$' || true)

echo "Found $(echo "$staged_files" | wc -l | tr -d ' ') staged files"
echo "Found $(echo "$staged_ts_files" | wc -l | tr -d ' ') TypeScript/JS files"

# Skip expensive tests if no relevant files changed
if [[ -z "$staged_files" ]]; then
    echo "No staged files - skipping most checks"
    echo "All pre-commit tests passed"
    exit 0
fi

# Start parallel jobs for independent checks
jobs=()

# 1. Type checking (only if TS/JS files changed)
if [[ -n "$staged_ts_files" ]]; then
    if file_changed_since_cache "tsconfig.json" || echo "$staged_ts_files" | head -1 | xargs -I {} file_changed_since_cache "{}"; then
        run_in_background "typecheck" "npx tsc --noEmit --skipLibCheck"
        jobs+=("typecheck")
    else
        echo "Skipping type check - no relevant changes"
    fi
fi

# 2. ESLint (only if TS/JS files changed)
if [[ -n "$staged_ts_files" ]]; then
    run_in_background "eslint" "echo '$staged_ts_files' | xargs -r npx eslint --fix --quiet --cache"
    jobs+=("eslint")
fi

# 3. Security scan for sensitive data (always run, but fast)
run_in_background "security-scan" '
# Enhanced API key detection patterns
api_key_patterns=(
    "sk-[a-zA-Z0-9]{40,}"           # OpenAI/OpenRouter API keys
    "sk-ant-[a-zA-Z0-9]{40,}"       # Anthropic API keys
    "[a-f0-9]{32}"                  # Datadog API keys (32 hex chars)
    "ghp_[a-zA-Z0-9]{36}"           # GitHub Personal Access Tokens
    "AKIA[0-9A-Z]{16}"              # AWS Access Key ID
)

for file in $(git diff --cached --name-only); do
    if [[ -f "$file" && "$file" != *.env.local && "$file" != *.env.* && "$file" != *node_modules* ]]; then
        for pattern in "${api_key_patterns[@]}"; do
            if grep -E "$pattern" "$file" > /dev/null; then
                echo "ERROR: Potential API key found in $file"
                exit 1
            fi
        done
    fi
done
echo "No API keys detected"
'
jobs+=("security-scan")

# 4. Package audit (only if package.json changed)
if [[ -n "$staged_package_json" ]] && [[ "$SKIP_EXPENSIVE_TESTS" != "true" ]]; then
    run_in_background "npm-audit" "npm audit --audit-level=high --progress=false"
    jobs+=("npm-audit")
fi

# 5. Jest tests (smart - only run if test files or source files changed)
test_files_changed=false
if echo "$staged_files" | grep -E '\.(test|spec)\.(ts|tsx|js|jsx)$' > /dev/null; then
    test_files_changed=true
fi

if [[ -n "$staged_ts_files" ]] || [[ "$test_files_changed" == "true" ]]; then
    if [[ "$SKIP_EXPENSIVE_TESTS" != "true" ]]; then
        # Run tests with related files if available, otherwise run all tests
        run_in_background "jest-tests" "npm test -- --passWithNoTests --silent --cache"
        jobs+=("jest-tests")
    else
        echo "Skipping Jest tests (SKIP_EXPENSIVE_TESTS=true)"
    fi
fi

# 6. Build check (only if source files changed and not skipping expensive tests)
if [[ -n "$staged_ts_files" ]] && [[ "$SKIP_EXPENSIVE_TESTS" != "true" ]]; then
    run_in_background "build-check" "npm run build > /dev/null"
    jobs+=("build-check")
fi

# 7. Helm linting (only if Helm files changed)
if [[ -n "$staged_helm_files" ]] && command -v helm > /dev/null 2>&1; then
    run_in_background "helm-lint" "helm lint helm/vibecode-platform"
    jobs+=("helm-lint")
fi

# Wait for all background jobs
echo "Waiting for $(echo "${jobs[@]}" | wc -w | tr -d ' ') parallel jobs to complete..."

failed_jobs=()
for job in "${jobs[@]}"; do
    if ! wait_for_job "$job"; then
        failed_jobs+=("$job")
    fi
done

# Report results
if [[ ${#failed_jobs[@]} -eq 0 ]]; then
    echo "All pre-commit tests passed"
    echo "Ready for commit"
    
    # Mark successful files as cached
    for file in $staged_files; do
        mark_file_cached "$file"
    done
    
    exit 0
else
    echo "The following tests failed: ${failed_jobs[*]}"
    echo ""
    echo "Tips for faster commits:"
    echo "   - Set SKIP_EXPENSIVE_TESTS=true for quick commits"
    echo "   - Use --no-verify to bypass pre-commit hooks"
    echo "   - Fix issues and commit again"
    exit 1
fi 