# Agent 2: macOS VM Workflow

## Goal
Create complete macOS VM creation workflow and document requirements.

## Tasks
1. Document .ipsw download and preparation process
2. Create VM creation script with .ipsw handling
3. Add first-boot automation (cloud-init or script injection)
4. Create VM snapshot/restore workflow
5. Document hardware model persistence

## Success Criteria
- Clear documentation for .ipsw requirements
- Automated VM creation script
- First-boot setup automation
- VM can be recreated from snapshot

## Files
- `scripts/vz/create-openclaw-vm.sh` (creation script)
- `platforms/macos/vz-swift/Sources/VibeCodeVM/OpenClawVM.swift` (VM config)

## Notes
- Requires macOS restore image (.ipsw) from Apple Developer
- Hardware model must persist between boots
- First boot needs automation for OpenClaw installation
