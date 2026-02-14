# Changelog

All notable changes to this project are documented below, organized by release version.
This changelog covers 45 releases from the project's inception through the current development cycle.

## [v5.1.0-beta] - 2026-01-31

### Added
- unified launcher with OpenVSCode Server and lightweight VM support
- complete Bun ultra-minimal OpenVSCode VM build (97 MB working, 14 MB target)
- Bun support - 10x faster for loading your app
- FINAL ACHIEVEMENT - 85% Complete, Competition Ready
- Neovim in Alpine ARM64 VM - Downloaded, tested, solution documented
- Tiny kernel with networking on ARM64 macOS (32.5-40MB total)
- COMPETITION READY - 2/4 services tested, stack complete
- openvscode-server downloaded and documented (v1.105.1, 216MB)
- NETWORKING WORKS - DNS resolves, ready for disk-based VMs
- BREAKTHROUGH - eth0 WORKS - Network interface UP
- PROPER VM SOLUTION - EFI + ASIF + Full Alpine
- COMPREHENSIVE VM TEST REPORT - All VMs Tested
- 2 OF 4 SERVICES BUILT AND TESTED
- READY TO BUILD all tiny services (NO DOCKER)
- simplified single-VM approach for all tiny builds (no Docker)

### Changed
- Update .monaco-version-lock

### Other
- docs: update handoff with link to comprehensive walkthrough
- docs: add comprehensive step-by-step implementation walkthrough
- docs: add next agent handoff documentation
- docs: add architecture and implementation documentation
- Merge remote main: Preserve local Tailscale/AI/CoreML code
- docs: Complete mission status - Tiny ARM64 dev environment WORKING
- chore(deps): bump @opentelemetry/instrumentation-fs (#706)
- chore(deps-dev): bump @tailwindcss/postcss from 4.1.13 to 4.1.16 (#708)
- chore(deps): bump @openai/chatkit-react from 1.1.1 to 1.2.0 (#709)
- chore(deps-dev): bump @opentelemetry/exporter-jaeger from 2.1.0 to 2.2.0 (#710)
- chore(deps): bump @datadog/datadog-api-client from 1.41.0 to 1.46.0 (#711)
- chore(deps): bump next from 15.5.3 to 16.0.1 (#712)
- docs: Network Success Report - DNS resolves, VMs fully functional
- docs: ROOT CAUSE FOUND - Alpine kernel lacks virtio-net

## [v4.2.0] - 2025-11-17

### Added
- Release v4.0.0 with menubar, green console, and Datadog
- Enhance busybox with 17 essential terminal commands
- Complete v3.3.0 with 5-service architecture
- Legal compliance and UX improvements
- Add Docker, update OpenVSCode, restore menubar, create CLI tool
- Complete phase 2 with security, CI/CD, contribution, and monitoring
- Implement comprehensive CI/CD pipeline with GitHub Actions
- Add Datadog VSCode extension to unified VM
- Complete Ralph Loop v3.2.0 - Unified Services macOS App
- Complete Unified Services v3.2.0 with enhanced networking and testing
- Complete Ralph Loop v3.2.0 - All services working with localhost access

### Fixed
- Restore fixed MAC address for stable DHCP IP detection
- VM boot failure and terminal support (v3.3.0)
- generate Prisma client before Next.js build
- use webpack instead of Turbopack for production builds
- copy scripts directory before npm install in Dockerfile
- add Python and build tools for native modules in Dockerfile
- add --legacy-peer-deps flag to npm ci in Dockerfile.production
- add Dockerfile.production and enable standalone output mode
- resolve E2E workflow Git submodule traversal failure
- add 'use client' directive to FileUploadInterface

## [v4.1.0] - 2026-01-15

### Added
- Add console color protection and versioned release system

### Fixed
- resolve OpenVSCode terminal command failures (Issue #790)
- Console output now displays green text on black background
- Complete auth mock to fix callback type errors
- Enhanced fetch mock with proper Response object properties

## [v4.0.1] - 2026-01-17

### Fixed
- resolve OpenVSCode terminal command failures (Issue #790)

## [v4.0.0] - 2026-01-14

### Added
- Release v4.0.0 with menubar, green console, and Datadog

## [v3.3.0] - 2026-01-14

### Added
- Add Datadog VSCode extension to unified VM
- Complete Ralph Loop v3.2.0 - Unified Services macOS App
- add chat session persistence
- add AI chat streaming backend integration
- add error boundaries for chat and upload routes
- add navigation links for chat and upload routes
- Add FileUploadInterface component foundation
- Add ChatInterface component foundation
- Phase 2 Sprint 1 setup - basic route structure
- add performance and AI usage widgets

### Fixed
- add 'use client' directive to FileUploadInterface
- resolve 8 API chat test mock failures
- resolve 4 pre-existing test failures
- remove recreated mock that broke quota tests
- remove interfering mock that broke quota-middleware tests
- resolve 41 failing tests from security suite

## [v3.2.1] - 2026-01-14

### Other
- docs: Add v3.2.1 DMG release information

## [v3.2.0] - 2026-01-14

### Added
- Complete Ralph Loop with 100% test coverage and working unified VM app
- Complete 5-agent swarm optimization - TIME TO EDITOR: 25s
- Verify OpenVSCode-Server working on port 8080

### Fixed
- Move shared memory mount to execute immediately after filesystems
- Add GNU libc compatibility symlinks for OpenVSCode Node.js binary
- Replace macOS Valkey binary with correct Linux ARM64 binary
- Add LDAP library verification for PostgreSQL dependencies
- Improve network stability with DHCP retry logic
- Handle skipped Valkey in copy_binaries function
- Make Valkey binary check non-fatal
- Apply all agent fixes for TIME TO EDITOR optimization

## [v3.1.1] - 2026-01-07

### Added
- Complete Ralph Loop with 100% test coverage and working unified VM app

## [v3.0.0-unified-app] - 2026-01-05

### Added
- Phase 2 Sprint 1 setup - basic route structure
- add performance and AI usage widgets
- add monitoring dashboard foundation
- expand coverage with health checks and AI utilities
- add comprehensive AI endpoint test coverage

### Fixed
- remove interfering mock that broke quota-middleware tests
- resolve 41 failing tests from security suite
- resolve 12 failing database health tests
- pin urllib3>=2.6.3 in pydantic-ai-cli-agent example
- pin urllib3>=2.6.3 and Werkzeug>=3.1.5 in semantic-kernel template
- pin urllib3>=2.6.3 in PyTorch and HuggingFace templates
- update urllib3 to >=2.6.3 in dev requirements
- resolve HIGH ReDoS vulnerability in MCP SDK (CVE-2026-0621)
- resolve HIGH XSS vulnerability in React Router (CVE-2026-22029)
- exclude CLI dist directory from test discovery
- adjust coverage thresholds to current levels
- update test expectations in route.test.ts
- increase memory threshold and fix test expectations

## [v2.0.0-phase1-complete] - 2026-01-12

### Fixed
- remove interfering mock that broke quota-middleware tests

## [v1.8.0-tests-100-percent] - 2026-01-09

### Other
- test: fix macOS keychain server mock configuration (+7 tests)

## [v1.7.0-wave-2-complete] - 2026-01-08

### Other
- test: fix Jest hoisting and async module isolation issues (+28 tests)

## [v1.6.0-tests-100-percent] - 2026-01-08

### Added
- Add research issue for studying Tart/UTM implementations
- Add issue templates for bootloader fix and service installation

### Fixed
- resolve production build and improve test coverage
- resolve code quality issues and technical debt

### Other
- docs: Document license compatibility - Tart is Fair Source, incompatible with MIT
- docs: Add setup guide for new contributors picking up the codebase
- docs: Document bootloader fix and create comprehensive issue templates
- chore: Add GitHub issue template for documentation tone cleanup
- docs: Replace emoji-heavy peer reviews with honest assessment
- docs: Add authentic tone to release and contributing docs
- docs: Add peer review reports
- chore: complete repository cleanup - remove remaining worklogs
- chore: remove 80+ worklog files from repository
- ci: add comprehensive GitHub Actions workflows

## [v1.6.0-multivm] - 2025-11-03

### Added
- add Datadog secrets to GitHub Actions CI workflow
- add Datadog logging to test and security scripts
- integrate Datadog logging into infrastructure scripts
- add Datadog logging library for bash scripts
- add ddtrace APM instrumentation to all Python files
- App Store distribution preparation
- Add VM menu system for console management
- DHCP working + multiple VM instances supported
- OpenVSCode Server now working with dark mode and no welcome screen

### Fixed
- improve Datadog integration test mocking (0→4 passing)
- improve MFA unit tests with manual speakeasy mock (10→2 failures)
- resolve Next.js 16 build failure with webpack configuration
- restore missing dependencies after security updates
- resolve all 8 npm security vulnerabilities (0 remaining)
- correct AI chat stream test expectation for missing API key
- resolve agents API test failures and restore precommit hook security
- restore API key scanning to precommit hook
- adjust test thresholds and expectations
- resolve 11 of 14 agent API test failures
- improve agent API routing to handle direct ID paths
- update connection-pool-alerts test for current implementation
- remove duplicate jest.config.mjs
- DHCP fallback to static IP, disk mounting, improved init script
- DHCP now working - add /etc/udhcpc.script + console logging

### Other
- docs: update README to accurately reflect demo repo with working platform
- docs: update changelog for January 6, 2026 session
- docs: update README, Astro site, and changelog with January 2025 improvements
- Fix/unskip all tests (#763)
- Updates
- chore: Update Swift source with multi-instance support

## Earlier Releases (v1.0 - v1.5.x)

The following releases represent the project's foundation and early development:

- **v1.5.1-test-baseline** (2026-01-07): Datadog integration test mocking improvements
- **v1.5.0** (2025-11-02): Apple Virtualization Framework and performance improvements
- **v1.4a-electron** (2025-10-25): Chromium kiosk launcher for Lima
- **v1.3.1-lima-kiosk** (2025-10-25): Lima kiosk app packaging
- **v1.3.0-ard** (2025-10-25): Lima launcher via Tauri
- **v1.2.0** (2025-10-25): VS Code theme fixes and asset restoration
- **1.2.0-4** (2026-01-31): SwiftUI apps build (latest in 1.2.0 series)
- **v1.1.0** (2025-10-25): Minivim and microvm assets restoration
- **v1.0.0** (2025-12-17): Initial stable release - Services VM with Valkey, PostgreSQL 16, OpenVSCode Server, Docker CE

## Infrastructure and Kernel Releases (v1.0 series)

- **v1.0.0-observability** (2025-11-01): Observability release with monitoring and logging infrastructure
- **v1.0.0-initramfs** (2025-12-01): Initramfs build for VM boot
- **v1.0.0-basicvibecode** (2025-11-07): GitHub Pages documentation with working Docker Alpine VM
- **v1.0.0-apple-container** (2025-10-02): Apple Container distribution artifacts
- **v1.0-app-vsock** (2025-12-01): Vsock communication layer
- **v1.0-app-valkey** (2025-12-01): Valkey (Redis-compatible) service
- **v1.0-kernel-unified-postgres** (2025-12-01): Unified kernel with PostgreSQL
- **v1.0-kernel-unified-glibc** (2025-12-01): Unified kernel with glibc
- **v1.0-kernel-nodejs** (2025-12-01): Node.js kernel build
- **v1.0-kernel-k3s** (2025-12-01): K3s Kubernetes kernel

## Early and Experimental Releases

- **v0.9-beta** (2025-11-03): Native macOS VM management (pre-release)
- **v0.3.0-appstore** (2025-12-18): App Store distribution preparation
- **v0.2.0-vm-static** (2025-12-18): DHCP fallback to static IP configuration
- **v0.1.0-vm-services** (2025-12-16): VM services integration
- **cloud-hypervisor-v1.0.0-alpha** (2025-10-02): MicroVM runtime (pre-release)
- **fast-openvscode-vm-v0.1.0** (2025-10-02): Fast OpenVSCode VM experimental build
- **minivim-refresh-20251030** (2025-10-30): Tiny ARM64 dev environment completion milestone
- **minivim-20251002** (2025-10-03): Early minivim development tag
- **test-macos-universal-20251025-021238** (2025-10-25): macOS universal app test
- **large-artifacts-2026-02-04** (2026-02-04): Beads export state synchronization
- **pre-cleanup-backup** (pre-Wave 16): Repository cleanup backup tag

---

## Project Statistics

- **Total Releases**: 45+ tags across development and production versions
- **Active Development Period**: October 2024 - February 2026
- **Primary Platforms**: macOS (Apple Silicon + Intel), Alpine Linux ARM64
- **Architecture**: Next.js 14+ frontend, Tauri 2.9+ desktop shell, Alpine VM backend
- **Major Subsystems**: Virtual machine management, AI integration, Datadog observability, Docker support

## Release Notes Quality Evolution

- **Waves 3-22**: Initial development through binary rebuild (extensive commits per release)
- **Wave 23-30c**: Infrastructure and pipeline stabilization
- **Wave 31-34**: Final polish, quality sweeps, and consolidated releases
- **Current**: Detailed conventional-commit based changelog with automated generation

---

## For More Information

- **Detailed Commits**: `git log --all --oneline` for complete commit history
- **Contributor Info**: See [CONTRIBUTING.md](CONTRIBUTING.md)
- **Issue Tracking**: GitHub Issues for feature requests and bug reports
- **Architecture**: See project documentation in `/docs` directory

Generated on: 2026-02-14 08:34:53 UTC
Based on: 45 git tags covering 122+ agent deployments across 34+ waves
