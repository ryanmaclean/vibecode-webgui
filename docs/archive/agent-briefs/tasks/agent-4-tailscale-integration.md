# Agent 4: Tailscale Integration

## Goal
Automate Tailscale setup in VM with automatic IP detection and host connectivity.

## Tasks
1. Create Tailscale setup script with auth key handling
2. Automate IP detection and OpenClaw gateway configuration
3. Create host-side connection test script
4. Set up port forwarding if needed
5. Test connectivity from host to VM gateway

## Success Criteria
- Tailscale automatically configured in VM
- OpenClaw gateway accessible via Tailscale IP
- Host can connect to VM gateway
- Port forwarding works if needed

## Files
- `scripts/vz/setup-tailscale-vm.sh` (new script needed)
- `scripts/vz/test-tailscale-connectivity.sh` (test script)

## Notes
- Need Tailscale auth key (can be ephemeral for testing)
- Gateway should bind to Tailscale IP, not just localhost
- Test from host: `curl http://<tailscale-ip>:18789/health`
