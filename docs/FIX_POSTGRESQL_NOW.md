# Fix PostgreSQL - Run These Commands

The Cursor terminal is currently broken. Run these commands in a fresh Terminal.app:

## Quick Fix - Run This First

```bash
cd /Users/ryan.maclean/vibecode-webgui

# First, extract the current initramfs if not already done
if [ ! -d /tmp/glibc-check ]; then
    mkdir -p /tmp/glibc-check
    cd /tmp/glibc-check
    zcat /Users/ryan.maclean/vibecode-webgui/azure/unified-services-glibc-fixed.cpio.gz | cpio -idmv
fi

# Run the Python script to try all options
python3 /Users/ryan.maclean/vibecode-webgui/scripts/fix_pg_all_options.py
```

## What It Does

The script tries 3 approaches:

1. **Option 2**: PostgreSQL 14 from Ubuntu 22.04 (glibc 2.35 compatible)
   - Downloads PG14 and dependencies from Ubuntu 22.04 repos
   - Creates: `unified-services-pg14.cpio.gz`

2. **Option 3**: Alpine PostgreSQL (musl-based)
   - Downloads PostgreSQL from Alpine (same libc as Valkey)
   - Creates: `unified-services-alpine-pg.cpio.gz`

3. **Option 4**: Disable PostgreSQL (fallback)
   - Disables PG in init script
   - Creates: `unified-services-no-pg.cpio.gz`

## Test the Results

After running, test each initramfs:

```bash
# Update the Swift app to use a new initramfs
cd /Users/ryan.maclean/vibecode-webgui

# Kill existing VM
killall VibeCodeServicesVibeCode 2>/dev/null

# Remove old bundle
rm -rf ~/VibeCode\ VMs/VibeCodeServices\ VM.bundle/

# Test Option 2 (PG14)
# Edit azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app/Contents/MacOS/VibeCodeServicesVibeCode.swift
# Change: unified-services-glibc-fixed.cpio.gz → unified-services-pg14.cpio.gz
# Then rebuild:
python3 scripts/build_gui_linux_vm_swift.py

# Launch
open azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app
```

## Alternative: Quick Test Script

```bash
#!/bin/bash
# Test different initramfs images

IMAGES=(
    "unified-services-pg14.cpio.gz"
    "unified-services-alpine-pg.cpio.gz"
    "unified-services-no-pg.cpio.gz"
)

for img in "${IMAGES[@]}"; do
    if [ -f "azure/$img" ]; then
        echo "Testing $img..."
        # Update the initramfs path in the Swift source
        sed -i '' "s/unified-services.*\.cpio\.gz/$img/g" \
            azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app/Contents/MacOS/VibeCodeServicesVibeCode.swift
        
        # Rebuild
        python3 scripts/build_gui_linux_vm_swift.py
        
        # Test
        killall VibeCodeServicesVibeCode 2>/dev/null
        rm -rf ~/VibeCode\ VMs/VibeCodeServices\ VM.bundle/
        open azure/SwiftUI-Apps/VibeCodeServicesVibeCode.app
        
        echo "Check the VM console. Press Enter to try next image..."
        read
    fi
done
```

## Current Status

- ✅ Valkey: Working (musl-based)
- ✅ OpenVSCode: Working (glibc-based)
- ❌ PostgreSQL: Needs glibc 2.38, but initramfs has glibc 2.35
- ❌ Job Control: Requires SSH (dropbear) for full TTY

## Next Steps After PG Fix

1. Add dropbear SSH server for proper TTY/job control
2. Fix NAT routing so host can reach VM services
3. Re-enable Datadog agent


