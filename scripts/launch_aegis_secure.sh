#!/usr/bin/env bash
set -euo pipefail
IMAGE="$(pwd)/vm-assets/debian-12-genericcloud-amd64.qcow2"
SEED="$(pwd)/vm-assets/aegis-seed.iso"
DISK="$(pwd)/vm-assets/aegis-root.qcow2"
if [[ ! -f "$DISK" ]]; then
  qemu-img create -f qcow2 -b "$IMAGE" -F qcow2 "$DISK" 20G
fi
/usr/local/bin/qemu-system-x86_64 \
  -accel hvf \
  -m 4096 \
  -cpu host \
  -drive file="$DISK",format=qcow2,if=virtio \
  -drive file="$SEED",format=raw,if=virtio \
  -device virtio-keyboard-pci \
  -device virtio-mouse-pci \
  -display cocoa,show-cursor=on,fullscreen=off \
  -serial none \
  -parallel none \
  -nodefaults \
  -device virtio-serial-pci \
  -chardev socket,id=spicevmc,path=/tmp/aegis-spice.sock,server,nowait \
  -device virtserialport,chardev=spicevmc,name=com.redhat.spice.0 \
  -net none
