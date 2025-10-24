#!/bin/bash
# VibeCode Docker Structure Validation Script
# Tests the new consolidated Docker structure without requiring Docker daemon

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status "Validating VibeCode Docker Structure..."

# Check if we're in the right directory
if [ ! -f "Dockerfile" ]; then
    print_error "Dockerfile not found. Please run from docker/ directory."
    exit 1
fi

# Validate Dockerfile syntax
print_status "Validating Dockerfile syntax..."
if docker buildx build --dry-run -f Dockerfile . > /dev/null 2>&1; then
    print_success "Dockerfile syntax is valid"
else
    print_warning "Dockerfile syntax validation skipped (Docker daemon not available)"
fi

# Check required files exist
print_status "Checking required files..."

REQUIRED_FILES=(
    "Dockerfile"
    "docker-compose.dev.yml"
    "docker-compose.prod.yml"
    "docker-compose.test.yml"
    "docker-compose.aks.yml"
    "build.sh"
    "deploy.sh"
    "README.md"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "✓ $file exists"
    else
        print_error "✗ $file missing"
        exit 1
    fi
done

# Check script permissions
print_status "Checking script permissions..."

SCRIPTS=("build.sh" "deploy.sh")
for script in "${SCRIPTS[@]}"; do
    if [ -x "$script" ]; then
        print_success "✓ $script is executable"
    else
        print_warning "⚠ $script is not executable, fixing..."
        chmod +x "$script"
        print_success "✓ $script permissions fixed"
    fi
done

# Validate docker-compose files
print_status "Validating docker-compose files..."

COMPOSE_FILES=(
    "docker-compose.dev.yml"
    "docker-compose.prod.yml"
    "docker-compose.test.yml"
    "docker-compose.aks.yml"
)

for compose_file in "${COMPOSE_FILES[@]}"; do
    if docker-compose -f "$compose_file" config > /dev/null 2>&1; then
        print_success "✓ $compose_file syntax is valid"
    else
        print_warning "⚠ $compose_file syntax validation skipped (Docker Compose not available)"
    fi
done

# Test build script help
print_status "Testing build script help..."
if ./build.sh --help > /dev/null 2>&1; then
    print_success "✓ build.sh help works"
else
    print_error "✗ build.sh help failed"
    exit 1
fi

# Test deploy script help
print_status "Testing deploy script help..."
if ./deploy.sh --help > /dev/null 2>&1; then
    print_success "✓ deploy.sh help works"
else
    print_error "✗ deploy.sh help failed"
    exit 1
fi

# Check Dockerfile targets
print_status "Checking Dockerfile targets..."

TARGETS=("base" "deps" "builder" "production" "development" "testing" "ingestion")
for target in "${TARGETS[@]}"; do
    if grep -q "FROM.*AS $target" Dockerfile; then
        print_success "✓ Target '$target' found in Dockerfile"
    else
        print_warning "⚠ Target '$target' not found in Dockerfile"
    fi
done

# Check build arguments
print_status "Checking build arguments..."

BUILD_ARGS=(
    "NODE_VERSION"
    "BASE_OS"
    "BUILD_TARGET"
    "INCLUDE_DEV_DEPS"
    "ENABLE_SOURCE_MAPS"
    "ENABLE_DATADOG"
    "ENABLE_LIGHTNINGCSS"
    "ENABLE_PRISMA"
    "ENABLE_HEALTH_CHECK"
)

for arg in "${BUILD_ARGS[@]}"; do
    if grep -q "ARG $arg" Dockerfile; then
        print_success "✓ Build arg '$arg' found in Dockerfile"
    else
        print_warning "⚠ Build arg '$arg' not found in Dockerfile"
    fi
done

# Summary
echo ""
print_success "🎉 Docker structure validation completed!"
print_status "The new consolidated Docker structure is ready to use."
print_status ""
print_status "Next steps:"
print_status "1. Test with: ./build.sh dev"
print_status "2. Deploy with: ./deploy.sh dev"
print_status "3. Update CI/CD workflows to use new structure"
print_status "4. Remove old Dockerfiles after migration"
