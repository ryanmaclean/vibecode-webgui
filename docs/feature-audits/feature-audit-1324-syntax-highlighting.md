# Feature Audit: Syntax Highlighting (Issue #1324)

Source release: VibeCode Desktop v1.2.0 - Apple Virtualization Framework (1.2.0-2)
Status: Partial (Monaco supports highlighting; language coverage not documented)

## Evidence in mainline
- Monaco editor is bundled (`monaco-editor` + `@monaco-editor/react`).
- `src/components/editor/AgentMonacoEditor.tsx` exposes a `language` prop (default `typescript`).
- Monaco-based editor components exist in `src/components/editors/`.

## Gaps / Missing info
- No documented list of supported languages (claim is 50+ languages).
- No tests validating syntax highlighting across language modes.

## TODO / Plan
- Document supported Monaco language IDs and where they’re enabled.
- Add a small test or demo checklist verifying multiple language modes render correctly.

## Tests
- Not added in this PR. Suggested: a lightweight Playwright smoke test that switches `language` prop.
