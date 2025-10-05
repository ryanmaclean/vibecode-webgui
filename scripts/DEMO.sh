#!/bin/bash
# 🐘 VibeCode pgvector + Datadog DBM Demo
# Just run: ./DEMO.sh

clear
echo "🐘 VibeCode: pgvector + PostgreSQL + Kubernetes + Datadog DBM"
echo "============================================================="
echo ""
echo "✨ Demonstrating vector database monitoring in 30 seconds..."
echo ""

# Try fancy TUI first
if [ -f "bin/vibecode-demo" ]; then
    ./bin/vibecode-demo
    exit 0
fi

# Try to build TUI
if command -v go >/dev/null 2>&1 && [ -f "go.mod" ]; then
    echo "Building interactive demo..."
    go build -o bin/vibecode-demo ./cmd/vibecode-demo >/dev/null 2>&1 && ./bin/vibecode-demo && exit 0
fi

# Simple fallback
echo "1) Setup pgvector + Datadog DBM"
echo "2) Generate vector activity"  
echo "3) Open Datadog dashboard"
echo ""
read -p "Choose (1-3): " choice

case $choice in
    1) ./scripts/verify-datadog-dbm.sh ;;
    2) ./scripts/generate-vector-activity.sh ;;
    3) open "https://app.datadoghq.com/databases" 2>/dev/null || echo "Visit: https://app.datadoghq.com/databases" ;;
    *) echo "Run: ./scripts/verify-datadog-dbm.sh" ;;
esac
