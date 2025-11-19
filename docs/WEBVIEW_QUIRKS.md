# WebView Quirks & Compatibility Guide

**Last Updated:** 2025-11-14
**Current Setup:** Tauri 2.9.1 with platform-native WebViews

## Platform WebView Engines

| Platform | Engine | Version | Chromium Equivalent | Auto-Update |
|----------|--------|---------|---------------------|-------------|
| **macOS** | WebKit | Varies by OS | ~Safari 17 | Via OS updates |
| **Windows** | WebView2 | Edge-based | Latest Edge | Via Edge updates |
| **Linux** | WebKitGTK | 2.40+ | ~Safari 16 | Via package manager |

## Known Issues

### OpenVSCode Server Rendering

#### Status: TESTING NEEDED

Test these specific scenarios on macOS WebKit:

- [ ] Monaco editor renders correctly
- [ ] Syntax highlighting works
- [ ] Code completion popup positioning
- [ ] File tree scrolling performance
- [ ] Terminal emulator rendering
- [ ] Split editor views
- [ ] Minimap rendering
- [ ] Extension webviews
- [ ] Markdown preview
- [ ] Git diff view

### Common WebKit Issues

#### 1. CSS Grid Layout Differences

**Symptom:** Grid layouts may render differently on WebKit vs Chromium

**Affected:** macOS, Linux (WebKitGTK)

**Workaround:**
```css
/* Explicit grid definitions work better */
.grid-container {
  display: grid;
  grid-template-columns: 200px 1fr; /* Explicit px values */
  /* Avoid: grid-template-columns: auto 1fr; */
}
```

#### 2. Flexbox Gap Support

**Symptom:** `gap` property in flexbox may not work on older WebKit

**Affected:** macOS < 14.0

**Workaround:**
```css
/* Feature detection */
.flex-container {
  display: flex;
}

@supports (gap: 1rem) {
  .flex-container {
    gap: 1rem;
  }
}

@supports not (gap: 1rem) {
  .flex-container > * + * {
    margin-left: 1rem;
  }
}
```

#### 3. Backdrop Filter Performance

**Symptom:** `backdrop-filter: blur()` may be slow on WebKit

**Affected:** macOS, Linux

**Workaround:**
```css
/* Use sparingly, or fallback */
.modal-backdrop {
  background: rgba(0, 0, 0, 0.8); /* Fallback */
}

@supports (backdrop-filter: blur(10px)) {
  .modal-backdrop {
    backdrop-filter: blur(10px);
    background: rgba(0, 0, 0, 0.5);
  }
}
```

#### 4. WebRTC Support Variations

**Symptom:** WebRTC APIs may differ

**Affected:** All platforms

**Workaround:**
```javascript
// Check for WebRTC support
if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
  // Use WebRTC
} else {
  // Fallback or show error
}
```

#### 5. Web Workers & SharedArrayBuffer

**Symptom:** SharedArrayBuffer may require specific headers

**Affected:** All platforms

**Workaround:**
```rust
// In Tauri, set CSP headers
"app": {
  "security": {
    "csp": "default-src 'self'; Cross-Origin-Embedder-Policy: require-corp; Cross-Origin-Opener-Policy: same-origin"
  }
}
```

## Testing Checklist

### Before Each Release

#### macOS (WebKit)
- [ ] Test on macOS 13 (Ventura)
- [ ] Test on macOS 14 (Sonoma)
- [ ] Test on macOS 15 (Sequoia)
- [ ] Check Safari Technology Preview compatibility

#### Windows (WebView2)
- [ ] Verify WebView2 Runtime installed
- [ ] Test on Windows 10
- [ ] Test on Windows 11
- [ ] Check Edge version compatibility

#### Linux (WebKitGTK)
- [ ] Test on Ubuntu 22.04
- [ ] Test on Fedora latest
- [ ] Test on Arch Linux
- [ ] Check WebKitGTK version >= 2.40

### Feature Compatibility Matrix

| Feature | macOS WebKit | Windows WebView2 | Linux WebKitGTK | Notes |
|---------|--------------|------------------|-----------------|-------|
| CSS Grid | ✅ | ✅ | ✅ | |
| Flexbox Gap | ⚠️ macOS < 14 | ✅ | ⚠️ Old GTK | Use fallback |
| Backdrop Filter | ⚠️ Slow | ✅ | ⚠️ Slow | Minimize usage |
| Web Workers | ✅ | ✅ | ✅ | |
| WebAssembly | ✅ | ✅ | ✅ | |
| WebGL | ✅ | ✅ | ✅ | |
| WebRTC | ⚠️ Varies | ✅ | ⚠️ Varies | Check support |
| Clipboard API | ✅ | ✅ | ⚠️ Permissions | May need fallback |
| File System Access | ❌ | ✅ | ❌ | Use Tauri APIs instead |

Legend: ✅ Full support | ⚠️ Partial/conditional | ❌ Not supported

## Polyfills & Workarounds

### Recommended Polyfills

```json
// package.json
{
  "dependencies": {
    "core-js": "^3.35.0",
    "regenerator-runtime": "^0.14.1",
    "whatwg-fetch": "^3.6.20"
  }
}
```

```javascript
// src/polyfills.js
import 'core-js/stable';
import 'regenerator-runtime/runtime';
import 'whatwg-fetch';
```

### CSS Normalize

```bash
npm install modern-normalize
```

```css
/* src/styles/global.css */
@import 'modern-normalize';

/* WebKit-specific fixes */
@supports (-webkit-appearance: none) {
  /* WebKit-only styles */
  input[type="search"] {
    -webkit-appearance: textfield;
  }
}
```

## Runtime Detection

### Detect WebView Engine in Frontend

```javascript
// src/utils/webview-detect.js
export function getWebViewEngine() {
  const ua = navigator.userAgent;

  if (ua.includes('Edg/')) {
    return {
      engine: 'WebView2',
      version: ua.match(/Edg\/([\d.]+)/)?.[1],
      isChromium: true
    };
  }

  if (ua.includes('AppleWebKit') && !ua.includes('Chrome')) {
    return {
      engine: 'WebKit',
      version: ua.match(/Version\/([\d.]+)/)?.[1],
      isChromium: false
    };
  }

  if (ua.includes('WebKitGTK')) {
    return {
      engine: 'WebKitGTK',
      version: ua.match(/WebKitGTK\/([\d.]+)/)?.[1],
      isChromium: false
    };
  }

  return {
    engine: 'Unknown',
    version: null,
    isChromium: false
  };
}

// Usage
const webview = getWebViewEngine();
console.log(`Running on ${webview.engine} ${webview.version}`);

if (!webview.isChromium) {
  console.warn('Running on non-Chromium engine, some features may differ');
}
```

### Detect from Rust Backend

Add to `/Users/studio/vibecode-webgui/src-tauri/src/commands.rs`:

```rust
use serde::Serialize;

#[derive(Serialize)]
pub struct WebViewInfo {
    pub platform: String,
    pub engine: String,
    pub os_version: String,
}

#[tauri::command]
pub fn get_webview_info() -> WebViewInfo {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        let output = Command::new("defaults")
            .args(&[
                "read",
                "/System/Library/Frameworks/WebKit.framework/Versions/Current/Resources/Info.plist",
                "CFBundleVersion"
            ])
            .output()
            .ok();

        let webkit_version = output
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .unwrap_or_else(|| "unknown".to_string())
            .trim()
            .to_string();

        WebViewInfo {
            platform: "macOS".to_string(),
            engine: format!("WebKit {}", webkit_version),
            os_version: std::env::var("OSTYPE").unwrap_or_default(),
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Check WebView2 version
        use std::process::Command;

        let output = Command::new("reg")
            .args(&[
                "query",
                "HKLM\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
                "/v",
                "pv"
            ])
            .output()
            .ok();

        let version = output
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .and_then(|s| s.lines().find(|l| l.contains("pv")).map(|l| l.to_string()))
            .unwrap_or_else(|| "unknown".to_string());

        WebViewInfo {
            platform: "Windows".to_string(),
            engine: format!("WebView2 (Edge) {}", version),
            os_version: std::env::var("OS").unwrap_or_default(),
        }
    }

    #[cfg(target_os = "linux")]
    {
        use std::process::Command;

        let output = Command::new("pkg-config")
            .args(&["--modversion", "webkit2gtk-4.1"])
            .output()
            .ok();

        let webkit_version = output
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .unwrap_or_else(|| "unknown".to_string())
            .trim()
            .to_string();

        WebViewInfo {
            platform: "Linux".to_string(),
            engine: format!("WebKitGTK {}", webkit_version),
            os_version: std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default(),
        }
    }
}
```

Then register the command in `main.rs`:

```rust
.invoke_handler(tauri::generate_handler![
    // ... existing commands ...
    commands::get_webview_info,
])
```

### Use in Frontend

```typescript
// src/utils/diagnostics.ts
import { invoke } from '@tauri-apps/api/core';

interface WebViewInfo {
  platform: string;
  engine: string;
  os_version: string;
}

export async function logWebViewInfo() {
  try {
    const info = await invoke<WebViewInfo>('get_webview_info');
    console.log('WebView Info:', info);

    // Send to analytics/monitoring
    if (window.DD_RUM) {
      window.DD_RUM.addRumGlobalContext('webview', info);
    }

    return info;
  } catch (err) {
    console.error('Failed to get WebView info:', err);
    return null;
  }
}
```

## Debugging WebKit Issues

### Enable WebKit Inspector (macOS)

```bash
# Enable Web Inspector in WebKit WebView
defaults write com.vibecode.app WebKitDeveloperExtras -bool true
defaults write com.vibecode.app WebKitPreferences.developerExtrasEnabled -bool true

# Restart app, then right-click → Inspect Element
```

### Remote Debugging (Linux WebKitGTK)

```bash
# Set environment variable before launching
WEBKIT_INSPECTOR_SERVER=127.0.0.1:9222 ./target/release/vibecode

# Open in browser:
# http://127.0.0.1:9222
```

### Windows WebView2 DevTools

```rust
// Add to src-tauri/src/main.rs setup
#[cfg(debug_assertions)]
{
    let window = app.get_webview_window("main").unwrap();
    window.open_devtools();
}
```

## Reporting Issues

### Issue Template

```markdown
**Platform:** macOS 14.1 / Windows 11 / Ubuntu 22.04
**WebView Engine:** WebKit 618.1.15 / WebView2 120.0.6099.109 / WebKitGTK 2.42.1
**App Version:** 1.5.0
**Tauri Version:** 2.9.1

**Description:**
[What doesn't work as expected?]

**Expected (Chromium behavior):**
[How it works in Chrome/Edge/Electron]

**Actual (WebKit/WebView2 behavior):**
[How it differs]

**Screenshots:**
[Side-by-side comparison if possible]

**Workaround:**
[If you found one]

**Code Sample:**
\`\`\`html
<!-- Minimal reproduction -->
\`\`\`
```

## Resources

- [WebKit Feature Status](https://webkit.org/status/)
- [Can I Use (WebKit)](https://caniuse.com/?compare=safari+17,edge+120)
- [MDN Browser Compatibility](https://developer.mozilla.org/en-US/docs/Web/API)
- [Tauri WebView Docs](https://tauri.app/v1/references/webview-versions/)
- [WebKitGTK Release Notes](https://webkitgtk.org/releases/)

## Version History

| Date | Change | By |
|------|--------|-----|
| 2025-11-14 | Initial quirks document | Claude |

---

**Next Steps:**
1. Test OpenVSCode Server on macOS WebKit thoroughly
2. Document any rendering issues in this file
3. Create GitHub issues for major bugs
4. Build platform-specific workarounds as needed
