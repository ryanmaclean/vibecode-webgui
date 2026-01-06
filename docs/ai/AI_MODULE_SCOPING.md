# AI Module Scaffolding Checklist

**Last updated:** November 3, 2025  
**Owner:** AI Experience Guild  
**Status:** Initial scaffold captured

## File Map
- `src-tauri/src/ai/` — Rust orchestration (chat, completion, MCP, context). Needs wiring to surface actionable commands.
- `src/components/ai/` — React presenters (AIChatPanel, Model selector, etc.). Requires new container for desktop bundle integration.
- `src/app/(app)/ai/` — Next.js routes for AI surfaces (to verify once Next build stabilises).

## Week 1 Actions
1. Confirm command set exported by `src-tauri/src/ai/commands.rs` aligns with desktop use cases (chat, streaming, agent lifecycle).
2. Create `src/components/ai/AIDesktopPanel.tsx` that wraps `AIChatPanel` with desktop-specific chrome and feature flags.
3. Add storybook entry to validate layout without Tauri runtime.
4. Document IPC contract between Tauri and React in `docs/ai/IPC_CONTRACT.md` (pending).

## Dependencies
- Rust async runtime availability inside desktop bundle.
- Stable OpenRouter API credentials for local testing.
- Logger revamp (build fix) to ensure streaming logs surface without circular imports.

## Risks
- Large number of unused functions in `src-tauri/src/ai` indicates incomplete wiring — track in follow-up ticket.
- Streaming API may require incremental decode logic in React (inspect `EnhancedAIChatInterface`).
