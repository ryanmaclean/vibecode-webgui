# Feature Audit: Git Integration (Issue #1437)

Source release: VibeCode Desktop v1.5.0 - Apple Virtualization Framework & Performance (v1.5.0)
Status: Not found (no built-in git UI located)

## Evidence in mainline
- Onboarding references GitHub/GitLab, but no explicit git operations UI in app routes.
- IDE integration uses OpenVSCode server image, which may provide git inside the VM.

## Gaps / Missing info
- No UI for git status, commit, push, or diff in the web app.
- No documentation describing built-in git workflows.

## TODO / Plan
- Confirm whether git integration is expected inside the embedded IDE (OpenVSCode) vs app UI.
- If app-level git features are required, design and implement basic git operations.

## Tests
- Not added in this PR. Suggested: e2e test for git operations in the IDE if supported.
