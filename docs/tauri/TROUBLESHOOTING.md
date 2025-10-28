# Tauri Troubleshooting Guide

Comprehensive troubleshooting guide for VibeCode Tauri desktop application issues.

## Table of Contents

- [Development Issues](#development-issues)
- [Build Issues](#build-issues)
- [Runtime Issues](#runtime-issues)
- [Platform-Specific Issues](#platform-specific-issues)
- [Docker Integration Issues](#docker-integration-issues)
- [Performance Issues](#performance-issues)
- [Common Error Messages](#common-error-messages)

## Quick Diagnostics

### Check Environment

```bash
# Verify all required tools
node --version        # Should be 18.18.0+
npm --version         # Should be 9.0.0+
rustc --version       # Should be 1.70+
cargo --version       # Should be 1.70+
cargo tauri --version # Should be 2.x

# Check Docker
docker --version
docker ps

# Check Xcode (macOS)
xcode-select -p
```

### Verify Project Setup

```bash
# From project root
ls -la src-tauri/        # Should exist
ls -la out/              # Should exist after build:export
cat src-tauri/tauri.conf.json | jq .version

# Check dependencies
cd src-tauri
cargo check
```

## Development Issues

### Issue: Tauri Dev Won't Start

**Symptoms**:
- `cargo tauri dev` fails immediately
- "Command not found: tauri"
- Frontend loads but window doesn't appear

**Diagnosis**:
```bash
# Check if Tauri CLI is installed
which cargo-tauri

# Check if Next.js dev server is accessible
curl http://localhost:3000

# Check for port conflicts
lsof -i :3000
```

**Solutions**:

1. **Tauri CLI Not Installed**
   ```bash
   # Install Tauri CLI
   cargo install tauri-cli

   # Verify installation
   cargo tauri --version
   ```

2. **Next.js Not Running**
   ```bash
   # Start Next.js first in separate terminal
   npm run dev

   # Wait for "Ready" message, then:
   cargo tauri dev
   ```

3. **Port Already in Use**
   ```bash
   # Kill process using port 3000
   kill -9 $(lsof -t -i :3000)

   # Or use alternative port
   PORT=3002 npm run dev

   # Update tauri.conf.json devUrl to match
   ```

4. **Rust Compilation Errors**
   ```bash
   # Clean and rebuild
   cd src-tauri
   cargo clean
   cargo build

   # Check for missing dependencies
   cargo check
   ```

### Issue: Changes Not Reflecting

**Symptoms**:
- Frontend changes don't hot-reload
- Backend changes not visible after edit
- Stale content displayed

**Solutions**:

1. **Frontend Changes**
   ```bash
   # Check DevTools console for errors
   # Browser DevTools should be open automatically in dev mode

   # If not hot-reloading, restart Next.js
   # Terminal 1 (restart):
   npm run dev

   # Terminal 2 (keep running):
   cargo tauri dev
   ```

2. **Backend Changes**
   ```bash
   # Rust changes ALWAYS require restart
   # Stop cargo tauri dev (Ctrl+C)
   # Then restart:
   cargo tauri dev
   ```

3. **Configuration Changes**
   ```bash
   # Changes to tauri.conf.json require full restart
   # Stop both Next.js and Tauri
   # Then restart both
   ```

### Issue: DevTools Not Opening

**Symptoms**:
- Window opens but no DevTools
- Cannot debug frontend issues

**Solutions**:

1. **Enable Debug Mode**
   ```bash
   # Ensure running in debug mode (default for dev)
   cargo tauri dev

   # DevTools should auto-open
   ```

2. **Manual DevTools Toggle**
   ```rust
   // In src-tauri/src/main.rs, ensure this is present:
   .setup(|app| {
       #[cfg(debug_assertions)]
       {
           let window = app.get_webview_window("main").unwrap();
           window.open_devtools();
       }
       Ok(())
   })
   ```

3. **Open DevTools Manually**
   - macOS: `Cmd + Opt + I`
   - Windows: `Ctrl + Shift + I`
   - Linux: `Ctrl + Shift + I`

### Issue: IPC Commands Failing

**Symptoms**:
- Frontend invoke() calls return errors
- "Command not found" errors
- Type errors in responses

**Diagnosis**:
```typescript
// Test in frontend console
import { invoke } from '@tauri-apps/api/core';
await invoke('ping').then(console.log).catch(console.error);
```

**Solutions**:

1. **Command Not Registered**
   ```rust
   // Ensure command is registered in main.rs
   .invoke_handler(tauri::generate_handler![
       commands::ping,  // Must be listed here
   ])
   ```

2. **Command Handler Errors**
   ```bash
   # Check terminal running cargo tauri dev for Rust errors
   # Look for panic messages or error logs
   ```

3. **Type Mismatch**
   ```typescript
   // Frontend expects string, backend returns number
   // Fix backend return type:
   #[command]
   pub fn get_value() -> String {  // Not -> i32
       "42".to_string()
   }
   ```

4. **Async Issues**
   ```rust
   // Async commands need await in frontend
   #[command]
   pub async fn check_docker() -> Result<bool, String> {
       // Async implementation
   }
   ```

   ```typescript
   // Frontend must await
   const result = await invoke('check_docker');  // Not invoke()
   ```

## Build Issues

### Issue: Build Fails

**Symptoms**:
- `cargo tauri build` exits with errors
- Linker errors
- Missing dependencies

**Diagnosis**:
```bash
# Check what fails
cargo tauri build 2>&1 | tee build.log

# Check individual components
npm run build:export  # Frontend
cd src-tauri && cargo build --release  # Backend
```

**Solutions**:

1. **Frontend Build Fails**
   ```bash
   # Check Next.js build errors
   npm run build:export

   # Common issues:
   # - TypeScript errors
   # - Missing dependencies
   # - Dynamic imports not compatible with static export
   ```

2. **Rust Compilation Fails**
   ```bash
   cd src-tauri

   # Update dependencies
   cargo update

   # Clean rebuild
   cargo clean
   cargo build --release
   ```

3. **Missing System Dependencies (macOS)**
   ```bash
   # Install Xcode Command Line Tools
   xcode-select --install

   # If already installed, update
   sudo rm -rf /Library/Developer/CommandLineTools
   xcode-select --install
   ```

4. **Linker Errors**
   ```bash
   # Check if all required system libraries present
   # macOS: Ensure Xcode is up to date

   # Clear cargo cache
   rm -rf ~/.cargo/registry
   rm -rf ~/.cargo/git

   # Reinstall dependencies
   cd src-tauri
   cargo clean
   cargo build --release
   ```

### Issue: Bundle Size Too Large

**Symptoms**:
- DMG exceeds 100MB
- .app bundle unexpectedly large
- Slow download/installation

**Diagnosis**:
```bash
# Check bundle size
ls -lh src-tauri/target/release/bundle/dmg/*.dmg
du -sh src-tauri/target/release/bundle/macos/*.app

# Check what's included
cd src-tauri/target/release/bundle/macos/VibeCode.app
find . -type f -exec ls -lh {} \; | sort -k5 -h -r | head -20
```

**Solutions**:

1. **Debug Build Instead of Release**
   ```bash
   # Always use --release flag
   cargo tauri build --release

   # Not just cargo tauri build
   ```

2. **Strip Debug Symbols**
   ```bash
   cd src-tauri/target/release
   strip vibecode
   ```

3. **Optimize Frontend**
   ```bash
   # Ensure production build
   NODE_ENV=production npm run build:export

   # Check bundle analyzer
   npm run build -- --analyze
   ```

4. **Configure Cargo.toml**
   ```toml
   [profile.release]
   opt-level = "z"     # Optimize for size
   lto = true          # Link-time optimization
   codegen-units = 1   # Better optimization
   panic = "abort"     # Smaller binary
   strip = true        # Strip symbols
   ```

### Issue: Code Signing Fails (macOS)

**Symptoms**:
- "Code signing failed" error
- Notarization rejected
- "Developer ID not found"

**Diagnosis**:
```bash
# Check available signing identities
security find-identity -v -p codesigning

# Verify certificate
security find-certificate -c "Developer ID Application"
```

**Solutions**:

1. **Missing Certificate**
   ```bash
   # Download certificate from Apple Developer portal
   # Install via Xcode or manual import
   # Double-click .cer file to install
   ```

2. **Certificate Not in Keychain**
   ```bash
   # Import certificate
   security import certificate.p12 -k ~/Library/Keychains/login.keychain

   # Verify import
   security find-identity -v -p codesigning
   ```

3. **Signing Configuration**
   ```json
   // tauri.conf.json
   {
     "bundle": {
       "macOS": {
         "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)"
       }
     }
   }
   ```

4. **Hardened Runtime Issues**
   ```bash
   # Check if hardened runtime is enabled
   codesign -dvv src-tauri/target/release/bundle/macos/VibeCode.app

   # Should see: Flags=0x10000(runtime)
   ```

## Runtime Issues

### Issue: Application Won't Launch

**Symptoms**:
- App icon bounces and closes
- Crash on startup
- "Application is damaged" error

**Diagnosis**:
```bash
# Check console logs (macOS)
log show --predicate 'processImagePath contains "VibeCode"' --last 5m

# Or use Console.app and filter for VibeCode

# Try launching from terminal for debug output
./src-tauri/target/release/bundle/macos/VibeCode.app/Contents/MacOS/VibeCode
```

**Solutions**:

1. **Gatekeeper Blocking (macOS)**
   ```bash
   # Remove quarantine attribute
   xattr -dr com.apple.quarantine VibeCode.app

   # Or allow in System Preferences
   # System Preferences → Security & Privacy → Allow
   ```

2. **Missing Frontend Build**
   ```bash
   # Ensure frontend was built
   ls -la out/

   # If empty, rebuild
   npm run build:export
   cargo tauri build
   ```

3. **Corrupt Application**
   ```bash
   # Delete and rebuild
   rm -rf src-tauri/target/release/bundle
   cargo tauri build
   ```

4. **Permission Issues**
   ```bash
   # Fix permissions
   chmod -R 755 VibeCode.app
   ```

### Issue: White Screen / Blank Window

**Symptoms**:
- Window opens but shows nothing
- No content loaded
- DevTools shows errors

**Diagnosis**:
```bash
# Check if frontend files exist
ls -la src-tauri/target/release/bundle/macos/VibeCode.app/Contents/Resources/

# Should contain index.html and assets
```

**Solutions**:

1. **Frontend Not Bundled**
   ```bash
   # Verify Next.js static export
   ls -la out/

   # Should contain index.html, _next/, etc.
   # If missing, rebuild:
   npm run build:export
   ```

2. **Incorrect Frontend Path**
   ```json
   // Check tauri.conf.json
   {
     "build": {
       "frontendDist": "../out"  // Must match Next.js output
     }
   }
   ```

3. **CSP Blocking Resources**
   ```json
   // Check tauri.conf.json CSP
   {
     "security": {
       "csp": "default-src 'self'; script-src 'self' 'unsafe-eval'; ..."
     }
   }
   ```

4. **Base URL Issues**
   ```javascript
   // next.config.mjs - for static export
   const nextConfig = {
     output: 'export',
     images: {
       unoptimized: true,  // Required for static export
     },
   };
   ```

### Issue: Window Sizing Problems

**Symptoms**:
- Window too small/large
- Cannot resize
- Content doesn't fit

**Solutions**:

1. **Configure Default Window Size**
   ```json
   // tauri.conf.json
   {
     "app": {
       "windows": [{
         "width": 1400,
         "height": 900,
         "minWidth": 800,
         "minHeight": 600,
         "resizable": true
       }]
     }
   }
   ```

2. **Runtime Window Management**
   ```typescript
   // Frontend can control window
   import { getCurrent } from '@tauri-apps/api/window';

   const window = getCurrent();
   await window.setSize({ width: 1400, height: 900 });
   ```

## Platform-Specific Issues

### macOS Issues

#### Issue: "App is damaged and can't be opened"

**Solution**:
```bash
# Remove quarantine attribute
xattr -cr /Applications/VibeCode.app

# Verify removal
xattr -l /Applications/VibeCode.app  # Should be empty
```

#### Issue: Notarization Fails

**Diagnosis**:
```bash
# Check notarization status
xcrun notarytool history --keychain-profile "AC_PASSWORD"

# View submission details
xcrun notarytool log <submission-id> --keychain-profile "AC_PASSWORD"
```

**Solutions**:
```bash
# Ensure app is properly signed
codesign --verify --deep --strict --verbose=2 VibeCode.app

# Re-submit for notarization
xcrun notarytool submit VibeCode.dmg \
  --keychain-profile "AC_PASSWORD" \
  --wait

# Staple notarization ticket
xcrun stapler staple VibeCode.app
```

#### Issue: Keychain Access Denied

**Symptoms**:
- "User interaction is not allowed" during build
- Signing fails in CI/CD

**Solution**:
```bash
# Unlock keychain before building
security unlock-keychain -p <password> ~/Library/Keychains/login.keychain-db

# Or use CI-specific keychain
security create-keychain -p <password> build.keychain
security unlock-keychain -p <password> build.keychain
security import certificate.p12 -k build.keychain -P <p12-password> -T /usr/bin/codesign
```

## Docker Integration Issues

### Issue: Docker Commands Fail

**Symptoms**:
- `check_docker()` returns false
- "Cannot connect to Docker" errors
- Docker version not detected

**Diagnosis**:
```bash
# Test Docker from command line
docker ps
docker version

# Check Docker socket permissions
ls -la /var/run/docker.sock

# Test Bollard connection
cargo test --package vibecode --lib docker::tests::test_docker_check -- --nocapture
```

**Solutions**:

1. **Docker Not Running**
   ```bash
   # Start Docker Desktop (macOS)
   open -a Docker

   # Wait for Docker to fully start
   until docker ps; do sleep 1; done
   ```

2. **Socket Permission Issues**
   ```bash
   # Add user to docker group (Linux)
   sudo usermod -aG docker $USER

   # Re-login for changes to take effect
   ```

3. **Docker Desktop Configuration**
   ```bash
   # Ensure Docker Desktop allows socket access
   # Docker Desktop → Settings → Advanced → Allow socket access
   ```

4. **Test Connection in App**
   ```typescript
   // Frontend test
   import { invoke } from '@tauri-apps/api/core';

   const status = await invoke('get_docker_status');
   console.log('Docker status:', status);
   ```

### Issue: Container Operations Timeout

**Symptoms**:
- Docker commands hang
- Timeout errors
- Slow responses

**Solutions**:

1. **Increase Timeout**
   ```rust
   // In docker.rs
   use tokio::time::{timeout, Duration};

   pub async fn check_docker_available() -> Result<bool, String> {
       let result = timeout(Duration::from_secs(10), async {
           // Docker operations
       }).await;

       match result {
           Ok(r) => r,
           Err(_) => Err("Operation timed out".to_string()),
       }
   }
   ```

2. **Check Docker Daemon**
   ```bash
   # Check Docker daemon logs
   docker logs $(docker ps -aq) --tail 50

   # Restart Docker
   # macOS: Docker Desktop menu → Restart
   # Linux: sudo systemctl restart docker
   ```

## Performance Issues

### Issue: Slow Startup

**Symptoms**:
- App takes >5 seconds to launch
- Window appears but loads slowly

**Diagnosis**:
```bash
# Profile startup
RUST_LOG=debug cargo tauri dev

# Check what's loading slowly
# Look at console logs for timing
```

**Solutions**:

1. **Large Frontend Bundle**
   ```bash
   # Analyze Next.js bundle
   npm run build -- --analyze

   # Optimize with code splitting
   # Use dynamic imports for heavy components
   ```

2. **Slow Docker Check**
   ```rust
   // Make Docker check async and non-blocking
   #[command]
   pub async fn check_docker() -> Result<bool, String> {
       tokio::spawn(async {
           docker::check_docker_available().await
       }).await.unwrap()
   }
   ```

3. **Database/Network on Startup**
   ```rust
   // Defer heavy operations until after window shows
   .setup(|app| {
       let app_handle = app.handle();

       tokio::spawn(async move {
           // Heavy initialization here
       });

       Ok(())
   })
   ```

### Issue: High Memory Usage

**Symptoms**:
- App uses >500MB RAM
- Memory grows over time
- System slowdown

**Diagnosis**:
```bash
# Monitor memory usage
ps aux | grep VibeCode

# Profile with Instruments (macOS)
# Xcode → Open Developer Tool → Instruments → Allocations
```

**Solutions**:

1. **Frontend Memory Leaks**
   ```typescript
   // Ensure cleanup in React components
   useEffect(() => {
       const subscription = someObservable.subscribe();

       return () => {
           subscription.unsubscribe();  // Cleanup
       };
   }, []);
   ```

2. **Backend Memory Management**
   ```rust
   // Use Arc for shared data
   use std::sync::Arc;

   let shared_data = Arc::new(data);
   ```

3. **Clear Caches Periodically**
   ```typescript
   // Clear Monaco editor models
   monaco.editor.getModels().forEach(model => {
       if (!isActive(model)) {
           model.dispose();
       }
   });
   ```

## Common Error Messages

### "error: linking with `cc` failed"

**Cause**: Missing system dependencies or compiler tools

**Solution** (macOS):
```bash
xcode-select --install
sudo xcode-select --reset
```

### "panicked at 'Failed to connect to Docker'"

**Cause**: Docker daemon not running or not accessible

**Solution**:
```bash
# Start Docker
open -a Docker

# Verify connection
docker ps
```

### "Error: Command not registered"

**Cause**: Frontend trying to invoke unregistered command

**Solution**:
```rust
// Add to main.rs
.invoke_handler(tauri::generate_handler![
    commands::your_command,  // Add here
])
```

### "Failed to load resource: net::ERR_FILE_NOT_FOUND"

**Cause**: Frontend assets not bundled or incorrect path

**Solution**:
```bash
# Rebuild frontend
npm run build:export

# Verify out/ directory exists and has content
ls -la out/

# Rebuild Tauri
cargo tauri build
```

### "WebView2 not found" (Windows)

**Cause**: WebView2 Runtime not installed

**Solution**:
```bash
# Download and install WebView2 Runtime
# https://developer.microsoft.com/en-us/microsoft-edge/webview2/

# Or bundle with application
# tauri.conf.json: "webviewInstallMode": "embedBootstrapper"
```

## Debugging Tools

### Enable Verbose Logging

```bash
# Rust debug logs
RUST_LOG=debug cargo tauri dev

# Cargo verbose output
cargo tauri dev -v

# Both
RUST_LOG=trace cargo tauri dev -vv
```

### Browser DevTools

```bash
# Auto-opens in debug mode
cargo tauri dev

# Manual shortcuts:
# macOS: Cmd + Opt + I
# Windows/Linux: Ctrl + Shift + I
```

### Rust Debugging

```bash
# With rust-lldb (macOS)
rust-lldb src-tauri/target/debug/vibecode

# With rust-gdb (Linux)
rust-gdb src-tauri/target/debug/vibecode
```

### Network Inspection

```javascript
// Frontend - Monitor IPC calls
window.__TAURI_INTERNALS__.transformCallback = (callback, once) => {
  console.log('Tauri callback:', callback, once);
  return callback;
};
```

## Getting Help

### Before Asking for Help

1. ✅ Check this troubleshooting guide
2. ✅ Search GitHub issues: `label:tauri`
3. ✅ Check Tauri documentation
4. ✅ Collect diagnostic information:

```bash
# System info
uname -a
sw_vers  # macOS
node --version
npm --version
rustc --version
cargo tauri --version

# Error logs
cargo tauri dev 2>&1 | tee error.log

# Build output
cargo tauri build 2>&1 | tee build.log
```

### Opening an Issue

Include:
- **System Information**: OS, versions
- **Steps to Reproduce**: Exact commands
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Logs**: Error messages and stack traces
- **Screenshots**: If UI-related

### Useful Resources

- [Tauri Documentation](https://tauri.app/v2/)
- [Tauri Discord](https://discord.com/invite/tauri)
- [VibeCode Issues](https://github.com/ryanmaclean/vibecode-webgui/issues)
- [Rust Forum](https://users.rust-lang.org/)

---

**Last Updated**: 2025-10-01
**Tauri Version**: 2.x
**Platform Coverage**: macOS (primary), Windows/Linux (planned)
