# Feature Audit: Monaco Editor core (Issue #1322)

Source release: VibeCode Desktop v1.2.0 - Apple Virtualization Framework (1.2.0-2)
Status: Partial (Monaco present; primary editor integration scope unclear)

## Evidence in mainline
- `package.json` includes `monaco-editor` and `@monaco-editor/react` dependencies.
- `src/components/editor/AgentMonacoEditor.tsx` wraps Monaco with Agent API integration.
- `src/components/editors/monaco.tsx` and `src/components/editors/MonacoLazy.tsx` provide a generic Monaco editor.
- `src/app/editor/page.tsx` demonstrates Monaco integration.

## Gaps / Missing info
- Unclear if Monaco is the primary editor in the production UI or a demo-only route.
- No explicit doc stating Monaco is the editor core used across the product.

## TODO / Plan
- Document which UI surfaces use Monaco and whether any editor uses a different core.
- If Monaco should be the primary editor, add a product-level reference in docs.

## Tests
- Not added in this PR. Suggested: add a smoke test that mounts the Monaco-based editor route.
