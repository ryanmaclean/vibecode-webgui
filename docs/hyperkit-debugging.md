# HyperKit BusyBox Console Debugging Guide

**Issue**: #575 - HyperKit BusyBox vi console output missing

## Problem Description

When running BusyBox-based VMs with HyperKit, console output may not appear or vi editor fails to display properly. This affects minimal container/VM debugging workflows.

## Common Causes

### 1. Serial Console Configuration

HyperKit requires explicit serial console setup:

```bash
# Correct HyperKit invocation with console
hyperkit \
  -A \
  -m 512M \
  -s 0:0,hostbridge \
  -s 31,lpc \
  -l com1,stdio \
  -f kexec,vmlinuz,initrd.img,"console=ttyS0 earlyprintk=serial"
```

Key flags:
- `-l com1,stdio` - Attach serial port to stdio
- `console=ttyS0` - Linux kernel parameter for serial console
- `earlyprintk=serial` - Early boot messages on serial

### 2. Terminal Settings

BusyBox vi requires proper TERM:

```bash
export TERM=xterm-256color
# or
export TERM=vt100
```

Check current terminal:
```bash
echo $TERM
tput colors  # Should show 256 or 8
```

### 3. TTY Device

Verify serial device:
```bash
ls -la /dev/ttyS*
dmesg | grep tty
```

Should see `/dev/ttyS0` or `/dev/console`

### 4. Init Configuration

BusyBox init needs getty on console:

`/etc/inittab`:
```
::sysinit:/bin/mount -t proc proc /proc
::sysinit:/bin/mount -t sysfs sysfs /sys
ttyS0::respawn:/sbin/getty -L ttyS0 115200 vt100
::ctrlaltdel:/sbin/reboot
::shutdown:/bin/umount -a -r
```

## Debugging Steps

### Step 1: Verify HyperKit Console

Test with minimal kernel boot:
```bash
hyperkit \
  -A -m 512M \
  -l com1,stdio \
  -f kexec,vmlinuz,initrd.img,"console=ttyS0 earlyprintk=serial console=tty0"
```

You should see kernel boot messages immediately.

### Step 2: Test BusyBox Shell

Once booted:
```bash
# Should get prompt
/bin/sh

# Test output
echo "Hello HyperKit"
```

### Step 3: Test vi

```bash
# Create test file
echo "test content" > /tmp/test.txt

# Open with vi
TERM=vt100 vi /tmp/test.txt
```

If vi still fails, try:
```bash
# Use ed instead (simpler)
ed /tmp/test.txt

# Or use cat for viewing
cat /tmp/test.txt
```

### Step 4: Check Kernel Parameters

View actual kernel cmdline:
```bash
cat /proc/cmdline
```

Should include `console=ttyS0`

## Solutions

### Solution 1: Update HyperKit Command

Add proper console flags:
```bash
CONSOLE_FLAGS="console=ttyS0,115200 earlyprintk=serial"
hyperkit -l com1,stdio -f kexec,kernel,initrd,"$CONSOLE_FLAGS"
```

### Solution 2: Fix BusyBox Init

Rebuild initramfs with correct inittab:
```bash
cat > inittab <<EOF
::sysinit:/bin/mount -t proc proc /proc
ttyS0::respawn:/sbin/getty -L ttyS0 115200 vt100
EOF

# Rebuild initrd
cd busybox-rootfs
find . | cpio -o -H newc | gzip > ../initrd.img
```

### Solution 3: Use Alternative Editor

If vi remains problematic:
```bash
# Use ed (always works on serial)
ed file.txt

# Or sed for simple edits
sed -i 's/old/new/' file.txt
```

### Solution 4: Enable Debug Output

Add debug flags to kernel:
```bash
"console=ttyS0 debug earlyprintk=serial loglevel=8"
```

## Prevention

### Best Practices

1. **Always specify console in kernel cmdline**
   ```
   console=ttyS0,115200 console=tty0
   ```

2. **Test with simple output first**
   ```bash
   echo "boot complete" > /dev/ttyS0
   ```

3. **Use proper TERM environment**
   ```bash
   export TERM=vt100
   ```

4. **Include getty in init**
   Always spawn getty on ttyS0

5. **Document HyperKit flags**
   Keep a template command with correct flags

## Verification Script

```bash
#!/bin/bash
# Verify HyperKit console setup

echo "Testing HyperKit console..."

# Check TERM
echo "TERM: $TERM"

# Check TTY
echo "TTY devices:"
ls -la /dev/tty* /dev/console 2>/dev/null

# Check kernel cmdline
echo "Kernel cmdline:"
cat /proc/cmdline

# Test vi
if command -v vi >/dev/null; then
  echo "vi: available"
  TERM=vt100 vi --version 2>&1 | head -1
else
  echo "vi: NOT FOUND"
fi

# Test console output
echo "Console test" > /dev/console 2>/dev/null && echo "Console: OK" || echo "Console: FAIL"
```

## References

- HyperKit Documentation: https://github.com/moby/hyperkit
- BusyBox init: https://git.busybox.net/busybox/tree/examples/inittab
- Linux Serial Console: https://www.kernel.org/doc/html/latest/admin-guide/serial-console.html

## Related Issues

- #575: HyperKit BusyBox vi console output missing
- #560: Slim vi micro-guest for Lima
- #571: Trim microVM rootfs for sub-10s boot
