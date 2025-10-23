# Vibecode Packer Templates

This directory adapts the multi-distro automation patterns from the ZFS Datadog
integration to build reproducible images for Vibecode WebGUI. The initial target is
an Ubuntu-based VM with preinstalled Node.js, Docker, and the Vibecode CLI helpers.

## Files

- `vibecode-ubuntu.pkr.hcl` – QEMU builder that provisions Ubuntu 24.04, installs
  Node.js 20 LTS, Docker, and copies `scripts/vibecode-cli` into `/opt/vibecode/cli`.
- `http/user-data`, `http/meta-data` – Cloud-init seed files referenced by Packer.

## Usage

```bash
packer fmt infrastructure/packer
packer init infrastructure/packer/vibecode-ubuntu.pkr.hcl
packer build infrastructure/packer/vibecode-ubuntu.pkr.hcl
```

The build emits a qcow2 image under `output-vibecode-ubuntu-dev/` plus a manifest
named `manifest-vibecode.json`. Import the qcow2 into Lima/libvirt or convert it for
your preferred hypervisor.

## Extending

- Add additional provisioners to preload the Vibecode repository, run smoke tests,
  or install Playwright browsers.
- Introduce extra builders (ARM64, cloud images) by following the same structure and
  adapting variables. See the upstream ZFS packer templates for inspiration.
