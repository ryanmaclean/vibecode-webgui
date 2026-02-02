#!/bin/bash
# MongoDB health check script for VibeCode Chat-UI

set -e

# Configuration
HOST="localhost"
PORT="27017"
DATABASE="chatui"
TIMEOUT=5

# Check if MongoDB is responding
echo "Checking MongoDB connection..."
if ! mongosh --host $HOST:$PORT --eval "db.adminCommand('ping')" --quiet > /dev/null 2>&1; then
    echo "ERROR: MongoDB is not responding"
    exit 1
fi

# Check if chatui database exists and is accessible
echo "Checking chatui database..."
if ! mongosh --host $HOST:$PORT/$DATABASE --eval "db.runCommand({ping: 1})" --quiet > /dev/null 2>&1; then
    echo "ERROR: chatui database is not accessible"
    exit 1
fi

# Check critical collections exist
echo "Checking collections..."
COLLECTIONS=("conversations" "sessions" "assistants" "sharedConversations")
for collection in "${COLLECTIONS[@]}"; do
    if ! mongosh --host $HOST:$PORT/$DATABASE --eval "db.${collection}.countDocuments({})" --quiet > /dev/null 2>&1; then
        echo "ERROR: Collection $collection is not accessible"
        exit 1
    fi
done

# Check indexes exist
echo "Checking indexes..."
INDEX_COUNT=$(mongosh --host $HOST:$PORT/$DATABASE --eval "db.conversations.getIndexes().length" --quiet 2>/dev/null || echo "0")
if [ "$INDEX_COUNT" -lt 5 ]; then
    echo "WARNING: Expected indexes may be missing on conversations collection"
fi

# Check disk space (warn if less than 1GB available)
AVAILABLE_SPACE=$(df /data/db | awk 'NR==2 {print $4}')
if [ "$AVAILABLE_SPACE" -lt 1048576 ]; then  # 1GB in KB
    echo "WARNING: Low disk space available: ${AVAILABLE_SPACE}KB"
fi

# Check memory usage
MEMORY_USAGE=$(mongosh --host $HOST:$PORT --eval "db.serverStatus().mem" --quiet 2>/dev/null || echo "")
if [ -n "$MEMORY_USAGE" ]; then
    echo "Memory usage check passed"
else
    echo "WARNING: Could not check memory usage"
fi

# Performance check - ensure queries respond within reasonable time
echo "Checking query performance..."
START_TIME=$(date +%s%N)
mongosh --host $HOST:$PORT/$DATABASE --eval "db.conversations.findOne()" --quiet > /dev/null 2>&1
END_TIME=$(date +%s%N)
QUERY_TIME=$(( (END_TIME - START_TIME) / 1000000 ))  # Convert to milliseconds

if [ "$QUERY_TIME" -gt 1000 ]; then  # More than 1 second
    echo "WARNING: Slow query performance: ${QUERY_TIME}ms"
fi

echo "MongoDB health check passed successfully"
exit 0