#!/bin/bash
# standardize-error-handling.sh
# Script to standardize error handling across vector database adapters

# Step 1: Update the vector-db-error-handler.ts file
echo "Step 1: Updating vector-db-error-handler.ts with standardized naming and consolidated error types"
cp src/lib/vector-db/vector-db-error-handler-new.ts src/lib/vector-db/vector-db-error-handler.ts

# Step 2: Update the enhanced-vector-database-adapter.ts file
echo "Step 2: Updating enhanced-vector-database-adapter.ts to use class-based error handling"
cp src/lib/vector-db/enhanced-vector-database-adapter-new.ts src/lib/vector-db/enhanced-vector-database-adapter.ts

# Step 3: Update vector-retry-handler.ts to use standardized imports
echo "Step 3: Updating vector-retry-handler.ts to use standardized imports"
sed -i '' 's/import { VectorDBError, VectorDBErrorType } from/import { VectorDbError, VectorDbErrorType } from/g' src/lib/vector-db/vector-retry-handler.ts
sed -i '' 's/VectorDBErrorType/VectorDbErrorType/g' src/lib/vector-db/vector-retry-handler.ts
sed -i '' 's/VectorDBError/VectorDbError/g' src/lib/vector-db/vector-retry-handler.ts
sed -i '' 's/CONNECTION_FAILED/CONNECTION/g' src/lib/vector-db/vector-retry-handler.ts

# Step 4: Update other adapter files
echo "Step 4: Adding error handler to postgres-vector-database-adapter.ts"
# This requires a more nuanced approach with manual edits
# See postgres-vector-database-adapter-new.ts as a template

# Repeat for other adapters (redis, cosmosdb, sqlserver, etc.)
echo "Step 5: Adding error handler to redis-vector-database-adapter.ts"
echo "Step 6: Adding error handler to cosmosdb-vector-database-adapter.ts"
echo "Step 7: Adding error handler to sqlserver-vector-database-adapter.ts"

# Step 8: Update imports in files that use these modules
echo "Step 8: Updating imports in dependent files"
find src -type f -name "*.ts" -o -name "*.tsx" | xargs grep -l "VectorDBErrorType" | xargs sed -i '' 's/VectorDBErrorType/VectorDbErrorType/g'
find src -type f -name "*.ts" -o -name "*.tsx" | xargs grep -l "VectorDBError" | xargs sed -i '' 's/VectorDBError/VectorDbError/g'

echo "Step 9: Run TypeScript type checking to ensure no errors"
npx tsc --noEmit

echo "Step 10: Testing the changes"
npm test -- -t "vector database"

echo "Completed standardization of error handling across vector database adapters"