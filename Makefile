# VibeCode pgvector + Datadog DBM Demo
# Simple Makefile for easy discovery and execution

.PHONY: demo help setup status vector dashboard clean build install

# Default target - shows the TUI demo
demo: build
	@echo "🚀 Starting VibeCode pgvector + Datadog DBM Demo..."
	@./bin/vibecode-demo

# Build the TUI demo application
build:
	@echo "🔨 Building demo TUI..."
	@go build -o bin/vibecode-demo ./cmd/vibecode-demo

# Install Go dependencies
install:
	@echo "📦 Installing Go dependencies..."
	@go mod tidy
	@go mod download

# Quick status check (non-interactive)
status:
	@echo "🔍 Checking pgvector + Datadog DBM status..."
	@./scripts/verify-datadog-dbm.sh || echo "Run 'make setup' to configure"

# Setup pgvector + Datadog DBM (non-interactive)
setup:
	@echo "⚙️ Setting up pgvector + Datadog DBM..."
	@./scripts/verify-datadog-dbm.sh

# Generate vector activity (non-interactive)  
vector:
	@echo "🎯 Generating pgvector activity..."
	@./scripts/generate-vector-activity.sh

# Open Datadog dashboard
dashboard:
	@echo "📊 Opening Datadog Database Monitoring..."
	@open "https://app.datadoghq.com/databases" || xdg-open "https://app.datadoghq.com/databases" || echo "Please visit: https://app.datadoghq.com/databases"

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	@rm -rf bin/
	@go clean

# Show help
help:
	@echo ""
	@echo "🐘 VibeCode pgvector + Datadog DBM Demo"
	@echo "======================================"
	@echo ""
	@echo "📋 Available commands:"
	@echo ""
	@echo "  make demo       🚀 Start interactive TUI demo (recommended)"
	@echo "  make setup      ⚙️  Setup pgvector + Datadog DBM"
	@echo "  make status     🔍 Check current setup status"
	@echo "  make vector     🎯 Generate vector activity"
	@echo "  make dashboard  📊 Open Datadog dashboard"
	@echo ""
	@echo "📦 Development:"
	@echo ""
	@echo "  make build      🔨 Build the TUI application"
	@echo "  make install    📦 Install Go dependencies"
	@echo "  make clean      🧹 Clean build artifacts"
	@echo "  make help       ❓ Show this help"
	@echo ""
	@echo "🎯 Quick Start:"
	@echo "  1. make demo    (interactive TUI - best experience)"
	@echo "  2. make setup   (if needed)"
	@echo "  3. make vector  (generate activity)"
	@echo "  4. make dashboard (view results)"
	@echo ""
	@echo "💡 The TUI provides the best experience with real-time feedback!"
	@echo ""

# Default help when no target specified
.DEFAULT_GOAL := help
