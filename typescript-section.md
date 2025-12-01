### 🧩 2025-10-24 TypeScript Follow-ups (Codex)
- [ ] **Collaborative editing stack** — finish wiring real `awareness` object from the Yjs provider; current implementation assumes `WebsocketProvider.awareness` exposes `on/off/getStates` like prod `y-websocket`. Verify in runtime env and replace temporary casts.
- [ ] **`CursorTracking` & presence typing** — replace the interim `as Map<number, Record<string, any>>` assertions with strongly typed adapters once the upstream awareness contract is confirmed.
- [ ] **Template marketplace props** — align `TemplateMarketplace`/`TemplateSubmissionForm` public props with the new handlers (`onTemplateSelect`, `onSubmit`). Update any consumers outside `MarketplacePage` and add tests.
- [ ] **Generated template metadata** — source `category` from real template records; current addition pulls from `template.category` via loose cast.
- [ ] **Virtualized message list deps** — install `@types/react-window` and `@types/react-virtualized-auto-sizer` (or swap to built-in virtualization) so `MessageListVirtual.tsx` can be typed without inline `any` fallbacks.
- [ ] **Monaco lightbulb & agent config** — audit `AgentMonacoEditor` options; `lightbulb.enabled` expects `'off' | 'on' | 'onCode'` and agent `model` must map to `ModelType`. Confirm runtime defaults and add a config validation helper.
- [ ] **Zustand middleware generics** — create shared helpers for `sseMiddleware`/`optimisticMiddleware`; blocker for removing remaining `unknown` casts and satisfying `Mutate` constraints.

#### **Expected Cost Reduction**: 70-80% (from $100 to ~$20-30/month)

