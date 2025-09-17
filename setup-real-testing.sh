#!/bin/bash

# Setup script for real API testing with VibeCode WebGUI
# This script sets up environment variables and validates the testing environment

echo "🚀 Setting up VibeCode WebGUI for real API testing..."

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "⚠️  .env.local not found. Creating template..."
    cp .env.template .env.local 2>/dev/null || cat > .env.local << 'EOF'
# VibeCode WebGUI Environment Configuration
# Configure with your actual API keys

# Database Configuration
DATABASE_URL="postgresql://user:password@localhost:5432/vibecode_test"
POSTGRES_URL="postgresql://user:password@localhost:5432/vibecode_test"

# AI Service Configuration
OPENROUTER_API_KEY="your-openrouter-api-key-here"
OPENAI_API_KEY="your-openai-api-key-here"

# NextAuth Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-nextauth-secret-here"

# Test Environment Configuration
NODE_ENV="test"
ENABLE_REAL_AI_TESTS="true"
ENABLE_REAL_INTEGRATION_TESTS="true"
ENABLE_REAL_DATADOG_TESTS="true"
PLAYWRIGHT_TEST="true"

# Redis Configuration (for collaboration features)
REDIS_URL="redis://localhost:6379"

# Vector Database Configuration
AZURE_OPENAI_API_KEY="your-azure-openai-key-here"
AZURE_OPENAI_ENDPOINT="your-azure-openai-endpoint-here"

# Development Server Configuration
PORT="3000"
BASE_URL="http://localhost:3000"
EOF
    echo "✅ Created .env.local template. Please edit it with your actual API keys."
    echo "📝 Edit .env.local and add your API keys, then run this script again."
    exit 1
fi

echo "📋 Checking environment configuration..."

# Load environment variables
source .env.local

# Check required variables
missing_vars=()

if [[ -z "$OPENROUTER_API_KEY" || "$OPENROUTER_API_KEY" == "your-openrouter-api-key-here" ]]; then
    missing_vars+=("OPENROUTER_API_KEY")
fi

if [[ -z "$DATABASE_URL" || "$DATABASE_URL" == "postgresql://user:password@localhost:5432/vibecode_test" ]]; then
    missing_vars+=("DATABASE_URL")
fi

if [[ -z "$NEXTAUTH_SECRET" || "$NEXTAUTH_SECRET" == "your-nextauth-secret-here" ]]; then
    missing_vars+=("NEXTAUTH_SECRET")
fi

# Report missing variables
if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "❌ Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "   - $var"
    done
    echo ""
    echo "📝 Please edit .env.local and configure these variables with real values."
    echo "💡 You can continue with limited testing, but some tests may be skipped."
    echo ""
fi

# Check optional variables
optional_vars=("OPENAI_API_KEY" "DD_API_KEY" "AZURE_OPENAI_API_KEY")
echo "📊 Optional API keys status:"
for var in "${optional_vars[@]}"; do
    if [[ -n "${!var}" && "${!var}" != "your-"*"-key-here" ]]; then
        echo "   ✅ $var: configured"
    else
        echo "   ⚠️  $var: not configured (optional)"
    fi
done

echo ""
echo "🔧 Environment setup complete!"
echo ""
echo "🧪 Available test commands:"
echo "   npm run test:e2e          # Run E2E tests with Playwright"
echo "   npm run test:integration  # Run integration tests"
echo "   npm run test              # Run all unit tests"
echo "   npm run dev               # Start development server"
echo ""
echo "🌐 To run E2E tests with real APIs:"
echo "   1. Start the dev server: npm run dev"
echo "   2. In another terminal: npm run test:e2e"
echo ""
echo "✨ Ready for comprehensive testing!"
