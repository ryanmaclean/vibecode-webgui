# VibeCode Rebranding Documentation Index

**Start Here** - Complete guide to transforming OpenVSCode Server into VibeCode

---

## Quick Navigation

### 📋 Executive Summary
**[REBRAND_SUMMARY.md](REBRAND_SUMMARY.md)** - Start here for quick overview
- 5-minute read
- High-level decisions needed
- Timeline and next steps

### 📚 Comprehensive Plan
**[REBRAND_PLAN.md](REBRAND_PLAN.md)** - Complete implementation guide
- Full branding strategy
- File-by-file modification plan
- Legal, licensing, and attribution
- Testing and verification steps
- ~30-minute read

### 🎨 Icon Creation Guide
**[ICON_GENERATION_GUIDE.md](ICON_GENERATION_GUIDE.md)** - Asset creation workflows
- macOS .icns generation scripts
- Web asset creation
- Quality testing procedures
- Troubleshooting tips

### 📝 Configuration Template
**[product.json.template](product.json.template)** - Ready-to-use config
- Complete rebranded product.json
- Replace placeholders with your values
- Copy to `openvscode-server/product.json`

---

## Document Relationships

```
REBRAND_SUMMARY.md (Start Here)
    ↓
    ├─→ REBRAND_PLAN.md (Full Details)
    │       ↓
    │       ├─→ Section 1: Current State Analysis
    │       ├─→ Section 2: Brand Identity (Choose tagline)
    │       ├─→ Section 3: File Modifications (Implementation)
    │       ├─→ Section 4: Asset Requirements
    │       ├─→ Section 5: Open-VSX Integration
    │       ├─→ Section 6: CLI Naming Decision
    │       ├─→ Section 7: Implementation Checklist
    │       ├─→ Section 8: Testing Strategy
    │       └─→ Section 9: Legal & Licensing
    │
    ├─→ ICON_GENERATION_GUIDE.md (Asset Creation)
    │       ↓
    │       ├─→ Design Guidelines
    │       ├─→ Automated Scripts
    │       ├─→ Testing Procedures
    │       └─→ Deployment Steps
    │
    └─→ product.json.template (Reference)
            ↓
            Use as base for openvscode-server/product.json
```

---

## Implementation Workflow

### Phase 1: Planning (Week 1)
1. Read **REBRAND_SUMMARY.md**
2. Review **REBRAND_PLAN.md** Section 2 (Brand Identity)
3. Make decisions on:
   - Tagline
   - Icon style direction
   - CLI binary name
   - Bundle identifier
4. Approve color palette and design direction

### Phase 2: Asset Creation (Week 2)
1. Follow **ICON_GENERATION_GUIDE.md**
2. Design master icon (1024×1024 PNG)
3. Run generation scripts
4. Test icon quality across all sizes
5. Create web assets (192px, 512px)

### Phase 3: Core Implementation (Week 2-3)
1. Use **REBRAND_PLAN.md** Section 3 (File Modifications)
2. Update `product.json` using **product.json.template**
3. Modify `cli/src/constants.rs`
4. Update `package.json` metadata
5. Replace `README.md`
6. Rebuild CLI binary

### Phase 4: Integration (Week 3)
1. Copy icons to `resources/` directories
2. Update build scripts (gulp tasks)
3. Modify Info.plist (macOS app bundle)
4. Configure code signing
5. Test full build pipeline

### Phase 5: Testing (Week 4)
1. Follow **REBRAND_PLAN.md** Section 8 (Testing)
2. Visual verification (Finder, Dock, Launchpad)
3. Functional testing (CLI, extensions, data isolation)
4. Regression testing (core features)
5. Bug fixing

### Phase 6: Distribution (Week 5-6)
1. Create DMG installer
2. Sign and notarize app bundle
3. Test on clean macOS system
4. Prepare release notes
5. Publish GitHub release
6. Launch documentation site

---

## Key Decisions Checklist

Before starting implementation, decide:

### Brand Identity
- [ ] **Tagline**: Which one? (Recommend: "AI-Native macOS IDE")
- [ ] **Icon Design**: Approve concept (waves, neural, geometric, etc.)
- [ ] **Color Palette**: Primary and accent colors
- [ ] **Typography**: Font choices (SF Pro recommended)

### Technical Choices
- [ ] **CLI Name**: `vibecode` or keep `code`? (Recommend: `vibecode`)
- [ ] **Data Folder**: `.vibecode` or `.vibecode-server`? (Recommend: `.vibecode`)
- [ ] **Bundle ID**: `com.vibecode.ide` or custom?

### Infrastructure
- [ ] **Domain**: Register vibecode.io or alternative?
- [ ] **Apple Developer**: Individual ($99) or Organization ($299)?
- [ ] **Community Platform**: Discord, Discourse, or other?
- [ ] **Social Media**: Twitter, Mastodon, both?

---

## File Locations

### Documentation (This Directory)
```
docs/
├── REBRAND_INDEX.md           ← You are here
├── REBRAND_SUMMARY.md          ← Start here (executive summary)
├── REBRAND_PLAN.md             ← Complete guide
├── ICON_GENERATION_GUIDE.md    ← Asset creation
└── product.json.template       ← Configuration template
```

### Files to Modify (OpenVSCode Submodule)
```
openvscode-server/
├── product.json                     ← Update branding
├── package.json                     ← Update metadata
├── README.md                        ← Replace entirely
├── cli/src/constants.rs             ← Update app name, paths
└── resources/
    ├── darwin/
    │   └── code.icns                ← Replace with vibecode.icns
    ├── server/
    │   ├── code-192.png             ← Replace with vibecode-192.png
    │   └── code-512.png             ← Replace with vibecode-512.png
    └── linux/
        └── code.png                 ← Replace with vibecode.png
```

### Build Output
```
openvscode-server/cli/target/release/
└── code                             ← Rename to vibecode
```

---

## Quick Reference Commands

### Icon Generation
```bash
# Navigate to docs directory
cd /Users/ryan.maclean/vibecode-webgui/docs

# Create icon generation script
cat ICON_GENERATION_GUIDE.md  # Copy script from here

# Run icon generation
./generate-icons.sh

# Preview result
qlmanage -p vibecode.icns
```

### Build & Test
```bash
# Rebuild CLI (after constants.rs changes)
cd /Users/ryan.maclean/vibecode-webgui/openvscode-server/cli
cargo build --release

# Test new binary
./target/release/vibecode --version

# Full rebuild (after product.json changes)
cd /Users/ryan.maclean/vibecode-webgui/openvscode-server
npm run compile
```

### Deploy Icons
```bash
# Copy generated icons to project
cp vibecode.icns openvscode-server/resources/darwin/
cp vibecode-192.png openvscode-server/resources/server/
cp vibecode-512.png openvscode-server/resources/server/
cp vibecode-512.png openvscode-server/resources/linux/vibecode.png
```

---

## Success Criteria

### MVP Launch (v1.0)
- [x] Build successful (11MB CLI binary)
- [ ] Branding shows "VibeCode" everywhere
- [ ] Custom icon displays correctly
- [ ] CLI command `vibecode` works
- [ ] Extensions install from Open-VSX
- [ ] No VS Code conflicts

### Public Release
- [ ] Signed DMG installer
- [ ] Documentation website live
- [ ] GitHub release published
- [ ] Community channels active
- [ ] Initial marketing complete

---

## Timeline Summary

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1 | Planning | Brand decisions, icon concepts |
| 2 | Assets | Final icon, web assets |
| 2-3 | Core Implementation | Updated configs, rebuilt binary |
| 3 | Integration | Icons deployed, build working |
| 4 | Testing | All tests passing, bugs fixed |
| 5-6 | Distribution | DMG ready, docs live, launch! |

**Total**: 4-6 weeks from planning to public release

---

## Support & Questions

### Documentation Questions
- Check relevant section in **REBRAND_PLAN.md**
- Review **REBRAND_SUMMARY.md** for quick answers
- Use **ICON_GENERATION_GUIDE.md** for asset help

### Implementation Issues
- All file paths are absolute
- Scripts are ready to copy/paste
- Templates include all required fields
- Check "Troubleshooting" sections in each guide

### Design Questions
- See **REBRAND_PLAN.md** Section 2.4 (Visual Identity)
- Review **ICON_GENERATION_GUIDE.md** (Design Resources)
- Check Apple HIG for icon requirements

---

## Additional Context

### Why VibeCode?
See **CODE_SERVER_COMPARISON.md** for analysis of alternatives:
- VS Code: Desktop, Microsoft-controlled
- OpenVSCode Server: Browser/server, Gitpod
- code-server: Self-hosted, Coder
- **VibeCode**: Native macOS, AI-first, community

### Project Status
See **BUILD_STATUS.md** for current build state:
- ✅ CLI binary built successfully
- ✅ Submodule integrated
- ⏳ Rebranding in progress (this phase)
- 🔜 Desktop app packaging next

### Architecture
See **ARCHITECTURE.md** for technical details:
- OpenVSCode Server as foundation
- AI integration strategy
- VM provider abstraction
- macOS-specific optimizations

---

## Version History

- **v1.0** (2025-10-28): Initial rebranding plan
  - Complete branding strategy
  - Icon generation guide
  - Configuration templates
  - Implementation checklists

---

## Next Steps

1. **Start with Summary**: Read **REBRAND_SUMMARY.md**
2. **Make Decisions**: Choose tagline, icon style, CLI name
3. **Design Icons**: Follow **ICON_GENERATION_GUIDE.md**
4. **Implement Changes**: Use **REBRAND_PLAN.md** checklists
5. **Test Thoroughly**: Verify branding, test functionality
6. **Launch**: Package, distribute, announce!

---

**Ready to begin?** → Start with [REBRAND_SUMMARY.md](REBRAND_SUMMARY.md)

**Need full details?** → Read [REBRAND_PLAN.md](REBRAND_PLAN.md)

**Creating assets?** → Follow [ICON_GENERATION_GUIDE.md](ICON_GENERATION_GUIDE.md)

**Want template?** → Use [product.json.template](product.json.template)

---

**Document Index Version**: 1.0  
**Last Updated**: 2025-10-28  
**Status**: Complete - Ready for Implementation
