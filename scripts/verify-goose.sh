#!/bin/bash

# Test script to verify Goose installation in code-server

echo "🔍 Verifying Goose installation..."

# Check if Goose is installed
if ! command -v goose &> /dev/null; then
    echo "❌ Goose is not installed or not in PATH"
    exit 1
fi

# Check Goose version
echo "✅ Goose is installed at: $(which goose)"
echo "🔢 Goose version: $(goose -version)"

# Test creating a migration
echo "
🧪 Testing migration creation..."
mkdir -p /tmp/goose-test/migrations
cd /tmp/goose-test

echo "📝 Creating a test migration..."
goose -dir ./migrations create test_migration sql

if [ $? -eq 0 ]; then
    echo "✅ Successfully created migration file"
    echo "📄 Migration file created at: $(ls ./migrations/*_test_migration.sql)"
else
    echo "❌ Failed to create migration file"
    exit 1
fi

# Test SQL migration file content
MIGRATION_FILE=$(ls ./migrations/*_test_migration.sql)
if [ -f "$MIGRATION_FILE" ]; then
    echo "
📋 Migration file content:"
    cat "$MIGRATION_FILE"
    echo "
✅ Migration file looks good!"
else
    echo "❌ Migration file not found"
    exit 1
fi

echo "
🎉 Goose verification completed successfully!"

# Clean up
rm -rf /tmp/goose-test
