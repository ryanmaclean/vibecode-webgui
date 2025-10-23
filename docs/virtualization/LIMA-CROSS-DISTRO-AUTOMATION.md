# Lima Cross-Distro Automation for Vibecode

This guide ports the Lima and VM orchestration patterns introduced in the ZFS
Datadog integration into the Vibecode WebGUI toolchain. It documents how to spin up
reproducible dev/test VMs, reuse the new helper scripts, and extend the workflow to
BSD-based images when running on Azure or similar cloud hosts.

## Assets Introduced

- `infrastructure/lima/vibecode-dev.yaml` – Ubuntu 24.04 VM definition with Node.js,
  Docker, and Playwright dependencies preinstalled.
- `scripts/automate-lima-vibecode.sh` – One-touch bootstrap that starts the VM,
  syncs the repository, installs dependencies, and runs smoke checks inside the
  guest.
- `infrastructure/packer/` – Packer templates that emit qcow2 images mirroring the
  Lima environment so the same configuration can be used on libvirt, Azure, or other
  hypervisors.

## Usage

```bash
# Start the Lima VM and run validation
scripts/automate-lima-vibecode.sh

# Manually shell into the VM afterwards
limactl shell vibecode-dev
```

The automation mounts the repository read/write and syncs the latest changes using
`rsync`, so subsequent runs are incremental. Playwright smoke listing verifies that
browser projects resolve without running a lengthy UI suite.

## Extending Beyond Linux

The same provisioning approach works for FreeBSD images hosted in Azure when paired
with ZFS-aware cloud-init templates. See iDatum's walkthrough on combining FreeBSD,
ZFS, and IPv6 on Azure for networking nuances such as SLAAC configuration and
`rc.conf` settings required to keep ZFS pools accessible after reboots.citeturn0search0

## Next Steps

1. Add distro-specific Lima configs (e.g., Debian, Rocky) mirroring the ZFS set for
   wider coverage.
2. Extend the Packer template with Playwright browser pre-installs to produce
   drop-in CI VMs.
3. Wire the new mock telemetry server into Playwright suites so the VM tests can
   validate Datadog payload shapes without hitting the real API.
