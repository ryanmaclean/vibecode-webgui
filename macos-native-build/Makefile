# VibeCode Native macOS Build System
# Agent 23 - Shopify macOS CI Infrastructure

.PHONY: all build install test clean help benchmark

# Configuration
PREFIX ?= /usr/local
SWIFT_BUILD_FLAGS ?= -c release
INSTALL_PATH = $(PREFIX)/bin

# Build targets
all: build

## Build the vibe-build CLI
build:
	@echo "Building vibe-build for macOS..."
	swift build $(SWIFT_BUILD_FLAGS)
	@echo "✅ Build complete: .build/release/vibe-build"

## Install vibe-build to system
install: build
	@echo "Installing vibe-build to $(INSTALL_PATH)..."
	install -d $(INSTALL_PATH)
	install .build/release/vibe-build $(INSTALL_PATH)/vibe-build
	install .build/release/vibe-oci $(INSTALL_PATH)/vibe-oci
	@echo "Installing launchd service..."
	install -d $(PREFIX)/var/log
	install -d $(PREFIX)/var/vibecode
	sudo install -m 644 launch/com.vibecode.builder.plist /Library/LaunchDaemons/
	@echo "✅ Installation complete"
	@echo ""
	@echo "Start service: sudo launchctl load /Library/LaunchDaemons/com.vibecode.builder.plist"
	@echo "Check status: launchctl list | grep vibecode"

## Uninstall vibe-build from system
uninstall:
	@echo "Uninstalling vibe-build..."
	sudo launchctl unload /Library/LaunchDaemons/com.vibecode.builder.plist 2>/dev/null || true
	sudo rm -f /Library/LaunchDaemons/com.vibecode.builder.plist
	rm -f $(INSTALL_PATH)/vibe-build
	rm -f $(INSTALL_PATH)/vibe-oci
	@echo "✅ Uninstall complete"

## Run tests
test:
	@echo "Running tests..."
	swift test

## Run benchmarks
benchmark:
	@echo "Running build benchmarks..."
	@./scripts/benchmark-builds.sh

## Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	swift package clean
	rm -rf .build
	@echo "✅ Clean complete"

## Format code with swift-format
format:
	@echo "Formatting Swift code..."
	@find Sources Tests -name "*.swift" -exec swift-format -i {} \;
	@echo "✅ Format complete"

## Lint code
lint:
	@echo "Linting Swift code..."
	@swiftlint lint --strict
	@echo "✅ Lint complete"

## Generate Xcode project
xcode:
	@echo "Generating Xcode project..."
	swift package generate-xcodeproj
	@echo "✅ Xcode project generated"

## Display help
help:
	@echo "VibeCode Native macOS Build System"
	@echo ""
	@echo "Usage:"
	@echo "  make <target>"
	@echo ""
	@echo "Targets:"
	@grep -E '^## ' Makefile | sed 's/## /  /'
	@echo ""
	@echo "Environment Variables:"
	@echo "  PREFIX          Installation prefix (default: /usr/local)"
	@echo "  SWIFT_BUILD_FLAGS  Swift build flags (default: -c release)"
	@echo ""
	@echo "Examples:"
	@echo "  make build              # Build release binary"
	@echo "  make install            # Install to /usr/local/bin"
	@echo "  make PREFIX=~/.local install  # Install to custom location"
	@echo "  make test               # Run test suite"
	@echo "  make benchmark          # Run performance benchmarks"

## Quick development build
dev:
	swift build
	.build/debug/vibe-build info

## Build universal binary (arm64 + x86_64)
universal:
	@echo "Building universal binary..."
	swift build -c release --arch arm64 --arch x86_64
	@echo "✅ Universal binary built"
	@file .build/release/vibe-build
