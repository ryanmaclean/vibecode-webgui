# Quick Fix Reference: Init Script Network Issues

## The Problem in 10 Seconds

The broken init script has **overly strict network interface detection** that times out waiting for carrier signals that may never arrive on certain hypervisors (like macOS Virtualization Framework).

## The One-Line Fix

**Line 241 in current broken init script:**

Change this:
```bash
if [ "$CARRIER" = "1" ] || [ "$OPERSTATE" = "up" ] || [ "$OPERSTATE" = "unknown" ]; then
```

To this:
```bash
if [ "$CARRIER" = "1" ] || [ "$OPERSTATE" = "up" ] || [ "$OPERSTATE" = "unknown" ] || [ -n "$iface" ]; then
```

**That's it.** That one condition (`|| [ -n "$iface" ]`) makes all the difference.

---

## Why This Fixes It

- **Before:** Loop checks carrier signal for 15 seconds, gives up, falls back to static IP
- **After:** Loop accepts first found interface immediately, then stabilizes it properly

Result: Network ready in ~3 seconds instead of 15+ seconds.

---

## Additional Improvements (Priority Order)

### Must Have (Priority 1)
Add the condition above. That's the critical fix.

### Should Have (Priority 2)
Remove the early interface bring-up code (lines 227-231):
```bash
# DELETE THESE LINES:
if [ "$i" = "1" ]; then
    echo "  Bringing $iface up..."
    ip link set $iface up
    sleep 2
fi
```

This adds unnecessary 2-second waits on first loop iteration.

### Nice to Have (Priority 3)
Add 0.5-second sleep after DHCP (line ~254):
```bash
# Get IP address
# Give DHCP time to configure interface
sleep 0.5
VM_IP=$(ip addr show "$FOUND_IFACE" | grep "inet " | awk '{print $2}' | cut -d/ -f1)
```

### Optional (Priority 4)
Simplify storage logic to use VirtioFS directly instead of trying block device first (lines 28-135).

---

## Working vs Broken in 30 Seconds

| Aspect | Working | Broken |
|--------|---------|--------|
| **Network detection** | Accepts interface if exists | Demands carrier signal |
| **Detection speed** | Immediate (1 iteration) | 15 seconds (timeout) |
| **Boot time** | ~3 seconds | 15+ seconds |
| **Storage** | VirtioFS first | Block device first |
| **Code size** | 810 lines, 31KB | 862 lines, 33KB |
| **Reliability** | High | Low |

---

## How to Apply the Fix

### Option A: Direct Edit
1. Open `/tmp/initramfs-check/init`
2. Find line 241
3. Change the condition as shown above
4. Save

### Option B: Copy from Working Version
The working version is at `/tmp/working-initramfs/init` (extracted from the DMG).

Copy the network initialization section (lines 176-246) from working version to broken version.

---

## Testing After Fix

Boot the VM and check:
```bash
# Should appear within 1-2 seconds:
"✓ Found interface: eth0 after 0.5s"

# Should appear within 3 seconds:
"✓ DHCP IP: 192.168.x.x"

# Should NOT appear:
"⚠ Network interface with carrier not found after 15 seconds"
```

---

## Technical Details

### What `[ -n "$iface" ]` Does
- Returns true if string `$iface` is not empty
- In this context: always true if we found an interface
- Acts as a pragmatic fallback when carrier signal is unreliable

### Why Hypervisors Have Issues
Some hypervisors (macOS Virtualization Framework, QEMU with certain configs) don't properly report:
- Carrier signals (always 0 or unavailable)
- operstate (shows "down" even when working)

The working version handles this by accepting the interface anyway and stabilizing it in the secondary setup phase.

---

## Common Mistakes to Avoid

1. **Don't remove the entire condition check** - you still need to verify the interface exists
2. **Don't add early bring-up code** - the secondary phase handles this better
3. **Don't skip the subsequent interface setup** - that code is essential for proper network configuration
4. **Don't ignore DHCP timing** - the 0.5-second sleep is important

---

## Files Generated

All comparison files have been saved to `/Users/ryan.maclean/vibecode-webgui/`:

1. `INITRAMFS_WORKING_VS_BROKEN_COMPARISON.md` - Detailed analysis
2. `NETWORK_INIT_DETAILED_COMPARISON.md` - Network initialization focus
3. `EXTRACTION_AND_COMPARISON_SUMMARY.md` - Extraction process and findings
4. `QUICK_FIX_REFERENCE.md` - This file

Extract locations:
- Working version: `/tmp/working-initramfs/init`
- Broken version: `/tmp/initramfs-check/init`
