#!/bin/bash

# Performance Test Script
echo "📊 Running performance tests..."

# Test startup time
echo "Testing startup time..."
start_time=$(date +%s%N)
# Start app here
sleep 2  # Simulate startup
end_time=$(date +%s%N)
startup_time=$(( (end_time - start_time) / 1000000 ))

# Test memory usage
memory_usage=$(ps -o rss= -p $$ | awk '{print $1}')

# Test binary size
binary_size=$(du -h . | tail -1 | awk '{print $1}')

echo "Results:"
echo "  Startup Time: ${startup_time}ms"
echo "  Memory Usage: ${memory_usage}KB"
echo "  Binary Size: $binary_size"
