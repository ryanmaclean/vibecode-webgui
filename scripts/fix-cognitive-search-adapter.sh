#!/bin/bash

# Datadog Log Aggregation
source "$(dirname "$0")/lib/log-aggregation.sh"


# Path to the file

# Initialize log aggregation
init_log_aggregation

FILE="/Users/ryan.maclean/vibecode-webgui/src/lib/vector-db/cognitive-search-vector-database-adapter.ts"

# Create backup
cp "$FILE" "${FILE}.bak"

# Replace imports to fix error handler import
sed -i.tmp '16s/.*import { handleVectorDBError as errorHandler, VectorDBErrorType } from.*/import { VectorDbErrorHandler, VectorDbErrorType } from '\''\.\/vector-db-error-handler'\'';/' "$FILE"

# Fix error handler initialization in constructor
sed -i.tmp '44s/.*this\.errorHandler = handleVectorDBError;.*/    this.errorHandler = new VectorDbErrorHandler('\''azure-cognitive-search'\'', config.enableLogging, config.enableMetrics);/' "$FILE"

# Fix checkIndexExists method with proper error handling
cat > /tmp/check_index_exists.txt << 'EOF'
  private async checkIndexExists(indexName: string): Promise<boolean> {
    if (!this.searchIndexClient) {
      throw this.errorHandler.handleError(
        new Error('Search index client not initialized'),
        'checkIndexExists',
        VectorDbErrorType.INITIALIZATION,
        false
      );
    }

    try {
      const indexes = await this.searchIndexClient.listIndexes();
      for await (const index of indexes) {
        if (index.name === indexName) {
          return true;
        }
      }
      return false;
    } catch (error) {
      // Determine error type based on error characteristics
      let errorType = VectorDbErrorType.SERVICE;
      let retryable = false;
      
      if (this.errorHandler.isAuthError(error)) {
        errorType = VectorDbErrorType.AUTHENTICATION;
        retryable = false;
      } else if (this.errorHandler.isNetworkError(error)) {
        errorType = VectorDbErrorType.CONNECTION;
        retryable = true;
      } else if (this.errorHandler.isTimeoutError(error)) {
        errorType = VectorDbErrorType.TIMEOUT;
        retryable = true;
      }
      
      // Include additional context in error data
      const errorData = {
        endpoint: this.searchConfig.endpoint,
        indexName
      };
      
      // For index checks, we'll log but not throw to allow initialization to continue
      // and make a decision about the missing index
      if (this.config.enableLogging) {
        console.error('Error checking if index exists:', error);
      }
      
      if (this.config.enableMetrics) {
        metrics.increment('vector_db.check_index.error');
      }
      
      return false;
    }
  }
EOF

# Replace the checkIndexExists method
start_line=$(grep -n "private async checkIndexExists" "$FILE" | cut -d':' -f1)
end_line=$(grep -n "protected async pingProvider" "$FILE" | cut -d':' -f1)
end_line=$((end_line - 2))

# Replace the method - macOS compatible version
sed -i.tmp "${start_line},${end_line}d" "$FILE"

# On macOS, we need to insert line by line for the i command
line_num=$start_line
while IFS= read -r line; do
  sed -i.tmp "${line_num}i\\
$line" "$FILE"
  line_num=$((line_num + 1))
done < /tmp/check_index_exists.txt

# Fix VectorDBErrorType to VectorDbErrorType throughout the file
sed -i.tmp 's/VectorDBErrorType/VectorDbErrorType/g' "$FILE"

# Fix searchOptions type references if any
sed -i.tmp 's/CONNECTION_FAILED/CONNECTION/g' "$FILE"

# Clean up temp files
rm "${FILE}.tmp"
rm /tmp/check_index_exists.txt

echo "Updated cognitive-search-vector-database-adapter.ts with improved error handling"