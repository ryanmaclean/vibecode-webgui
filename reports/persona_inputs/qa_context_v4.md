# Existing Coverage (tests/scripts/test-code-server-editors.bats)
- Happy path: ensures "All tools verified." output and masks pod names.
- `MOCK_TOOL_MISSING`: fails when editor binary absent.
- `MOCK_KUBECTL_EXEC_FAIL`/`_MSG`: redaction path for kubectl exec errors.
- `MOCK_TIMEOUT_EXIT` & `MOCK_KUBECTL_WAIT_FAIL`: timeout and wait failure handling.
- `MOCK_KUBECTL_GET_SEQUENCE` + `MOCK_KUBECTL_EXEC_FAIL_ONCE`: retry success across pods.

# Script Behavior (scripts/test-code-server-editors.sh)
- Emits telemetry lines `tool=<name> status=<value> duration_ms=<ms> message="..."`.
- Sanitizes password/token/key substrings.
- Aborts with "kubectl is required" if PATH lacks kubectl.

# Outstanding Work (#417)
- Assert telemetry line structure + sanitization.
- Simulate PATH without kubectl (no MOCK flag) to hit real error path.
- Cover empty Ready pod list / retry exhaustion failure.
- Once above pass, wire `npm run test:scripts` into CI gating.
