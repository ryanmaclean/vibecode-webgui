# Feature Audit: IntelliSense — Intelligent code completion

Issue: #1471
Source release: VibeCode Desktop v1.5.0 - Apple Virtualization Framework & Performance (v1.5.0)

## Status
Confirmed via Monaco agent integration.

## Evidence
- `src/components/editor/AgentMonacoEditor.tsx` initializes the Monaco agent integration and binds Ctrl/Cmd+Space to `editor.action.triggerSuggest`.
- `src/lib/editor/monaco-agentapi.ts` registers a Monaco completion provider via `registerCompletionItemProvider` with trigger characters.

## Notes
- IntelliSense is provided by Monaco’s completion provider wiring and the agent API stream.

## Follow-ups
- None.
