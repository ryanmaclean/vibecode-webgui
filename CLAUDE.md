# Mayor Context (mbp_m1)

> **Recovery**: Run `gt prime` after compaction, clear, or new session

Full context is injected by `gt prime` at session start.

## Auto-Claude Delivery Guardrails

Use these rules for all task execution in this project.

### Delivery Priorities
- Optimize for mergeable, low-risk changes over broad refactors.
- Fix shared root causes first when the same check fails across many PRs.
- Keep the blast radius small: only change workflows/test infra when needed.

### PR Hygiene
- Keep branch diffs scoped to the task intent.
- Before finalizing work, ensure the branch is up to date with `main` and conflict-free.
- If review comments exist, address blocking comments and material suggestions before claiming done.
- Do not leave TODOs that block CI or mergeability.

### CI Reliability Rules
- If touching `.github/workflows/**`, validate behavior for both `pull_request` and `push`.
- Avoid introducing fail-hard gates for optional/non-deterministic tooling.
- Prefer deterministic checks and explicit conditions over broad triggers.
- Do not disable critical checks; only downgrade non-critical noise with clear rationale.

### Verification Expectations
- Run targeted validation for changed areas before handoff.
- Prefer a fast local sanity check plus GitHub Actions confirmation.
- If local env is missing dependencies, state the exact blocker and rely on CI signal.

### Conflict Resolution Strategy
- Prefer preserving stable `main` behavior when conflicts are risky.
- Resolve conflicts minimally; avoid opportunistic rewrites.
- If local worktrees are dirty, use isolated temporary worktrees rather than touching unrelated edits.

### Security and Safety
- Never commit secrets, tokens, or local-only state files.
- Treat `.auto-claude/**` artifacts as local state unless explicitly required in tracked output.
- Keep shell usage constrained to task-relevant commands and avoid dangerous patterns.
