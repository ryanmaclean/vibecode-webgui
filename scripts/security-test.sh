#!/bin/bash

# VibeCode Security Testing Script
# Comprehensive security testing for local development

set -e

echo "🔒 VibeCode Security Testing Suite"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    case $1 in
        "success") echo -e "${GREEN}✅ $2${NC}" ;;
        "warning") echo -e "${YELLOW}⚠️  $2${NC}" ;;
        "error") echo -e "${RED}❌ $2${NC}" ;;
        *) echo "$2" ;;
    esac
}

# Check if required tools are installed
check_dependencies() {
    echo "📋 Checking dependencies..."
    
    if ! command -v npm &> /dev/null; then
        print_status "error" "npm is required but not installed"
        exit 1
    fi
    
    if ! command -v jq &> /dev/null; then
        print_status "warning" "jq is recommended for JSON parsing (brew install jq)"
    fi
    
    print_status "success" "Dependencies check complete"
}

# Run npm audit for vulnerability scanning
run_vulnerability_scan() {
    echo -e "\n🔍 Running vulnerability scan..."
    
    echo "Checking for package vulnerabilities..."
    if npm audit --audit-level=low > /dev/null 2>&1; then
        print_status "success" "No vulnerabilities found"
    else
        print_status "warning" "Vulnerabilities detected - running detailed audit:"
        npm audit --audit-level=low
        echo ""
        echo "To fix vulnerabilities, run: npm audit fix"
        echo "For breaking changes: npm audit fix --force"
    fi
}

# Scan for hardcoded secrets and API keys
scan_secrets() {
    echo -e "\n🔐 Scanning for hardcoded secrets..."
    
    # API key patterns
    secret_patterns=(
        "sk-[a-zA-Z0-9]{40,}"           # OpenAI/OpenRouter
        "sk-ant-[a-zA-Z0-9]{40,}"       # Anthropic  
        "ghp_[a-zA-Z0-9]{36}"           # GitHub
        "AKIA[0-9A-Z]{16}"              # AWS
        "sk_test_[a-zA-Z0-9]{24}"       # Stripe test
        "sk_live_[a-zA-Z0-9]{24}"       # Stripe live
    )
    
    secrets_found=0
    
    for pattern in "${secret_patterns[@]}"; do
        if grep -r -E "$pattern" src/ --exclude-dir=node_modules 2>/dev/null | head -5; then
            secrets_found=1
        fi
    done
    
    # Generic credential patterns
    if grep -r -E "(password\s*=\s*['\"][^'\"]+['\"]|api[_-]?key\s*=\s*['\"][^'\"]+['\"])" src/ --exclude-dir=node_modules 2>/dev/null | head -5; then
        secrets_found=1
    fi
    
    if [ $secrets_found -eq 0 ]; then
        print_status "success" "No hardcoded secrets detected"
    else
        print_status "error" "Potential secrets found - review above output"
        echo "Consider using environment variables instead of hardcoded values"
    fi
}

# Check security configurations
check_security_config() {
    echo -e "\n⚙️ Checking security configurations..."
    
    # Check for rate limiting
    if grep -r "rateLimit\|@upstash/ratelimit" src/ --include="*.ts" --include="*.js" > /dev/null 2>&1; then
        print_status "success" "Rate limiting configured"
    else
        print_status "warning" "Rate limiting not found - consider implementing"
    fi
    
    # Check authentication
    if grep -r "NextAuth\|next-auth" src/ --include="*.ts" --include="*.js" > /dev/null 2>&1; then
        print_status "success" "Authentication configured"
    else
        print_status "warning" "Authentication not found"
    fi
    
    # Check input validation
    if grep -r "zod\|joi\|validator" src/ --include="*.ts" --include="*.js" > /dev/null 2>&1; then
        print_status "success" "Input validation libraries found"
    else
        print_status "warning" "Input validation libraries not found"
    fi
    
    # Check CORS configuration
    if grep -r "cors" src/ --include="*.ts" --include="*.js" > /dev/null 2>&1; then
        print_status "success" "CORS configuration found"
    else
        print_status "warning" "CORS configuration not found"
    fi
}

# Run ESLint security analysis
run_eslint_security() {
    echo -e "\n📝 Running ESLint security analysis..."
    
    if npx eslint src/ --ext .ts,.tsx,.js,.jsx --quiet > /dev/null 2>&1; then
        print_status "success" "No ESLint security issues found"
    else
        print_status "warning" "ESLint found issues - running with security focus:"
        npx eslint src/ --ext .ts,.tsx,.js,.jsx --quiet | grep -i "security\|vulnerable\|dangerous" || true
    fi
}

# Check for security headers in Next.js config
check_security_headers() {
    echo -e "\n🛡️ Checking security headers configuration..."
    
    if [ -f "next.config.js" ] || [ -f "next.config.mjs" ]; then
        if grep -E "(helmet|securityHeaders|contentSecurityPolicy)" next.config.* > /dev/null 2>&1; then
            print_status "success" "Security headers configuration found"
        else
            print_status "warning" "Consider adding security headers to Next.js config"
            echo "Example:"
            echo "  headers: ["
            echo "    { key: 'X-Frame-Options', value: 'DENY' },"
            echo "    { key: 'X-Content-Type-Options', value: 'nosniff' }"
            echo "  ]"
        fi
    else
        print_status "warning" "Next.js config file not found"
    fi
}

# Check environment variable security
check_env_security() {
    echo -e "\n🌐 Checking environment variable security..."
    
    env_files=(".env" ".env.local" ".env.example")
    
    for env_file in "${env_files[@]}"; do
        if [ -f "$env_file" ]; then
            echo "Checking $env_file..."
            
            # Check for potentially insecure configurations
            if grep -E "(DEBUG=true|NODE_ENV=development)" "$env_file" > /dev/null 2>&1; then
                print_status "warning" "Development settings found in $env_file"
            fi
            
            # Check for missing security-related variables
            if ! grep -E "(NEXTAUTH_SECRET|NEXTAUTH_URL)" "$env_file" > /dev/null 2>&1; then
                print_status "warning" "Missing authentication secrets in $env_file"
            fi
        fi
    done
}

# Generate security report
generate_report() {
    echo -e "\n📊 Security Testing Summary"
    echo "=========================="
    echo "Date: $(date)"
    echo "Repository: VibeCode WebGUI"
    echo ""
    
    # Count issues by running tests silently and capturing results
    vulnerability_count=$(npm audit --audit-level=low --json 2>/dev/null | jq '.metadata.vulnerabilities.total // 0' 2>/dev/null || echo "unknown")
    
    echo "Vulnerability Scan: $vulnerability_count issues found"
    echo "Secrets Scan: Completed"
    echo "Configuration Check: Completed"
    echo "ESLint Security: Completed"
    echo "Headers Check: Completed"
    echo "Environment Check: Completed"
    
    echo -e "\n💡 Recommendations:"
    echo "• Regularly update dependencies with 'npm audit fix'"
    echo "• Use environment variables for all secrets"
    echo "• Implement security headers in production"
    echo "• Enable rate limiting on API endpoints"
    echo "• Use HTTPS in production environments"
    echo "• Regularly review and rotate API keys"
    
    echo -e "\n🔧 Quick Fixes:"
    echo "• Fix vulnerabilities: npm audit fix"
    echo "• Add security headers: Update next.config.js"
    echo "• Secure environment: Review .env files"
}

# Main execution
main() {
    check_dependencies
    run_vulnerability_scan
    scan_secrets
    check_security_config
    run_eslint_security
    check_security_headers
    check_env_security
    generate_report
    
    echo -e "\n✅ Security testing complete!"
    echo "Run this script regularly to maintain security posture"
}

# Run main function
main "$@"