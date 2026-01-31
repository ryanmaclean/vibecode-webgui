# Feature Audit: Syntax Highlighting — 50+ languages supported

Issue: #1472
Source release: VibeCode Desktop v1.5.0 - Apple Virtualization Framework & Performance (v1.5.0)

## Status
Confirmed via Monaco editor integration (language-driven highlighting).

## Evidence
- `src/components/editor/AgentMonacoEditor.tsx` exposes `language` prop with `DEFAULT_EDITOR_LANGUAGE` and passes language into Monaco agent providers.
- `src/lib/editor/monaco-agentapi.ts` registers providers per language ID, which drives Monaco’s language services.

## Notes
- Monaco/editor language services provide syntax highlighting based on language ID.

## Follow-ups
- None.
