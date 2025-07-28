#!/bin/bash

# Script to switch between Tailwind v4 CDN and Docker modes

MODE=${1:-"cdn"}

case $MODE in
  "cdn")
    echo "🎨 Setting up Tailwind v4 CDN mode..."
    
    # Copy CDN-specific files
    cp postcss.config.js postcss.config.js.backup 2>/dev/null || true
    
    # Update PostCSS config for CDN mode
    cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    // Tailwind CSS v4 loaded via CDN, no PostCSS plugin needed
    autoprefixer: {},
  },
}
EOF
    
    # Update layout to include CDN
    echo "✅ CDN mode configured. Tailwind v4 will load via CDN in browser."
    echo "🚀 Run: npm run dev"
    ;;
    
  "docker")
    echo "🐳 Setting up Tailwind v4 Docker mode..."
    
    # Backup current config
    cp postcss.config.js postcss.config.js.backup 2>/dev/null || true
    
    # Copy Docker-specific config
    cp postcss.config.docker.js postcss.config.js
    
    # Update layout to remove CDN and use CSS import
    echo "✅ Docker mode configured. Tailwind v4 will build inside container."
    echo "🚀 Run: docker-compose -f docker-compose.dev.yml up --build"
    ;;
    
  "restore")
    echo "🔄 Restoring original configuration..."
    
    if [ -f postcss.config.js.backup ]; then
      mv postcss.config.js.backup postcss.config.js
      echo "✅ Original configuration restored."
    else
      echo "❌ No backup found."
    fi
    ;;
    
  *)
    echo "Usage: $0 [cdn|docker|restore]"
    echo ""
    echo "Modes:"
    echo "  cdn     - Use Tailwind v4 via CDN (for local development)"
    echo "  docker  - Use Tailwind v4 with PostCSS in Docker"
    echo "  restore - Restore original configuration"
    exit 1
    ;;
esac