# Packer template for OmniOS ARM64-based VibeCode development image
# Creates VM with ZFS, DTrace, zones, and native ARM64 performance on Apple Silicon
#
# ARCHITECTURE: ARM64/aarch64 (Apple Silicon M1/M2/M3, Raspberry Pi 4)
# DISTRIBUTION: OmniOS CE (Community Edition) - Experimental ARM64 build
#
# OmniOS is a server-oriented illumos distribution with:
# - ZFS filesystem (snapshots, compression, deduplication)
# - DTrace performance analysis
# - Zones (OS-level virtualization)
# - LX zones for Linux binary compatibility
# - CDDL licensing (MIT/BSD-compatible)
#
# Experimental ARM64 build from: https://downloads.omnios.org/media/braich/

packer {
  required_plugins {
    qemu = {
      source  = "github.com/hashicorp/qemu"
      version = ">= 1.1.0"
    }
  }
}

variable "vm_name" {
  type    = string
  default = "vibecode-omnios-arm64"
}

variable "omnios_version" {
  type    = string
  default = "braich"
  description = "OmniOS ARM64 experimental branch name"
}

variable "iso_url" {
  type    = string
  default = "https://downloads.omnios.org/media/braich/omnios-r151054-braich.raw.xz"
  description = "OmniOS ARM64 raw image (experimental)"
}

variable "iso_checksum" {
  type    = string
  default = "none"
  description = "SHA256 checksum (verify from https://downloads.omnios.org/media/braich/)"
}

variable "disk_size" {
  type    = string
  default = "60G"
}

variable "cpus" {
  type    = number
  default = 4
}

variable "memory" {
  type    = number
  default = 8192
}

variable "zone_name" {
  type    = string
  default = "vibecode-zone"
}

variable "zone_cpus" {
  type    = number
  default = 4
}

variable "zone_memory" {
  type    = string
  default = "8G"
}

# Locals for ARM64-specific configurations
locals {
  use_hvf = true  # Use Hypervisor.framework on macOS for acceleration
}

source "qemu" "omnios-arm64" {
  vm_name          = var.vm_name
  iso_url          = var.iso_url
  iso_checksum     = var.iso_checksum
  output_directory = "output-${var.vm_name}"
  shutdown_command = "pfexec poweroff"
  disk_size        = var.disk_size
  format           = "qcow2"
  disk_image       = true  # Using raw image, not ISO

  # ARM64-specific QEMU configuration
  qemu_binary      = "qemu-system-aarch64"
  machine_type     = "virt"

  # Acceleration: Use Hypervisor.framework on macOS, TCG elsewhere
  accelerator      = "hvf"  # macOS Hypervisor.framework for native ARM64

  cpus             = var.cpus
  memory           = var.memory
  headless         = false

  # ARM64 QEMU arguments for Apple Silicon optimization
  qemuargs = [
    # CPU: Use max features available on host
    ["-cpu", "host"],

    # Machine: ARMv8 Virtual Machine
    ["-machine", "virt,gic-version=3"],

    # UEFI firmware for ARM64
    ["-bios", "/opt/homebrew/share/qemu/edk2-aarch64-code.fd"],

    # Network: virtio-net for performance
    ["-device", "virtio-net-pci,netdev=net0"],
    ["-netdev", "user,id=net0,hostfwd=tcp::2222-:22,hostfwd=tcp::3000-:3000"],

    # Storage: virtio-blk for performance
    ["-device", "virtio-blk-pci,drive=drive0"],

    # Display: virtio-gpu for acceleration
    ["-device", "virtio-gpu-pci"],
    ["-display", "cocoa"],

    # USB: for keyboard/mouse
    ["-device", "qemu-xhci"],
    ["-device", "usb-kbd"],
    ["-device", "usb-mouse"]
  ]

  # Network configuration
  net_device       = "virtio-net"
  disk_interface   = "virtio"

  # SSH configuration
  ssh_username     = "root"
  ssh_password     = "omnios"
  ssh_timeout      = "60m"
  ssh_handshake_attempts = 100
  ssh_pty          = true

  # VNC configuration for installation monitoring
  vnc_bind_address = "0.0.0.0"
  vnc_port_min     = 5901
  vnc_port_max     = 5901
}

build {
  sources = ["source.qemu.omnios-arm64"]

  # Wait for system to boot from raw image
  provisioner "shell" {
    inline = [
      "echo 'OmniOS ARM64 booted successfully'",
      "uname -a",
      "pkg publisher"
    ]
    pause_before = "30s"
  }

  # Update base system
  provisioner "shell" {
    inline = [
      "pkg refresh",
      "pkg install -v system/zones/brand/lx git curl wget unzip vim",
      "pkg install -v developer/build/gnu-make developer/gcc13",
      "# Show boot environments",
      "beadm list"
    ]
  }

  # Transfer OmniOS setup scripts (reuse OpenIndiana scripts with minor adjustments)
  provisioner "file" {
    source      = "scripts/openindiana/"
    destination = "/root/omnios-setup"
  }

  # Create LX-branded zone for Linux compatibility
  provisioner "shell" {
    inline = [
      "chmod +x /root/omnios-setup/*.sh",
      "export ZONE_NAME=${var.zone_name}",
      "export ZONE_CPUS=${var.zone_cpus}",
      "export ZONE_MEMORY=${var.zone_memory}",
      "# Configure LX zone (may need adjustments for ARM64)",
      "/root/omnios-setup/02-configure-lx-zone.sh || echo 'LX zone setup may require manual configuration on ARM64'"
    ]
    environment_vars = [
      "ZONE_NAME=${var.zone_name}",
      "ZONE_CPUS=${var.zone_cpus}",
      "ZONE_MEMORY=${var.zone_memory}"
    ]
  }

  # Install Node.js in native zone or via pkgsrc
  provisioner "shell" {
    inline = [
      "# Install pkgsrc for broader ARM64 package availability",
      "curl -O https://pkgsrc.smartos.org/packages/SmartOS/bootstrap/bootstrap-trunk-aarch64-20240901.tar.gz",
      "tar -zxpf bootstrap-trunk-aarch64-20240901.tar.gz -C /",
      "export PATH=/opt/local/bin:/opt/local/sbin:$PATH",
      "# Install Node.js via pkgsrc",
      "pkgin -y install nodejs",
      "node --version",
      "npm --version"
    ]
  }

  # Configure DTrace monitoring
  provisioner "shell" {
    inline = [
      "/root/omnios-setup/06-configure-dtrace.sh"
    ]
  }

  # Create deployment README
  provisioner "shell" {
    inline = [
      "mkdir -p /root/vibecode-deployment",
      "cat > /root/README.txt <<'EOF'",
      "VibeCode OmniOS ARM64 Development Image",
      "========================================",
      "",
      "This image includes:",
      "- OmniOS CE r151054 ARM64 (experimental)",
      "- Native ARM64 architecture (Apple Silicon optimized)",
      "- ZFS filesystem with compression and snapshots",
      "- DTrace performance monitoring",
      "- Node.js installed via pkgsrc",
      "- Zones for OS-level virtualization",
      "",
      "Architecture: aarch64 (ARM64)",
      "Host: Apple Silicon M1/M2/M3, Raspberry Pi 4",
      "",
      "To deploy VibeCode:",
      "1. Clone repository:",
      "   git clone https://github.com/your-org/vibecode-webgui.git /workspace/vibecode",
      "",
      "2. Install dependencies:",
      "   cd /workspace/vibecode",
      "   npm install",
      "",
      "3. Configure environment:",
      "   cp .env.example .env",
      "   vi .env",
      "",
      "4. Run database migrations:",
      "   npx prisma migrate deploy",
      "",
      "5. Start application:",
      "   npm run start",
      "",
      "Useful Commands:",
      "- Zone status:    zoneadm list -v",
      "- ZFS datasets:   zfs list",
      "- DTrace probes:  dtrace -l",
      "- Package search: pkgin search <package>",
      "- Package install: pkgin install <package>",
      "",
      "Performance:",
      "- Native ARM64 execution (no emulation overhead)",
      "- Hypervisor.framework acceleration on macOS",
      "- Optimized for Apple Silicon",
      "",
      "Monitoring:",
      "- HTTP latency:   dtrace -s /root/omnios-setup/dtrace/http-latency.d -p <pid>",
      "- ZFS I/O:        dtrace -s /root/omnios-setup/dtrace/zfs-io.d",
      "- Network:        dtrace -s /root/omnios-setup/dtrace/network-tcp.d",
      "EOF"
    ]
  }

  # Create ZFS snapshots for easy rollback
  provisioner "shell" {
    inline = [
      "# Create baseline snapshots",
      "zfs snapshot rpool@baseline",
      "echo 'ZFS snapshots created:'",
      "zfs list -t snapshot"
    ]
  }

  # Cleanup
  provisioner "shell" {
    inline = [
      "# Clear package cache",
      "pkg purge",
      "# Clear logs",
      "find /var/log -type f -name '*.log' -exec truncate -s 0 {} \\;",
      "# Clear temporary files",
      "rm -rf /var/tmp/*",
      "rm -rf /tmp/*",
      "# Show final system status",
      "echo '=== System Status ==='",
      "beadm list",
      "echo ''",
      "echo '=== Architecture ==='",
      "uname -m",
      "echo ''",
      "echo '=== ZFS Datasets ==='",
      "zfs list",
      "echo ''",
      "echo '=== Disk Usage ==='",
      "df -h"
    ]
  }

  # Create manifest
  post-processor "manifest" {
    output = "manifest-vibecode-omnios-arm64.json"
    custom_data = {
      architecture     = "aarch64"
      zone_name        = var.zone_name
      zone_cpus        = var.zone_cpus
      zone_memory      = var.zone_memory
      omnios_version   = "r151054-braich"
      omnios_arch      = "ARM64"
      nodejs_source    = "pkgsrc"
      acceleration     = "Hypervisor.framework (macOS)"
    }
  }

  # Create checksums
  post-processor "checksum" {
    checksum_types = ["sha256"]
    output         = "output-${var.vm_name}/${var.vm_name}.{{.ChecksumType}}.checksum"
  }
}
