# Agent 6: Integration Testing Framework

## Goal
Create automated testing framework for VM creation, networking, and OpenClaw connectivity.

## Tasks
1. Create test harness for VM configuration validation
2. Create networking test (Linux VM)
3. Create OpenClaw connectivity test
4. Create Tailscale integration test
5. Create end-to-end test workflow

## Success Criteria
- All tests automated and repeatable
- Tests can run in CI/CD
- Clear test results and reporting
- Tests cover happy path and error cases

## Files
- `scripts/vz/test-vm-harness.sh` (test runner)
- `tests/vm/openclaw-vm.test.ts` (TypeScript tests if needed)

## Notes
- Tests should be fast and isolated
- Can use mocks for .ipsw requirement
- Real VM tests need actual VM running
