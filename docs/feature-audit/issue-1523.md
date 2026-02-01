# Feature Audit: 📁 Automatic workspace loading

Issue: #1523
Source release: VibeCode v1.1.0 - vfkit VM Integration (v1.1.0)

## Summary
OpenVSCode sessions default to a workspace path when `projectPath` is not provided, providing automatic workspace loading for new sessions.

## Expected behavior
- IDE sessions default to a workspace path (e.g., `/workspace`) when not specified.
- Session metadata includes the resolved workspace path.

## Current state
- `src/lib/ide/openvscode.ts` sets `projectPath` to `/workspace` when not supplied.

## Missing info
- Whether the desktop UI surfaces the workspace path for user edits.

## Plan
- Keep default workspace path documented.
- Add a test to confirm default workspace path assignment.

## Evidence
- `src/lib/ide/openvscode.ts`

## Tests
- `tests/feature-audit/issue-1523.test.ts`
