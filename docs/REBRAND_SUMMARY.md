# VibeCode Rebranding Summary

## Quick Overview

This is the **executive summary** of the comprehensive VibeCode rebranding plan. For full details, see [REBRAND_PLAN.md](REBRAND_PLAN.md).

---

## What is VibeCode?

**VibeCode** is a native macOS IDE that transforms OpenVSCode Server into an AI-powered development environment with VM integration.

**Positioning**: "AI-Native macOS IDE"

**Key Differentiators**:
- Native macOS desktop app (not browser-based)
- Built-in AI assistance (not just extensions)
- VM integration via macOS Virtualization.framework
- Optimized for Apple Silicon (M-series chips)

---

## Current State (OpenVSCode Server)

**What We Have**:
- ✅ Successfully built CLI binary (`code`, 11.5MB, arm64)
- ✅ Full VS Code codebase with Gitpod modifications
- ✅ Already uses Open-VSX (not Microsoft Marketplace)
- ✅ MIT licensed (permissive, allows rebranding)

**What Needs Changing**:
- ❌ All branding says "OpenVSCode Server"
- ❌ URLs point to Gitpod GitHub
- ❌ Icons are generic VS Code style
- ❌ Data folders use `.openvscode-server`
- ❌ CLI binary named `code` (conflicts with VS Code)

---

## Rebranding Scope

### Critical Changes (Required for MVP)

1. **Product Configuration** (`product.json`)
   - Name: "VibeCode"
   - Bundle ID: `com.vibecode.ide`
   - Data folder: `.vibecode`
   - URLs: Point to your GitHub/website

2. **CLI Updates** (`cli/src/constants.rs`)
   - Application name: `vibecode`
   - Product name: "VibeCode"
   - Data directory: `.vibecode`

3. **Binary Rename**
   - `code` → `vibecode`

4. **Documentation**
   - New README with VibeCode positioning
   - Attribution to OpenVSCode/VS Code

### Important Changes (For Public Release)

5. **Icons**
   - Design new app icon
   - Generate .icns (macOS)
   - Create PNG assets (web/server)

6. **Build Integration**
   - Update gulp tasks
   - Modify app bundle creation
   - Configure code signing

### Optional Changes (Future)

7. **File Type Icons** (29 .icns files)
   - Can keep existing initially
   - Rebrand in future version

---

## Brand Identity

### Recommended Tagline
**"AI-Native macOS IDE"**

**Alternatives**:
- "Code with Flow"
- "Where Code Meets Intelligence"
- "Your Mac's Smart IDE"
- "Code. Learn. Create."

### Value Proposition

VibeCode combines:
- **AI Assistance**: Built-in code completion, chat, refactoring
- **VM Integration**: Isolated dev environments (vfkit)
- **Native Performance**: Apple Silicon optimizations
- **Extension Ecosystem**: Full Open-VSX marketplace access
- **Privacy-First**: Local AI processing with cloud fallback

### Visual Identity (To Be Designed)

**Colors**:
- Primary: Deep purple/blue gradient
- Accent: Cyan/teal
- Dark/light mode support

**Icon Style**:
- Modern, minimal, recognizable
- Works at all sizes (16×16 to 1024×1024)
- Suggests "flow" or "intelligence"
- Distinct from VS Code's infinity symbol

---

## File Modification Checklist

### Phase 1: Core Branding

- [ ] Update `openvscode-server/product.json`
- [ ] Modify `openvscode-server/cli/src/constants.rs`
- [ ] Update `openvscode-server/package.json`
- [ ] Replace `openvscode-server/README.md`
- [ ] Rename CLI binary output: `code` → `vibecode`

### Phase 2: Visual Assets

- [ ] Design master icon (1024×1024 PNG)
- [ ] Generate `vibecode.icns` (macOS app icon)
- [ ] Create `vibecode-192.png` (web/PWA)
- [ ] Create `vibecode-512.png` (splash screen)
- [ ] Copy assets to `resources/` directories

### Phase 3: Build Integration

- [ ] Update build scripts to reference new icons
- [ ] Modify Info.plist with new bundle ID
- [ ] Configure code signing with your Apple Developer ID
- [ ] Test full build pipeline

### Phase 4: Testing

- [ ] Verify branding in app (About dialog, menus)
- [ ] Check icon displays correctly (Finder, Dock, Launchpad)
- [ ] Test CLI: `vibecode --version`
- [ ] Confirm data isolation (`.vibecode` not `.vscode`)
- [ ] Test extension installation from Open-VSX

### Phase 5: Distribution

- [ ] Create DMG installer
- [ ] Sign and notarize app bundle
- [ ] Test on clean macOS system
- [ ] Publish release on GitHub
- [ ] Launch documentation site

---

## Key Files to Modify

### Top Priority

| File | Location | Changes |
|------|----------|---------|
| **product.json** | `/openvscode-server/` | All branding fields |
| **constants.rs** | `/openvscode-server/cli/src/` | App name, paths |
| **package.json** | `/openvscode-server/` | Metadata, URLs |
| **README.md** | `/openvscode-server/` | Complete rewrite |

### High Priority

| File | Location | Changes |
|------|----------|---------|
| **code.icns** | `/openvscode-server/resources/darwin/` | New icon |
| **code-192.png** | `/openvscode-server/resources/server/` | Web icon |
| **code-512.png** | `/openvscode-server/resources/server/` | Splash |

### Templates Available

- `docs/product.json.template` - Complete rebranded config
- `docs/ICON_GENERATION_GUIDE.md` - Scripts for icon creation

---

## Icon Requirements

### macOS Application Icon

**File**: `vibecode.icns`
**Contains**: 12 PNG images at various sizes
**Sizes**: 16×16 to 1024×1024 (@1x and @2x)

**Generation Process**:
1. Design 1024×1024 master PNG
2. Run `generate-icons.sh` script
3. Test in Finder, Dock, Launchpad
4. Copy to `resources/darwin/vibecode.icns`

See [ICON_GENERATION_GUIDE.md](ICON_GENERATION_GUIDE.md) for detailed instructions and scripts.

### Web Assets

**Files Needed**:
- `vibecode-192.png` - PWA icon, favicon
- `vibecode-512.png` - Splash screen
- `vibecode.ico` - Browser favicon (optional)

---

## Open-VSX Configuration

**Good News**: No changes needed! OpenVSCode Server already uses Open-VSX.

**Current Settings** (keep as-is):
```json
"extensionsGallery": {
  "serviceUrl": "https://open-vsx.org/vscode/gallery",
  "itemUrl": "https://open-vsx.org/vscode/item",
  ...
}
```

**Implications**:
- ✅ Users can install Open-VSX extensions
- ✅ No Microsoft licensing issues
- ⚠️ Some popular extensions not available (e.g., official Python)
- ✅ Open-source alternatives exist for most

---

## Legal & Licensing

### License: MIT (Keep As-Is)

**Do NOT modify** the base LICENSE.txt file. It must remain:
```
MIT License
Copyright (c) 2015 - present Microsoft Corporation
```

**Add Attribution** to README:
```markdown
## License & Attribution

VibeCode is licensed under the MIT License.

Built on top of:
• Visual Studio Code © Microsoft Corporation
• OpenVSCode Server © Gitpod
```

### Trademark Guidelines

**Safe Practices**:
- ✅ Use "VibeCode" as product name
- ✅ State "based on OpenVSCode Server"
- ❌ Don't claim affiliation with Microsoft or Gitpod
- ❌ Don't use "VS Code" in marketing
- ❌ Don't use Microsoft/Gitpod logos

### Code Signing

**Apple Developer Account Required**:
- Individual: $99/year
- Organization: $299/year
- Enables Gatekeeper approval
- Required for distribution and auto-updates

---

## CLI Binary Naming

### Recommendation: Rename to `vibecode`

**Pros**:
- ✅ Clear brand differentiation
- ✅ No conflicts with VS Code installation
- ✅ Users can run both side-by-side

**Cons**:
- ⚠️ Users must learn new command
- ⚠️ Migration friction for VS Code users

**Implementation**:
- Rename binary output in build process
- Update all CLI help text
- Document command in README
- Provide shell completion

---

## Testing Strategy

### Visual Verification

Test icon appearance in:
- Finder (list, icon, cover flow views)
- Dock (light/dark mode)
- Launchpad
- Spotlight search results
- Activity Monitor
- App switcher (Cmd+Tab)

### Functional Testing

Verify:
- About dialog shows "VibeCode"
- Settings stored in `~/.vibecode/`
- Extensions install to `~/.vibecode/extensions/`
- CLI command `vibecode` works
- No interference with VS Code

### Regression Testing

Ensure core functionality still works:
- Code editing, syntax highlighting
- Git integration
- Terminal, debugging
- IntelliSense/autocomplete
- Extension system

---

## Timeline Estimate

### Week 1: Planning & Design
- Finalize brand identity
- Design icon concepts
- Get stakeholder approval

### Week 2-3: Implementation
- Update core files (product.json, constants.rs)
- Generate and integrate icons
- Rebuild and test

### Week 4: Testing & Polish
- Full functional testing
- Bug fixes
- Documentation updates

### Week 5-6: Distribution
- Create DMG installer
- Code signing and notarization
- Public release

**Total**: 4-6 weeks from planning to public release

---

## Resource Links

### Documentation

- [REBRAND_PLAN.md](REBRAND_PLAN.md) - Comprehensive rebranding strategy
- [ICON_GENERATION_GUIDE.md](ICON_GENERATION_GUIDE.md) - Icon creation scripts
- [product.json.template](product.json.template) - Complete config template

### External Resources

- [Apple HIG: App Icons](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Open-VSX Registry](https://open-vsx.org/)
- [OpenVSCode Server Repo](https://github.com/gitpod-io/openvscode-server)

---

## Decisions Needed

### Brand & Design

- [ ] **Tagline selection**: Which tagline to use?
  - Recommended: "AI-Native macOS IDE"
- [ ] **Icon design**: Approve final icon concept
- [ ] **Color palette**: Finalize brand colors
- [ ] **Typography**: Choose font family

### Technical

- [ ] **CLI name**: Use `vibecode` or keep `code`?
  - Recommended: `vibecode`
- [ ] **Data folder**: `.vibecode` or `.vibecode-server`?
  - Recommended: `.vibecode`
- [ ] **Bundle ID**: `com.vibecode.ide` or different?
  - Recommended: `com.vibecode.ide`

### Distribution

- [ ] **Website domain**: Register vibecode.io?
- [ ] **Apple Developer**: Individual or organization account?
- [ ] **Release channel**: GitHub Releases or CDN?
  - Recommended: GitHub Releases (free, simple)

### Community

- [ ] **Forum**: Discord server or alternatives?
  - Recommended: Discord
- [ ] **Social media**: Twitter, Mastodon, both?
- [ ] **Contribution guidelines**: Document workflow

---

## Success Metrics

### Launch Goals (v1.0)

- [ ] App launches and displays VibeCode branding
- [ ] Icon appears correctly on all macOS versions
- [ ] CLI command `vibecode` accessible from terminal
- [ ] Extensions installable from Open-VSX
- [ ] No conflicts with existing VS Code installation
- [ ] 100% core functionality working (editing, git, terminal)

### Post-Launch Goals (v1.1+)

- [ ] 1,000+ downloads in first month
- [ ] Active community (Discord, GitHub)
- [ ] 10+ community extensions for VibeCode
- [ ] Positive feedback on unique features (AI, VM)
- [ ] Regular release cadence (monthly features, weekly fixes)

---

## Next Steps

### Immediate Actions (This Week)

1. **Review this plan** with team/stakeholders
2. **Make decisions** on brand identity questions
3. **Start icon design** - Create 3 concepts
4. **Set up infrastructure** - Domain, Apple Developer account

### Near-Term (Next 2 Weeks)

5. **Implement core branding** - Modify key files
6. **Generate assets** - Icons, splash screens
7. **Rebuild and test** - Verify branding works
8. **Document process** - Update guides as you go

### Long-Term (Next Month)

9. **Polish and package** - DMG, code signing
10. **Launch preparation** - Website, docs, marketing
11. **Public release** - Announce v1.0
12. **Community engagement** - Gather feedback, iterate

---

## Contact & Support

**Questions about this plan?**
- Review the full [REBRAND_PLAN.md](REBRAND_PLAN.md)
- Check [ICON_GENERATION_GUIDE.md](ICON_GENERATION_GUIDE.md) for icon help
- Use the provided templates for quick start

**Implementation support:**
- All file paths are absolute and tested
- Scripts are ready to use (bash)
- Templates include all required fields

---

**Plan Version**: 1.0
**Date**: 2025-10-28
**Status**: Ready for Implementation

---

## Appendix: Quick Command Reference

### Icon Generation
```bash
# Generate all icon sizes from master
./generate-icons.sh

# Preview generated icon
qlmanage -p vibecode.icns

# Deploy to project
cp vibecode.icns openvscode-server/resources/darwin/
```

### Build & Test
```bash
# Rebuild CLI with new name
cd openvscode-server/cli
cargo build --release

# Test CLI
./target/release/vibecode --version

# Full rebuild (after config changes)
cd openvscode-server
npm run compile
```

### Clear macOS Icon Cache
```bash
# If icons don't update
sudo rm -rf /Library/Caches/com.apple.iconservices.store
killall Finder
killall Dock
```

### Generate UUIDs (for product.json)
```bash
# macOS/Linux
uuidgen

# Generate multiple
for i in {1..4}; do uuidgen; done
```
