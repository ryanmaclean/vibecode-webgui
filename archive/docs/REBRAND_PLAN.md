# VibeCode Rebranding Plan

## Executive Summary

This document provides a comprehensive strategy for rebranding OpenVSCode Server to **VibeCode** - a native macOS desktop IDE with AI assistance and VM integration capabilities. This plan analyzes the current Gitpod branding, defines the VibeCode brand identity, and provides a detailed file-by-file implementation roadmap.

**Status**: Planning Phase
**Target**: Native macOS IDE with AI + VM Integration
**Base**: OpenVSCode Server (Gitpod's VS Code fork)
**License**: MIT (maintained)

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [VibeCode Brand Identity](#2-vibecode-brand-identity)
3. [File Modification Plan](#3-file-modification-plan)
4. [Asset Creation Requirements](#4-asset-creation-requirements)
5. [Open-VSX Integration](#5-open-vsx-integration)
6. [CLI Binary Naming](#6-cli-binary-naming)
7. [Implementation Checklist](#7-implementation-checklist)
8. [Testing & Verification](#8-testing--verification)
9. [Legal & Licensing](#9-legal--licensing)

---

## 1. Current State Analysis

### 1.1 Gitpod Branding Audit

#### Primary Branding Files

**product.json** (`/openvscode-server/product.json`)
- `nameShort`: "OpenVSCode Server"
- `nameLong`: "OpenVSCode Server"
- `applicationName`: "openvscode-server"
- `dataFolderName`: ".openvscode-server"
- `darwinBundleIdentifier`: "openvscode.server"
- `licenseUrl`: Points to Gitpod GitHub repo
- `reportIssueUrl`: Points to Gitpod GitHub issues
- `twitterUrl`: Points to @gitpod Twitter
- Extension gallery: Already uses Open-VSX (good!)

#### CLI Constants (`/openvscode-server/cli/src/constants.rs`)
- `APPLICATION_NAME`: "code" (or from env var)
- `PRODUCT_NAME_LONG`: "Code - OSS"
- `QUALITYLESS_PRODUCT_NAME`: "Code"
- `DEFAULT_DATA_PARENT_DIR`: ".vscode-oss"

#### Resource Files
**macOS Icons** (`/openvscode-server/resources/darwin/`)
- `code.icns` - Main application icon (needs replacement)
- 29 file-type icons (.bat, .js, .py, etc.) - Can keep or customize
- `bin/code.sh` - Launcher script

**PNG Assets** (`/openvscode-server/resources/`)
- `server/code-192.png` - Web favicon
- `server/code-512.png` - Splash/logo
- `linux/code.png` - Linux icon
- `win32/code_150x150.png` - Windows tile
- `win32/code_70x70.png` - Windows tile

#### Documentation
- `README.md` - Heavy Gitpod branding, Docker instructions
- `LICENSE.txt` - MIT License (Copyright Microsoft) - Keep as-is
- Multiple references to "Gitpod" and "gitpod.io"

### 1.2 Current Build Artifacts

**CLI Binary**: `/openvscode-server/cli/target/release/code`
- Size: ~11.5 MB (stripped)
- Language: Rust
- Architecture: arm64 (macOS)
- Status: Successfully built

---

## 2. VibeCode Brand Identity

### 2.1 Product Name & Positioning

**Primary Name**: **VibeCode**
**Tagline Options** (choose one):

1. **"Code with Flow"** - Emphasizes smooth developer experience
2. **"AI-Native macOS IDE"** - Highlights AI-first approach
3. **"Where Code Meets Intelligence"** - Balance of traditional + AI
4. **"Your Mac's Smart IDE"** - macOS-specific positioning
5. **"Code. Learn. Create."** - Action-oriented, educational focus

**Recommended**: Option 2 - "AI-Native macOS IDE"
**Rationale**: Clearly differentiates from VS Code/OpenVSCode, emphasizes unique selling points (AI + macOS optimization).

### 2.2 Value Proposition

VibeCode is a **native macOS desktop IDE** that combines:
- **AI Assistance**: Built-in AI code completion, chat, and analysis
- **VM Integration**: Seamless development environment isolation via macOS Virtualization.framework
- **Modern Architecture**: Based on proven VS Code technology
- **Extension Ecosystem**: Full access to Open-VSX extension marketplace
- **Privacy-First**: Local-first AI processing with optional cloud fallback

### 2.3 Differentiation Matrix

| Feature | VS Code | OpenVSCode | code-server | VibeCode |
|---------|---------|------------|-------------|----------|
| **Platform** | Cross-platform | Browser/Server | Browser/Server | **Native macOS** |
| **AI Integration** | Extensions | Extensions | Extensions | **Built-in native** |
| **VM Support** | Remote Dev Containers | None | None | **Native VMs (vfkit)** |
| **Distribution** | Desktop app | Docker/CLI | Docker/Self-hosted | **macOS app bundle** |
| **Extension Source** | Microsoft Marketplace | Open-VSX | Open-VSX | **Open-VSX** |
| **Target User** | General developers | Remote teams | Self-hosters | **macOS AI developers** |

### 2.4 Visual Identity Direction

**Color Palette** (to be designed):
- Primary: Modern, vibrant (suggest deep purple/blue gradient)
- Accent: Energetic highlight (suggest cyan/teal)
- Background: Dark/light mode support
- Avoid: VS Code blue (differentiation)

**Icon Style**:
- Modern, minimal, recognizable
- Works at all sizes (16x16 to 512x512)
- Distinctly different from VS Code's infinity symbol
- Suggests "flow" or "intelligence" (waves, neural patterns, or abstract "V" shape)

**Typography**:
- Modern sans-serif (SF Pro for macOS native feel)
- Code font: Cascadia Code, JetBrains Mono, or Fira Code

---

## 3. File Modification Plan

### 3.1 Core Product Configuration

#### File: `/openvscode-server/product.json`

**Changes Required**:

```json
{
  "nameShort": "VibeCode",
  "nameLong": "VibeCode",
  "applicationName": "vibecode",
  "dataFolderName": ".vibecode",
  "win32MutexName": "vibecode",
  "licenseName": "MIT",
  "licenseUrl": "https://github.com/YOUR_ORG/vibecode-webgui/blob/main/LICENSE.txt",
  "serverLicenseUrl": "https://github.com/YOUR_ORG/vibecode-webgui/blob/main/LICENSE.txt",
  "serverApplicationName": "vibecode-server",
  "serverDataFolderName": ".vibecode-server",
  "tunnelApplicationName": "vibecode-tunnel",
  "win32DirName": "VibeCode",
  "win32NameVersion": "VibeCode",
  "win32RegValueName": "VibeCode",
  "win32AppUserModelId": "VibeCode",
  "darwinBundleIdentifier": "com.vibecode.ide",
  "linuxIconName": "vibecode",
  "twitterUrl": "https://twitter.com/YOUR_TWITTER",
  "reportIssueUrl": "https://github.com/YOUR_ORG/vibecode-webgui/issues/new",
  "requestFeatureUrl": "https://github.com/YOUR_ORG/vibecode-webgui/issues",
  "reportMarketplaceIssueUrl": "https://github.com/eclipse/openvsx/issues",
  "urlProtocol": "vibecode",
  "embedderIdentifier": "vibecode",

  // Keep Open-VSX gallery config (no change)
  "extensionsGallery": {
    "serviceUrl": "https://open-vsx.org/vscode/gallery",
    "itemUrl": "https://open-vsx.org/vscode/item",
    "resourceUrlTemplate": "https://open-vsx.org/vscode/unpkg/{publisher}/{name}/{version}/{path}",
    "controlUrl": "",
    "recommendationsUrl": "",
    "nlsBaseUrl": "",
    "publisherUrl": ""
  },

  "linkProtectionTrustedDomains": [
    "https://open-vsx.org",
    "https://vibecode.io"  // Add your domain
  ]
}
```

**Note**: Keep all extension recommendations as-is. Update UUIDs for Windows app IDs if publishing to Windows.

---

### 3.2 CLI Source Code

#### File: `/openvscode-server/cli/src/constants.rs`

**Changes Required**:

```rust
// Line 50-66
pub const APPLICATION_NAME: &str = match option_env!("VSCODE_CLI_APPLICATION_NAME") {
    Some(n) => n,
    None => "vibecode",  // Changed from "code"
};

pub const PRODUCT_NAME_LONG: &str = match option_env!("VSCODE_CLI_NAME_LONG") {
    Some(n) => n,
    None => "VibeCode",  // Changed from "Code - OSS"
};

pub const QUALITYLESS_PRODUCT_NAME: &str = match option_env!("VSCODE_CLI_QUALITYLESS_PRODUCT_NAME") {
    Some(n) => n,
    None => "VibeCode",  // Changed from "Code"
};

pub const QUALITYLESS_SERVER_NAME: &str = concatcp!(QUALITYLESS_PRODUCT_NAME, " Server");
// Results in "VibeCode Server"

pub const DEFAULT_DATA_PARENT_DIR: &str = match option_env!("VSCODE_CLI_DATA_FOLDER_NAME") {
    Some(n) => n,
    None => ".vibecode",  // Changed from ".vscode-oss"
};
```

**Alternative Approach**: Set environment variables during build instead of hardcoding:
- `VSCODE_CLI_APPLICATION_NAME=vibecode`
- `VSCODE_CLI_NAME_LONG="VibeCode"`
- `VSCODE_CLI_DATA_FOLDER_NAME=".vibecode"`

---

### 3.3 Package Configuration

#### File: `/openvscode-server/package.json`

**Changes Required**:

```json
{
  "name": "vibecode",  // Changed from "code-oss-dev"
  "version": "1.0.0",  // Start with 1.0.0 for VibeCode
  "author": {
    "name": "VibeCode Contributors"  // Changed from Microsoft
  },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/YOUR_ORG/vibecode-webgui.git"
  },
  "bugs": {
    "url": "https://github.com/YOUR_ORG/vibecode-webgui/issues"
  }
  // Rest unchanged
}
```

---

### 3.4 Documentation

#### File: `/openvscode-server/README.md`

**Complete Replacement** - New content:

```markdown
# VibeCode

[![GitHub](https://img.shields.io/github/license/YOUR_ORG/vibecode-webgui)](LICENSE.txt)
[![Discord](https://img.shields.io/discord/YOUR_DISCORD_ID)](https://discord.gg/YOUR_INVITE)

## What is VibeCode?

VibeCode is a native macOS IDE that brings AI-powered development to your Mac. Built on the proven VS Code architecture, it adds native AI assistance, seamless VM integration, and macOS-specific optimizations.

### Key Features

- **AI-Native**: Built-in code completion, chat, and intelligent refactoring
- **VM Integration**: Isolated development environments via macOS Virtualization.framework
- **Native Performance**: Optimized for Apple Silicon (M-series chips)
- **Extension Ecosystem**: Full access to Open-VSX marketplace
- **Privacy-First**: Local AI processing with optional cloud fallback

## Getting Started

### macOS Installation

1. Download the latest release from [Releases](https://github.com/YOUR_ORG/vibecode-webgui/releases)
2. Mount the DMG and drag VibeCode to Applications
3. Launch VibeCode from Launchpad or Spotlight

### Building from Source

See [DESKTOP_BUILD_GUIDE.md](../docs/DESKTOP_BUILD_GUIDE.md) for instructions.

## Documentation

- [User Guide](https://vibecode.io/docs)
- [AI Features](https://vibecode.io/docs/ai)
- [VM Setup](https://vibecode.io/docs/vms)
- [Extension Development](https://vibecode.io/docs/extensions)

## Architecture

VibeCode is based on OpenVSCode Server, which itself is based on VS Code (OSS). Key differences:

- **OpenVSCode Server**: Web/server-first, Gitpod-maintained
- **VibeCode**: Native macOS desktop, AI-first, community-maintained

See [ARCHITECTURE.md](../docs/ARCHITECTURE.md) for technical details.

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE.txt](LICENSE.txt) for details.

VibeCode is based on OpenVSCode Server (Gitpod) and Visual Studio Code (Microsoft), both under MIT license. This project maintains that license and is not affiliated with Microsoft, Gitpod, or the VS Code project.

## Attribution

This project is built on top of:
- [Visual Studio Code](https://github.com/microsoft/vscode) - Copyright (c) Microsoft Corporation
- [OpenVSCode Server](https://github.com/gitpod-io/openvscode-server) - Copyright (c) Gitpod

Thank you to these projects and their contributors for making this possible.
```

---

## 4. Asset Creation Requirements

### 4.1 macOS Application Icon

**Primary Icon**: `/openvscode-server/resources/darwin/code.icns`

**Format**: Apple Icon Image (.icns) containing multiple resolutions:

| Size (px) | @1x | @2x | Usage |
|-----------|-----|-----|-------|
| 16x16 | ✓ | ✓ | Menu bar, list views |
| 32x32 | ✓ | ✓ | List views, Finder sidebar |
| 64x64 | ✓ | ✓ | List views (retina) |
| 128x128 | ✓ | ✓ | Finder icon view |
| 256x256 | ✓ | ✓ | Finder icon view (retina) |
| 512x512 | ✓ | ✓ | Dock, Quick Look |
| 1024x1024 | - | ✓ | Retina displays |

**Creation Process**:
1. Design master icon at 1024x1024 (vector preferred)
2. Export all required sizes as PNG
3. Convert to .icns using `iconutil`:
   ```bash
   mkdir vibecode.iconset
   # Copy all PNGs to iconset with proper naming:
   # icon_16x16.png, icon_16x16@2x.png, etc.
   iconutil -c icns vibecode.iconset -o vibecode.icns
   ```

**Design Guidelines**:
- Simple, recognizable shape
- Works in both dark and light modes
- Avoids fine details that blur at small sizes
- Distinct from VS Code's icon
- Reflects "flow" or "intelligence" theme

---

### 4.2 Web/Server Assets

#### Favicon & PWA Icons

**Files to Create**:
- `/openvscode-server/resources/server/vibecode-192.png` (192x192)
- `/openvscode-server/resources/server/vibecode-512.png` (512x512)

**Usage**: Browser favicon, PWA home screen icon, splash screen

**Requirements**:
- PNG format with transparency
- Centered design with padding
- Works on light and dark backgrounds

---

### 4.3 Platform-Specific Icons

#### Linux Icon
**File**: `/openvscode-server/resources/linux/vibecode.png`
**Format**: PNG, 256x256 or 512x512
**Usage**: Linux desktop file, window icon

#### Windows Tiles (Future)
**Files**:
- `/openvscode-server/resources/win32/vibecode_150x150.png`
- `/openvscode-server/resources/win32/vibecode_70x70.png`

**Format**: PNG with transparency
**Usage**: Windows Start menu tiles

---

### 4.4 File Type Icons (Optional)

**Location**: `/openvscode-server/resources/darwin/*.icns`

**Current Icons** (29 files):
- Language-specific: `javascript.icns`, `python.icns`, `ruby.icns`, etc.
- Format-specific: `json.icns`, `markdown.icns`, `yaml.icns`, etc.
- Default: `default.icns` (fallback)

**Options**:
1. **Keep existing** - These are generic and functional
2. **Rebrand** - Add subtle VibeCode branding to each
3. **Redesign** - Create new icon set matching VibeCode visual identity

**Recommendation**: Keep existing for initial release, redesign in future version.

---

### 4.5 Splash Screen

**File**: TBD (likely in `src/vs/workbench/contrib/splash/`)

**Requirements**:
- Shown during app startup
- Product name + version
- Minimal, fast-loading
- SVG preferred for crisp rendering

**Example Content**:
```
[VibeCode Logo]
VibeCode
Version 1.0.0
Loading...
```

---

## 5. Open-VSX Integration

### 5.1 Current Configuration

**Good News**: OpenVSCode Server already uses Open-VSX registry (not Microsoft Marketplace).

**Current Settings** (in `product.json`):
```json
"extensionsGallery": {
  "serviceUrl": "https://open-vsx.org/vscode/gallery",
  "itemUrl": "https://open-vsx.org/vscode/item",
  "resourceUrlTemplate": "https://open-vsx.org/vscode/unpkg/{publisher}/{name}/{version}/{path}",
  "controlUrl": "",
  "recommendationsUrl": "",
  "nlsBaseUrl": "",
  "publisherUrl": ""
}
```

### 5.2 VibeCode Configuration

**Action**: Keep as-is, no changes needed.

**Implications**:
- ✅ Users can install any Open-VSX extension
- ✅ No Microsoft licensing restrictions
- ✅ Community-maintained extension registry
- ⚠️ Some popular extensions not available (e.g., official Python extension)
- ✅ Open-source alternatives available for most extensions

### 5.3 Trusted Domains

**Update**:
```json
"linkProtectionTrustedDomains": [
  "https://open-vsx.org",
  "https://vibecode.io"  // Add your domain
]
```

---

## 6. CLI Binary Naming

### 6.1 Current State

**Binary Name**: `code`
**Location**: `/openvscode-server/cli/target/release/code`
**Size**: 11.5 MB (arm64)

### 6.2 Options for VibeCode

#### Option A: Keep "code"
**Pros**:
- Familiar to VS Code users
- Easier migration (`code .` still works)
- Less documentation changes

**Cons**:
- Conflicts with existing VS Code installations
- Less distinctive branding
- Confusing if both installed

#### Option B: Rename to "vibecode"
**Pros**:
- Clear branding
- No conflicts with VS Code
- Distinctive identity

**Cons**:
- Users must learn new command
- More migration friction
- Need to update all docs

#### Option C: Dual Support
**Approach**:
- Primary binary: `vibecode`
- Symlink: `code` → `vibecode`

**Pros**:
- Best of both worlds
- Gradual migration path
- User choice

**Cons**:
- More complex packaging
- Still has conflict potential

### 6.3 Recommendation

**Primary**: Option B - Rename to `vibecode`

**Rationale**:
- Clear brand differentiation
- Avoids installation conflicts
- Users choosing VibeCode expect something different
- Can document migration path for VS Code users

**Implementation**:
1. Rename binary output in build process
2. Update CLI help text and docs
3. Provide shell completion for `vibecode`
4. Document as unique selling point

---

## 7. Implementation Checklist

### Phase 1: Core Branding (Required for MVP)

- [ ] **Product Configuration**
  - [ ] Update `product.json` with VibeCode branding
  - [ ] Set new bundle identifier: `com.vibecode.ide`
  - [ ] Update URLs (issues, license, etc.)
  - [ ] Update data folder name: `.vibecode`

- [ ] **CLI Updates**
  - [ ] Modify `cli/src/constants.rs` with VibeCode names
  - [ ] Rename binary output: `code` → `vibecode`
  - [ ] Update CLI help text and version strings
  - [ ] Rebuild CLI binary

- [ ] **Package Configuration**
  - [ ] Update `package.json` metadata
  - [ ] Update repository URLs
  - [ ] Set version to `1.0.0`

- [ ] **Documentation**
  - [ ] Replace `README.md` with VibeCode content
  - [ ] Create `CONTRIBUTING.md`
  - [ ] Add attribution section for OpenVSCode/VS Code
  - [ ] Update license file headers (where applicable)

### Phase 2: Visual Assets (Required for Public Release)

- [ ] **Icon Design**
  - [ ] Design master icon concept (3 variations)
  - [ ] User testing / feedback
  - [ ] Finalize primary icon design

- [ ] **macOS Icons**
  - [ ] Create 1024x1024 master icon (vector)
  - [ ] Export all required PNG sizes
  - [ ] Generate `vibecode.icns`
  - [ ] Test at all display scales

- [ ] **Web Assets**
  - [ ] Create `vibecode-192.png`
  - [ ] Create `vibecode-512.png`
  - [ ] Design splash screen
  - [ ] Test in browser/PWA mode

- [ ] **Platform Icons**
  - [ ] Linux PNG icon
  - [ ] Windows tiles (if supporting Windows)

### Phase 3: Build Integration

- [ ] **Build System**
  - [ ] Update gulp tasks for VibeCode branding
  - [ ] Modify app bundle creation (macOS)
  - [ ] Update Info.plist with new bundle ID
  - [ ] Configure code signing with new identity

- [ ] **Asset Pipeline**
  - [ ] Copy new icons to build directories
  - [ ] Update resource references in build scripts
  - [ ] Verify icon embedding in final binary

### Phase 4: Testing & Verification

- [ ] **Branding Verification**
  - [ ] Launch app, check About dialog shows "VibeCode"
  - [ ] Verify dock icon displays correctly
  - [ ] Check menu bar shows "VibeCode" not "OpenVSCode"
  - [ ] Confirm data directory is `~/.vibecode`

- [ ] **CLI Testing**
  - [ ] `vibecode --version` shows correct version
  - [ ] `vibecode --help` shows VibeCode branding
  - [ ] `vibecode .` launches VibeCode, not VS Code

- [ ] **Extension System**
  - [ ] Can install extensions from Open-VSX
  - [ ] Extensions install to `.vibecode/extensions`
  - [ ] No conflicts with VS Code extensions

- [ ] **Deep Link Testing**
  - [ ] `vibecode://` protocol registered correctly
  - [ ] macOS recognizes VibeCode as handler
  - [ ] Can open projects via URL scheme

### Phase 5: Distribution Preparation

- [ ] **Packaging**
  - [ ] Create DMG installer with custom background
  - [ ] Sign app bundle with Apple Developer ID
  - [ ] Notarize app for Gatekeeper
  - [ ] Test installation on clean macOS system

- [ ] **Release Assets**
  - [ ] Tag release in Git
  - [ ] Build universal binary (arm64 + x86_64)
  - [ ] Generate checksums
  - [ ] Write release notes

- [ ] **Documentation Site**
  - [ ] Launch vibecode.io (or subdomain)
  - [ ] Publish user guide
  - [ ] Add download page
  - [ ] Create getting started tutorial

---

## 8. Testing & Verification

### 8.1 Visual Verification

**Checklist**:
- [ ] App icon displays correctly in Finder
- [ ] Dock icon shows proper VibeCode icon
- [ ] About dialog shows "VibeCode" name and version
- [ ] Window title bars show "VibeCode"
- [ ] Splash screen displays VibeCode branding
- [ ] All menu items reference VibeCode (not OpenVSCode)

**Testing Locations**:
- Finder (list view, icon view, cover flow)
- Dock (light mode, dark mode)
- Spotlight search results
- Launchpad
- macOS Activity Monitor
- App switcher (Cmd+Tab)

### 8.2 Functional Testing

**Data Isolation**:
- [ ] Settings stored in `~/.vibecode/` not `~/.vscode/`
- [ ] Extensions install to `~/.vibecode/extensions/`
- [ ] No interference with existing VS Code installation
- [ ] Can run both VibeCode and VS Code simultaneously

**CLI Testing**:
- [ ] `vibecode` command available in PATH
- [ ] Opening files works: `vibecode file.js`
- [ ] Opening directories works: `vibecode .`
- [ ] CLI flags work as expected
- [ ] Shell completion works (bash/zsh)

**Extension System**:
- [ ] Open-VSX registry accessible
- [ ] Can search and install extensions
- [ ] Extensions load correctly
- [ ] Settings sync works (if implemented)

### 8.3 Regression Testing

**Ensure no breakage**:
- [ ] Code editing works normally
- [ ] Git integration functional
- [ ] Terminal opens and executes commands
- [ ] Debugging works
- [ ] IntelliSense/autocomplete works
- [ ] Find/replace works
- [ ] Multi-cursor editing works
- [ ] Theme switching works

### 8.4 Platform-Specific Testing

**macOS-Specific**:
- [ ] Keyboard shortcuts use Cmd (not Ctrl)
- [ ] Touch Bar integration (if applicable)
- [ ] Native notifications work
- [ ] File dialogs use macOS native UI
- [ ] Drag-and-drop works
- [ ] Quick Look integration (optional)

### 8.5 Performance Testing

**Benchmarks**:
- [ ] Startup time < 3 seconds (cold start)
- [ ] Memory usage reasonable (~200-300MB idle)
- [ ] Scrolling smooth (60fps)
- [ ] Large file handling (>10MB)
- [ ] Project indexing speed

---

## 9. Legal & Licensing

### 9.1 License Maintenance

**Current License**: MIT (Copyright Microsoft Corporation)

**Action**: **Keep as-is** - Do not modify the base LICENSE.txt

**Rationale**:
- OpenVSCode Server is MIT licensed
- MIT allows redistribution and rebranding
- Attribution is maintained in README and docs
- Changing license would violate upstream terms

**Required Attribution**:

Add to README.md:
```markdown
## License & Attribution

VibeCode is licensed under the MIT License. See LICENSE.txt for details.

This project is built upon:
- **Visual Studio Code** © Microsoft Corporation
- **OpenVSCode Server** © Gitpod

We are grateful to these projects and their contributors.
```

### 9.2 Trademark Considerations

**Safe Practices**:
- ✅ Use "VibeCode" as product name
- ✅ State "based on OpenVSCode Server"
- ✅ Include attribution in About dialog
- ❌ Don't claim affiliation with Microsoft
- ❌ Don't claim affiliation with Gitpod
- ❌ Don't use "VS Code" or "Visual Studio" in marketing
- ❌ Don't use Microsoft or Gitpod logos

**About Dialog Text** (example):
```
VibeCode
Version 1.0.0

An AI-native macOS IDE based on OpenVSCode Server.

Built on top of:
• Visual Studio Code © Microsoft Corporation
• OpenVSCode Server © Gitpod

Licensed under the MIT License.
```

### 9.3 Extension Marketplace

**Open-VSX Registry**:
- ✅ Free to use
- ✅ Open source
- ✅ No trademark restrictions
- ✅ No Microsoft approval needed

**Restrictions**:
- ❌ Cannot use Microsoft Extension Marketplace
- ❌ Cannot include Microsoft-proprietary extensions
- ✅ Can document compatible alternatives

### 9.4 Code Signing & Notarization

**Apple Developer ID**:
- Required for distribution outside Mac App Store
- Costs $99/year (individual) or $299/year (organization)
- Enables Gatekeeper approval
- Required for auto-updates

**Recommendation**: Register VibeCode under your own Apple Developer account, not Microsoft's or Gitpod's.

---

## Appendix A: Product.json Template

Complete rebranded product.json template:

```json
{
  "nameShort": "VibeCode",
  "nameLong": "VibeCode",
  "applicationName": "vibecode",
  "dataFolderName": ".vibecode",
  "win32MutexName": "vibecode",
  "licenseName": "MIT",
  "licenseUrl": "https://github.com/YOUR_ORG/vibecode-webgui/blob/main/LICENSE.txt",
  "serverLicenseUrl": "https://github.com/YOUR_ORG/vibecode-webgui/blob/main/LICENSE.txt",
  "serverGreeting": [],
  "serverLicense": [],
  "serverLicensePrompt": "",
  "serverApplicationName": "vibecode-server",
  "serverDataFolderName": ".vibecode-server",
  "tunnelApplicationName": "vibecode-tunnel",
  "win32DirName": "VibeCode",
  "win32NameVersion": "VibeCode",
  "win32RegValueName": "VibeCode",
  "win32x64AppId": "{{GENERATE_NEW_GUID}}",
  "win32arm64AppId": "{{GENERATE_NEW_GUID}}",
  "win32x64UserAppId": "{{GENERATE_NEW_GUID}}",
  "win32arm64UserAppId": "{{GENERATE_NEW_GUID}}",
  "win32AppUserModelId": "VibeCode",
  "win32ShellNameShort": "VibeC&ode",
  "win32TunnelServiceMutex": "vibecode.server-tunnelservice",
  "win32TunnelMutex": "vibecode.server-tunnel",
  "darwinBundleIdentifier": "com.vibecode.ide",
  "darwinProfileUUID": "{{GENERATE_NEW_UUID}}",
  "darwinProfilePayloadUUID": "{{GENERATE_NEW_UUID}}",
  "linuxIconName": "vibecode",
  "licenseFileName": "LICENSE.txt",
  "twitterUrl": "https://twitter.com/YOUR_TWITTER",
  "reportIssueUrl": "https://github.com/YOUR_ORG/vibecode-webgui/issues/new",
  "requestFeatureUrl": "https://github.com/YOUR_ORG/vibecode-webgui/issues",
  "reportMarketplaceIssueUrl": "https://github.com/eclipse/openvsx/issues",
  "sendASmile": {
    "reportIssueUrl": "https://github.com/YOUR_ORG/vibecode-webgui/issues/new",
    "requestFeatureUrl": "https://github.com/YOUR_ORG/vibecode-webgui/issues"
  },
  "nodejsRepository": "https://nodejs.org",
  "urlProtocol": "vibecode",
  "embedderIdentifier": "vibecode",
  "webviewContentExternalBaseUrlTemplate": "https://{{uuid}}.vscode-cdn.net/insider/ef65ac1ba57f57f2a3961bfe94aa20481caca4c6/out/vs/workbench/contrib/webview/browser/pre/",

  "extensionRecommendations": { /* Keep existing */ },
  "commonlyUsedSettings": [ /* Keep existing */ ],
  "keymapExtensionTips": [ /* Keep existing */ ],
  "languageExtensionTips": [ /* Keep existing */ ],
  "configBasedExtensionTips": { /* Keep existing */ },
  "commandPaletteSuggestedCommandIds": [ /* Keep existing */ ],
  "extensionKeywords": { /* Keep existing */ },
  "extensionAllowedBadgeProviders": [ /* Keep existing */ ],
  "extensionAllowedBadgeProvidersRegex": [ /* Keep existing */ ],
  "extensionKind": { /* Keep existing */ },
  "extensionPointExtensionKind": { /* Keep existing */ },
  "builtInExtensions": [ /* Keep existing */ ],

  "extensionsGallery": {
    "serviceUrl": "https://open-vsx.org/vscode/gallery",
    "itemUrl": "https://open-vsx.org/vscode/item",
    "resourceUrlTemplate": "https://open-vsx.org/vscode/unpkg/{publisher}/{name}/{version}/{path}",
    "extensionUrlTemplate": "https://open-vsx.org/vscode/gallery/{publisher}/{name}/latest",
    "controlUrl": "",
    "recommendationsUrl": "",
    "nlsBaseUrl": "",
    "publisherUrl": ""
  },

  "linkProtectionTrustedDomains": [
    "https://open-vsx.org",
    "https://vibecode.io"
  ]
}
```

**Note**: Generate new GUIDs/UUIDs for Windows app IDs and macOS profile IDs. Don't reuse Gitpod's or Microsoft's.

---

## Appendix B: Icon Size Reference

### macOS .icns Structure

Complete list of required icon sizes for `vibecode.icns`:

| Filename in .iconset | Size | Scale |
|----------------------|------|-------|
| icon_16x16.png | 16x16 | @1x |
| icon_16x16@2x.png | 32x32 | @2x |
| icon_32x32.png | 32x32 | @1x |
| icon_32x32@2x.png | 64x64 | @2x |
| icon_64x64.png | 64x64 | @1x |
| icon_64x64@2x.png | 128x128 | @2x |
| icon_128x128.png | 128x128 | @1x |
| icon_128x128@2x.png | 256x256 | @2x |
| icon_256x256.png | 256x256 | @1x |
| icon_256x256@2x.png | 512x512 | @2x |
| icon_512x512.png | 512x512 | @1x |
| icon_512x512@2x.png | 1024x1024 | @2x |

**Creation Script**:
```bash
#!/bin/bash
# Generate icns from 1024x1024 master PNG

MASTER="vibecode-master-1024.png"
ICONSET="vibecode.iconset"

mkdir -p "$ICONSET"

sips -z 16 16     "$MASTER" --out "$ICONSET/icon_16x16.png"
sips -z 32 32     "$MASTER" --out "$ICONSET/icon_16x16@2x.png"
sips -z 32 32     "$MASTER" --out "$ICONSET/icon_32x32.png"
sips -z 64 64     "$MASTER" --out "$ICONSET/icon_32x32@2x.png"
sips -z 64 64     "$MASTER" --out "$ICONSET/icon_64x64.png"
sips -z 128 128   "$MASTER" --out "$ICONSET/icon_64x64@2x.png"
sips -z 128 128   "$MASTER" --out "$ICONSET/icon_128x128.png"
sips -z 256 256   "$MASTER" --out "$ICONSET/icon_128x128@2x.png"
sips -z 256 256   "$MASTER" --out "$ICONSET/icon_256x256.png"
sips -z 512 512   "$MASTER" --out "$ICONSET/icon_256x256@2x.png"
sips -z 512 512   "$MASTER" --out "$ICONSET/icon_512x512.png"
sips -z 1024 1024 "$MASTER" --out "$ICONSET/icon_512x512@2x.png"

iconutil -c icns "$ICONSET" -o vibecode.icns

echo "Created vibecode.icns"
```

---

## Appendix C: Version Numbering Scheme

### Proposed Versioning

**Format**: `MAJOR.MINOR.PATCH[-PRERELEASE]`

**Examples**:
- `1.0.0` - Initial public release
- `1.1.0` - New feature (AI improvements, VM enhancements)
- `1.0.1` - Bug fix release
- `1.0.0-beta.1` - Pre-release testing
- `2.0.0` - Major breaking changes

**Tracking Upstream**:
- Document which VS Code version VibeCode is based on
- Example: "VibeCode 1.0.0 (based on VS Code 1.106.0)"
- Allows users to understand feature parity

**Release Cadence**:
- Monthly feature releases (1.1, 1.2, 1.3, etc.)
- Weekly bug fix releases (1.0.1, 1.0.2, etc.)
- Quarterly major releases (2.0, 3.0, etc.)

---

## Appendix D: File Modification Summary

### Critical Files (Must Change)

| File | Changes | Priority |
|------|---------|----------|
| `product.json` | Complete rebrand | 🔴 Critical |
| `cli/src/constants.rs` | Product names, paths | 🔴 Critical |
| `package.json` | Metadata, repo URLs | 🔴 Critical |
| `README.md` | Full rewrite | 🔴 Critical |
| `resources/darwin/code.icns` | New icon | 🔴 Critical |

### Important Files (Should Change)

| File | Changes | Priority |
|------|---------|----------|
| `resources/server/code-192.png` | Web icon | 🟡 Important |
| `resources/server/code-512.png` | Splash screen | 🟡 Important |
| `resources/linux/code.png` | Linux icon | 🟡 Important |
| CLI binary name | `code` → `vibecode` | 🟡 Important |

### Optional Files (Nice to Have)

| File | Changes | Priority |
|------|---------|----------|
| `resources/darwin/*.icns` (29 files) | File type icons | 🟢 Optional |
| `resources/win32/*.png` | Windows tiles | 🟢 Optional |
| Various splash screen assets | Branding | 🟢 Optional |

---

## Next Steps

### Immediate Actions (Week 1)

1. **Finalize Brand Identity**
   - Choose tagline (recommend: "AI-Native macOS IDE")
   - Approve color palette
   - Select icon design direction

2. **Icon Design Sprint**
   - Create 3 icon concepts
   - Get feedback from team/users
   - Finalize and export all sizes

3. **Core File Updates**
   - Modify `product.json`
   - Update `constants.rs`
   - Rebuild CLI binary as `vibecode`

### Near-Term (Week 2-3)

4. **Asset Integration**
   - Replace all icons
   - Update README and docs
   - Test branding in build

5. **Functional Testing**
   - Verify data isolation
   - Test extension system
   - Check for Gitpod references

6. **Build & Package**
   - Create signed DMG
   - Test installation on clean system
   - Prepare release notes

### Long-Term (Month 2+)

7. **Launch Preparation**
   - Set up vibecode.io website
   - Create tutorial content
   - Prepare marketing materials

8. **Community Building**
   - Announce on social media
   - Engage with VS Code community
   - Gather initial feedback

9. **Iteration**
   - Release v1.1 with user feedback
   - Expand platform support (Linux, Windows)
   - Develop unique features (AI, VM integration)

---

## Questions & Decisions Needed

### Brand & Design
- [ ] Which tagline to use? (Recommend: "AI-Native macOS IDE")
- [ ] Icon design approval required
- [ ] Color palette selection
- [ ] Typography choices (SF Pro suggested)

### Technical
- [ ] CLI binary name: `vibecode` or keep `code`? (Recommend: `vibecode`)
- [ ] Data folder: `.vibecode` or `.vibecode-server`? (Recommend: `.vibecode`)
- [ ] Bundle ID: `com.vibecode.ide` or different? (Approve or modify)

### Distribution
- [ ] Website domain: vibecode.io or other? (Need to register)
- [ ] Apple Developer account: Individual or organization? (Need to set up)
- [ ] Release channel: GitHub Releases or separate CDN? (GitHub OK for start)

### Community
- [ ] Discord server or other forum? (Recommend Discord)
- [ ] Social media accounts? (Twitter, Mastodon?)
- [ ] Contribution guidelines ready? (Need to write)

---

## Conclusion

This rebranding plan provides a complete roadmap for transforming OpenVSCode Server into VibeCode. The approach:

✅ **Respects upstream licenses** (MIT maintained, proper attribution)
✅ **Provides clear differentiation** (AI-native, macOS-focused)
✅ **Maintains compatibility** (Open-VSX, extension ecosystem)
✅ **Enables future growth** (Unique features, community building)

The plan is **implementation-ready** and can be executed by developers with clear checklists, file-by-file modifications, and verification steps.

**Estimated Timeline**: 2-3 weeks for core rebranding, 4-6 weeks for full launch-ready package.

**Next Action**: Review and approve brand identity decisions, then begin Phase 1 implementation.

---

**Document Version**: 1.0
**Date**: 2025-10-28
**Author**: Claude (VibeCode Brand Designer & Product Strategist)
**Status**: Draft - Awaiting Approval
