# Verso Browser Engine Research
**Date**: 2025-10-25
**Status**: Research Phase
**Related Issue**: #682

## What is Verso?

Verso is a web browser built on top of Servo, Mozilla's experimental browser engine written in Rust. It aims to provide a modern, fast, and secure browsing experience.

**Key Points**:
- Built on Servo (Rust-based browser engine)
- Modern web standards support
- Memory-safe (Rust)
- Embeddable
- Active development

## Why Verso for VibeCode?

### Current Architecture
```
Tauri Desktop Shell (Rust)
  └─> System WebView (Chromium/WebKit)
      └─> code-server (VS Code)
          └─> http://localhost:8080
```

### Proposed Architecture
```
Tauri Desktop Shell (Rust)
  └─> Verso Browser Engine (Rust)
      └─> code-server (VS Code)
          └─> http://localhost:8080
```

### Benefits

1. **Full Rust Stack**
   - Tauri: Rust
   - Verso: Rust
   - No JavaScript runtime overhead
   - Memory safety throughout

2. **Performance**
   - Lighter than Chromium
   - Optimized for IDE workloads
   - Better memory management
   - Faster startup

3. **Control**
   - Custom rendering pipeline
   - Better debugging
   - Can optimize for code-server
   - No WebView limitations

4. **Consistency**
   - Same engine on all platforms
   - No WebView version differences
   - Predictable behavior

5. **Size**
   - Smaller than bundling Chromium
   - Contributes to <20MB target
   - Static linking possible

## Research Questions

### 1. Embedding API
- [ ] How to embed Verso in Tauri?
- [ ] What's the API surface?
- [ ] Can we control navigation?
- [ ] Event handling?

### 2. Compatibility
- [ ] Does code-server work in Verso?
- [ ] WebSocket support?
- [ ] Service Worker support?
- [ ] IndexedDB support?
- [ ] LocalStorage support?

### 3. Performance
- [ ] Startup time vs WebView?
- [ ] Memory usage vs WebView?
- [ ] Rendering performance?
- [ ] JavaScript execution speed?

### 4. Maturity
- [ ] Production-ready?
- [ ] Stability?
- [ ] Bug count?
- [ ] Community support?

### 5. Integration
- [ ] Build system integration?
- [ ] Cross-platform support?
- [ ] Binary size impact?
- [ ] Dependencies?

## Research Plan

### Phase 1: Documentation Review (1-2 days)
- [ ] Read Verso documentation
- [ ] Study Servo embedding guide
- [ ] Review example applications
- [ ] Check GitHub issues

### Phase 2: Simple PoC (3-4 days)
- [ ] Create minimal Tauri + Verso app
- [ ] Load simple HTML page
- [ ] Test navigation
- [ ] Measure performance

### Phase 3: code-server Test (3-4 days)
- [ ] Load code-server in Verso
- [ ] Test all features
- [ ] Identify compatibility issues
- [ ] Document workarounds

### Phase 4: Benchmarking (2-3 days)
- [ ] Startup time comparison
- [ ] Memory usage comparison
- [ ] Rendering performance
- [ ] JavaScript benchmarks

### Phase 5: Decision (1 day)
- [ ] Compile findings
- [ ] Make go/no-go decision
- [ ] Document rationale
- [ ] Update roadmap

## Initial Findings

### Verso Repository
- **URL**: https://github.com/versotile-org/verso
- **Stars**: ~2k (as of research date)
- **Language**: Rust
- **License**: MPL 2.0
- **Status**: Active development

### Servo Engine
- **URL**: https://github.com/servo/servo
- **Stars**: ~28k
- **Language**: Rust
- **License**: MPL 2.0
- **Status**: Active (Linux Foundation project)

## Technical Considerations

### Dependencies
```toml
[dependencies]
# Verso/Servo dependencies (estimated)
servo = "0.x"
verso = "0.x"
webrender = "0.x"
```

### Binary Size Impact
- **Servo core**: ~50-100MB (unoptimized)
- **With optimizations**: ~20-40MB
- **Static linking**: Possible size reduction
- **Target**: Keep total <20MB

### Platform Support
- **macOS**: ✅ Supported
- **Linux**: ✅ Supported
- **Windows**: ⚠️ Experimental

### Web Standards Support
- **HTML5**: ✅ Good
- **CSS3**: ✅ Good
- **JavaScript**: ✅ SpiderMonkey
- **WebGL**: ⚠️ Partial
- **WebAssembly**: ✅ Yes
- **Service Workers**: ⚠️ Partial

## Risks & Mitigations

### Risk 1: Maturity
**Risk**: Verso/Servo may not be production-ready
**Mitigation**: 
- Thorough testing in Phase 3
- Keep WebView as fallback
- Gradual rollout

### Risk 2: Compatibility
**Risk**: code-server may not work fully
**Mitigation**:
- Test all features early
- Document incompatibilities
- Work with Verso team on fixes

### Risk 3: Performance
**Risk**: May be slower than WebView
**Mitigation**:
- Benchmark early (Phase 4)
- Profile and optimize
- Set clear performance targets

### Risk 4: Binary Size
**Risk**: May increase binary size significantly
**Mitigation**:
- Aggressive optimization
- Static linking
- Strip unnecessary features

### Risk 5: Maintenance
**Risk**: Additional maintenance burden
**Mitigation**:
- Monitor Verso releases
- Contribute fixes upstream
- Build relationship with Verso team

## Success Criteria

### Must Have
- [ ] code-server loads and runs
- [ ] All core features work (editor, terminal, extensions)
- [ ] Performance ≥ WebView
- [ ] Binary size <20MB
- [ ] Stable (no crashes)

### Nice to Have
- [ ] Performance >WebView (faster)
- [ ] Binary size <15MB
- [ ] DevTools integration
- [ ] Custom rendering optimizations

### Deal Breakers
- ❌ code-server doesn't work
- ❌ Performance <50% of WebView
- ❌ Binary size >50MB
- ❌ Frequent crashes
- ❌ No cross-platform support

## Timeline

### Week 1: Research & PoC
- Days 1-2: Documentation review
- Days 3-5: Simple PoC
- Days 6-7: Initial testing

### Week 2: Integration & Testing
- Days 1-3: code-server integration
- Days 4-5: Feature testing
- Days 6-7: Bug fixing

### Week 3: Benchmarking & Decision
- Days 1-2: Performance benchmarks
- Days 3-4: Analysis
- Days 5: Decision
- Days 6-7: Documentation

**Total**: 3 weeks (part of 6-8 week Milestone 2)

## Next Steps

### Immediate (Today)
1. [ ] Clone Verso repository
2. [ ] Review documentation
3. [ ] Find embedding examples
4. [ ] Check compatibility matrix

### This Week
1. [ ] Create minimal PoC
2. [ ] Test with simple HTML
3. [ ] Measure baseline performance
4. [ ] Document findings

### Next Week
1. [ ] Integrate with code-server
2. [ ] Test all features
3. [ ] Identify issues
4. [ ] Create issue list

## Resources

### Documentation
- Verso Docs: https://github.com/versotile-org/verso/wiki
- Servo Book: https://book.servo.org/
- Embedding Guide: TBD

### Community
- Verso Discord: TBD
- Servo Zulip: https://servo.zulipchat.com/
- GitHub Discussions: https://github.com/versotile-org/verso/discussions

### Examples
- Verso Browser: Reference implementation
- Servo Embedders: Other projects using Servo
- Tauri Examples: Integration patterns

## Open Questions

1. **API Stability**: Is the embedding API stable?
2. **Documentation**: Is embedding well-documented?
3. **Support**: Will Verso team help with integration?
4. **Roadmap**: What's Verso's development roadmap?
5. **Community**: How active is the community?

## Decision Framework

### Go Decision
If:
- ✅ code-server works ≥90% features
- ✅ Performance ≥ WebView
- ✅ Binary size <20MB
- ✅ Stable (crash rate <1%)
- ✅ Cross-platform support

Then: **Proceed with full integration**

### No-Go Decision
If:
- ❌ code-server <70% features
- ❌ Performance <50% WebView
- ❌ Binary size >50MB
- ❌ Unstable (crash rate >5%)
- ❌ No cross-platform

Then: **Stay with WebView, revisit in 6 months**

### Partial Go
If:
- ⚠️ code-server 70-90% features
- ⚠️ Performance 50-100% WebView
- ⚠️ Binary size 20-50MB

Then: **Make it optional, let users choose**

---

**Status**: 📋 Research plan ready
**Next**: Clone repo and start Phase 1
**Owner**: Development team
**Timeline**: 3 weeks
