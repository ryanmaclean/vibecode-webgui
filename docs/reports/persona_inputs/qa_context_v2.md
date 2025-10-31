# Test Artifacts
- tests/scripts/test-code-server-editors.bats: covers happy path, MOCK_TOOL_MISSING, kubectl exec failure, timeout, wait fail, pod rotation.
- scripts/test-code-server-editors.sh: emits `tool= status=` telemetry, sanitizes secrets, errors when kubectl missing.

# Open Items (issue #417)
- Need coverage for telemetry output assertions.
- Need scenario for kubectl absent from PATH.
- Need test for empty Ready pod list / retries exhausting.
- Ensure CI gating (npm run test:scripts) planned once gaps closed.
