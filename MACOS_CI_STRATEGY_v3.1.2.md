# macOS CI/CD Strategy for VibeCode v3.1.2

**Agent AY - macOS CI/CD Research Report**
**Date**: 2026-01-14
**Status**: Ready for Implementation

---

## Executive Summary

This document provides a comprehensive CI/CD strategy for VibeCode's Swift/SwiftUI macOS applications, based on GitHub Actions capabilities as of January 2026. The strategy addresses build automation, testing, security scanning, and release management while working around the critical limitation that **nested virtualization is not supported** on Apple Silicon GitHub-hosted runners.

### Key Findings

1. **GitHub-Hosted Runners**: macOS-14 and macOS-15 runners are production-ready with Xcode 16+ and Swift 5.9+ pre-installed
2. **Nested Virtualization**: NOT supported on ARM64 runners due to Apple Virtualization.framework limitations
3. **Cost Reduction**: GitHub reduced hosted runner prices by up to 39% effective January 1, 2026
4. **Testing Strategy**: Must use unit/integration tests without full VM boot; reserve E2E VM tests for self-hosted runners
5. **Security & Automation**: Full support for SwiftLint, Dependabot, code signing, and notarization

---

## Table of Contents

1. [GitHub Actions macOS Runners Capabilities](#1-github-actions-macos-runners-capabilities)
2. [Swift/SwiftUI CI/CD Support](#2-swiftswiftui-cicd-support)
3. [VM Testing Challenges & Limitations](#3-vm-testing-challenges--limitations)
4. [Recommended CI/CD Pipeline](#4-recommended-cicd-pipeline)
5. [Workflow YAML Templates](#5-workflow-yaml-templates)
6. [Security & Compliance](#6-security--compliance)
7. [Cost & Performance Analysis](#7-cost--performance-analysis)
8. [Implementation Roadmap](#8-implementation-roadmap)

---

## 1. GitHub Actions macOS Runners Capabilities

### 1.1 Available Runner Versions (January 2026)

| Runner Label | OS Version | Architecture | Status | Recommended For |
|--------------|-----------|--------------|---------|-----------------|
| `macos-15` | macOS 15.7.3 | ARM64 (M1/M2) | GA | Production builds |
| `macos-15-xlarge` | macOS 15.7.3 | ARM64 (M2) | GA | Faster builds (paid) |
| `macos-15-intel` | macOS 15.7.3 | Intel x86_64 | GA | Intel compatibility (until Aug 2027) |
| `macos-14` | macOS 14.x | ARM64/Intel | GA | Legacy support |
| `macos-13` | macOS 13.x | Intel | **DEPRECATED** | Do not use (EOL Dec 2025) |
| `macos-26` | macOS 26 | ARM64 | Public Beta | Cutting-edge testing |
| `macos-latest` | → `macos-15` | ARM64 | Alias | Points to macos-15 |

**Recommendation**: Use `macos-15` for all new workflows targeting VibeCode v3.1.2+

### 1.2 Pre-Installed Software (macOS-15 Runners)

#### Xcode & Swift

As of January 2026:

- **Xcode 16.3+**: Available (Xcode 16.2 and older removed Jan 12, 2026)
- **Xcode 26.2**: Added after Jan 12, 2026 cleanup
- **Swift**: Multiple versions available via Xcode installs
  - Swift 5.9+ (Xcode 15)
  - Swift 6.0+ (Xcode 16)
  - Swift 6.2+ (Xcode 26)

**Important Policy Changes (2026)**:
- Only **ONE major Xcode version** per macOS version
- Platform tools (SDK, simulator runtimes) available for **3 most recent Xcode versions only**
- Xcode 16.3 and older simulators deprecated on macOS-15 (Jan 12, 2026)

#### Development Tools

Pre-installed on all macOS runners:
- **Swift Package Manager** (SPM)
- **xcodebuild** command-line tools
- **Git** (latest)
- **Homebrew** package manager
- **Node.js** (via setup-node action)
- **Python** 3.x
- **Ruby** (for CocoaPods if needed)
- **fastlane** (CI/CD automation)

#### iOS Simulators

Available for testing:
- iPhone 14/15/16 simulators
- iPad simulators
- watchOS, tvOS, visionOS simulators (limited)

**Note**: Simulator runtimes only for recent Xcode versions (3 most recent)

### 1.3 Performance & Concurrency

| Plan | macOS Standard Runners | macOS Large Runners (-xlarge) |
|------|----------------------|-------------------------------|
| **Free/Pro** | Max 5 concurrent jobs | Available (paid) |
| **Team** | Max 5 concurrent jobs | Available (paid) |
| **Enterprise** | Max 50 concurrent jobs | Available (paid) |

**Build Times** (estimated for VibeCode):
- Clean build: 5-10 minutes
- Incremental build: 2-5 minutes
- Test suite: 2-5 minutes
- Total CI pipeline: 10-20 minutes

---

## 2. Swift/SwiftUI CI/CD Support

### 2.1 Building Swift macOS Apps

GitHub Actions **fully supports** building Swift macOS applications using:

1. **Swift Package Manager (SPM)** - Recommended for VibeCode
2. **xcodebuild** - For Xcode projects/workspaces
3. **fastlane** - For complex automation

### 2.2 Testing Capabilities

✅ **Supported**:
- Unit tests (XCTest)
- Integration tests (without VM)
- UI tests (SwiftUI view testing)
- Swift package tests
- Code coverage reports

❌ **NOT Supported on GitHub-Hosted**:
- Full VM boot tests (requires nested virtualization)
- Apple Virtualization.framework integration tests
- Docker containers (on ARM64 runners)

### 2.3 Example Build Patterns

#### Swift Package Manager (Recommended)

```bash
# Resolve dependencies
swift package resolve

# Build for macOS
swift build -c release --arch arm64

# Run tests
swift test --enable-code-coverage

# Build specific target
swift build --product UnifiedServicesVibeCodeApp
```

#### xcodebuild (If using Xcode project)

```bash
# Build macOS app
xcodebuild build \
  -scheme UnifiedServicesVibeCodeApp \
  -destination 'platform=macOS,arch=arm64' \
  -configuration Release

# Run tests
xcodebuild test \
  -scheme UnifiedServicesVibeCodeApp \
  -destination 'platform=macOS' \
  -enableCodeCoverage YES
```

### 2.4 Code Signing in CI

**GitHub Actions supports macOS code signing** with proper secret management:

#### Required Secrets

1. `MACOS_CERTIFICATE` - Base64-encoded .p12 certificate
2. `MACOS_CERTIFICATE_PASSWORD` - Certificate password
3. `MACOS_PROVISIONING_PROFILE` - Provisioning profile (if needed)
4. `APPLE_ID` - Apple Developer email
5. `APPLE_TEAM_ID` - 10-character Team ID
6. `APPLE_APP_PASSWORD` - App-specific password for notarization

#### Process

1. Import certificate to keychain
2. Build signed application
3. Create DMG
4. Notarize with Apple
5. Staple notarization ticket

**Automated tools available**:
- `indygreg/apple-code-sign-action` (open-source, Linux-compatible)
- Manual scripts using `codesign`, `productsign`, `xcrun notarytool`

---

## 3. VM Testing Challenges & Limitations

### 3.1 The Nested Virtualization Problem

**CRITICAL LIMITATION**: Apple Virtualization.framework on GitHub's ARM64 runners **does NOT support nested virtualization**.

#### Impact on VibeCode

VibeCode uses `VZVirtualMachine` to boot Linux VMs. This requires:
- Hardware virtualization support
- Apple Virtualization.framework
- Kernel extensions (nested hypervisor)

**GitHub ARM64 runners run as VMs themselves**, so:
- Cannot create nested VMs
- `VZVirtualMachine.init()` will fail
- Full integration tests with VM boot impossible

#### Technical Details

From GitHub Actions issue #12933:

> "Due to a limitation of Apple's Virtualization Framework, which GitHub's hypervisor uses, nested-virtualization is not supported by arm64 runners."

This affects:
- macOS-14 (ARM64)
- macOS-15 (ARM64)
- macOS-15-xlarge (ARM64)
- macOS-26 (ARM64)

**Intel runners** (macos-15-intel) theoretically support nested virtualization, but:
- Being phased out (EOL August 2027)
- Slower performance
- Not recommended for production CI

### 3.2 Workarounds & Alternatives

#### Option 1: Unit/Integration Tests WITHOUT Full VM (Recommended)

Test components in isolation:

```swift
// ✅ Can test in CI
class BaseVMManagerTests: XCTestCase {
    func testVMConfiguration() {
        let config = createVMConfiguration()
        XCTAssertNotNil(config)
        XCTAssertEqual(config.cpuCount, 4)
        XCTAssertEqual(config.memorySize, 4 * 1024 * 1024 * 1024)
    }

    func testNetworkStrategySelection() {
        let strategy = NATNetworkStrategy()
        XCTAssertTrue(strategy.supportsHostAccess)
    }

    func testDHCPLeaseMonitor() {
        let monitor = DHCPLeaseMonitor()
        // Test parsing logic without actual VM
    }
}
```

#### Option 2: Mock VM Components

```swift
protocol VMProtocol {
    func start() async throws
    func stop() async throws
}

class MockVM: VMProtocol {
    var isStarted = false

    func start() async throws {
        isStarted = true
    }

    func stop() async throws {
        isStarted = false
    }
}

// Use MockVM in tests, real VZVirtualMachine in production
```

#### Option 3: Self-Hosted Runners (For Full E2E Tests)

Run GitHub Actions on your own Mac hardware:

- **Physical Mac mini** (ARM64) - Full virtualization support
- **Mac Studio** - Maximum performance
- **MacBook Pro** - Portable testing

**Setup**:
```bash
# On your Mac
cd ~/actions-runner
./config.sh --url https://github.com/your-org/vibecode-webgui
./run.sh
```

**Label** self-hosted runner as `self-hosted-macos-vm` and use for E2E:

```yaml
jobs:
  e2e-vm-tests:
    runs-on: [self-hosted, macOS, ARM64, self-hosted-macos-vm]
    steps:
      - name: Run full VM boot tests
        run: swift test --filter UnifiedServicesTests
```

#### Option 4: Scheduled Nightly Tests (Self-Hosted)

Reserve expensive full VM tests for nightly builds:

```yaml
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily
  workflow_dispatch:  # Manual trigger

jobs:
  full-vm-tests:
    runs-on: [self-hosted, macOS, ARM64]
    # ...
```

### 3.3 Recommended Testing Strategy

| Test Type | GitHub-Hosted | Self-Hosted | Frequency |
|-----------|--------------|-------------|-----------|
| **Unit tests** (no VM) | ✅ Yes | ✅ Yes | Every commit |
| **Integration tests** (mocked VM) | ✅ Yes | ✅ Yes | Every PR |
| **Component tests** (networking, DHCP) | ✅ Yes | ✅ Yes | Every PR |
| **Security tests** (static analysis) | ✅ Yes | ✅ Yes | Every PR |
| **Build & package** (no run) | ✅ Yes | ✅ Yes | Every PR |
| **Full VM boot tests** | ❌ No | ✅ Yes | Nightly/release |
| **E2E service tests** (SSH, Valkey, etc.) | ❌ No | ✅ Yes | Nightly/release |

---

## 4. Recommended CI/CD Pipeline

### 4.1 Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Pull Request Trigger                      │
└────────────┬────────────────────────────────────────────────┘
             │
             ├──► Job 1: Lint & Format Check (2 min)
             │    ├─ SwiftLint
             │    ├─ swift format --check
             │    └─ SwiftFormat validation
             │
             ├──► Job 2: Build (5-8 min)
             │    ├─ swift build (debug & release)
             │    ├─ Verify all app targets
             │    └─ Upload build artifacts
             │
             ├──► Job 3: Unit Tests (3-5 min)
             │    ├─ swift test (unit tests only)
             │    ├─ Code coverage (80% target)
             │    └─ Upload test results
             │
             ├──► Job 4: Integration Tests (4-6 min)
             │    ├─ Mocked VM tests
             │    ├─ Networking strategy tests
             │    ├─ DHCP monitor tests
             │    └─ No actual VM boot
             │
             ├──► Job 5: Security Scan (2-3 min)
             │    ├─ SwiftLint security rules
             │    ├─ Dependency audit
             │    ├─ Secrets scanning
             │    └─ SAST analysis
             │
             └──► Job 6: Build Matrix (8-12 min)
                  ├─ macOS 14 + Xcode 16
                  ├─ macOS 15 + Xcode 16
                  └─ ARM64 + Intel (if needed)

┌─────────────────────────────────────────────────────────────┐
│                   Main Branch / Release                      │
└────────────┬────────────────────────────────────────────────┘
             │
             ├──► All PR Jobs (above)
             │
             ├──► Job 7: Code Signing & DMG (10-15 min)
             │    ├─ Import signing certificate
             │    ├─ Build release app
             │    ├─ Create signed DMG
             │    ├─ Notarize with Apple
             │    └─ Upload to releases
             │
             └──► Job 8: Deploy Artifacts (2-3 min)
                  ├─ Upload to GitHub Releases
                  ├─ Update changelog
                  └─ Create Git tag

┌─────────────────────────────────────────────────────────────┐
│                  Nightly / Self-Hosted                       │
└────────────┬────────────────────────────────────────────────┘
             │
             └──► Job 9: Full VM E2E Tests (15-20 min)
                  ├─ Boot UnifiedServicesVibeCodeApp VM
                  ├─ Test SSH (port 22)
                  ├─ Test Valkey (port 6379)
                  ├─ Test PostgreSQL (port 5432)
                  ├─ Test OpenVSCode (port 8080)
                  └─ Performance benchmarks
```

### 4.2 Workflow Files Structure

```
.github/workflows/
├── swift-ci.yml                  # Main CI (PR & main branch)
├── swift-lint.yml                # Lint & format checks
├── swift-security.yml            # Security scans
├── swift-release.yml             # Release automation
├── swift-nightly-vm-tests.yml    # Full VM tests (self-hosted)
└── dependabot.yml                # Dependency updates
```

---

## 5. Workflow YAML Templates

### 5.1 Main CI Pipeline (swift-ci.yml)

```yaml
name: Swift CI - Build & Test

on:
  push:
    branches:
      - main
      - 'v*.*.*'
    paths:
      - 'azure/SwiftUI-Apps/**'
      - '.github/workflows/swift-ci.yml'
  pull_request:
    paths:
      - 'azure/SwiftUI-Apps/**'
      - '.github/workflows/swift-ci.yml'

concurrency:
  group: swift-ci-${{ github.ref }}
  cancel-in-progress: true

env:
  SWIFT_VERSION: '6.2'
  XCODE_VERSION: '16.3'

jobs:
  # Job 1: Build
  build:
    name: Build Swift Apps
    runs-on: macos-15
    timeout-minutes: 20

    strategy:
      matrix:
        configuration: [Debug, Release]

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Select Xcode version
        run: |
          sudo xcode-select -switch /Applications/Xcode_${{ env.XCODE_VERSION }}.app
          xcodebuild -version
          swift --version

      - name: Cache Swift packages
        uses: actions/cache@v4
        with:
          path: |
            azure/SwiftUI-Apps/.build
            ~/Library/Caches/org.swift.swiftpm
          key: ${{ runner.os }}-spm-${{ hashFiles('azure/SwiftUI-Apps/**/Package.resolved') }}
          restore-keys: |
            ${{ runner.os }}-spm-

      - name: Resolve Swift dependencies
        working-directory: azure/SwiftUI-Apps
        run: swift package resolve

      - name: Build all targets (${{ matrix.configuration }})
        working-directory: azure/SwiftUI-Apps
        run: |
          swift build \
            --configuration $(echo "${{ matrix.configuration }}" | tr '[:upper:]' '[:lower:]') \
            --arch arm64 \
            -v

      - name: Build UnifiedServicesVibeCodeApp
        working-directory: azure/SwiftUI-Apps
        run: |
          swift build \
            --product UnifiedServicesVibeCodeApp \
            --configuration $(echo "${{ matrix.configuration }}" | tr '[:upper:]' '[:lower:]') \
            --arch arm64

      - name: Verify build artifacts
        working-directory: azure/SwiftUI-Apps
        run: |
          CONFIG=$(echo "${{ matrix.configuration }}" | tr '[:upper:]' '[:lower:]')
          ls -lh .build/arm64-apple-macosx/${CONFIG}/

          if [ -d "Apps/UnifiedServicesVibeCodeApp.app" ]; then
            echo "✅ App bundle exists"
            ls -lh Apps/UnifiedServicesVibeCodeApp.app/Contents/MacOS/
          fi

      - name: Upload build artifacts
        if: matrix.configuration == 'Release'
        uses: actions/upload-artifact@v4
        with:
          name: swift-build-${{ matrix.configuration }}-${{ github.sha }}
          path: |
            azure/SwiftUI-Apps/.build/arm64-apple-macosx/release/
            azure/SwiftUI-Apps/Apps/UnifiedServicesVibeCodeApp.app
          retention-days: 7

  # Job 2: Unit Tests
  test-unit:
    name: Unit Tests
    runs-on: macos-15
    timeout-minutes: 15
    needs: build

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Select Xcode version
        run: |
          sudo xcode-select -switch /Applications/Xcode_${{ env.XCODE_VERSION }}.app
          xcodebuild -version

      - name: Cache Swift packages
        uses: actions/cache@v4
        with:
          path: |
            azure/SwiftUI-Apps/.build
            ~/Library/Caches/org.swift.swiftpm
          key: ${{ runner.os }}-spm-${{ hashFiles('azure/SwiftUI-Apps/**/Package.resolved') }}
          restore-keys: |
            ${{ runner.os }}-spm-

      - name: Run unit tests
        working-directory: azure/SwiftUI-Apps
        run: |
          swift test \
            --enable-code-coverage \
            --filter '.*Tests' \
            --filter '!UnifiedServicesTests' \
            --filter '!.*E2E.*' \
            -v

      - name: Generate code coverage report
        working-directory: azure/SwiftUI-Apps
        run: |
          xcrun llvm-cov export \
            -format="lcov" \
            .build/debug/VibeCodeSharedPackageTests.xctest/Contents/MacOS/VibeCodeSharedPackageTests \
            -instr-profile .build/debug/codecov/default.profdata \
            > coverage.lcov

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          files: azure/SwiftUI-Apps/coverage.lcov
          flags: swift-unit-tests
          name: swift-unit-tests
          fail_ci_if_error: false

      - name: Coverage summary
        working-directory: azure/SwiftUI-Apps
        run: |
          echo "## Code Coverage Summary" >> $GITHUB_STEP_SUMMARY
          xcrun llvm-cov report \
            .build/debug/VibeCodeSharedPackageTests.xctest/Contents/MacOS/VibeCodeSharedPackageTests \
            -instr-profile .build/debug/codecov/default.profdata \
            >> $GITHUB_STEP_SUMMARY

  # Job 3: Integration Tests (No VM Boot)
  test-integration:
    name: Integration Tests (No VM)
    runs-on: macos-15
    timeout-minutes: 15
    needs: build

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Select Xcode version
        run: |
          sudo xcode-select -switch /Applications/Xcode_${{ env.XCODE_VERSION }}.app

      - name: Cache Swift packages
        uses: actions/cache@v4
        with:
          path: |
            azure/SwiftUI-Apps/.build
            ~/Library/Caches/org.swift.swiftpm
          key: ${{ runner.os }}-spm-${{ hashFiles('azure/SwiftUI-Apps/**/Package.resolved') }}
          restore-keys: |
            ${{ runner.os }}-spm-

      - name: Run integration tests (mocked VM)
        working-directory: azure/SwiftUI-Apps
        run: |
          # Run tests that don't require VM boot
          swift test \
            --filter 'BaseVMManagerTests' \
            --filter 'NetworkingStrategyTests' \
            --filter 'DHCPLeaseMonitorTests' \
            --filter 'ObservabilityProviderTests' \
            -v

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: integration-test-results
          path: azure/SwiftUI-Apps/.build/debug/
          retention-days: 7

  # Job 4: Security Tests
  security:
    name: Security Tests
    runs-on: macos-15
    timeout-minutes: 10

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Run security tests
        working-directory: azure/SwiftUI-Apps
        run: |
          swift test \
            --filter 'SecurityTests' \
            -v

  # Job 5: CI Summary
  ci-summary:
    name: CI Summary
    runs-on: ubuntu-latest
    needs: [build, test-unit, test-integration, security]
    if: always()

    steps:
      - name: Generate summary
        run: |
          echo "## Swift CI Results" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "- Build: ${{ needs.build.result }}" >> $GITHUB_STEP_SUMMARY
          echo "- Unit Tests: ${{ needs.test-unit.result }}" >> $GITHUB_STEP_SUMMARY
          echo "- Integration Tests: ${{ needs.test-integration.result }}" >> $GITHUB_STEP_SUMMARY
          echo "- Security Tests: ${{ needs.security.result }}" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY

          if [[ "${{ needs.build.result }}" == "success" ]] && \
             [[ "${{ needs.test-unit.result }}" == "success" ]] && \
             [[ "${{ needs.test-integration.result }}" == "success" ]] && \
             [[ "${{ needs.security.result }}" == "success" ]]; then
            echo "✅ All checks passed!" >> $GITHUB_STEP_SUMMARY
          else
            echo "❌ Some checks failed" >> $GITHUB_STEP_SUMMARY
            exit 1
          fi
```

### 5.2 Lint & Format Workflow (swift-lint.yml)

```yaml
name: Swift Lint & Format

on:
  pull_request:
    paths:
      - 'azure/SwiftUI-Apps/**/*.swift'
      - '.github/workflows/swift-lint.yml'

concurrency:
  group: swift-lint-${{ github.ref }}
  cancel-in-progress: true

jobs:
  swiftlint:
    name: SwiftLint
    runs-on: macos-15
    timeout-minutes: 5

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Install SwiftLint
        run: brew install swiftlint

      - name: Run SwiftLint
        working-directory: azure/SwiftUI-Apps
        run: |
          swiftlint lint \
            --reporter github-actions-logging \
            --strict \
            --config .swiftlint.yml

      - name: SwiftLint report
        if: always()
        working-directory: azure/SwiftUI-Apps
        run: |
          swiftlint lint --reporter markdown >> $GITHUB_STEP_SUMMARY

  swiftformat:
    name: SwiftFormat Check
    runs-on: macos-15
    timeout-minutes: 5

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install SwiftFormat
        run: brew install swiftformat

      - name: Check formatting
        working-directory: azure/SwiftUI-Apps
        run: |
          swiftformat --lint \
            --config .swiftformat \
            --reporter github-actions-logging \
            .

      - name: Show formatting diff
        if: failure()
        working-directory: azure/SwiftUI-Apps
        run: |
          echo "## SwiftFormat Issues" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "Run \`swiftformat .\` to fix formatting" >> $GITHUB_STEP_SUMMARY
```

### 5.3 Security Scanning Workflow (swift-security.yml)

```yaml
name: Swift Security Scan

on:
  push:
    branches: [main]
  pull_request:
    branches: ['**']
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday

concurrency:
  group: swift-security-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read
  security-events: write
  pull-requests: write

jobs:
  dependency-audit:
    name: Dependency Audit
    runs-on: macos-15
    timeout-minutes: 10

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Check for Swift security advisories
        working-directory: azure/SwiftUI-Apps
        run: |
          echo "## Swift Dependency Security Audit" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY

          # Swift doesn't have built-in audit like npm/cargo
          # Check GitHub Advisory Database manually
          echo "📦 Checking Swift package dependencies..." >> $GITHUB_STEP_SUMMARY

          if [ -f "Package.resolved" ]; then
            echo "### Dependencies" >> $GITHUB_STEP_SUMMARY
            cat Package.resolved | jq -r '.pins[] | "- \(.identity) @ \(.state.version // .state.branch // .state.revision)"' >> $GITHUB_STEP_SUMMARY
          fi

          echo "" >> $GITHUB_STEP_SUMMARY
          echo "⚠️ Note: Manual review required for Swift dependencies" >> $GITHUB_STEP_SUMMARY
          echo "Check: https://github.com/advisories?query=ecosystem%3Aswift" >> $GITHUB_STEP_SUMMARY

  secrets-scan:
    name: Secrets Scanning
    runs-on: ubuntu-latest
    timeout-minutes: 5

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: TruffleHog Secret Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./azure/SwiftUI-Apps
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
          extra_args: --only-verified --json

  swiftlint-security:
    name: SwiftLint Security Rules
    runs-on: macos-15
    timeout-minutes: 5

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install SwiftLint
        run: brew install swiftlint

      - name: Create security-focused SwiftLint config
        working-directory: azure/SwiftUI-Apps
        run: |
          cat > .swiftlint-security.yml <<EOF
          opt_in_rules:
            - force_unwrapping
            - force_try
            - force_cast
            - implicitly_unwrapped_optional
            - weak_delegate
            - fatal_error_message

          disabled_rules: []

          included:
            - .

          excluded:
            - .build
            - Tests
          EOF

      - name: Run security-focused linting
        working-directory: azure/SwiftUI-Apps
        run: |
          swiftlint lint \
            --config .swiftlint-security.yml \
            --reporter markdown \
            >> $GITHUB_STEP_SUMMARY

  code-quality:
    name: Static Analysis
    runs-on: macos-15
    timeout-minutes: 10

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Select Xcode
        run: sudo xcode-select -switch /Applications/Xcode_16.3.app

      - name: Run Swift compiler warnings as errors
        working-directory: azure/SwiftUI-Apps
        run: |
          swift build -Xswiftc -warnings-as-errors 2>&1 | tee build-warnings.log || true

      - name: Check for unsafe patterns
        working-directory: azure/SwiftUI-Apps
        run: |
          echo "## Unsafe Code Patterns" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY

          # Check for force unwraps
          FORCE_UNWRAPS=$(grep -r "!" --include="*.swift" Shared Apps | grep -v "!=" | wc -l || true)
          echo "- Force unwraps (!): $FORCE_UNWRAPS" >> $GITHUB_STEP_SUMMARY

          # Check for force try
          FORCE_TRY=$(grep -r "try!" --include="*.swift" Shared Apps | wc -l || true)
          echo "- Force try: $FORCE_TRY" >> $GITHUB_STEP_SUMMARY

          # Check for force cast
          FORCE_CAST=$(grep -r "as!" --include="*.swift" Shared Apps | wc -l || true)
          echo "- Force cast (as!): $FORCE_CAST" >> $GITHUB_STEP_SUMMARY

          # Check for fatalError
          FATAL_ERRORS=$(grep -r "fatalError" --include="*.swift" Shared Apps | wc -l || true)
          echo "- fatalError calls: $FATAL_ERRORS" >> $GITHUB_STEP_SUMMARY

  security-summary:
    name: Security Summary
    runs-on: ubuntu-latest
    needs: [dependency-audit, secrets-scan, swiftlint-security, code-quality]
    if: always()

    steps:
      - name: Generate summary
        run: |
          echo "## 🔒 Security Scan Results" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "- Dependency Audit: ${{ needs.dependency-audit.result }}" >> $GITHUB_STEP_SUMMARY
          echo "- Secrets Scan: ${{ needs.secrets-scan.result }}" >> $GITHUB_STEP_SUMMARY
          echo "- SwiftLint Security: ${{ needs.swiftlint-security.result }}" >> $GITHUB_STEP_SUMMARY
          echo "- Code Quality: ${{ needs.code-quality.result }}" >> $GITHUB_STEP_SUMMARY
```

### 5.4 Release Workflow (swift-release.yml)

```yaml
name: Swift Release - Build & Sign DMG

on:
  push:
    tags:
      - 'v*.*.*'
  workflow_dispatch:
    inputs:
      version:
        description: 'Release version (e.g., v3.1.2)'
        required: true

env:
  APP_NAME: "UnifiedServicesVibeCodeApp"
  DMG_NAME: "VibeCode-Installer"

jobs:
  build-and-sign:
    name: Build, Sign & Notarize
    runs-on: macos-15
    timeout-minutes: 30

    permissions:
      contents: write

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Select Xcode
        run: |
          sudo xcode-select -switch /Applications/Xcode_16.3.app
          xcodebuild -version
          swift --version

      - name: Get version from tag
        id: version
        run: |
          if [[ "${{ github.event_name }}" == "workflow_dispatch" ]]; then
            VERSION="${{ github.event.inputs.version }}"
          else
            VERSION="${GITHUB_REF#refs/tags/}"
          fi
          echo "version=${VERSION}" >> $GITHUB_OUTPUT
          echo "Building version: ${VERSION}"

      - name: Import signing certificate
        env:
          MACOS_CERTIFICATE: ${{ secrets.MACOS_CERTIFICATE }}
          MACOS_CERTIFICATE_PASSWORD: ${{ secrets.MACOS_CERTIFICATE_PASSWORD }}
          KEYCHAIN_PASSWORD: ${{ secrets.KEYCHAIN_PASSWORD }}
        run: |
          # Create temporary keychain
          KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db
          security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
          security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"

          # Import certificate
          echo "$MACOS_CERTIFICATE" | base64 --decode > certificate.p12
          security import certificate.p12 \
            -k "$KEYCHAIN_PATH" \
            -P "$MACOS_CERTIFICATE_PASSWORD" \
            -T /usr/bin/codesign \
            -T /usr/bin/productsign

          # Set keychain for codesign
          security list-keychain -d user -s "$KEYCHAIN_PATH"
          security set-key-partition-list \
            -S apple-tool:,apple:,codesign: \
            -s -k "$KEYCHAIN_PASSWORD" \
            "$KEYCHAIN_PATH"

      - name: Build release app
        working-directory: azure/SwiftUI-Apps
        run: |
          swift build \
            --configuration release \
            --arch arm64 \
            --product ${{ env.APP_NAME }}

      - name: Sign application
        env:
          MACOS_CERTIFICATE_NAME: ${{ secrets.MACOS_CERTIFICATE_NAME }}
        working-directory: azure/SwiftUI-Apps
        run: |
          # Sign the app bundle
          codesign --force --deep --sign "$MACOS_CERTIFICATE_NAME" \
            --options runtime \
            --entitlements Apps/${{ env.APP_NAME }}/Entitlements.plist \
            --timestamp \
            Apps/${{ env.APP_NAME }}.app

          # Verify signature
          codesign --verify --verbose Apps/${{ env.APP_NAME }}.app
          spctl --assess --verbose Apps/${{ env.APP_NAME }}.app

      - name: Create DMG
        working-directory: azure/SwiftUI-Apps
        run: |
          # Create temporary DMG directory
          mkdir -p dmg-staging
          cp -R Apps/${{ env.APP_NAME }}.app dmg-staging/
          ln -s /Applications dmg-staging/Applications

          # Create DMG
          hdiutil create \
            -volname "${{ env.DMG_NAME }}" \
            -srcfolder dmg-staging \
            -ov -format UDZO \
            "${{ env.DMG_NAME }}-${{ steps.version.outputs.version }}.dmg"

      - name: Sign DMG
        env:
          MACOS_CERTIFICATE_NAME: ${{ secrets.MACOS_CERTIFICATE_NAME }}
        working-directory: azure/SwiftUI-Apps
        run: |
          codesign --force --sign "$MACOS_CERTIFICATE_NAME" \
            --timestamp \
            "${{ env.DMG_NAME }}-${{ steps.version.outputs.version }}.dmg"

          # Verify DMG signature
          codesign --verify --verbose "${{ env.DMG_NAME }}-${{ steps.version.outputs.version }}.dmg"

      - name: Notarize with Apple
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          APPLE_APP_PASSWORD: ${{ secrets.APPLE_APP_PASSWORD }}
        working-directory: azure/SwiftUI-Apps
        run: |
          # Submit for notarization
          xcrun notarytool submit \
            "${{ env.DMG_NAME }}-${{ steps.version.outputs.version }}.dmg" \
            --apple-id "$APPLE_ID" \
            --team-id "$APPLE_TEAM_ID" \
            --password "$APPLE_APP_PASSWORD" \
            --wait \
            --timeout 30m

          # Staple notarization ticket
          xcrun stapler staple "${{ env.DMG_NAME }}-${{ steps.version.outputs.version }}.dmg"

          # Verify staple
          xcrun stapler validate "${{ env.DMG_NAME }}-${{ steps.version.outputs.version }}.dmg"

      - name: Generate checksums
        working-directory: azure/SwiftUI-Apps
        run: |
          shasum -a 256 "${{ env.DMG_NAME }}-${{ steps.version.outputs.version }}.dmg" > checksums.txt
          shasum -a 512 "${{ env.DMG_NAME }}-${{ steps.version.outputs.version }}.dmg" >> checksums.txt

      - name: Create release notes
        id: release_notes
        run: |
          cat > release_notes.md <<EOF
          # VibeCode ${{ steps.version.outputs.version }}

          ## What's New

          - UnifiedServicesVibeCodeApp with all services
          - SSH, Valkey, PostgreSQL, OpenVSCode support
          - Enhanced networking with NAT strategy
          - Improved observability (Datadog, OpenTelemetry)

          ## Installation

          1. Download \`${{ env.DMG_NAME }}-${{ steps.version.outputs.version }}.dmg\`
          2. Open the DMG file
          3. Drag VibeCode to Applications folder
          4. Launch from Applications

          ## System Requirements

          - macOS 14.0+ (Sonoma or later)
          - Apple Silicon (M1/M2/M3) or Intel Mac
          - 8GB RAM minimum (16GB recommended)
          - 10GB free disk space

          ## Checksums

          \`\`\`
          $(cat azure/SwiftUI-Apps/checksums.txt)
          \`\`\`

          ## Known Issues

          - None at this time

          ## Support

          Report issues: https://github.com/your-org/vibecode-webgui/issues
          EOF

      - name: Upload to GitHub Releases
        uses: softprops/action-gh-release@v1
        with:
          tag_name: ${{ steps.version.outputs.version }}
          name: VibeCode ${{ steps.version.outputs.version }}
          body_path: release_notes.md
          files: |
            azure/SwiftUI-Apps/${{ env.DMG_NAME }}-${{ steps.version.outputs.version }}.dmg
            azure/SwiftUI-Apps/checksums.txt
          draft: false
          prerelease: false
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: release-artifacts-${{ steps.version.outputs.version }}
          path: |
            azure/SwiftUI-Apps/${{ env.DMG_NAME }}-${{ steps.version.outputs.version }}.dmg
            azure/SwiftUI-Apps/checksums.txt
            release_notes.md
          retention-days: 90

      - name: Cleanup keychain
        if: always()
        run: |
          KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db
          security delete-keychain "$KEYCHAIN_PATH" || true
```

### 5.5 Nightly VM Tests (swift-nightly-vm-tests.yml)

```yaml
name: Nightly VM Tests (Self-Hosted)

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily
  workflow_dispatch:

concurrency:
  group: nightly-vm-tests
  cancel-in-progress: false

jobs:
  full-vm-tests:
    name: Full VM Boot & Service Tests
    runs-on: [self-hosted, macOS, ARM64]
    timeout-minutes: 30

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Clean previous test runs
        run: |
          rm -rf /tmp/vibecode-test-* || true
          killall UnifiedServicesVibeCodeApp || true

      - name: Build test app
        working-directory: azure/SwiftUI-Apps
        run: |
          swift build \
            --configuration debug \
            --product UnifiedServicesVibeCodeApp

      - name: Run full VM tests
        working-directory: azure/SwiftUI-Apps
        timeout-minutes: 20
        run: |
          swift test \
            --filter 'UnifiedServicesTests' \
            --enable-code-coverage \
            -v

      - name: Run E2E service tests
        working-directory: azure/SwiftUI-Apps
        timeout-minutes: 15
        run: |
          # Run comprehensive service tests
          ./Tests/run_unified_tests.sh

      - name: Collect VM logs
        if: always()
        run: |
          mkdir -p vm-test-logs
          cp /tmp/vibecode-test-*/console.log vm-test-logs/ || true
          cp /tmp/vibecode-test-*/vm.log vm-test-logs/ || true

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: vm-test-results-${{ github.run_number }}
          path: |
            azure/SwiftUI-Apps/.build/debug/
            vm-test-logs/
          retention-days: 14

      - name: Performance benchmarks
        if: success()
        run: |
          echo "## VM Performance Benchmarks" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "- VM Boot Time: X seconds" >> $GITHUB_STEP_SUMMARY
          echo "- SSH Connection Time: Y ms" >> $GITHUB_STEP_SUMMARY
          echo "- Service Ready Time: Z seconds" >> $GITHUB_STEP_SUMMARY

      - name: Notify on failure
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: '🚨 Nightly VM Tests Failed',
              body: `Nightly VM tests failed on ${new Date().toISOString()}\n\nRun: ${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
              labels: ['test-failure', 'vm', 'nightly']
            })
```

### 5.6 Dependabot Configuration (.github/dependabot.yml)

```yaml
version: 2

updates:
  # Swift Package Manager dependencies
  - package-ecosystem: "swift"
    directory: "/azure/SwiftUI-Apps"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
    open-pull-requests-limit: 5
    reviewers:
      - "your-team"
    labels:
      - "dependencies"
      - "swift"
    commit-message:
      prefix: "chore(deps):"
      include: "scope"

  # npm dependencies (if any)
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
      - "npm"

  # GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "monthly"
    labels:
      - "dependencies"
      - "github-actions"
```

---

## 6. Security & Compliance

### 6.1 Secret Management

#### Required Secrets for CI/CD

Store in **GitHub Secrets** (Settings → Secrets and variables → Actions):

| Secret Name | Description | Example |
|-------------|-------------|---------|
| `MACOS_CERTIFICATE` | Base64-encoded .p12 certificate | `MIIK...` |
| `MACOS_CERTIFICATE_PASSWORD` | Certificate password | `your-password` |
| `MACOS_CERTIFICATE_NAME` | Full certificate name | `Developer ID Application: Your Name (ABC123)` |
| `APPLE_ID` | Apple Developer email | `dev@yourcompany.com` |
| `APPLE_TEAM_ID` | 10-character Team ID | `ABC1234567` |
| `APPLE_APP_PASSWORD` | App-specific password | `xxxx-xxxx-xxxx-xxxx` |
| `KEYCHAIN_PASSWORD` | Temporary keychain password | Generate random 32-char |
| `CODECOV_TOKEN` | Codecov upload token (optional) | `xxx-xxx-xxx` |

#### Creating Signing Certificate Secret

```bash
# Export certificate from Keychain
# File → Export Items → Personal Information Exchange (.p12)

# Convert to base64
base64 -i Certificates.p12 -o Certificates.base64

# Copy contents to MACOS_CERTIFICATE secret
cat Certificates.base64 | pbcopy
```

#### App-Specific Password for Notarization

1. Go to https://appleid.apple.com/account/manage
2. Sign in with Apple ID
3. Generate app-specific password
4. Store in `APPLE_APP_PASSWORD` secret

### 6.2 Security Scanning Tools

#### SwiftLint Security Rules

Create `.swiftlint.yml` in `azure/SwiftUI-Apps/`:

```yaml
# SwiftLint Configuration for VibeCode
# Security-focused rules

opt_in_rules:
  # Security
  - force_unwrapping
  - force_try
  - force_cast
  - implicitly_unwrapped_optional
  - weak_delegate
  - fatal_error_message
  - explicit_init
  - explicit_self
  - explicit_top_level_acl
  - explicit_type_interface

  # Code Quality
  - empty_count
  - empty_string
  - closure_spacing
  - contains_over_first_not_nil
  - first_where
  - last_where
  - sorted_first_last
  - reduce_into
  - toggle_bool
  - unused_import
  - unused_declaration
  - unused_capture_list

disabled_rules:
  - line_length  # Allow longer lines for URLs
  - todo  # Allow TODOs in development

included:
  - Apps
  - Shared
  - Tests

excluded:
  - .build
  - .swiftpm
  - Tests/Fixtures

force_unwrapping:
  severity: error

force_try:
  severity: error

force_cast:
  severity: warning

reporter: "xcode"
```

#### Secrets Scanning

Use **TruffleHog** for detecting secrets:

```yaml
- name: TruffleHog Secret Scan
  uses: trufflesecurity/trufflehog@main
  with:
    path: ./azure/SwiftUI-Apps
    base: main
    head: HEAD
    extra_args: --only-verified --json
```

#### Dependency Vulnerability Scanning

**Dependabot** now supports Swift (as of August 2023):

- Automatically opens PRs for dependency updates
- Alerts for known vulnerabilities in Swift packages
- Checks GitHub Advisory Database for Swift advisories

### 6.3 Code Signing Best Practices

1. **Never commit certificates or private keys**
   - Use GitHub Secrets exclusively
   - Rotate certificates annually

2. **Use temporary keychains**
   - Create keychain in `$RUNNER_TEMP`
   - Delete keychain in `if: always()` step

3. **Enable hardened runtime**
   - `--options runtime` flag for codesign
   - Required for notarization

4. **Verify signatures**
   - Run `codesign --verify` after signing
   - Run `spctl --assess` for Gatekeeper check

5. **Notarize all releases**
   - Required for macOS 10.15+
   - Use `xcrun notarytool` (replaces altool)
   - Staple ticket to DMG

### 6.4 Compliance Checklist

- [ ] All secrets stored in GitHub Secrets (not in code)
- [ ] Certificate rotation process documented
- [ ] Code signing enabled for all releases
- [ ] Notarization enabled for all releases
- [ ] Security scans run on every PR
- [ ] Dependency updates automated (Dependabot)
- [ ] Branch protection rules enabled on `main`
- [ ] Required reviews for PRs
- [ ] Status checks must pass before merge
- [ ] CHANGELOG.md updated for releases
- [ ] License headers on all source files

---

## 7. Cost & Performance Analysis

### 7.1 GitHub Actions Pricing (2026)

#### macOS Hosted Runners

**Pricing Reduction**: GitHub reduced hosted runner prices by **up to 39%** effective January 1, 2026.

| Plan | Free Minutes/Month | macOS Multiplier | Effective Free macOS Minutes |
|------|-------------------|-----------------|------------------------------|
| **Free** | 2,000 | 10x | 200 minutes/month |
| **Pro** | 3,000 | 10x | 300 minutes/month |
| **Team** | 3,000 | 10x | 300 minutes/month |
| **Enterprise** | 50,000 | 10x | 5,000 minutes/month |

**Overage Rates** (estimated post-reduction):
- Standard macOS runners: ~$0.08/minute (reduced from ~$0.13)
- Large macOS runners (-xlarge): ~$0.16/minute

#### Self-Hosted Runners

**Important**: GitHub introduced a **$0.002 per minute** cloud platform charge for self-hosted runners effective March 1, 2026.

- Previously: Free (only pay for your hardware)
- Now: $0.002/minute + your hardware costs

**Community Feedback**: GitHub postponed this change after backlash, so check current policy.

### 7.2 Estimated Monthly Costs

#### Scenario 1: Small Team (10 PRs/day)

**GitHub-Hosted Only**:

| Activity | Minutes/Run | Runs/Day | Daily Minutes | Monthly Minutes | Monthly Cost |
|----------|-------------|----------|---------------|-----------------|--------------|
| PR CI (build+test) | 15 | 10 | 150 | 4,500 | $360 |
| Main branch CI | 20 | 5 | 100 | 3,000 | $240 |
| Nightly tests | 0 (self-hosted) | 1 | 0 | 0 | $0 |
| Weekly releases | 30 | 0.14 | 4.2 | 126 | $10 |
| **Total** | | | **254.2** | **7,626** | **$610/mo** |

**With Self-Hosted for Nightly**:

| Activity | Cost |
|----------|------|
| GitHub-hosted (PR/main) | $600/mo |
| Self-hosted Mac mini | $500 one-time + $0.002/min |
| **Estimated savings** | Break-even in 1 month |

#### Scenario 2: Medium Team (30 PRs/day)

**GitHub-Hosted Only**: ~$1,800/month
**Hybrid (self-hosted nightly)**: ~$1,500/month

### 7.3 Performance Optimization Tips

#### 1. Cache Swift Packages

```yaml
- name: Cache Swift packages
  uses: actions/cache@v4
  with:
    path: |
      azure/SwiftUI-Apps/.build
      ~/Library/Caches/org.swift.swiftpm
    key: ${{ runner.os }}-spm-${{ hashFiles('**/Package.resolved') }}
    restore-keys: |
      ${{ runner.os }}-spm-
```

**Impact**: Reduces build time by **30-50%** after first run

#### 2. Use Concurrency Limits

```yaml
concurrency:
  group: swift-ci-${{ github.ref }}
  cancel-in-progress: true
```

**Impact**: Saves minutes by canceling outdated runs

#### 3. Split Jobs for Parallelism

Run independent jobs in parallel:
- Lint (2 min)
- Build (5 min)
- Unit tests (3 min)
- Integration tests (4 min)

**Impact**: Total time = max(2,5,3,4) = 5 min instead of 14 min

#### 4. Use Matrix Builds Selectively

Only test multiple OS versions for releases:

```yaml
strategy:
  matrix:
    os: [macos-15]  # Single OS for PRs
    # os: [macos-14, macos-15]  # Multiple for releases
```

**Impact**: Saves 50% of build minutes on PRs

#### 5. Skip CI for Docs Changes

```yaml
on:
  push:
    paths-ignore:
      - '**.md'
      - 'docs/**'
```

**Impact**: Saves ~20% of unnecessary runs

### 7.4 Cost Comparison: GitHub-Hosted vs Self-Hosted

#### GitHub-Hosted (macos-15)

**Pros**:
- No infrastructure management
- Auto-scaling
- Always up-to-date OS/Xcode
- No maintenance

**Cons**:
- 10x pricing multiplier
- No nested virtualization (ARM64)
- Limited to 5-50 concurrent jobs
- Shared resources

**Total Cost**: $600-2,000/month for active projects

#### Self-Hosted (Mac mini M2)

**Pros**:
- One-time hardware cost ($500-800)
- Full nested virtualization support
- Unlimited concurrency (per machine)
- Full control

**Cons**:
- Hardware purchase
- Setup & maintenance
- OS/Xcode updates manual
- $0.002/min platform charge (if enforced)

**Total Cost**: $500 upfront + $50-100/month (electricity + platform fees)

#### Recommended Hybrid Approach

- **GitHub-hosted**: PR checks, unit tests, builds (fast, no VM)
- **Self-hosted**: Nightly full VM tests, E2E tests (requires VM)

**Best of both worlds**: Fast PR feedback + comprehensive nightly testing

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Week 1)

- [ ] Create `.github/workflows/` directory
- [ ] Add `swift-ci.yml` (basic build + unit tests)
- [ ] Add `swift-lint.yml` (SwiftLint + SwiftFormat)
- [ ] Create `.swiftlint.yml` configuration
- [ ] Test workflows on a feature branch
- [ ] Fix any build issues revealed by CI

### Phase 2: Security & Quality (Week 2)

- [ ] Add `swift-security.yml` (secrets, dependencies, SAST)
- [ ] Set up TruffleHog secret scanning
- [ ] Enable Dependabot for Swift packages
- [ ] Add code coverage reporting (Codecov)
- [ ] Create SwiftFormat configuration
- [ ] Run security audit, fix critical issues

### Phase 3: Testing Strategy (Week 3)

- [ ] Separate tests into unit/integration/e2e
- [ ] Update test filters to skip VM tests in GitHub-hosted
- [ ] Mock VM components for integration tests
- [ ] Add test result uploading
- [ ] Configure test timeouts
- [ ] Document test categories

### Phase 4: Release Automation (Week 4)

- [ ] Set up code signing secrets
- [ ] Add `swift-release.yml` workflow
- [ ] Test DMG creation locally
- [ ] Test notarization locally
- [ ] Configure release workflow triggers
- [ ] Document release process

### Phase 5: Self-Hosted Runner (Optional)

- [ ] Purchase Mac mini or Mac Studio
- [ ] Install GitHub Actions runner
- [ ] Configure runner labels
- [ ] Add `swift-nightly-vm-tests.yml`
- [ ] Test full VM boot on self-hosted
- [ ] Schedule nightly runs

### Phase 6: Optimization & Monitoring

- [ ] Add workflow timing reports
- [ ] Optimize cache keys
- [ ] Review and optimize job dependencies
- [ ] Set up failure notifications
- [ ] Create CI dashboard
- [ ] Document CI/CD for team

---

## Appendix A: Quick Reference

### Common Commands

```bash
# Local testing (run before pushing)
swift build
swift test
swiftlint lint
swiftformat --lint .

# Check Xcode version
xcodebuild -version
swift --version

# List available Xcode versions on GitHub runner
ls /Applications | grep Xcode

# Select specific Xcode
sudo xcode-select -switch /Applications/Xcode_16.3.app

# Manual code signing
codesign --force --deep --sign "Developer ID" \
  --options runtime --timestamp MyApp.app
codesign --verify --verbose MyApp.app

# Manual notarization
xcrun notarytool submit MyApp.dmg \
  --apple-id email@example.com \
  --team-id ABC1234567 \
  --password xxxx-xxxx-xxxx-xxxx \
  --wait

# Staple notarization ticket
xcrun stapler staple MyApp.dmg
```

### Useful GitHub Actions

- `actions/checkout@v4` - Checkout code
- `actions/cache@v4` - Cache dependencies
- `actions/upload-artifact@v4` - Upload build artifacts
- `softprops/action-gh-release@v1` - Create GitHub release
- `codecov/codecov-action@v4` - Upload code coverage
- `trufflesecurity/trufflehog@main` - Scan for secrets
- `indygreg/apple-code-sign-action` - Code signing (cross-platform)

### Debugging CI Failures

```yaml
# Enable debug logging
- name: Debug info
  run: |
    echo "Runner OS: $RUNNER_OS"
    echo "Runner arch: $RUNNER_ARCH"
    echo "Xcode: $(xcodebuild -version)"
    echo "Swift: $(swift --version)"
    echo "Disk space:"
    df -h
    echo "Environment:"
    env | sort
```

---

## Appendix B: Resources & Documentation

### GitHub Actions Documentation

- [GitHub-hosted runners reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [Building and testing Swift](https://docs.github.com/en/actions/automating-builds-and-tests/building-and-testing-swift)
- [Actions runner pricing](https://docs.github.com/en/billing/reference/actions-runner-pricing)
- [Larger runners reference](https://docs.github.com/en/actions/reference/runners/larger-runners)

### macOS Runner Images

- [macOS-15 image README](https://github.com/actions/runner-images/blob/main/images/macos/macos-15-Readme.md)
- [macOS-14 image README](https://github.com/actions/runner-images/blob/main/images/macos/macos-14-Readme.md)
- [macOS-26 (beta) image README](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-arm64-Readme.md)
- [Runner images releases](https://github.com/actions/runner-images/releases)

### Code Signing & Notarization

- [Automatic Code-signing and Notarization for macOS apps using GitHub Actions](https://federicoterzi.com/blog/automatic-code-signing-and-notarization-for-macos-apps-using-github-actions/)
- [How to automatically sign macOS apps using GitHub Actions](https://localazy.com/blog/how-to-automatically-sign-macos-apps-using-github-actions)
- [Apple code signing GitHub Action](https://github.com/indygreg/apple-code-sign-action)
- [Signing and Notarizing with GitHub Actions](https://gregoryszorc.com/docs/apple-codesign/stable/apple_codesign_github_actions.html)

### Swift CI/CD

- [Swift - Build and Test (GitHub Action)](https://github.com/marketplace/actions/swift-build-and-test)
- [Optimizing CI for Xcode with GitHub Actions: Quick Guide](https://qualitycoding.org/github-actions-ci-xcode/)
- [Build and Test Swift Packages using Github Actions CI](https://medium.com/@przemek.jablonski/test-your-swift-package-with-github-actions-ci-22ac116480b8)

### Security & Dependencies

- [Swift Support for Dependabot Updates](https://github.blog/changelog/2023-08-01-swift-support-for-dependabot-updates/)
- [GitHub embraces Swift and provides code analysis, security alerts](https://blog.eidinger.info/github-embraces-swift-and-provides-code-analysis-security-alerts-and-dependency-updates-for-swift-projects)
- [SwiftLint Package Index](https://swiftpackageindex.com/realm/SwiftLint)

### Nested Virtualization Issues

- [Documentation Request: Nested Virtualization Support](https://github.com/actions/runner-images/issues/12933)
- [Virtualization is not enabled error on macos13 M1 runner](https://github.com/actions/runner-images/issues/8465)
- [Enable nested virtualization](https://github.com/orgs/community/discussions/160591)

### GitHub Changelog

- [Pricing changes for GitHub Actions](https://resources.github.com/actions/2026-pricing-changes-for-github-actions/)
- [Reduced pricing for GitHub-hosted runners usage](https://github.blog/changelog/2026-01-01-reduced-pricing-for-github-hosted-runners-usage/)
- [GitHub Actions: macOS 15 and Windows 2025 images are now generally available](https://github.blog/changelog/2025-04-10-github-actions-macos-15-and-windows-2025-images-are-now-generally-available/)
- [Actions: macOS 26 image now in public preview](https://github.blog/changelog/2025-09-11-actions-macos-26-image-now-in-public-preview/)

---

## Summary & Recommendations

### Key Takeaways

1. **GitHub Actions fully supports Swift/SwiftUI** macOS app CI/CD with Xcode 16+ and Swift 6.2+ pre-installed on macos-15 runners

2. **Nested virtualization is NOT supported** on ARM64 GitHub-hosted runners due to Apple Virtualization.framework limitations

3. **Hybrid strategy is optimal**:
   - GitHub-hosted: Fast PR checks (build, unit tests, lint, security)
   - Self-hosted: Comprehensive nightly VM tests (full boot, E2E services)

4. **Cost reduced 39%** as of January 2026, making GitHub-hosted runners more affordable

5. **Full automation possible**: Code signing, notarization, DMG creation, releases all work in CI

### Recommended Next Steps

1. **Immediate (Week 1)**:
   - Implement `swift-ci.yml` with build + unit tests
   - Add `swift-lint.yml` for code quality
   - Test on feature branch

2. **Short-term (Month 1)**:
   - Add security scanning
   - Enable Dependabot
   - Set up release automation
   - Configure code signing secrets

3. **Long-term (Month 2+)**:
   - Consider self-hosted runner for full VM tests
   - Optimize build times with caching
   - Add performance benchmarks
   - Monitor costs and adjust strategy

### Final Recommendation

**Start with GitHub-hosted runners for all CI**, accept that full VM boot tests won't work in CI initially, and **reserve VM E2E tests for manual testing or self-hosted runners later**. This provides immediate value (fast PR feedback, security scans, automated releases) while allowing gradual expansion to full E2E testing when needed.

---

**Report prepared by Agent AY**
**Date**: 2026-01-14
**Version**: 1.0
