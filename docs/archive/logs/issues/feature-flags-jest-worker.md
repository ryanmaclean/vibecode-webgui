# Feature Flags Unit Suite Failure

## Context
- Failing workflow: `Main Branch CI (Lightweight)` run [#18146262057](https://github.com/ryanmaclean/vibecode-webgui/actions/runs/18146262057)
- Symptom: `Jest worker encountered 4 child process exceptions, exceeding retry limit` while running `tests/unit/feature-flags.test.ts`
- Local reproduction before fix: `npm run test -- tests/unit/feature-flags.test.ts` → `ReferenceError: setImmediate is not defined`

## Resolution Applied
- Added `tests/jest.polyfills.js` to `setupFiles` in `jest.config.mjs` so `setImmediate` is polyfilled before Jest loads tests.
- Post-update, `npm run test -- tests/unit/feature-flags.test.ts` passes locally.

## Follow-up
- Share this fix with the feature-flags owners to confirm CI stability once the next run completes.
- If additional suites still fail, capture logs and extend the polyfill (e.g., mock `global.navigator` APIs) as needed.

## Verification Steps
```bash
npm install
npm run test -- tests/unit/feature-flags.test.ts
```
