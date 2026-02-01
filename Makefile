# VibeCode CLI + pgvector + Datadog DBM
# Consolidated CLI that replaces 195 Python scripts

VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
LDFLAGS := -ldflags "-X github.com/vibecode/vibecode/cmd/vibecode/cmd.Version=$(VERSION) \
                     -X github.com/vibecode/vibecode/cmd/vibecode/cmd.Commit=$(COMMIT) -s -w"

.PHONY: demo help setup status vector dashboard clean build install cli cli-all

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
	@echo "🔧 CLI (Consolidates 195 Python scripts → 1 binary):"
	@echo ""
	@echo "  make cli         🔨 Build unified vibecode CLI"
	@echo "  make cli-all     🌍 Build for all platforms"
	@echo "  make cli-install 📦 Install to GOPATH/bin"
	@echo ""
	@echo "📋 CLI Commands:"
	@echo "  vibecode vm list           - List VMs"
	@echo "  vibecode vm start <name>   - Start VM"
	@echo "  vibecode build docker      - Build Docker image"
	@echo "  vibecode bench boot -n 10  - Run boot benchmark"
	@echo "  vibecode cloud start       - Start cloud workspace"
	@echo "  vibecode setup all         - Full setup"
	@echo "  vibecode dev openvscode    - Start OpenVSCode"
	@echo ""

# ============================================
# VIBECODE CLI (Consolidates 195 Python scripts)
# ============================================

# Build the unified vibecode CLI
cli:
	@echo "🔨 Building vibecode CLI (consolidates 195 Python scripts)..."
	@go build $(LDFLAGS) -o bin/vibecode ./cmd/vibecode
	@echo "✅ Built: bin/vibecode ($(VERSION))"
	@echo ""
	@echo "Usage:"
	@echo "  ./bin/vibecode vm list"
	@echo "  ./bin/vibecode build docker"
	@echo "  ./bin/vibecode bench boot"
	@echo "  ./bin/vibecode --help"

# Build CLI for all platforms
cli-all:
	@echo "🔨 Building vibecode CLI for all platforms..."
	@GOOS=darwin GOARCH=arm64 go build $(LDFLAGS) -o bin/vibecode-darwin-arm64 ./cmd/vibecode
	@GOOS=darwin GOARCH=amd64 go build $(LDFLAGS) -o bin/vibecode-darwin-amd64 ./cmd/vibecode
	@GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o bin/vibecode-linux-amd64 ./cmd/vibecode
	@GOOS=linux GOARCH=arm64 go build $(LDFLAGS) -o bin/vibecode-linux-arm64 ./cmd/vibecode
	@echo "✅ Built binaries for darwin-arm64, darwin-amd64, linux-amd64, linux-arm64"

# Install CLI to $GOPATH/bin
cli-install:
	@echo "📦 Installing vibecode CLI..."
	@go install $(LDFLAGS) ./cmd/vibecode
	@echo "✅ Installed: $(shell go env GOPATH)/bin/vibecode"

# Default help when no target specified
.DEFAULT_GOAL := help
