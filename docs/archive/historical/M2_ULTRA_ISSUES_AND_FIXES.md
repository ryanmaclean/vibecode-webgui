# M2 Ultra Testing - Issues & Fixes

**Hardware**: Apple M2 Ultra (24 cores, 64GB)  
**Date**: 2025-10-04  

## Issues Encountered & Solutions

### Issue 1: GNU Make Version Too Old ❌→✅

**Problem**:
```
Makefile:15: *** GNU Make >= 3.82 is required. Your Make version is 3.81
```

**Root Cause**:
- macOS ships with GNU Make 3.81 (`/usr/bin/make`)
- Linux kernel 6.6.52 requires Make 3.82+
- Apple's system make is outdated for modern kernel builds

**Solution**:
```bash
# Install GNU Make via Homebrew
brew install make

# Homebrew installs as 'gmake' to avoid conflicts
# Version: GNU Make 4.4.1

# Add to PATH for 'make' command
export PATH="/opt/homebrew/opt/make/libexec/gnubin:$PATH"

# Verify
make --version  # Now shows 4.4.1
```

**Fix Applied**: ✅
- Installed GNU Make 4.4.1 via Homebrew
- Updated PATH to use newer version
- Kernel build can now proceed

**Permanent Fix**:
Add to `~/.zshrc`:
```bash
export PATH="/opt/homebrew/opt/make/libexec/gnubin:$PATH"
```

### Issue 2: Lima VM Networking Error ❌

**Problem**:
```
networks.yaml: "/opt/socket_vmnet/bin/socket_vmnet" has to be installed
```

**Root Cause**:
- Lima VZ networking requires `socket_vmnet` daemon
- Not installed by default on macOS
- Required for VM network connectivity

**Investigation**:
```bash
brew list socket_vmnet
# Not installed

limactl sudoers
# Shows required sudoers configuration
```

**Solution Options**:

**Option 1: Install socket_vmnet**
```bash
brew install socket_vmnet
sudo socket_vmnet install
```

**Option 2: Use host networking (no socket_vmnet)**
```yaml
# In Lima YAML config
networks:
  - lima: user-v2  # Uses user-mode networking
  # Or remove networks section entirely
```

**Option 3: Use existing VMs**
- 4 production VMs already running successfully
- They use configured networking
- Can test with those instead

**Current Status**: ⏳ Investigating best approach for test VM

### Issue 3: Kernel Version Availability ❌→✅

**Problem**:
- Kernel 6.17.14 not available (404 error)
- Original build script referenced non-existent version

**Solution**:
- Updated to 6.6.52 LTS (Long Term Support)
- Available and stable
- Better for long-term use

**Fix Applied**: ✅ Build script updated

---

## Current Status

### Kernel Build ✅ In Progress
- **Make version**: Fixed (3.81 → 4.4.1)
- **Architecture**: arm64 native
- **Cores**: 24 parallel compilation
- **Status**: Building with correct Make version
- **Log**: `/tmp/kernel-build-fixed.log`

**Build Command**:
```bash
cd artifacts/minivim/work/linux-6.6.52
export PATH="/opt/homebrew/opt/make/libexec/gnubin:$PATH"
ARCH=arm64 make -j24
```

### Lima VMs ⏳ Networking Issue
- **VMs Created**: ✅ vibecode-vi exists
- **Configuration**: ✅ aarch64 validated
- **Networking**: ❌ Requires socket_vmnet
- **Workaround**: Use existing production VMs

**Existing Working VMs**:
```
debian-zfs    Running    aarch64    2 CPU    4GB
rocky-zfs     Running    aarch64    2 CPU    4GB
ubuntu-zfs    Running    aarch64    2 CPU    4GB
zfs-test      Running    aarch64    2 CPU    4GB
```

---

## Lessons Learned

### 1. macOS Development Challenges
- System tools often outdated (Make 3.81 vs 4.4.1 needed)
- Homebrew essential for modern toolchains
- PATH management critical

### 2. Lima Networking on M-Series
- VZ requires additional networking setup
- socket_vmnet not automatic
- Alternative: user-mode networking or existing VMs

### 3. Kernel Build Requirements
- Modern kernels need modern tools
- GNU Make 3.82+ mandatory
- Check versions before starting builds

### 4. M2 Ultra Still Excellent
- Issues are tooling, not hardware
- 24 cores still provide massive speedup
- Once tools configured, performance outstanding

---

## Recommendations

### For Future Testing

**1. Pre-flight Checks**:
```bash
# Verify Make version
make --version  # Should be ≥3.82

# Install if needed
brew install make
export PATH="/opt/homebrew/opt/make/libexec/gnubin:$PATH"
```

**2. Lima Networking**:
```bash
# Option A: Install socket_vmnet
brew install socket_vmnet
sudo socket_vmnet install

# Option B: Use user networking (no root)
# Modify YAML: networks: - lima: user-v2
```

**3. Use Homebrew Aggressively**:
- Don't rely on system tools
- Install modern versions via brew
- Add to PATH properly

### For Documentation

**Update Build Script**:
```bash
# Add to scripts/benchmarks/build-minivim-kernel.sh

# Check Make version
MAKE_VERSION=$(make --version | head -1 | grep -oE '[0-9]+\.[0-9]+')
if (( $(echo "$MAKE_VERSION < 3.82" | bc -l) )); then
  echo "Error: GNU Make ≥3.82 required, found $MAKE_VERSION"
  echo "Install: brew install make"
  echo "Then: export PATH=\"/opt/homebrew/opt/make/libexec/gnubin:\$PATH\""
  exit 1
fi
```

**Update Lima Docs**:
- Document socket_vmnet requirement
- Provide user-mode networking alternative
- Show sudoers configuration

---

## Next Steps

### Immediate
1. ✅ Monitor kernel build progress (24 cores)
2. ⏳ Decide on Lima networking approach
3. ⏳ Complete kernel build and validate output
4. ⏳ Test built kernel in existing VM

### Follow-up
1. Install socket_vmnet for full Lima functionality
2. Update build scripts with version checks
3. Document macOS-specific requirements
4. Create setup checklist for M-Series

---

## Build Progress

**Started**: ~22:05 PST  
**Status**: Compiling with 24 cores  
**Expected**: 5-10 minutes total  

**Monitoring**:
```bash
# Watch build
tail -f /tmp/kernel-build-fixed.log

# Check processes
ps aux | grep make

# Verify output
ls -lh artifacts/minivim/work/linux-6.6.52/arch/arm64/boot/Image
```

---

**Conclusion**: Issues identified and fixes applied. M2 Ultra continues to perform excellently once proper tooling is configured. Kernel build proceeding with 24-core parallelism.
