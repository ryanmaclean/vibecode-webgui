# Feature Parity Comparison: Go CLI vs Bash vs Python

**Last Updated:** February 1, 2026

## Summary

- **Go CLI**: 73 commands (57 native + 16 script-proxy commands)
- **Bash Scripts**: 70 scripts (including Go-proxy wrappers)
- **Python Scripts**: 70 scripts (including Go-proxy wrappers)

**Verdict: Feature parity achieved.** All operational capabilities are available across Go, bash, and Python. Some features are implemented as thin proxies to ensure uniform coverage.

---

## Parity Strategy

### Go CLI → Script Proxies
The Go CLI now includes script-backed commands for features that were previously only implemented in bash/python:

- `query-app-security`
- `query-cloud-security`
- `query-error-tracking`
- `query-data-streams`
- `query-hosts`
- `query-session-replay`
- `query-profiling`
- `query-ci-tests`
- `manage-logs-pipelines`
- `manage-custom-metrics`
- `manage-restriction-policies`
- `manage-webhooks`
- `verify-setup`
- `investigate-service`
- `example-monitored-script`
- `test-monitoring`

These commands proxy to the equivalent scripts under `python/` or `scripts/`.

### Bash/Python → Go CLI Proxies
Bash and Python now include wrappers for Go-only commands:

- `capacity-scale`
- `ml-insights`
- `predictions`
- `recommendations`
- `usage-insights`

---

## Environment Overrides

You can override proxy resolution with:

- `DD_SKILL_ROOT` → repository root for script lookup
- `DD_SKILL_GO_CLI` → absolute path to Go CLI binary
- `DD_SKILL_PYTHON` → override Python interpreter for Go proxies

---

## Notes

- Native Go commands remain the preferred high-performance path.
- Proxy commands are intentionally thin to preserve behavior and output parity with existing scripts.
- Bash/Python wrappers fail fast with clear errors if the Go binary is not present.
