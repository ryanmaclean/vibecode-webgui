#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


# Comprehensive Logger Circular Dependency Fix
# This script eliminates ALL logger imports to prevent circular dependencies

# Initialize log aggregation
init_log_aggregation


echo "🔥 SYSTEMATIC LOGGER ELIMINATION - Fixing circular dependencies once and for all"

# Find all TypeScript files with logger imports
echo "📋 Finding all files with logger imports..."
FILES_WITH_LOGGER=$(find src -name "*.ts" -o -name "*.tsx" | xargs grep -l "import.*logger" | grep -v "// import")

echo "Found $(echo "$FILES_WITH_LOGGER" | wc -l) files with logger imports"

# Process each file
for file in $FILES_WITH_LOGGER; do
    echo "🔧 Fixing: $file"
    
    # Comment out logger imports
    sed -i '' 's/^import { logger }/\/\/ import { logger }/g' "$file"
    sed -i '' 's/^import { logger,/\/\/ import { logger,/g' "$file"
    sed -i '' 's/^import { appLogger }/\/\/ import { appLogger }/g' "$file"
    sed -i '' 's/^import { appLogger,/\/\/ import { appLogger,/g' "$file"
    sed -i '' 's/^import { createChildLogger }/\/\/ import { createChildLogger }/g' "$file"
    sed -i '' 's/^import { createChildLogger,/\/\/ import { createChildLogger,/g' "$file"
    
    # Replace logger usage with console
    sed -i '' 's/logger\.error/console.error/g' "$file"
    sed -i '' 's/logger\.warn/console.warn/g' "$file"
    sed -i '' 's/logger\.info/console.log/g' "$file"
    sed -i '' 's/logger\.debug/console.log/g' "$file"
    sed -i '' 's/logger\.log/console.log/g' "$file"
    
    # Replace appLogger usage with console
    sed -i '' 's/appLogger\.logBusiness/console.log/g' "$file"
    sed -i '' 's/appLogger\.logSecurity/console.error/g' "$file"
    sed -i '' 's/appLogger\.logPerformance/console.log/g' "$file"
    sed -i '' 's/appLogger\.logError/console.error/g' "$file"
    
    # Replace createChildLogger usage with console
    sed -i '' 's/createChildLogger({.*})/console/g' "$file"
    sed -i '' 's/createChildLogger(/console.log(/g' "$file"
    
    # Fix any malformed console calls
    sed -i '' 's/console\.log\./console.log/g' "$file"
    sed -i '' 's/console\.error\./console.error/g' "$file"
    sed -i '' 's/console\.warn\./console.warn/g' "$file"
done

echo "✅ Logger circular dependency fix complete!"
echo "📊 Processed $(echo "$FILES_WITH_LOGGER" | wc -l) files"
echo "🚀 Ready to test build..."
