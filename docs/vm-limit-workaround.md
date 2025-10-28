---
title: macOS VM Limit Workaround
description: Practical way to run 3 environments on Apple Virtualization.framework by mixing QEMU and vfkit
---

# macOS VM Limit Workaround (1 QEMU + 2 macOS)

Apple's Virtualization.framework enforces a hard limit on concurrent macOS VMs. There is no public plist/profile to raise it. To run three environments concurrently:

- 1 Linux console microVM (QEMU)
- 2 macOS VMs (Virtualization.framework via vfkit)

## Why this works
- QEMU uses its own virtualization stack, not counted against the Virtualization.framework cap.
- Keeping the "console" on Linux minimizes macOS VM usage while preserving two macOS environments for GUI/dev.

## Common errors & fixes
- VZErrorDomain Code=10004 "Unable to connect to installation service" → Ensure official UniversalMac IPSW when installing, or use an existing Disk.img (skip install).
- "failed to lock aux storage on the vm" → Use per-VM `aux.img` copy and unique PID per VM.

## Launch pattern (vfkit, per-VM aux + PID)

1) Prepare per-VM auxiliary storage copy:

```bash
mkdir -p vfkit-myvm
cp vfkit-boot/aux-copy.img vfkit-myvm/aux.img
```

2) Launch vfkit with a unique PID file and your existing Disk.img/HardwareModel:

```bash
vfkit \
  -cpu host \
  -memory 8192 \
  -disk path=/path/to/Disk.img,readonly=false \
  -aux-storage path=vfkit-myvm/aux.img \
  -pid-file vm-myvm.pid
```

Note: Adapt to your environment (hardware model, network type, and display config). If a VM fails to boot due to aux lock, stop other macOS VMs first or use distinct `aux.img` copies and PID files per VM.

## Console microVM (QEMU)
Run a small Linux VM for shell, editor, and orchestration. This keeps two macOS VM slots free.

- Use a minimal Alpine/Ubuntu ARM64 image.
- Expose SSH and ports for web editors or tools.

## Verification checklist
- Two macOS VMs boot via vfkit, each with its own `aux.img` and PID file.
- One QEMU Linux microVM running a console/editor.
- Host browser can reach editor endpoints (e.g., http://vm-ip:8080).

## Notes
- Prefer snapshots/immutable bases for fast cloning.
- Keep large VM artifacts out of git; publish release images via GitHub Releases if needed.
