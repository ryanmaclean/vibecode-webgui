#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"

# Ultra-Simple Development Start
# Just run the app with your existing PostgreSQL

# Initialize log aggregation
init_log_aggregation


set -e

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🚀 Starting VibeCode Platform${NC}"

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: Run this from the project root directory"
    exit 1
fi

# Create minimal .env.local if it doesn't exist
if [ ! -f ".env.local" ]; then
    echo -e "${BLUE}Creating .env.local...${NC}"
    cat > .env.local << 'EOF'
DATABASE_URL="postgresql://vibecode:vibecode_password@localhost:5432/vibecode"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="dev-secret-123"
NODE_ENV="development"
EOF
fi

# Install dependencies and start
echo -e "${BLUE}Installing dependencies...${NC}"
npm install

echo -e "${BLUE}Starting development server...${NC}"
echo -e "${GREEN}✅ App will be available at: http://localhost:3000${NC}"
echo -e "${GREEN}✅ Using PostgreSQL at: localhost:5432${NC}"
echo ""

npm run dev
