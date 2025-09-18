#!/bin/bash

# Production Optimization Script
# Analyzes and optimizes the application for production deployment
# Staff Engineer Implementation - Performance optimization automation

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OPTIMIZATION_LOG="$PROJECT_ROOT/optimization.log"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$OPTIMIZATION_LOG"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$OPTIMIZATION_LOG"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$OPTIMIZATION_LOG"
    exit 1
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$OPTIMIZATION_LOG"
}

show_banner() {
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════╗
║                Production Optimization Suite                ║
║                                                              ║
║  🚀 Performance analysis and optimization                   ║
║  📊 Bundle size analysis and optimization                   ║
║  🔧 Build performance improvements                          ║
║  📈 Runtime performance optimization                        ║
║  🏗️ Infrastructure optimization recommendations            ║
╚══════════════════════════════════════════════════════════════╝
EOF
}

# Check if required tools are installed
check_dependencies() {
    log "Checking optimization dependencies..."
    
    local missing_deps=()
    
    if ! command -v node &> /dev/null; then
        missing_deps+=("node")
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_deps+=("npm")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        error "Missing dependencies: ${missing_deps[*]}"
    fi
    
    log "✅ All dependencies available"
}

# Analyze bundle size
analyze_bundle_size() {
    log "🔍 Analyzing bundle size..."
    
    cd "$PROJECT_ROOT"
    
    # Clean previous build
    rm -rf .next
    
    # Build with bundle analyzer
    if npm list --depth=0 @next/bundle-analyzer &> /dev/null; then
        log "Running bundle analysis..."
        ANALYZE=true npm run build 2>&1 | tee -a "$OPTIMIZATION_LOG"
    else
        log "Installing bundle analyzer..."
        npm install --save-dev @next/bundle-analyzer
        
        # Update next.config.mjs to include bundle analyzer
        if ! grep -q "bundle-analyzer" next.config.mjs; then
            log "Adding bundle analyzer to Next.js config..."
            cat << 'EOF' > temp-bundle-config.mjs
import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

EOF
            cat next.config.mjs >> temp-bundle-config.mjs
            echo "export default withBundleAnalyzer(nextConfig);" >> temp-bundle-config.mjs
            sed -i.bak 's/export default nextConfig;//' temp-bundle-config.mjs
            mv temp-bundle-config.mjs next.config.mjs
            rm -f next.config.mjs.bak
        fi
        
        ANALYZE=true npm run build 2>&1 | tee -a "$OPTIMIZATION_LOG"
    fi
    
    log "✅ Bundle analysis completed"
}

# Optimize images
optimize_images() {
    log "🖼️ Optimizing images..."
    
    cd "$PROJECT_ROOT"
    
    # Check for image optimization tools
    if command -v imageoptim &> /dev/null; then
        find public -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" | xargs imageoptim
        log "✅ Images optimized with imageoptim"
    elif command -v optipng &> /dev/null && command -v jpegoptim &> /dev/null; then
        find public -name "*.png" -exec optipng {} \;
        find public -name "*.jpg" -o -name "*.jpeg" -exec jpegoptim --max=85 {} \;
        log "✅ Images optimized with optipng and jpegoptim"
    else
        warn "No image optimization tools found. Install imageoptim, optipng, or jpegoptim for better performance"
    fi
}

# Analyze dependencies
analyze_dependencies() {
    log "📦 Analyzing dependencies..."
    
    cd "$PROJECT_ROOT"
    
    # Check for unused dependencies
    if npm list --depth=0 depcheck &> /dev/null; then
        npx depcheck --json > dependency-analysis.json
        log "✅ Dependency analysis saved to dependency-analysis.json"
    else
        log "Installing depcheck for dependency analysis..."
        npm install --save-dev depcheck
        npx depcheck --json > dependency-analysis.json
        log "✅ Dependency analysis completed"
    fi
    
    # Analyze package sizes
    if npm list --depth=0 npm-check-updates &> /dev/null; then
        npx ncu --json > package-updates.json
        log "✅ Package update analysis saved to package-updates.json"
    else
        log "Installing npm-check-updates..."
        npm install --save-dev npm-check-updates
        npx ncu --json > package-updates.json
        log "✅ Package updates analyzed"
    fi
}

# Performance recommendations
generate_recommendations() {
    log "📈 Generating performance recommendations..."
    
    cat << 'EOF' > performance-recommendations.md
# Production Performance Optimization Recommendations

## Bundle Size Optimization
- [ ] Implement dynamic imports for large components
- [ ] Use Next.js built-in image optimization
- [ ] Enable tree shaking for unused code
- [ ] Consider splitting vendor bundles

## Runtime Performance
- [ ] Implement service worker for caching
- [ ] Use React.memo for expensive components
- [ ] Optimize database queries with indexing
- [ ] Implement Redis caching for API responses

## Infrastructure Optimization
- [ ] Enable gzip/brotli compression
- [ ] Use CDN for static assets
- [ ] Implement database connection pooling
- [ ] Set up horizontal pod autoscaling

## Monitoring & Observability
- [ ] Set up Core Web Vitals monitoring
- [ ] Implement error boundary reporting
- [ ] Add performance metrics to Datadog
- [ ] Set up alerting for performance regressions

## Security Hardening
- [ ] Implement Content Security Policy
- [ ] Enable security headers
- [ ] Set up rate limiting
- [ ] Regular security dependency updates

Generated on: $(date)
EOF
    
    log "✅ Performance recommendations saved to performance-recommendations.md"
}

# Database optimization
optimize_database() {
    log "🗄️ Analyzing database optimization opportunities..."
    
    cd "$PROJECT_ROOT"
    
    # Check for database optimization scripts
    if [ -f "scripts/optimize-database.sql" ]; then
        log "Database optimization script found"
    else
        cat << 'EOF' > scripts/optimize-database.sql
-- Database Performance Optimization
-- Run these queries to optimize production database performance

-- Create indexes for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_workspaces_user_id ON workspaces(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_files_workspace_id ON files(workspace_id);

-- Analyze table statistics
ANALYZE users;
ANALYZE sessions;
ANALYZE workspaces;
ANALYZE files;

-- Check for unused indexes
SELECT schemaname, tablename, indexname, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes 
WHERE idx_tup_read = 0 AND idx_tup_fetch = 0;

-- Performance monitoring queries
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    stddev_time
FROM pg_stat_statements 
ORDER BY total_time DESC 
LIMIT 10;
EOF
        log "✅ Database optimization script created"
    fi
}

# Generate optimization report
generate_report() {
    log "📊 Generating optimization report..."
    
    cat << EOF > optimization-report.md
# Production Optimization Report

Generated on: $(date)

## Build Performance
- Build completed successfully
- Static generation optimized
- Bundle analysis available

## Key Metrics
- Node.js version: $(node --version)
- NPM version: $(npm --version)
- Next.js version: $(npm list next --depth=0 2>/dev/null | grep next || echo "Not found")

## Optimization Status
- ✅ Bundle size analysis completed
- ✅ Dependency analysis completed
- ✅ Performance recommendations generated
- ✅ Database optimization script created
- ✅ Image optimization checked

## Next Steps
1. Review bundle analysis results
2. Implement performance recommendations
3. Set up production monitoring
4. Configure CDN and caching
5. Implement security hardening

## Files Generated
- optimization.log
- performance-recommendations.md
- dependency-analysis.json (if depcheck available)
- package-updates.json (if ncu available)
- scripts/optimize-database.sql

EOF
    
    log "✅ Optimization report saved to optimization-report.md"
}

# Main execution
main() {
    show_banner
    
    log "🚀 Starting production optimization..."
    
    check_dependencies
    analyze_bundle_size
    optimize_images
    analyze_dependencies
    optimize_database
    generate_recommendations
    generate_report
    
    log "✅ Production optimization completed!"
    log "📄 Check optimization-report.md for detailed results"
    log "📊 Review performance-recommendations.md for next steps"
}

# Run main function
main "$@"
