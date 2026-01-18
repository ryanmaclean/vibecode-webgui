# Editor Fork & Mobile Strategy (Q4 2025)

## Objectives
- **Unified Fork Roadmap:** Align Eclipse Theia, Lapce, and VSCodium forks under shared packaging, telemetry, and compliance baselines.
- **Extension Compatibility:** Guarantee VSCode API parity where feasible, with shim layers for key extensions (GitHub Copilot, ESLint, Prettier, Live Share).
- **Mobile Reach:** Deliver first-class iPadOS/visionOS/tvOS experiences, prioritizing SwiftUI/Metal shells and controller-friendly layouts.
- **Resilience & Streaming:** Provide containerized streaming fallback (WebRTC/NoMachine) when native builds are blocked or performance-constrained.
- **Licensing & Security:** Maintain SPDX-audited SBOMs, enforce third-party license gates, and integrate SAST/DAST in weekly pipelines.

## Eclipse Theia (VSIX-first web IDE)
### Desktop Extensions & Builds
- **VSIX Supply:** Maintain VSIX mirror for top 50 VSCode extensions; run nightly compatibility sweeps on macOS, Windows, Linux.
- **Custom Packaging:** Ship signed installers via electron-builder with Hardened Runtime on macOS and MSIX on Windows; auto-update through private CDN.
- **Telemetry Harmonization:** Embed shared OpenTelemetry client with feature flags for Datadog vs Grafana back ends.
- **Licensing Checks:** Integrate FOSSA and OpenSSF Scorecard in CI to validate transitive dependencies before cutting release candidates.
- **Testing Matrix:** Execute Playwright smoke suites plus Jest component checks per platform build; gate merges on green matrix.
### Mobile & Emerging Platforms
- **iPadOS Shell:** Wrap Theia web bundle inside WKWebView with keyboard/trackpad support, leveraging iOS filesystem bookmarks for sandbox persistence.
- **visionOS SwiftUI/Metal:** Build SwiftUI window scene with Metal-accelerated canvas for virtual monitors; map multi-window to Theia workspaces.
- **Android & ChromeOS:** Package PWA with offline service workers and Android app bundle via Trusted Web Activity for Play Store distribution.
- **Streaming Fallback:** Offer containerized VS Code Server pod orchestrated via Tailscale + WebRTC when device CPU throttles.
- **Distribution:** Coordinate Apple TestFlight groups and enterprise MDM catalogs; maintain compliance docs for App Store review.

## Lapce (Native Rust Editor)
### Fork & Plugin Bridge
- **Plugin Bridge:** Extend Lapce plugin host to consume VSX manifest via WASI shim; prioritize tree-sitter, Copilot, and Git integrations.
- **Rust Fork Hygiene:** Track upstream Lapce weekly; rebase feature branches, run `cargo fmt`/`clippy`/`miri` to keep ABI stable.
- **Binary Delivery:** Produce notarized macOS universal binaries, MSI/winget manifests, and AppImage for Linux; publish checksums to releases.
- **Licensing Audit:** Automate cargo-deny and SPDX SBOM export; review GPL/LGPL transitive risks before bundling.
- **Testing Grid:** Add cross-platform UI regression via Specta/tauri-driver and unit tests in CI; measure startup performance regressions.
### Mobile / visionOS Path
- **Rust-Core Reuse:** Compile core editing engine to static lib for SwiftUI wrappers on iPadOS/iOS with Metal rendering.
- **SwiftUI/Metal Vision:** Prototype visionOS compositor bridging Lapce GPU renderer through Metal FFI; support hand/eye gestures.
- **Controller Support:** Implement SDL2 input layer for gamepad and Apple Pencil events, enabling tvOS/visionOS interactions.
- **Streaming Contingency:** Route to container-hosted Lapce via Rust gRPC proxy when native build fails App Store review.
- **App Store Readiness:** Validate via TestFlight (iOS/iPadOS) and visionOS Labs builds; ensure privacy manifest alignment.

## VSCodium Fork (Electron Baseline)
### Hardened Build Matrix
- **Secure Pipelines:** Use GitHub Actions hardened runners plus Sigstore attestations; enforce SLSA level 3 provenance.
- **Extension Pack:** Curate enterprise-approved VSIX bundle with policy engine; block marketplace calls in air-gapped deployments.
- **Packaging:** Produce DMG/PKG, MSI/winget, and Snap/Flatpak artifacts; include auto-update backed by CodePush-compatible endpoint.
- **Compliance:** Run license-scanner and binary whitelisting for bundled Node modules; publish SBOM diff per release.
- **Testing:** Execute smoke tests with `code -test` CLI, plus Cypress-based UI checks and spectral scanning for security headers.
### Mobile / TV Workbench
- **iPadOS Client:** Repackage via Capacitor using WKWebView + filesystem bridge; support split-view multitasking and hardware keyboard.
- **visionOS Workspace:** Create SwiftUI immersive space with Metal-based render textures; enable multi-monitor virtualization.
- **tvOS Layout:** Build remote-friendly UI with focus states and external keyboard/pointer support; sync settings via iCloud Keychain.
- **Android/Fire OS:** Bundle with Capacitor Android shell for Amazon Appstore/Google Play; integrate biometric auth APIs.
- **Streaming Mode:** Deliver containerized VS Code Server with QUIC/WebRTC path, falling back to HTTPS tunneling when UDP blocked.

## Cross-Cutting Investments
- **Shared UI Toolkit:** Maintain design tokens and theming parity across forks via `@vibe/ui-foundation` package.
- **Telemetry & Observability:** Standardize OpenTelemetry exporters, add session replay guardrails, and enforce anonymization policies.
- **Auth & Sync:** Provide secure SSO (OIDC) and encrypted settings sync using Cloudflare KV + Workers edge caching.
- **QA Automation:** Stand up nightly cross-device runs on BrowserStack, Bitrise, and physical lab rigs; aggregate results in Looker dashboard.
- **Documentation:** Publish living playbooks in `docs/research` with install, troubleshooting, and compliance chapters per fork.

## Immediate Action Items (Next 6 Weeks)
- **Fork Hardening:** Finish Lapce plugin bridge MVP and Theia VSIX sync job; run first extension compatibility report.
- **Mobile Shells:** Deliver SwiftUI iPadOS wrappers for Lapce and VSCodium; demo visionOS Metal surface prototype.
- **Streaming Pilot:** Launch containerized fallback service on staging AKS cluster with autoscaling and SOC2 logging.
- **Compliance Sprint:** Generate SBOMs for all forks and schedule third-party license review; document variances.
- **Testing Ramp:** Add Playwright + Cypress suites to CI and enforce green gate on PR merges for desktop forks.

## Backlog & Research Tracks (2026)
- **AI Pairing:** Investigate on-device ML copilots powered by CoreML and WebGPU for offline coding assistance.
- **Edge Sync:** Explore CRDT-based collaboration via Automerge syncing across mobile and streaming sessions.
- **Hardware Integrations:** Prototype haptic feedback for visionOS controllers and Apple Pencil hover APIs.
- **Low-Code Bridges:** Evaluate drag-and-drop UI builders integrated into Lapce/VSCodium mobile shells.
- **Post-Quantum Security:** Assess PQC-ready SSH tunnels and certificate rotation for enterprise deployments.
