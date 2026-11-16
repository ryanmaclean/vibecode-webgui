#!/bin/bash
# Test Model Management UI Backend Integration
# This tests the underlying Ollama integration

set -e

echo "=== Model Management UI Integration Test ==="
echo ""

# Test model name - using a very small model
TEST_MODEL="smollm2:360m"

echo "Test Configuration:"
echo "  Model: $TEST_MODEL"
echo "  Ollama Endpoint: http://localhost:11434"
echo ""

# Step 1: Check Ollama is running
echo "[1/6] Checking Ollama service..."
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "✓ Ollama service is running"
else
    echo "✗ Ollama service is not running"
    exit 1
fi
echo ""

# Step 2: Get current model count
echo "[2/6] Getting current model list..."
INITIAL_COUNT=$(curl -s http://localhost:11434/api/tags | jq '.models | length')
echo "✓ Currently $INITIAL_COUNT models installed"
curl -s http://localhost:11434/api/tags | jq -r '.models[] | "  - \(.name) (\(.details.parameter_size))"'
echo ""

# Step 3: Check if test model already exists
echo "[3/6] Checking if test model exists..."
MODEL_EXISTS=$(curl -s http://localhost:11434/api/tags | jq -r ".models[] | select(.name == \"$TEST_MODEL\") | .name" || echo "")
if [ -n "$MODEL_EXISTS" ]; then
    echo "⚠ Test model $TEST_MODEL already exists, will delete first"
    echo "Deleting existing model..."
    curl -s -X DELETE http://localhost:11434/api/delete -d "{\"name\": \"$TEST_MODEL\"}" > /dev/null
    sleep 2
fi
echo "✓ Ready to test model download"
echo ""

# Step 4: Download test model
echo "[4/6] Downloading test model $TEST_MODEL..."
echo "Note: This may take several minutes depending on connection speed"
echo "Model size: ~360MB"

# Pull the model
PULL_START=$(date +%s)
if curl -s -X POST http://localhost:11434/api/pull -d "{\"name\": \"$TEST_MODEL\"}" | while read -r line; do
    STATUS=$(echo "$line" | jq -r '.status // empty' 2>/dev/null || echo "")
    if [ -n "$STATUS" ]; then
        echo "  $STATUS"
    fi
done; then
    PULL_END=$(date +%s)
    PULL_DURATION=$((PULL_END - PULL_START))
    echo "✓ Model downloaded successfully in ${PULL_DURATION}s"
else
    echo "✗ Failed to download model"
    exit 1
fi
echo ""

# Step 5: Verify model appears in list
echo "[5/6] Verifying model in installed list..."
sleep 2
NEW_COUNT=$(curl -s http://localhost:11434/api/tags | jq '.models | length')
INSTALLED=$(curl -s http://localhost:11434/api/tags | jq -r ".models[] | select(.name == \"$TEST_MODEL\") | .name" || echo "")

if [ -n "$INSTALLED" ]; then
    echo "✓ Model appears in installed list"
    MODEL_INFO=$(curl -s http://localhost:11434/api/tags | jq -r ".models[] | select(.name == \"$TEST_MODEL\") | \"  Name: \(.name)\\n  Size: \(.size / 1024 / 1024 | floor)MB\\n  Family: \(.details.family)\\n  Format: \(.details.format)\\n  Params: \(.details.parameter_size)\\n  Quant: \(.details.quantization_level)\"")
    echo "$MODEL_INFO"
    echo "  Total models now: $NEW_COUNT (was $INITIAL_COUNT)"
else
    echo "✗ Model not found in installed list"
    exit 1
fi
echo ""

# Step 6: Delete the model
echo "[6/6] Deleting test model..."
if curl -s -X DELETE http://localhost:11434/api/delete -d "{\"name\": \"$TEST_MODEL\"}" > /dev/null 2>&1; then
    sleep 2
    FINAL_COUNT=$(curl -s http://localhost:11434/api/tags | jq '.models | length')
    STILL_INSTALLED=$(curl -s http://localhost:11434/api/tags | jq -r ".models[] | select(.name == \"$TEST_MODEL\") | .name" || echo "")

    if [ -z "$STILL_INSTALLED" ]; then
        echo "✓ Model deleted successfully"
        echo "  Total models now: $FINAL_COUNT (back to $INITIAL_COUNT)"
    else
        echo "✗ Model still appears in list after deletion"
        exit 1
    fi
else
    echo "✗ Failed to delete model"
    exit 1
fi
echo ""

# Summary
echo "=== Test Summary ==="
echo "✓ All backend integration tests passed!"
echo ""
echo "Backend Integration Verified:"
echo "  ✓ Ollama service health check"
echo "  ✓ Model list retrieval"
echo "  ✓ Model download (pull) operation"
echo "  ✓ Model appears in list after download"
echo "  ✓ Model deletion operation"
echo "  ✓ Model removed from list after deletion"
echo ""
echo "Next Steps:"
echo "  → Manual UI testing required in browser"
echo "  → Navigate to http://localhost:3000/ai/models"
echo "  → Test model management UI components"
echo "  → Verify all UI interactions work correctly"
echo ""
