# BusyBox Initramfs for MiniVim

This directory contains BusyBox-based initramfs images used for MiniVim kernel benchmarks.

## Files

- `busybox-initramfs.cpio.gz` - Standard BusyBox initramfs with basic utilities
- `busybox-vi-initrd.cpio.gz` - BusyBox initramfs optimized for vi benchmarks

## Building BusyBox Initramfs

To create a minimal BusyBox initramfs:

```bash
# Download BusyBox
wget https://busybox.net/downloads/busybox-1.36.1.tar.bz2
tar xf busybox-1.36.1.tar.bz2
cd busybox-1.36.1

# Configure for static build
make defconfig
sed -i 's/# CONFIG_STATIC is not set/CONFIG_STATIC=y/' .config

# Build
make -j$(nproc)

# Create initramfs structure
mkdir -p initramfs/{bin,sbin,etc,proc,sys,dev,usr/bin,usr/sbin}
cp busybox initramfs/bin/
cd initramfs

# Create symlinks for common commands
for cmd in sh ls cat echo mount umount mkdir rmdir cp mv rm ln; do
    ln -s /bin/busybox bin/$cmd
done

# Create init script
cat > init << 'EOF'
#!/bin/sh
mount -t proc none /proc
mount -t sysfs none /sys
mount -t devtmpfs none /dev
exec /bin/sh
EOF
chmod +x init

# Create initramfs
find . | cpio -o -H newc | gzip > ../busybox-initramfs.cpio.gz
```

## Usage

The initramfs is automatically used by the MiniVim kernel build workflow when building x86_64 kernels.
