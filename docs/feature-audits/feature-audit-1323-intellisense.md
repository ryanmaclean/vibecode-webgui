# Feature Audit: IntelliSense (Issue #1323)

Source release: VibeCode Desktop v1.2.0 - Apple Virtualization Framework (1.2.0-2)
Status: Partial (providers exist; end-to-end verification missing)

## Evidence in mainline
- `src/lib/editor/monaco-agentapi.ts` registers completion, hover, and code action providers.
- `src/components/editor/AgentMonacoEditor.tsx` wires Monaco providers on mount.
- `src/app/editor/page.tsx` demonstrates completions/hover/actions UI.

## Gaps / Missing info
- No end-to-end test confirming IntelliSense works in production routes.
- Unclear which languages are wired by default vs demo-only.

## TODO / Plan
- Add a test that mounts the editor route and verifies Monaco completion provider is registered.
- Document supported languages and how providers are configured.

## Tests
- Not added in this PR. Suggested: Jest test around provider registration or a Playwright smoke test.
