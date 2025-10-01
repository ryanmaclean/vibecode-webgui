# Current Coverage (tests/scripts/test-code-server-editors.bats)
- Happy path verifies "All tools verified." and masks pod names.
- `MOCK_TOOL_MISSING` handles missing binaries.
- `MOCK_KUBECTL_EXEC_FAIL` + `MOCK_KUBECTL_EXEC_FAIL_MSG` ensures redaction.
- `MOCK_TIMEOUT_EXIT` and `MOCK_KUBECTL_WAIT_FAIL` cover timeout/wait failure.
- `MOCK_KUBECTL_GET_SEQUENCE` + `MOCK_KUBECTL_EXEC_FAIL_ONCE` exercises retry success.

# Script Behavior (scripts/test-code-server-editors.sh)
- Emits structured telemetry lines: `tool=<name> status=<value> duration_ms=<ms> message="..."`.
- Sanitizes password/token/key strings.
- Errors if kubectl missing from PATH (`kubectl is required but not found`).

# Open Gaps from issue #417
- Assert telemetry output format and sanitization.
- Simulate PATH missing kubectl without relying on MOCK flags.
- Cover empty Ready pod list / exhausting retries.
- Plan to wire `npm run test:scripts` into CI once gaps close.
