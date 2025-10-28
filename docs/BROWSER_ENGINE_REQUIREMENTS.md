# Browser Engine Requirements - Chromium Required
**Date**: 2025-10-25 21:54 PST
**Status**: ⚠️ **CRITICAL CORRECTION**

## Problem Statement

**code-server extensions require Chromium**, not WebKit (Safari).

### Why Chromium is Required

1. **VS Code Extension API**: Built for Chromium
2. **Extension Compatibility**: Most extensions expect Chrome APIs
3. **WebView Limitations**: Safari WebView breaks extensions
4. **Developer Tools**: Chrome DevTools integration

## Current Architecture Issues

### macOS WebView = WebKit (Safari)
```
Tauri on macOS → WKWebView (Safari) → code-server
                  ❌ Extensions don't work!
```

**Problems**:
- Extensions fail to load
- Missing Chrome APIs
- Incompatible rendering
- DevTools issues

## Solutions

### Option 1: Tauri with Chromium WebView ⭐ RECOMMENDED
Use Chromium-based WebView instead of system WebView.

**Implementation**:
```toml
[dependencies]
tauri = { version = "2", features = ["webview-chromium"] }
```

**Pros**:
- ✅ Chromium rendering
- ✅ Extension compatibility
- ✅ Cross-platform consistency
- ✅ Chrome DevTools

**Cons**:
- ⚠️ Larger binary size (~50-80MB)
- ⚠️ Need to bundle Chromium
- ⚠️ More complex build

### Option 2: Electron Alternative
Use Electron instead of Tauri.

**Pros**:
- ✅ Chromium built-in
- ✅ Proven for code-server
- ✅ Large ecosystem

**Cons**:
- ❌ Much larger (~100-200MB)
- ❌ Slower startup
- ❌ More memory usage
- ❌ Not Rust-native

### Option 3: Servo with Chromium Compatibility
Wait for Servo to add Chromium API compatibility.

**Pros**:
- ✅ Rust-native
- ✅ Smaller than Chromium
- ✅ Modern architecture

**Cons**:
- ❌ Not ready yet
- ❌ Verso archived
- ❌ Long timeline

### Option 4: CEF (Chromium Embedded Framework)
Embed CEF directly in Tauri.

**Pros**:
- ✅ Full Chromium
- ✅ Good performance
- ✅ Mature

**Cons**:
- ⚠️ Complex integration
- ⚠️ Large binary
- ⚠️ C++ dependencies

## Recommended Approach: Tauri + Chromium WebView

### Architecture
```
┌─────────────────────────────────────┐
│   Tauri Desktop Shell (Rust)       │
│                                     │
│   ┌─────────────────────────────┐  │
│   │  Chromium WebView           │  │
│   │  ┌───────────────────────┐  │  │
│   │  │  code-server          │  │  │
│   │  │  (VS Code)            │  │  │
│   │  │  + Extensions ✅      │  │  │
│   │  └───────────────────────┘  │  │
│   └─────────────────────────────┘  │
└─────────────────────────────────────┘
```

### Implementation Plan

#### Phase 1: Research (2-3 days)
- [ ] Check Tauri Chromium WebView support
- [ ] Test with code-server
- [ ] Measure binary size impact
- [ ] Verify extension compatibility

#### Phase 2: Integration (1 week)
- [ ] Add Chromium WebView dependency
- [ ] Configure build system
- [ ] Test on macOS
- [ ] Test on Linux
- [ ] Test on Windows

#### Phase 3: Optimization (3-4 days)
- [ ] Minimize Chromium features
- [ ] Strip unnecessary components
- [ ] Optimize binary size
- [ ] Test performance

#### Phase 4: Testing (2-3 days)
- [ ] Test all code-server features
- [ ] Test popular extensions
- [ ] Performance benchmarks
- [ ] Cross-platform testing

**Total**: 2-3 weeks

### Binary Size Impact

**Current (WebKit)**:
- Tauri: ~15MB
- Total: ~15MB

**With Chromium**:
- Tauri: ~15MB
- Chromium: ~50-80MB
- Total: ~65-95MB

**Optimized**:
- Tauri: ~15MB
- Chromium (minimal): ~30-40MB
- Total: ~45-55MB (target)

### Comparison with Alternatives

| Solution | Binary Size | Startup | Memory | Extensions |
|----------|-------------|---------|--------|------------|
| Tauri + WebKit | 15MB | 2s | 57MB | ❌ Broken |
| Tauri + Chromium | 45-55MB | 3-4s | 150MB | ✅ Works |
| Electron | 100-200MB | 5-10s | 200MB+ | ✅ Works |
| VS Code | 200MB | 3-5s | 200MB+ | ✅ Works |

**Verdict**: Tauri + Chromium is best balance

## Alternative: Tauri WebView2 (Windows)

On Windows, use WebView2 (Chromium-based):

```toml
[target.'cfg(windows)'.dependencies]
tauri = { version = "2", features = ["webview2"] }
```

**Pros**:
- ✅ Chromium on Windows
- ✅ System WebView2
- ✅ Smaller binary

**Cons**:
- ⚠️ Windows only
- ⚠️ Still need solution for macOS/Linux

## Updated Strategy

### Short-term (This Week)
1. Research Tauri Chromium WebView options
2. Test code-server with Chromium
3. Measure binary size
4. Make go/no-go decision

### Medium-term (2-3 weeks)
1. Integrate Chromium WebView
2. Optimize binary size
3. Test extensions
4. Cross-platform testing

### Long-term (Monitor)
1. Watch Servo development
2. Track Chromium alternatives
3. Optimize further

## Decision Criteria

### Must Have
- ✅ code-server extensions work
- ✅ Chrome DevTools available
- ✅ Cross-platform support
- ✅ Binary size <100MB

### Nice to Have
- Binary size <50MB
- Startup time <3s
- Memory usage <200MB

### Deal Breakers
- ❌ Extensions don't work
- ❌ Binary size >200MB
- ❌ Startup time >10s

## Next Steps

### Immediate (Today)
1. [ ] Research Tauri Chromium options
2. [ ] Check if `webview-chromium` feature exists
3. [ ] Look for CEF integration examples
4. [ ] Test code-server extension compatibility

### This Week
1. [ ] Create PoC with Chromium
2. [ ] Test extensions
3. [ ] Measure binary size
4. [ ] Document findings

### Next Week
1. [ ] Full integration
2. [ ] Optimization
3. [ ] Cross-platform testing
4. [ ] Update roadmap

## Conclusion

**Correction**: We NEED Chromium for code-server extensions to work.

**Options**:
1. ⭐ Tauri + Chromium WebView (recommended)
2. Electron (fallback)
3. Wait for Servo (long-term)

**Timeline**: 2-3 weeks for Chromium integration
**Binary Size**: 45-55MB (acceptable trade-off)
**Benefit**: Extensions actually work!

---

**Status**: 🔄 Strategy revised
**Next**: Research Tauri Chromium WebView
**Priority**: HIGH (extensions are critical)
