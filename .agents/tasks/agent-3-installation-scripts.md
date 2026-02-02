# Agent 3: Installation Scripts Enhancement

## Goal
Enhance installation scripts with error handling, validation, and rollback.

## Tasks
1. Add error handling to install-openclaw-in-vm.sh
2. Add validation checks (verify services running)
3. Add rollback capability (undo on failure)
4. Add logging and progress reporting
5. Create health check script

## Success Criteria
- Scripts handle errors gracefully
- Validation confirms services are running
- Rollback works on failure
- Clear logging for debugging

## Files
- `scripts/vz/install-openclaw-in-vm.sh` (main install script)
- `scripts/vz/setup-dns-letsencrypt.sh` (DNS/SSL script)

## Notes
- Scripts run inside VM after first boot
- Need to verify each step before proceeding
- Should support idempotent re-runs
