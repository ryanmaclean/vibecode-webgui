#!/bin/bash

# Production build script that bypasses Babel for optimal performance
# Temporarily moves Babel config to let Next.js use SWC

echo "🚀 Starting production build with SWC optimization..."

# Backup Babel config if it exists
if [ -f "babel.config.js" ]; then
  echo "📦 Temporarily moving Babel config to allow SWC optimization..."
  mv babel.config.js babel.config.js.bak
fi

# Run the build
echo "🔨 Building with Next.js SWC compiler..."
NODE_ENV=production npm run build

BUILD_EXIT_CODE=$?

# Restore Babel config for tests
if [ -f "babel.config.js.bak" ]; then
  echo "🔄 Restoring Babel config for test compatibility..."
  mv babel.config.js.bak babel.config.js
fi

# Exit with the same code as the build
if [ $BUILD_EXIT_CODE -eq 0 ]; then
  echo "✅ Production build completed successfully!"
else
  echo "❌ Production build failed!"
fi

exit $BUILD_EXIT_CODE