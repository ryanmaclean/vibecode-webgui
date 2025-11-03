# Setup Guide for New Contributors

If you're picking up this codebase fresh, here's what you need to know.

## Current State

The code is complete and in git. The VM images are NOT in git (too large). You'll need to set them up.

## What You'll Get from Git

```bash
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui
```

You get:
- All source code (Swift, TypeScript, Rust)
- All build scripts
- All documentation
- All tests
- Issue templates with work to do

You DON'T get:
- VM disk images (.img files)
- Build artifacts
- node_modules (run npm install)

## Quick Setup

```bash
# 1. Install dependencies
npm install

# 2. Build the Swift app
cd VibeCodeSwift
swift build -c debug
cd ..

# 3. Setup VMs (see below)
./scripts/setup-vms-for-new-clone.sh

# 4. Launch
./scripts/launch-vibecode.sh
```

## The VM Image Problem

**Issue**: You need at least one working VM image to start.

**Why**: Fresh Alpine images don't have bootloaders configured. The working VMs (ide, pgvector) do, but they're not in git.

**Solutions**:

### Option 1: Get from Someone (Fastest)
If someone has working VMs, they can share `vibecode-ide.img` and `vibecode-ide-efi.nvram` files. Put them in `dist/vm-images/` and run:
```bash
./scripts/setup-vms-for-new-clone.sh
```

### Option 2: Build from Cloud Images (Complex)
```bash
./scripts/rebuild-all-vms-with-services.sh
```
This might work but has known issues. See `.github/ISSUE_TEMPLATE/01-bootloader-fix.md`

### Option 3: Wait for Pre-Built Images
We may provide downloadable VM images in a future release. Not available for v0.9-beta.

## Running Tests Without VMs

Most infrastructure tests work without VMs:

```bash
# These work without VMs running
./scripts/regression-tests.sh
cd VibeCodeSwift && swift build -c debug

# These need VMs
./scripts/functional-tests.sh
./scripts/service-tests.sh
```

## What Work Is Available

Check `.github/ISSUE_TEMPLATE/` for issues other agents can pick up:

1. **Bootloader fix** - Get fresh Alpine images to boot
2. **Service installation** - Add PostgreSQL, Valkey, Node.js, VSCode to VMs
3. **Tone cleanup** - Reduce emoji in documentation
4. **Auto-start fix** - Make codeserver VM auto-start
5. **SSH configuration** - Enable SSH access to VMs

## Current Test Status

If you get VMs set up, expect:
- 27 of 33 tests passing (82%)
- Build and infrastructure: 100%
- VM boot: Should be 100% with setup script
- Services: 0% (not installed)

## Known Blockers for New Contributors

1. **VM Images**: Need at least one working image
2. **macOS 15+**: Requires Sequoia or later
3. **Physical Mac**: No nested virtualization
4. **16GB RAM**: Minimum for running VMs

## Getting Help

- Read `docs/BOOTLOADER_FIX_APPLIED.md` for context
- Check `docs/STYLE_GUIDE.md` for documentation tone
- See `CONTRIBUTING.md` for how to contribute
- Open an issue if stuck (no judgment)

## Realistic Expectations

**This is beta software.** Even with setup, only 2/6 VMs have been fully validated. The others boot but may have issues.

**Services aren't installed.** You can start VMs but can't use PostgreSQL/Valkey/etc yet.

**Help is appreciated.** If you can fix bootloader issues or install services, that's valuable.

No pressure though. Understanding the codebase and asking questions is also valuable.

## Next Steps for You

1. Try to get one working VM image (ide.img if possible)
2. Run setup script
3. Launch the app
4. See what works and what doesn't
5. Pick an issue template that interests you
6. Or just explore the code

---

**Questions?** The issue templates have context. The docs have details. And you can always open an issue to ask.

