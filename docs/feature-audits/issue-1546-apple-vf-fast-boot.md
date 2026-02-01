# Feature Audit: Apple VF Fast-Boot Micro-VM (<10s)

**Issue:** #1546
**Priority:** High
**Labels:** feature-audit, area:vm, area:performance, high-priority

## Summary

Implement minimal BusyBox initramfs + EFI-stub arm64 kernel for Apple Virtualization Framework to achieve <10s boot times for OpenVSCode/code-server on M-series Macs.

## Acceptance Criteria

- [ ] VF boots OpenVSCode/code-server in <10s on M-series
- [ ] `scripts/benchmarks/vscode_microvm.sh` supports `MICROVM_RUNTIME=applevf` and `MICROVM_ARCH=arm64`
- [ ] `docs/virtualization/openvscode-microvm.md` updated with benchmark table
- [ ] Artifacts packaged via `scripts/release/package-fast-openvscode-vm.sh`

## Current State

### Existing Infrastructure

| Component | Status | Location |
|-----------|--------|----------|
| VFKit integration | Partial | `scripts/vfkit_py/` |
| Benchmark scripts | Exists | `scripts/benchmarks/` |
| VM management | Exists | `Sources/VibeCode/VM/` |
| Virtualization docs | Exists | `docs/virtualization/` |

### Required Components

1. **Minimal BusyBox initramfs** - Stripped-down init for fast boot
2. **EFI-stub arm64 kernel** - Direct EFI boot without bootloader
3. **Apple VF runtime support** - `MICROVM_RUNTIME=applevf` flag
4. **ARM64 architecture support** - `MICROVM_ARCH=arm64` flag
5. **Packaging script** - `package-fast-openvscode-vm.sh`

## Implementation Plan

1. Create minimal initramfs with BusyBox
2. Build EFI-stub kernel for arm64
3. Update `vscode_microvm.sh` with applevf runtime
4. Add benchmark table to microvm docs
5. Create packaging script for artifacts
6. Validate <10s boot on M1/M2/M3

## Verification Steps

```bash
# Run benchmark with Apple VF
MICROVM_RUNTIME=applevf MICROVM_ARCH=arm64 ./scripts/benchmarks/vscode_microvm.sh

# Expected output: Boot time < 10s
```

## Related Files

- `scripts/benchmarks/vscode_microvm.sh`
- `scripts/release/package-fast-openvscode-vm.sh` (to create)
- `docs/virtualization/openvscode-microvm.md`
- `Sources/VibeCode/VM/VirtualMachine.swift`

## References

- Apple Virtualization Framework docs
- VFKit project (crc-org/vfkit)
- Firecracker microVM architecture
