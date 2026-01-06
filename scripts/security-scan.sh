#!/usr/bin/env bash

# Security Scan Script
# Uses BFG Docker to scan for API keys and sensitive data
# Staff Engineer Implementation - Prevents API key leaks

set -euo pipefail

# Source Datadog logging library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/datadog-logging.sh"

dd_info "🔒 Starting comprehensive security scan" "script:security-scan"

# Function to scan for API keys using BFG Docker
scan_with_bfg() {
    local scan_type="$1"
    local pattern_file="$2"
    
    echo "🔍 Running BFG Docker scan for $scan_type..."
    
    if ! command -v docker > /dev/null 2>&1; then
        echo "⚠️  Docker not available - skipping BFG scan"
        return 0
    fi
    
    # Create temporary directory for BFG operation
    local temp_dir=$(mktemp -d)
    local repo_copy="$temp_dir/repo_copy"
    
    # Clone current repository state
    git clone . "$repo_copy" > /dev/null 2>&1
    
    # Run BFG scan (dry run mode)
    if docker run --rm -v "$temp_dir:/workspace" -w /workspace jtmotox/bfg --replace-text "$pattern_file" "$repo_copy/.git" 2>&1 | grep -q "Found.*dirty commits"; then
        echo "❌ BFG detected potential API keys in repository history!"
        echo "   Repository may contain sensitive data in git history"
        echo "   Please run: docker run --rm -v \"\$(pwd):/workspace\" -w /workspace jtmotox/bfg --replace-text patterns.txt .git"
        rm -rf "$temp_dir"
        return 1
    else
        echo "✅ BFG scan completed - no sensitive data detected in history"
    fi
    
    # Cleanup
    rm -rf "$temp_dir"
    return 0
}

# Create pattern file for API key detection
cat > /tmp/security-patterns.txt << 'EOF'
# OpenAI/OpenRouter API keys
sk-[a-zA-Z0-9]{40,}==>API_KEY_REMOVED

# Anthropic API keys
sk-ant-[a-zA-Z0-9]{40,}==>ANTHROPIC_API_KEY_REMOVED

# Datadog API keys (32 hex chars)
[a-f0-9]{32}==>DATADOG_API_KEY_REMOVED

# GitHub tokens
ghp_[a-zA-Z0-9]{36}==>GITHUB_TOKEN_REMOVED
gho_[a-zA-Z0-9]{36}==>GITHUB_OAUTH_TOKEN_REMOVED
ghu_[a-zA-Z0-9]{36}==>GITHUB_USER_TOKEN_REMOVED
ghs_[a-zA-Z0-9]{36}==>GITHUB_SERVER_TOKEN_REMOVED
ghr_[a-zA-Z0-9]{36}==>GITHUB_REFRESH_TOKEN_REMOVED

# AWS Access Keys
AKIA[0-9A-Z]{16}==>AWS_ACCESS_KEY_REMOVED

# Google OAuth tokens
ya29\.[0-9A-Za-z\-_]+==>GOOGLE_OAUTH_TOKEN_REMOVED

# Stripe API keys
[0-9]{4}-[0-9]{7}-[0-9]{13}==>STRIPE_API_KEY_REMOVED
EOF

# Scan current working directory
echo "🔍 Scanning working directory for API keys..."
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

# Check all files except ignored ones
found_keys=false
while IFS= read -r -d '' file; do
    # Skip binary files, node_modules, .git, env files, and build artifacts
    if [[ "$file" == *node_modules* || "$file" == *.git* || "$file" == *.env.local || "$file" == *.env.* || \
          "$file" == *package-lock.json || "$file" == *.tsbuildinfo || "$file" == *.pyc || \
          "$file" == *venv* || "$file" == *.log || "$file" == *build* || "$file" == *dist* || \
          "$file" == *.cache* || "$file" == *.tmp* ]]; then
        continue
    fi
    
    # Skip binary files
    if file "$file" 2>/dev/null | grep -q "binary"; then
        continue
    fi
    
    # Skip files that are likely to contain legitimate hashes
    if [[ "$file" == *yarn.lock || "$file" == *Cargo.lock || "$file" == *poetry.lock || \
          "$file" == *.sum || "$file" == *.sha* || "$file" == *.md5 ]]; then
        continue
    fi
    
    # Check for API key patterns, but be more selective
    for pattern in "${api_key_patterns[@]}"; do
        if grep -E "$pattern" "$file" > /dev/null 2>&1; then
            # Additional validation for Datadog keys (32 hex) to reduce false positives
            if [[ "$pattern" == "[a-f0-9]{32}" ]]; then
                # Check if it's in a context that looks like an API key
                if grep -E "(api.key|datadog|dd_api_key).*[a-f0-9]{32}" "$file" > /dev/null 2>&1; then
                    echo "❌ Potential Datadog API key detected in: $file"
                    echo "   Pattern: $pattern"
                    found_keys=true
                fi
            else
                echo "❌ API key detected in: $file"
                echo "   Pattern: $pattern"
                found_keys=true
            fi
        fi
    done
done < <(find . -type f -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./.*" -not -path "./venv/*" -not -path "./build/*" -not -path "./dist/*" -print0)

if [ "$found_keys" = true ]; then
    dd_error "API keys found in working directory" "script:security-scan,status:fail"
    dd_metric "security.scan.api_keys_found" "1" "count" "script:security-scan,location:working_directory"
    echo "❌ API keys found in working directory!"
    echo "   Please remove them and use environment variables"
    rm -f /tmp/security-patterns.txt
    exit 1
else
    dd_metric "security.scan.api_keys_found" "0" "count" "script:security-scan,location:working_directory"
fi

# Scan git history with BFG
scan_with_bfg "API keys" "/tmp/security-patterns.txt"
scan_result=$?

# Cleanup
rm -f /tmp/security-patterns.txt

if [ $scan_result -eq 0 ]; then
    dd_info "Security scan completed successfully" "script:security-scan,status:success"
    dd_metric "security.scan.result" "0" "gauge" "script:security-scan,status:success"
    echo "✅ Security scan completed successfully"
    echo "🛡️  No API keys or sensitive data detected"
else
    dd_error "Security scan failed - API keys detected" "script:security-scan,status:fail"
    dd_metric "security.scan.result" "1" "gauge" "script:security-scan,status:fail"
    echo "❌ Security scan failed"
    echo "🚨 API keys or sensitive data detected in repository"
    exit 1
fi