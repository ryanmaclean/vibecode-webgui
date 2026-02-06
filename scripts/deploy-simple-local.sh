#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Simple Local Deployment Script
# Works with your existing PostgreSQL container and any Kubernetes setup

# Initialize log aggregation
init_log_aggregation


set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo ""
    echo -e "${CYAN}================================================${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}================================================${NC}"
    echo ""
}

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

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

print_header "SIMPLE LOCAL DEPLOYMENT"

# Check if we're in the right directory
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
    print_error "Cannot find package.json. Are you in the right directory?"
    exit 1
fi

cd "$PROJECT_ROOT"

# Check prerequisites
print_status "Checking prerequisites..."
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed"
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "npm is not installed"
    exit 1
fi

# Check if PostgreSQL is running
print_status "Checking PostgreSQL connection..."
if docker ps | grep postgres &> /dev/null; then
    print_success "PostgreSQL container is running"
else
    print_warning "PostgreSQL container not found. Starting one..."
    docker run -d \
        --name vibecode-postgres \
        -e POSTGRES_DB=vibecode \
        -e POSTGRES_USER=vibecode \
        -e POSTGRES_PASSWORD=vibecode_password \
        -p 5432:5432 \
        postgres:16
    
    print_status "Waiting for PostgreSQL to be ready..."
    sleep 10
fi

# Create environment file if it doesn't exist
if [ ! -f ".env.local" ]; then
    print_status "Creating .env.local file..."
    cat > .env.local << EOF
# Database
DATABASE_URL="postgresql://vibecode:vibecode_password@localhost:5432/vibecode"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="development-secret-key-$(date +%s)"

# Development
NODE_ENV="development"
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# AI Configuration (optional)
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""

# Monitoring (optional)
DD_API_KEY=""
DD_APP_KEY=""
EOF
    print_success "Created .env.local with default values"
else
    print_success ".env.local already exists"
fi

# Install dependencies
print_status "Installing dependencies..."
npm ci

# Run database migrations if they exist
if [ -f "prisma/schema.prisma" ]; then
    print_status "Running database migrations..."
    npx prisma generate
    npx prisma db push || print_warning "Database migration failed - continuing anyway"
fi

# Build the application
print_status "Building application..."
npm run build

print_header "STARTING APPLICATION"

print_success "Setup complete! Starting the development server..."

cat << EOF

🎉 VibeCode Platform Ready!

The application will start at: http://localhost:3000

Available services:
- Main Application: http://localhost:3000
- PostgreSQL: localhost:5432
- Database: vibecode
- User: vibecode
- Password: vibecode_password

To stop the application: Press Ctrl+C

To restart later:
  cd $(pwd)
  npm run dev

EOF

# Start the development server
print_status "Starting development server..."
npm run dev
