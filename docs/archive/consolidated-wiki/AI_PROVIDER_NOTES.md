---
title: Ai Provider Notes
description: Auto-generated placeholder. Update as needed.
---

# AI Provider Notes

- `src/lib/ai/provider.ts` currently wraps `EnhancedAIManager` and returns a JSON payload (metadata + workflow results) via `ReadableStream<Uint8Array>`.
- None of the existing API routes call `getAIProvider`; the main chat streaming route (`src/app/api/ai/chat/stream/route.ts`) streams directly from OpenRouter.
- If we decide to drive streaming responses through `EnhancedAIManager`, we need to reintroduce incremental chunk forwarding; right now the utility only emits the final result.
- Follow-up: design a streaming adapter that maps `WorkflowResult` chunks into SSE or fetch-readable chunks so downstream callers can support incremental UI updates.

_Last reviewed: 2025-09-16_
