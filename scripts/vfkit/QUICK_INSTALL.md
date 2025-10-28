# VibeCode Fun Demo VM - Quick Install

**One-liner installation for super-fast Alpine VM with weather demo** 🌤️

---

## TL;DR - One-Liner Install

### Option 1: From GitHub (when published)

```bash
curl -fsSL https://raw.githubusercontent.com/yourrepo/main/scripts/vfkit/install.sh | bash
```

### Option 2: Local Install

```bash
# Start a local web server
cd /path/to/vibecode-webgui/scripts/vfkit
python3 -m http.server 8000

# In another terminal, run:
curl -fsSL http://localhost:8000/install.sh | bash
```

### Option 3: Direct Script

```bash
cd /path/to/vibecode-webgpu/scripts/vfkit
chmod +x install.sh
./install.sh
```

---

## What You Get

- ✅ **Ultra-minimal Alpine 3.22** - Only 3.8MB rootfs!
- ✅ **BusyBox** - Essential Unix utilities
- ✅ **~2 second boot** - Crazy fast with Apple Silicon
- ✅ **Fun weather demo** - Try `weather Moon` 🌙
- ✅ **1GB RAM** - Lightweight
- ✅ **No Docker needed** - Native Apple Virtualization.framework

---

## Installation Steps

The installer will:

1. **Check prerequisites** - Install vfkit via brew if needed
2. **Setup directories** - Create `~/.vfkit/vms/vibecode-alpine/`
3. **Download kernel** - Alpine 3.22 kernel (~33MB)
4. **Build rootfs** - Minimal Alpine with weather demo (~3.8MB)

**Total install time:** ~2-3 minutes (mostly downloads)

---

## Quick Start

After installation:

```bash
# Launch the VM
~/.vfkit/vms/vibecode-alpine/launch-fun-demo.sh
```

Inside the VM, try:

```bash
# Run demo
demo

# Get your weather
weather

# Fun examples!
weather Moon       # Moon weather 🌙
weather Mars       # Mars weather 🔴
weather Everest    # Mt. Everest
weather ISS        # International Space Station
weather Antarctica # South Pole

# Other useful commands
uname -a           # System info
free -h            # Memory usage
ps aux             # Running processes
```

---

## Examples

### Moon Weather 🌙

```bash
~ # weather Moon
🌤️  Weather Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Weather report: Moon

      \  /       Partly cloudy
    _ /"".-.     -180 °C
      \_(   ).   ↑ 0 km/h
      /(___(__)  270 km

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Mars Weather 🔴

```bash
~ # weather Mars
🌤️  Weather Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Weather report: Mars

  .--.     Light snow
.-(    ).  -68 °C
(___.__)__) ↑ 18 km/h
 ' *  * *  3 km

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Performance

| Metric | Value |
|--------|-------|
| **Rootfs size** | 3.8MB |
| **Kernel size** | 33MB |
| **Memory** | 1GB |
| **Boot time** | ~2 seconds 🚀 |
| **Disk usage** | ~37MB total |

**Comparison:**
- **vfkit Alpine** (this): 2s boot, 3.8MB rootfs
- **Lima VM**: 15s boot, ~200MB rootfs
- **Docker Desktop**: 20-30s boot, GB-sized

---

## Architecture

```
┌─────────────────────────────────────────┐
│  macOS Terminal                          │
│  └─ weather Moon                         │
├─────────────────────────────────────────┤
│  Alpine Linux 3.22 VM                    │
│  ├─ BusyBox                               │
│  ├─ wget (for wttr.in API)              │
│  └─ Custom weather script                │
├─────────────────────────────────────────┤
│  vfkit (Apple Virtualization)            │
│  ├─ Virtualization.framework             │
│  ├─ virtio-net (networking)              │
│  └─ virtio-serial (console)              │
├─────────────────────────────────────────┤
│  macOS (Ventura+)                         │
│  └─ Apple Silicon (M1/M2/M3/M4)          │
└─────────────────────────────────────────┘
```

---

## Files Created

```
~/.vfkit/vms/vibecode-alpine/
├── kernel/
│   └── vmlinux                       # Alpine 3.22 kernel (33MB)
├── rootfs/
│   └── fun-demo-rootfs.cpio.gz       # Minimal rootfs (3.8MB)
└── launch-fun-demo.sh                # Launch script
```

---

## Customization

### Add More Commands

Edit the rootfs build and add your own scripts:

```bash
# In /usr/local/bin/ of the rootfs
cat > usr/local/bin/mycommand << 'EOF'
#!/bin/sh
echo "Hello from my custom command!"
EOF
chmod +x usr/local/bin/mycommand
```

### Change Memory/CPU

Edit `launch-fun-demo.sh`:

```bash
vfkit \
  --cpus 4        # Change from 2 to 4
  --memory 2048   # Change from 1024 to 2048
  ...
```

### Change Boot Messages

Edit the init script in `14-create-fun-demo-rootfs.sh`

---

## Troubleshooting

### VM won't boot

Check kernel and rootfs exist:
```bash
ls -lh ~/.vfkit/vms/vibecode-alpine/kernel/vmlinux
ls -lh ~/.vfkit/vms/vibecode-alpine/rootfs/fun-demo-rootfs.cpio.gz
```

### Weather command doesn't work

Wait 5-10 seconds after boot for networking to initialize:
```bash
# Check network
ip addr show
ping -c 3 8.8.8.8

# Try weather again
weather
```

### vfkit not found

Install via brew:
```bash
brew install vfkit
```

---

## Why This Exists

This is an example of **extreme minimalism** for:

- ✅ **Learning** - Understand how VMs work at a basic level
- ✅ **Speed** - 2-second boot time for quick tests
- ✅ **Fun** - Because weather on the Moon is cool 🌙
- ✅ **Demos** - Show off fast VM provisioning
- ✅ **Base for more** - Build on this for real projects

---

## Next Steps

### Make It Persistent

Add a disk image for persistent storage:

```bash
# Create a disk
qemu-img create -f raw data.img 1G

# Add to vfkit launch command
--device virtio-blk,path=$PWD/data.img
```

### Add More Tools

Install additional packages by modifying the rootfs build:

```bash
# In the rootfs build, after extracting Alpine
apk add --root ./rootfs --no-cache \
    git \
    python3 \
    nodejs \
    ...
```

### Port Forwarding

Add port forwarding to access services:

```bash
# In vfkit launch command
--device virtio-net,nat,guestPortForward=tcp:3000-:3000
```

---

## Resources

- **wttr.in** - Weather API used: https://github.com/chubin/wttr.in
- **vfkit** - VM manager: https://github.com/crc-org/vfkit
- **Alpine Linux** - Minimal distro: https://alpinelinux.org/
- **BusyBox** - Tiny Unix tools: https://busybox.net/

---

## Contributing

Ideas for improvements:

- [ ] Add more fun APIs (cat facts, jokes, quotes)
- [ ] Create theme options for the banner
- [ ] Add interactive games (snake, tetris)
- [ ] Include system monitoring tools
- [ ] Create preset configurations

---

**Status:** ✅ Ready to use!

**Install time:** ~2-3 minutes

**Boot time:** ~2 seconds

**Fun factor:** 🌙 Moon weather!

---

Enjoy your ultra-fast VM! ⚡
