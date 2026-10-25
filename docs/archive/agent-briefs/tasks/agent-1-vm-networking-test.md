# Agent 1: VM Networking Test

## Goal
Test Linux VM creation with fixed networking to prove MAC address fix works.

## Tasks
1. Create minimal Linux VM (Alpine) with kernel + initramfs
2. Boot VM and verify eth0 interface appears
3. Verify DHCP assigns IP address
4. Test connectivity (ping gateway, DNS resolution)
5. Document results

## Success Criteria
- eth0 interface exists with carrier=1
- IP address assigned via DHCP
- Can ping 192.168.64.1 (gateway)
- DNS resolution works

## Files
- `scripts/vz/test-linux-vm-networking.sh` (test script)
- `platforms/macos/vz-swift/Sources/VibeCodeVM/NetworkConfig.swift` (fixed config)

## Notes
- Networking fix: Removed explicit MAC address, using auto-generated
- This proves the fix before testing macOS VM
