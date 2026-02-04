# vfkit Menu Structure and Command Reference

Comprehensive vfkit CLI reference for Apple Virtualization Framework integration.

## Command Structure

```
vfkit
├── --cpus <n>              # Virtual CPUs
├── --memory <MiB>          # Memory allocation
├── --gui                   # Enable GUI
├── --kernel <path>         # Kernel path
├── --initrd <path>         # Initramfs path
├── --kernel-cmdline <str>  # Boot parameters
└── --device <spec>         # Device configuration
```

## Device Options

| Device | Status | Options |
|--------|--------|---------|
| virtio-blk | Working | path, readonly |
| virtio-net | Working | nat, bridged, unixSocketPath, mac |
| virtio-fs | Working | sharedDir, mountTag |
| virtio-serial | Working | logFilePath, stdio |
| virtio-rng | Working | (none) |
| virtio-balloon | Working | (none) |
| virtio-vsock | Working | port, socketURL |

## Network with gvproxy

```
Host:${PORT} -> gvproxy -> Unix Socket -> virtio-net -> Guest:3000
```

Start gvproxy:
```bash
gvproxy --mtu 1500 --ssh-port -1 \
  --listen-vfkit "unixgram:///tmp/gvproxy.sock" \
  --listen "unix:///tmp/gvproxy-api.sock"
```

Expose port:
```bash
curl --unix-socket /tmp/gvproxy-api.sock -X POST \
  -H 'Content-Type: application/json' \
  -d '{"local":"127.0.0.1:4600","remote":"192.168.127.2:3000","protocol":"tcp"}' \
  http://d/services/forwarder/expose
```

## Example: Headless microVM

```bash
vfkit --cpus 4 --memory 2048 \
  --kernel kernel/Image-arm64 \
  --initrd rootfs/initramfs.cpio.gz \
  --kernel-cmdline "console=hvc0 quiet rdinit=/init" \
  --device "virtio-net,unixSocketPath=/tmp/gvproxy.sock,mac=5a:94:ef:e4:0c:ee" \
  --device virtio-serial,logFilePath=console.log \
  --device virtio-rng --device virtio-balloon
```

## REST API (--restful-uri)

```bash
curl http://localhost:8080/vm/state
curl -X POST -d '{"new_state":"Stop"}' http://localhost:8080/vm/state
```

## Kernel Command Line

| Parameter | Description |
|-----------|-------------|
| console=hvc0 | Required for vfkit |
| quiet | Suppress messages |
| rdinit=/init | Initramfs init |

## References

- [vfkit](https://github.com/crc-org/vfkit)
- [gvisor-tap-vsock](https://github.com/containers/gvisor-tap-vsock)
- [Apple Virtualization Framework](https://developer.apple.com/documentation/virtualization)
