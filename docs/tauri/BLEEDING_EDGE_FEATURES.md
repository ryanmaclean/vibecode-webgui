# Tauri v2 Bleeding Edge Features

Current status of experimental rendering engines in Tauri v2 (2025).

## TL;DR - What We're Using vs What's Available

| Feature | Status | VibeCode | Notes |
|---------|--------|----------|-------|
| **WebKit (WKWebView)** | ✅ Production | ✅ Using | Default on macOS, stable |
| **Chromium on macOS** | ❌ Not available | ❌ N/A | Planned for Tauri v3/v4 |
| **Servo (via Verso)** | 🧪 Experimental | ❌ Not using | Available March 2025 |
| **V8 Engine** | ❌ Not available | ❌ N/A | No direct support |

## Current VibeCode Setup (Production)

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }  # Uses WRY (WebKit on macOS)
```

**Rendering stack**:
- macOS: WKWebView (WebKit)
- Windows: WebView2 (Chromium)
- Linux: WebKitGTK

**What we get**:
- ✅ Stable, battle-tested
- ✅ Native OS integration
- ✅ Low memory footprint
- ✅ Fast startup time
- ❌ No Chrome DevTools on macOS
- ❌ Different rendering across platforms

## Experimental: Tauri Verso (Servo Integration)

### Announced: March 2025

Tauri announced **experimental integration with Verso**, a browser based on Mozilla's Servo engine.

```toml
# Experimental Verso setup
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-runtime-verso = "0.1"  # Custom runtime instead of WRY
```

### What is Verso?

**Verso** = Simplified wrapper around **Servo** (Mozilla's experimental browser engine written in Rust).

**Servo**:
- Written in Rust (memory-safe)
- Modern, parallel rendering architecture
- Web standards compliant
- ~4 MB binary (vs ~100+ MB Chromium)

**Why Verso instead of Servo directly?**
- Servo's APIs are complex and daunting
- Verso makes Servo easier to use
- Provides Tauri-compatible interface

### Current Verso Status (March 2025)

**What works**:
- ✅ Basic webview rendering
- ✅ Official Tauri plugins compatible
- ✅ Working examples available
- ✅ Cross-platform (macOS, Windows, Linux)

**Missing features**:
- ❌ Window decorations
- ❌ Custom window titles
- ❌ Transparency support
- ❌ Not as feature-complete as WKWebView/WebView2

**Funding**: NLNet via NGI Assure program

### Why Consider Verso?

**Advantages**:
1. **Consistent rendering across platforms** (same Servo engine everywhere)
2. **Open source entire stack** (no proprietary WebView)
3. **Smaller binary size** (Servo ~4 MB vs Chromium ~100 MB)
4. **Modern Rust codebase** (memory-safe, parallel)
5. **Control over engine** (can patch/customize Servo)

**Disadvantages**:
1. **Experimental** (not production-ready)
2. **Missing features** (no window decorations yet)
3. **Less mature** (WebKit has 20+ years, Servo ~10 years)
4. **Smaller ecosystem** (fewer devtools, extensions)

## Chromium on macOS: NOT Available

### Current Status

**macOS uses WKWebView**, not Chromium. There is **NO Chromium support on macOS** in Tauri v2.

**Why?**
- Apple requires apps to use WKWebView
- WebView2 (Chromium) is Windows-only
- CEF (Chromium Embedded Framework) not yet integrated

### Future Plans (Tauri v3/v4)

Tauri team is exploring:
- **CEF (Chromium Embedded Framework)** as alternative webview
- Microsoft working on WebView2 port to macOS
- Possible in Tauri v3 or v4 (no timeline confirmed)

**Why it matters**:
- Chrome DevTools on macOS
- Consistent Chromium rendering (matches production web browsers)
- V8 engine for better JS performance

**Downsides**:
- ~100 MB binary size increase (vs 10 MB with WebKit)
- Higher memory usage (~200 MB vs ~50 MB)
- Slower startup time

## V8 Engine: Not Directly Available

**V8** is Chrome's JavaScript engine. There's **no direct V8 integration** in Tauri.

**Current JS engines**:
- macOS: JavaScriptCore (WebKit's JS engine)
- Windows: V8 (via WebView2/Chromium)
- Linux: JavaScriptCore (WebKitGTK)

**Why it matters**:
- V8 is generally faster for compute-heavy JS
- Better source map support
- Chrome DevTools integration

**Workaround if you need V8 on macOS**:
- Wait for CEF support (Tauri v3/v4)
- Use Electron instead (has V8 everywhere)
- Or use Verso/Servo (has SpiderMonkey or custom JS engine)

## Recommendation for VibeCode

### Stay on Production WebKit (Current Choice) ✅

**Why**:
1. **Code-server incompatibility**: Servo/Chromium won't help with code-server embedding (we established this earlier)
2. **Stable and tested**: WebKit on macOS is production-ready
3. **Small binary**: ~10 MB vs ~100 MB with Chromium
4. **Fast startup**: <1 second vs 3-5 seconds
5. **MCP strategy**: Our focus is MCP server, not advanced webview features

**What we're NOT missing**:
- ❌ Chrome DevTools (use VS Code debugger instead)
- ❌ Consistent rendering (not critical for local dev tool)
- ❌ Latest web features (code-server doesn't need bleeding edge)

### Consider Verso for Future Experimentation

**When it makes sense**:
- Verso reaches production stability (6-12 months)
- You want consistent cross-platform rendering
- You're building UI-heavy features (not just embedding code-server)
- You want full control over rendering engine

**How to experiment** (today):

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-runtime-verso = "0.1"

# src-tauri/src/main.rs
use tauri_runtime_verso::VersoRuntime;

fn main() {
    tauri::Builder::<VersoRuntime>::default()
        .invoke_handler(tauri::generate_handler![/* ... */])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Comparison Matrix

| Feature | WebKit (Current) | Verso (Experimental) | Chromium (Future) |
|---------|------------------|----------------------|-------------------|
| **Availability** | ✅ Stable | 🧪 Experimental | ❌ Planned v3/v4 |
| **Binary size** | ~10 MB | ~15 MB | ~110 MB |
| **Memory usage** | ~50 MB | ~80 MB | ~200 MB |
| **Startup time** | <1s | ~2s | ~3-5s |
| **Cross-platform consistency** | ❌ No | ✅ Yes | ✅ Yes |
| **DevTools** | Safari Web Inspector | Minimal | Chrome DevTools |
| **JS Engine** | JavaScriptCore | SpiderMonkey* | V8 |
| **Web standards** | Good (Safari) | Good (Modern) | Excellent (Chrome) |
| **Production ready** | ✅ Yes | ❌ No | ❌ Not available |
| **Open source** | Partial (WebKit) | ✅ Full (Servo) | Partial (Chromium) |

*Servo uses its own JS engine or can integrate SpiderMonkey

## What We're Missing (and Why It Doesn't Matter)

### Chrome DevTools ❌
**Missing**: Chrome DevTools on macOS
**Workaround**: Safari Web Inspector, VS Code debugger
**Impact**: Low (not building complex web app)

### V8 Engine ❌
**Missing**: V8 JavaScript engine on macOS
**Impact**: Low (code-server runs in its own process)
**Alternative**: JavaScriptCore is fast enough

### Consistent Rendering ❌
**Missing**: Same rendering engine across platforms
**Impact**: Low (VibeCode is local dev tool, not consumer app)

### Chromium Features ❌
**Missing**: Latest Chrome APIs (WebGPU, WebXR, etc.)
**Impact**: None (not using advanced web features)

## Strategic Recommendations

### For VibeCode Today (2025)

1. **Stick with WebKit** (production-stable)
2. **Focus on MCP server** (AI programmability)
3. **Don't chase bleeding-edge webview** (not our differentiator)

### Monitor for Future (2025-2026)

1. **Verso maturity**: Check quarterly for production readiness
2. **CEF integration**: Watch for Tauri v3 Chromium support
3. **MCP ecosystem**: Focus here instead of rendering engine

### Experiment If Curious

```bash
# Try Verso in separate branch
git checkout -b experiment/tauri-verso
cargo add tauri-runtime-verso

# Test basic rendering
# Document differences vs WebKit
# Evaluate stability for production
```

## Conclusion

**Are we on the bleeding edge?**
- ❌ No, using stable WebKit

**Are we missing features?**
- ✅ Yes, missing Verso (Servo) experimental support
- ✅ Yes, missing Chromium (not available on macOS yet)

**Should we switch?**
- ❌ No, focus on MCP strategy instead
- ✅ Yes, experiment with Verso in separate branch for learning

**Our competitive advantage**:
- Not the rendering engine
- But AI-programmable infrastructure via MCP
- Serial communication, Docker, VMs, experiments platform

## References

- **Tauri Verso Integration**: https://v2.tauri.app/blog/tauri-verso-integration/
- **Servo Project**: https://servo.org/
- **Tauri v2 Release**: https://v2.tauri.app/blog/tauri-20/
- **CEF Discussion**: https://github.com/tauri-apps/tauri/discussions/4591
- **NLNet Funding**: https://nlnet.nl/project/Tauri-Servo/
