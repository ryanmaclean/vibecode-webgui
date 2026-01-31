# Feature Audit: Multi-File Editing (Issue #1325)

Source release: VibeCode Desktop v1.2.0 - Apple Virtualization Framework (1.2.0-2)
Status: Unverified (UI tabs exist; editor multi-file workflow unclear)

## Evidence in mainline
- Tab UI components used in `src/app/workspace/[id]/page.tsx` and `src/app/editor/page.tsx`.
- Monaco editor components exist, but no explicit multi-model/tabs wiring found.

## Gaps / Missing info
- No implementation found for opening multiple files in Monaco (multi-model) with tabs/splits.
- No split-view editor layout wiring identified.

## TODO / Plan
- Confirm product requirement: multi-file editing within Monaco vs workspace-level tabs.
- If required, add a multi-file model manager and tab UI for file switching.

## Tests
- Not added in this PR. Suggested: integration test that opens two files and switches tabs.
