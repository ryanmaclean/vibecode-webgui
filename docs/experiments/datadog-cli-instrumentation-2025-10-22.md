---
project: vibecode-code-server-ai-cli
owner: platform-observability
date: 2025-10-22
status: completed
type: Datadog Experiment
summary: >
  Baseline Datadog tracing coverage for Claude Code, OpenAI Codex, Google Gemini, and
  Just-Every/Code CLIs executed inside the code-server environment across linux/amd64 and linux/arm64 builds.
---

## Goals

1. Verify whether each AI CLI can be installed and invoked in our code-server container images (both `linux/amd64` and `linux/arm64` targets).
2. Instrument every CLI with Datadog tracing (runtime shims or native hooks) and observe spans in the local Datadog agent.
3. Capture any AI API activity (latency, token usage, error rates) and document the path to LLM Observability ingestion.
4. Identify code or documentation gaps required to make the instrumentation repeatable.

## Setup

- Local host: macOS (M‑series) running Datadog Agent 7.67.0 with APM enabled.  
- Sequential Thinking MCP server + Roundtable MCP server used for task fan-out.  
- Code-server Dockerfile (`docker/code-server/Dockerfile`) inspected for current CLI coverage. No modifications made in this pass.  
- Commands executed directly on the host to validate CLI behaviour prior to container integration.

We explicitly **did not** re-tag the Docker image in this experiment; instead we validated binaries on the host and noted the changes needed for the image build.

## Test Matrix

| CLI | Install Source | Instrumentation Attempt | API Activity | Result |
| --- | -------------- | ----------------------- | ------------ | ------ |
| Claude Code (`claude`) | Native macOS installer (pre-existing) | `~/Library/Python/3.13/bin/ddtrace-run claude --help` | N/A (no API call) | **Fail – no spans**. Binary is Mach-O; Python shim cannot intercept. |
| OpenAI Codex (`codex`) | `pip install codex-cli` | `~/Library/Python/3.13/bin/ddtrace-run codex --help` | N/A | **Fail – no spans**. Similar to Claude; CLI embeds its own runtime. |
| Google Gemini (`gemini`) | `npm install -g @google/gemini-cli` | `NODE_OPTIONS='-r dd-trace/init' node /usr/local/bin/gemini --help` | N/A | **Pass (shim runs)** but help command emits no spans. Datadog debug log shows bootstrap succeeded; need real API call + credentials. |
| Just-Every/Code (`just-every-code`) | _Not installed_ | _Not attempted_ | N/A | **Blocked** pending image install plan. |

### Observations

- Datadog APM status (`sudo datadog-agent status`) remained unchanged after running the main CLI commands. For Claude/Codex the lack of spans is expected because the binaries do not respect the injected Python runtime.
- Gemini CLI emits Datadog bootstrap logs (`Application instrumentation bootstrapping complete`), confirming Node-based shims are viable once we execute real API calls.
- We did not execute actual AI requests (token usage, latency) because production credentials are not provisioned in this environment. Roundtable agents should use dedicated API keys in follow-up experiments.

### Metrics Collected

| Metric | Value | Notes |
| ------ | ----- | ----- |
| Datadog APM span counts | 0 for Claude/Codex/Just-Every | No spans observed. |
| Datadog APM span counts | 1 bootstrap span (Gemini) | Observed in local debug log but not yet flushed to agent (no HTTP call). |
| Token usage | N/A | No prompts executed. |
| Latency | N/A | No API calls executed. |

All metrics recorded against **project** `vibecode-code-server-ai-cli` (replacing the deprecated `ml_app` tag).

## Gaps & Required Work

1. **Uniting binaries with agent shims (Claude/Codex).** Need vendor support or wrapper scripts that proxy commands through a Python entrypoint where `ddtrace-run` can operate.
2. **Gemini CLI verification.** Execute sample API requests with staged credentials, confirm spans reach the Datadog agent, and populate LLM Observability dashboards (`project:vibecode-code-server-ai-cli`).
3. **Just-Every/Code install.** Add `npm install -g @just-every/code` to the Dockerfile and create instrumentation wrappers similar to Gemini. Validate on both architectures.
4. **Dockerfile changes.** Extend `docker/code-server/Dockerfile` to install all four CLIs, add architecture-aware binaries, and ship Datadog wrapper scripts (`/usr/local/bin/*-ddtrace`).
5. **Documentation updates.** Revise `docker/code-server/DATADOG_INTEGRATION.md` and environment variable docs to use `DD_LLMOBS_PROJECT` instead of `DD_LLMOBS_ML_APP`.

## Conclusions

- Datadog instrumentation is currently **incomplete**. Only the Gemini CLI can be shimmed with existing tooling; other CLIs require vendor-native hooks or wrapper scripts.
- No AI API metrics were collected in this run; future experiments must execute real prompts with staging credentials to populate LLM Observability.
- The code-server Docker image does not yet include the required CLIs; installation + tracing wrappers remain to be implemented across both architectures.
- Project tagging needs to migrate from the legacy `ml_app` field to the documented **project name** convention across Docker configs, Terraform variables, and Datadog dashboards.

## Next Actions

1. File follow-up tasks for each agent (1–10) to implement the Dockerfile changes, wrappers, credential management, and Datadog dashboard updates.
2. Update all `DD_LLMOBS_*` references to the new project-based environment variables once the platform standard is published.
3. Schedule a repeat experiment once binaries are integrated in the container build and staging API keys are available, targeting both `linux/amd64` and `linux/arm64`.
