# GitHub Issues: Native Editor Strategy for VibeCode

**Research Date**: October 1, 2025
**Context**: Investigation into native (non-Electron) editors supporting VSIX extensions or alternatives

---

## Issue 1: [Strategic] Native Editor Architecture Decision - Recommendation Matrix

### Summary

Research into native code editors as alternatives to macOS containerized VS Code reveals **no existing native editor supports VSIX natively**. However, multiple strategic paths exist with different trade-offs.

### Decision Matrix

| Option | Performance | VSIX Support | License | Effort | Timeline |
|--------|-------------|--------------|---------|--------|----------|
| **A. Fork Lapce** | ⚡⚡⚡⚡⚡ Native | ⚠️ Partial (requires 12-18mo dev) | ✅ Apache 2.0 | High | 12-18 months |
| **B. Eclipse Theia** | ⚡⚡⚡ Web-based | ✅ 95% VSIX compatible | ✅ EPL 2.0 | Low | 3-6 months |
| **C. VSCodium Fork** | ⚡⚡ Electron | ✅ 100% VSIX compatible | ✅ MIT | Medium | 6-12 months |
| **D. Multi-Protocol Standard** | N/A | ⚠️ 40-60% portable | N/A | Very High | 24-36+ months |

### Primary Recommendation: **Hybrid Approach**

**Phase 1 (Immediate - 3-6 months)**: Eclipse Theia Integration
- Get VSIX support working quickly
- Replace GPL-contaminated code-server
- Validate VibeCode extension compatibility
- **Effort**: 1-2 engineers, 3-6 months

**Phase 2 (Long-term - 12-18 months)**: Fork Lapce
- Native performance for desktop/embedded use cases
- Apache 2.0 allows proprietary customization
- Build selective VSIX bridge for key extensions
- **Effort**: 3-5 engineers, 12-18 months

**Phase 3 (Future - 24+ months)**: Multi-Protocol Extensions
- Contribute to cross-editor extension standards
- LSP/DAP/Tree-sitter/WASM foundation
- Position as ecosystem leader

### Key Findings

1. **VSIX is an Open Standard** (ISO/IEC 29500-2) but requires VS Code Extension API implementation
2. **Zed/Lapce** use incompatible extension systems (WASM-based, not Node.js)
3. **VSCodium** is easiest for VSIX but doesn't solve Electron performance issues
4. **Eclipse Theia** provides best short-term VSIX support without maintaining a fork
5. **Performance gains**: Native editors achieve 5-15x startup speed, 4-10x memory reduction

### Next Steps

1. **Prototype Eclipse Theia integration** (replace code-server)
2. **Evaluate Lapce fork feasibility** (technical spike)
3. **Define extension compatibility requirements** (which VSIX features are critical?)
4. **Create roadmap** based on findings

### References

- VSIX Technical Specification: `claudedocs/VSIX_FORMAT_TECHNICAL_SPECIFICATION.md`
- Native Editor Comparison: `claudedocs/NATIVE_EDITOR_ARCHITECTURE_ANALYSIS_2025-10-01.md`
- LSP Bridge Analysis: `claudedocs/LSP_EXTENSION_ARCHITECTURE_RESEARCH.md`

---

## Issue 2: [Implementation] Fork Lapce for Native Performance (Long-term Strategy)

### Objective

Fork Lapce editor (Apache 2.0) to create a native, high-performance alternative to VS Code with selective VSIX compatibility.

### Why Lapce?

**✅ Advantages:**
- **License**: Apache 2.0 (fork-friendly, allows proprietary modifications)
- **Architecture**: Clean separation (app + proxy + core)
- **UI Framework**: Floem (MIT, reactive signals, modern)
- **Text Engine**: Xi-rope (battle-tested from Xi Editor)
- **Platform Support**: Stable on Windows/macOS/Linux
- **Performance**: 10-15x startup speed, 5-8x memory reduction vs VS Code
- **Active Development**: 37K stars, regular commits, responsive maintainers

**❌ Challenges:**
- WASI extension system incompatible with VSIX (requires bridge development)
- Smaller ecosystem than VS Code
- Pre-1.0 (v0.4.5), stability considerations
- Requires Rust expertise

### Implementation Roadmap

#### Phase 1: Fork & Customize (Months 1-3)
**Goal**: Establish VibeCode-branded Lapce fork with custom UI

**Tasks**:
- Fork Lapce repository
- Rebrand UI (name, logo, colors, default settings)
- Set up CI/CD for multi-platform builds
- Establish contribution guidelines
- Create documentation site

**Deliverables**:
- Working VibeCode editor (Lapce-based)
- macOS/Linux/Windows binaries
- Basic documentation

**Effort**: 1-2 engineers, 3 months

#### Phase 2: Core Enhancements (Months 3-6)
**Goal**: Improve stability, add differentiating features

**Tasks**:
- Stabilize known bugs from Lapce upstream
- Add VibeCode-specific features (integrated terminal enhancements, custom themes)
- Performance profiling and optimization
- Integration testing with existing workflows
- Community feedback incorporation

**Deliverables**:
- Stable v0.1 release
- Performance benchmarks vs VS Code
- User feedback report

**Effort**: 2-3 engineers, 3 months

#### Phase 3: Extension Bridge Development (Months 6-12)
**Goal**: Implement selective VSIX compatibility layer

**Approach**: Hybrid extension system
```
┌─────────────────────────────────────────┐
│  Native Lapce WASI Extensions           │
│  (Performance-critical, Rust-based)     │
└─────────────────────────────────────────┘
         +
┌─────────────────────────────────────────┐
│  VSIX Bridge Layer                      │
│  ├─ Node.js runtime (isolated)          │
│  ├─ VS Code API subset implementation   │
│  ├─ Language features via LSP/DAP       │
│  └─ Selective UI extension support      │
└─────────────────────────────────────────┘
```

**Tasks**:
- Design hybrid extension architecture
- Implement Node.js runtime bridge (sandboxed)
- Develop VS Code API compatibility layer (prioritize language features)
- Create VSIX-to-native conversion tools (for popular extensions)
- Build extension marketplace (Open VSX + native registry)

**Target Compatibility**:
- Language servers: 95-100%
- Debuggers (DAP): 90-95%
- Themes: 60-80%
- UI extensions: 20-40% (selective, high-priority only)

**Deliverables**:
- VSIX bridge working for top 20 extensions
- Extension conversion toolkit
- Documentation for extension authors

**Effort**: 3-5 engineers, 6 months

#### Phase 4: Ecosystem Growth (Months 12-18)
**Goal**: Build extension ecosystem, drive adoption

**Tasks**:
- Port critical VS Code extensions (LSP servers, debuggers, popular themes)
- Create extension development guide
- Host extension hackathon
- Partner with key extension authors
- Marketing and community building

**Deliverables**:
- 50+ compatible extensions
- Active developer community
- v1.0 release

**Effort**: 4-6 engineers + marketing, 6 months

### Total Investment

**Timeline**: 12-18 months
**Team Size**: 3-5 engineers (Rust expertise required)
**Budget**: $600K-1.2M (salaries, infrastructure, marketing)

### Success Metrics

1. **Performance**: 10x startup speed, 5x memory reduction vs VS Code
2. **Extensions**: 50+ high-quality extensions (80% coverage of common use cases)
3. **Adoption**: 10K+ active users by v1.0
4. **Stability**: <1% crash rate in production
5. **Compatibility**: 60-80% of popular VSIX extensions work with acceptable degradation

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| VSIX bridge complexity | High | Start with LSP/DAP-only approach (simpler, 60% coverage) |
| Upstream Lapce changes | Medium | Maintain clear fork divergence strategy, selective merges |
| Extension ecosystem growth | High | Focus on quality over quantity, partner with key authors |
| Rust expertise shortage | Medium | Hire early, invest in training, clear architecture docs |
| Competition from Zed/Helix | Low | Differentiate on VSIX compatibility + customization |

### Alternative: Learn from Lapce, Build Greenfield

If fork maintenance proves unsustainable, consider **building on Floem framework directly**:

**Advantages**:
- Full control over architecture
- MIT license (Floem), more permissive than Apache
- No upstream merge conflicts
- Purpose-built for VSIX compatibility

**Disadvantages**:
- Higher initial effort (18-24 months vs 12-18)
- Need to rebuild editor fundamentals
- Higher risk

**Recommendation**: Start with fork, evaluate greenfield if fork friction exceeds benefits.

### Next Steps

1. **Technical Spike** (2 weeks): Evaluate Lapce fork complexity
   - Clone Lapce, build from source on all platforms
   - Identify customization points (branding, settings)
   - Prototype WASI → VSIX bridge architecture
   - Assess Rust team capacity

2. **Go/No-Go Decision** (Week 3): Formal approval with cost/benefit analysis

3. **Team Formation** (Month 1): Hire Rust engineers, set up infrastructure

4. **Kick-off** (Month 1): Begin Phase 1 implementation

---

## Issue 3: [Implementation] Eclipse Theia Integration (Short-term Strategy)

### Objective

Replace code-server with Eclipse Theia to gain VSIX compatibility without GPL license issues, providing immediate value while native editor development proceeds.

### Why Eclipse Theia?

**✅ Advantages over code-server:**
- **License**: EPL 2.0 (permissive, not copyleft like GPL)
- **VSIX Support**: ~95% VS Code extension compatibility out-of-box
- **Open VSX Registry**: Vendor-neutral extension marketplace
- **Multi-User**: Built for cloud/Kubernetes deployment
- **Active Maintenance**: Eclipse Foundation backing
- **Proven**: Used by Gitpod, Eclipse Che, AWS Cloud9

**✅ Advantages over VSCodium fork:**
- No fork to maintain (use upstream Theia)
- Purpose-built for browser deployment
- Multi-user architecture (code-server requires custom work)
- Lower long-term maintenance burden

**⚠️ Considerations:**
- Web-based (not native performance, but better than Electron for containers)
- Requires integration work with existing VibeCode infrastructure
- EPL 2.0 (less permissive than MIT, but acceptable for this use case)

### Implementation Roadmap

#### Phase 1: Proof of Concept (Weeks 1-2)
**Goal**: Validate Theia works with VibeCode extension

**Tasks**:
- Deploy Theia in Docker container
- Install VibeCode VSIX extension from Open VSX
- Test core functionality (terminal, file operations, AI features)
- Evaluate performance vs code-server
- Document integration requirements

**Deliverables**:
- Working Theia + VibeCode prototype
- Technical feasibility report
- Performance comparison data

**Effort**: 1 engineer, 2 weeks

#### Phase 2: Integration (Weeks 3-6)
**Goal**: Replace code-server with Theia in VibeCode infrastructure

**Tasks**:
- Containerize Theia with VibeCode configuration
- Migrate authentication/authorization from code-server
- Update reverse proxy configuration
- Port custom code-server patches (if any)
- Testing across use cases (remote development, pair programming, etc.)

**Deliverables**:
- Production-ready Theia deployment
- Migration guide for existing users
- Automated tests for integration points

**Effort**: 2 engineers, 4 weeks

#### Phase 3: Production Deployment (Weeks 7-12)
**Goal**: Roll out Theia to users, deprecate code-server

**Tasks**:
- Beta testing with internal users
- Gradual rollout (10% → 50% → 100%)
- Monitor performance, stability, user feedback
- Documentation updates (user guides, troubleshooting)
- Code-server deprecation plan

**Deliverables**:
- 100% Theia deployment
- GPL-free codebase ✅
- User satisfaction survey results
- Post-mortem and lessons learned

**Effort**: 2-3 engineers, 6 weeks

### Total Investment

**Timeline**: 3 months (12 weeks)
**Team Size**: 2-3 engineers
**Budget**: $75K-150K (much lower than Lapce fork or VSCodium maintenance)

### Success Metrics

1. **VSIX Compatibility**: 95%+ of VibeCode extension features work
2. **Performance**: <10% degradation vs code-server (acceptable trade-off for GPL removal)
3. **Stability**: <0.5% error rate in production
4. **User Satisfaction**: >80% positive feedback on migration
5. **License Compliance**: 100% GPL-free (Emacs removal + Theia adoption)

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| EPL 2.0 license restrictions | Low | Legal review confirms EPL acceptable for SaaS use |
| Performance degradation | Medium | Profile and optimize hot paths, use HTTP/2 |
| Migration complexity | Medium | Gradual rollout, feature parity checklist |
| User resistance to change | Low | Communicate benefits, provide training |

### Why This Should Be Priority #1

1. **Immediate Impact**: Solves GPL license issue in 3 months vs 12-18 for Lapce fork
2. **Low Risk**: Theia is proven, mature, widely deployed
3. **Resource Efficient**: 2-3 engineers vs 3-5 for Lapce
4. **Parallel Track**: Doesn't block Lapce development (can run both)
5. **User Value**: Better extension ecosystem access via Open VSX

### Next Steps

1. **Week 1**: Technical spike (deploy Theia, test VibeCode extension)
2. **Week 2**: Decision meeting with stakeholders (go/no-go)
3. **Week 3-6**: Integration development
4. **Week 7-12**: Beta testing and rollout

---

## Issue 4: [Research] Multi-Protocol Extension Standard (Long-term Vision)

### Objective

Contribute to cross-editor extension standard enabling 40-60% ecosystem portability, reducing vendor lock-in and expanding VibeCode reach.

### Vision

**Current Reality**: Editor-specific extension ecosystems fragment developer tools landscape
- VS Code: 40,000+ extensions (proprietary marketplace, Node.js-based)
- Vim/Neovim: Vimscript/Lua plugins (no standard package format)
- Emacs: Elisp packages (ELPA/MELPA)
- JetBrains: Java/Kotlin plugins
- Sublime: Python-based plugins

**Future Vision**: Layered extension standard with portable core + editor-specific enhancements

```
┌─────────────────────────────────────────┐
│   EDITOR-SPECIFIC LAYER                 │
│   (UI, Commands, Themes, Workbench)     │
│   - Optional enhancements               │
│   - Graceful degradation                │
└───────────────┬─────────────────────────┘
                │
┌───────────────┴─────────────────────────┐
│   PORTABLE LAYER (40-60% coverage)      │
│   ├─ LSP (language intelligence)        │
│   ├─ DAP (debugging)                    │
│   ├─ Tree-sitter (syntax)               │
│   ├─ TextMate (grammars)                │
│   └─ WASM (compute)                     │
└─────────────────────────────────────────┘
```

### Technical Foundation

**Already Standardized:**
- ✅ **LSP** (Language Server Protocol): Cross-editor language features
- ✅ **DAP** (Debug Adapter Protocol): Cross-editor debugging
- ✅ **Tree-sitter**: Incremental parsing for syntax
- ✅ **TextMate**: Grammar definitions (legacy but widespread)

**Needs Standardization:**
- ❌ **UI Extension Protocol**: Panels, webviews, tree views
- ❌ **Command Protocol**: Editor-agnostic command registration
- ❌ **WASM Runtime**: Portable compute layer for extensions
- ❌ **Package Format**: Universal extension packaging

### Proposed Architecture

#### Universal Extension Package (UEP)

**Manifest Structure** (TOML-based):
```toml
[package]
name = "awesome-python"
version = "1.0.0"
license = "MIT"
authors = ["Developer <dev@example.com>"]

[protocols]
lsp = { server = "pylsp", command = "pylsp", languages = ["python"] }
dap = { adapter = "debugpy", command = "python -m debugpy" }
treesitter = { grammar = "python", highlights = "queries/highlights.scm" }
wasm = { module = "extension.wasm", entrypoint = "_start" }

[capabilities]
# Portable capabilities (work everywhere)
language_features = ["completion", "diagnostics", "hover", "goto_definition"]
debugging = ["launch", "attach", "breakpoints"]
syntax = ["highlighting", "folding", "indentation"]

# Editor-specific capabilities (optional enhancements)
[capabilities.vscode]
ui = ["webview", "tree_view", "status_bar"]
commands = ["python.runFile", "python.debugFile"]

[capabilities.lapce]
ui = ["panel", "status_item"]
commands = ["python.run", "python.debug"]
```

**Package Structure**:
```
awesome-python.uep (ZIP archive)
├── manifest.toml           # Universal manifest
├── lsp/
│   └── pylsp binary or install script
├── dap/
│   └── debugpy binary or install script
├── treesitter/
│   ├── python.so (grammar)
│   └── queries/ (highlight rules)
├── wasm/
│   └── extension.wasm (compute layer)
├── vscode/
│   └── package.json (VS Code-specific enhancements)
└── lapce/
    └── plugin.toml (Lapce-specific enhancements)
```

#### Portable vs Editor-Specific Features

| Feature Type | Portability | Examples |
|--------------|-------------|----------|
| Language Intelligence | 95-100% | Completion, diagnostics, hover, goto definition |
| Debugging | 90-95% | Breakpoints, variable inspection, step debugging |
| Syntax Highlighting | 85-95% | Tree-sitter grammars |
| Formatters/Linters | 90-100% | Via LSP code actions |
| Themes | 40-60% | Color schemes (portable), UI chrome (editor-specific) |
| UI Extensions | 5-20% | Webviews, panels, tree views (editor-specific) |
| Commands | 20-40% | Registration portable, bindings editor-specific |

**Target Coverage**: 60-80% of common use cases portable across editors

### Implementation Roadmap

#### Phase 1: Protocol Standardization (Months 1-6)
**Goal**: Establish formal specification

**Tasks**:
- Form working group (editor vendors, extension authors, standards body)
- Draft Universal Extension Protocol (UEP) specification
- Define manifest schema, package format, capability model
- Publish RFC, gather community feedback
- Iterate based on feedback

**Deliverables**:
- UEP v1.0 specification (public RFC)
- Reference implementation in Rust (CLI tools)
- Validation test suite

**Effort**: 2-3 engineers, 6 months
**Collaboration**: Microsoft, JetBrains, Eclipse Foundation, Zed/Lapce communities

#### Phase 2: Editor Integration (Months 6-18)
**Goal**: Implement UEP support in major editors

**Tasks**:
- VS Code UEP loader (convert UEP → VSIX at install time)
- Lapce UEP loader (native support)
- Neovim UEP loader (via plugin)
- Zed UEP loader (WASM-based)
- JetBrains UEP loader (if partners interested)

**Deliverables**:
- UEP support in 4+ major editors
- Conversion tools (UEP ↔ VSIX, UEP ↔ Lua, etc.)
- Cross-editor test suite

**Effort**: 1-2 engineers per editor, 12 months (parallel development)

#### Phase 3: Ecosystem Migration (Months 18-36)
**Goal**: Drive extension author adoption

**Tasks**:
- Port top 100 VS Code extensions to UEP
- Create migration guides for extension authors
- Build UEP extension registry (vendor-neutral)
- Hackathons and incentive programs
- Marketing and evangelism

**Deliverables**:
- 100+ UEP extensions covering common use cases
- Public UEP registry with search/discovery
- Active developer community

**Effort**: 3-5 engineers + marketing, 18 months

### Business Case for VibeCode

**Why Lead This Effort?**

1. **Ecosystem Expansion**: VibeCode extension works in VS Code, Neovim, Lapce, Zed, JetBrains
2. **Thought Leadership**: Position VibeCode as industry innovator
3. **Competitive Differentiation**: "Works everywhere" is powerful value prop
4. **Lock-in Reduction**: Users choose VibeCode on merit, not editor lock-in
5. **Community Goodwill**: Open source contribution builds brand reputation

**Investment**:
- Timeline: 24-36 months for meaningful adoption
- Effort: 2-3 engineers dedicated to standards work
- Budget: $300K-600K (lower than Lapce fork, higher impact)

**Return**:
- 5-10x larger addressable market (all editors, not just VS Code)
- Industry recognition (conference talks, press coverage)
- Partnership opportunities with editor vendors
- Long-term strategic positioning

### Success Metrics

1. **Specification Adoption**: 4+ major editors implement UEP
2. **Extension Coverage**: 100+ high-quality UEP extensions
3. **Author Adoption**: 20%+ of new extensions published as UEP
4. **VibeCode Reach**: VibeCode extension installable in 5+ editors
5. **Industry Recognition**: Standards body endorsement (ECMA? W3C?)

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Vendor resistance | High | Emphasize value proposition, start with community buy-in |
| Specification fragmentation | Medium | Strong governance, RFC process, reference implementation |
| Slow adoption | High | Focus on tangible benefits, lead by example with VibeCode |
| Competing standards (XKCD 927) | Medium | Partner early with major players, avoid NIH syndrome |

### Next Steps

1. **Months 1-3**: Draft RFC, socialize with editor communities (Zed, Lapce, VS Code forums)
2. **Months 3-6**: Form working group, iterate on specification
3. **Months 6-12**: Build reference implementation, port VibeCode extension to UEP
4. **Months 12-24**: Drive editor adoption, ecosystem growth
5. **Months 24-36**: Scale and evangelism

---

## Issue 5: [Implementation] VSCodium Fork (Fallback Option)

### Objective

Maintain a VSCodium fork as a **fallback option** if Eclipse Theia proves insufficient or Lapce fork exceeds resources.

### Why VSCodium Fork?

**✅ When This Makes Sense:**
- Eclipse Theia doesn't meet VSIX compatibility needs
- Lapce fork timeline/cost unacceptable
- Need 100% VSIX compatibility immediately
- Willing to accept Electron performance trade-offs

**❌ Why This Is Not Recommended:**
- Doesn't solve native performance goal
- Still Electron-based (defeats purpose of native editor research)
- Moderate maintenance burden (tracking upstream VS Code)
- Limited differentiation from VSCodium itself

### Implementation Approach

If this route is chosen, see full assessment in:
**`claudedocs/VSCODIUM_FORK_FEASIBILITY_ASSESSMENT_2025-10-01.md`**

**Summary**:
- **Timeline**: 6-12 months to stable custom fork
- **Effort**: 2-4 engineers ongoing
- **Cost**: $30K-75K annually (minimal customization)
- **Maintenance**: ~10-40 hours/month tracking upstream

**Key Decision Factors**:
1. Can accept Electron architecture? If no → pursue Lapce
2. Need 100% VSIX compatibility? If yes → VSCodium fork more viable than Theia
3. Have team bandwidth for fork maintenance? If no → use Theia (no fork to maintain)

### Recommendation

**Use VSCodium fork only if**:
1. Theia fails technical validation (Phase 1 spike)
2. AND Lapce fork budget not approved
3. AND 100% VSIX compatibility is hard requirement

**Otherwise**: Pursue Theia (short-term) + Lapce (long-term) strategy.

---

## Issue 6: [Reference] VSIX Format Technical Specification

### Summary

Comprehensive documentation of VSIX extension format for reference during implementation.

**Full Documentation**: `claudedocs/VSIX_FORMAT_TECHNICAL_SPECIFICATION.md`

### Key Technical Points

1. **VSIX = Open Standard**
   - Based on ISO/IEC 29500-2 (Open Packaging Conventions)
   - ZIP archive with manifest
   - Not VS Code proprietary (despite Microsoft Marketplace restrictions)

2. **Structure**
   ```
   extension.vsix (ZIP)
   ├── extension.vsixmanifest (Visual Studio format, optional)
   ├── package.json (VS Code format, required)
   ├── [Content_Types].xml (OPC requirement)
   ├── extension/ (code, assets, dependencies)
   └── LICENSE.txt
   ```

3. **Compatibility Requirements**
   To support VSIX, an editor must implement:
   - Extension Host API (Node.js-based `vscode` module)
   - Manifest parser (package.json schema)
   - Lifecycle management (activation events)
   - Node.js runtime for extension execution

4. **MIT/Apache Licensed Implementations**
   - **CodeOSS** (MIT): VS Code source code
   - **VSCodium** (MIT): Telemetry-free binaries
   - **Eclipse Theia** (EPL 2.0): VSIX-compatible framework
   - **Positron** (MIT): RStudio's VS Code fork

5. **Extension Marketplaces**
   - **Microsoft Marketplace**: Restricted to VS Code only (ToS)
   - **Open VSX** (EPL): Vendor-neutral, used by VSCodium/Theia/Gitpod
   - **Self-hosted**: Possible with Open VSX server (open source)

### Use Cases for This Reference

- Implementing VSIX loader in custom editors
- Understanding manifest schema for conversion tools
- Evaluating licensing compatibility
- Building extension registries/marketplaces

---

## Summary of Recommendations

### Immediate Priority (Next 3-6 months)

**✅ Implement Eclipse Theia Integration** ([Issue #3](#issue-3-implementation-eclipse-theia-integration-short-term-strategy))

**Why**: Solves GPL license issue, provides 95% VSIX compatibility, low risk/effort

**Effort**: 2-3 engineers, 3 months, $75K-150K

### Long-term Strategy (12-18 months)

**✅ Fork Lapce for Native Performance** ([Issue #2](#issue-2-implementation-fork-lapce-for-native-performance-long-term-strategy))

**Why**: Native performance (10x improvement), Apache 2.0 license, clean architecture

**Effort**: 3-5 engineers, 12-18 months, $600K-1.2M

### Visionary Play (24-36 months)

**✅ Lead Multi-Protocol Extension Standard** ([Issue #4](#issue-4-research-multi-protocol-extension-standard-long-term-vision))

**Why**: Industry thought leadership, 5-10x market expansion, competitive differentiation

**Effort**: 2-3 engineers, 24-36 months, $300K-600K

### Fallback Options

**⚠️ VSCodium Fork** ([Issue #5](#issue-5-implementation-vscodium-fork-fallback-option))

**When**: Only if Theia fails AND Lapce budget not approved

**Why Not Recommended**: Doesn't solve native performance goal, still Electron

---

## Questions for Stakeholders

1. **Budget Approval**: Which initiatives have funding?
   - [ ] Theia integration ($75K-150K)
   - [ ] Lapce fork ($600K-1.2M)
   - [ ] Multi-protocol standard ($300K-600K)

2. **Strategic Priority**: What's most important?
   - [ ] Speed to market (Theia wins)
   - [ ] Native performance (Lapce wins)
   - [ ] Ecosystem reach (Multi-protocol wins)
   - [ ] VSIX compatibility (Theia or VSCodium)

3. **Team Capacity**: Do we have Rust expertise for Lapce?
   - [ ] Yes, ready to start
   - [ ] No, need to hire (add 2-3 months to timeline)
   - [ ] Willing to train existing team

4. **Risk Tolerance**: How much uncertainty acceptable?
   - [ ] Low (Theia = safest)
   - [ ] Medium (Lapce = proven tech, new integration)
   - [ ] High (Multi-protocol = industry leadership but long timeline)

5. **User Requirements**: What VSIX features are critical?
   - [ ] Language servers (LSP) - achievable in all options
   - [ ] Debuggers (DAP) - achievable in all options
   - [ ] UI extensions (webviews, panels) - only Theia/VSCodium guarantee
   - [ ] Themes - achievable in all options with adaptation

---

## Research Artifacts

All research documentation available in `claudedocs/`:

1. `VSIX_FORMAT_TECHNICAL_SPECIFICATION.md` - VSIX format deep-dive
2. `zed-editor-evaluation-2025-10-01.md` - Zed analysis (GPL license = blocker)
3. `NATIVE_EDITOR_ARCHITECTURE_ANALYSIS_2025-10-01.md` - Editor comparison matrix
4. `LSP_EXTENSION_ARCHITECTURE_RESEARCH.md` - Multi-protocol extension analysis
5. `VSCODIUM_FORK_FEASIBILITY_ASSESSMENT_2025-10-01.md` - VSCodium fork costs
6. Performance benchmarks in `docs/performance/`

**Total Research Investment**: 6 specialized agents, ~40 hours equivalent, comprehensive market analysis

**Key Insight**: No single solution solves all requirements. Hybrid approach (Theia short-term + Lapce long-term + standards leadership) provides best risk-adjusted outcome.
