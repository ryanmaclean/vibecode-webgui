# Agent 7: Apple Containers Integration

## Goal
Explore and implement Apple Containers as lightweight alternative to macOS VM for OpenClaw.

## Tasks
1. Research Apple Container runtime capabilities
2. Create container configuration for OpenClaw
3. Test OpenClaw in Apple Container
4. Compare performance: Container vs VM
5. Create container deployment script
6. Document when to use Container vs VM

## Success Criteria
- OpenClaw runs in Apple Container
- Container is smaller/faster than VM
- Performance comparison documented
- Deployment script works
- Clear guidance on Container vs VM choice

## Files
- `platforms/macos/AppleContainerRuntime/Sources/OpenClawContainer.swift` (new)
- `scripts/containers/create-openclaw-container.sh` (new)
- `docs/containers/OPENCLAW_CONTAINER.md` (new)

## Dependencies
- Apple Container runtime available
- OpenClaw can run in containerized environment

## Notes
- Apple Containers are lighter than full VMs
- May not support all macOS features
- Good for headless OpenClaw gateway
- VM better for full macOS features
