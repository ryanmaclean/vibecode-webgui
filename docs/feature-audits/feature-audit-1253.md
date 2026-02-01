# Feature Audit 1253: Multi-Provider Keys (BYOK)

Source release: VibeCode Desktop v1.2.0 - Apple Virtualization Framework (1.2.0-2)

## Summary
- Status: Present (multi-provider key capture + selection)
- Risk: Low (localStorage persistence; no secure storage for non-macOS)
- Gaps: None for baseline BYOK; secure storage is tracked elsewhere

## Evidence
- Multi-provider configuration and model registry: `src/lib/ai-providers.ts`
- Unified client that switches providers: `src/lib/unified-ai-client.ts`
- BYOK UI state includes OpenAI/Anthropic/Google keys and provider selection: `src/components/PromptInterface/hooks/useAuthState.ts`
- Keys persisted locally (demo): `src/components/PromptInterface/hooks/useAuthState.ts`

## Notes
- Keys are stored in `localStorage` for the demo flow; production should use platform keychain/secure storage where available.
- Provider name matching uses display strings (e.g., `OpenAI`, `Anthropic`, `Google`). Keep consistent with model metadata.

## Tests
- Not added: Existing behavior is UI-driven and covered by current integration flows. Add UI test if provider switching UX changes.
