# Feature Audit: Enhanced ESLint configuration (Issue #1321)

Source release: VibeCode Desktop v1.2.0 - Apple Virtualization Framework (1.2.0-2)
Status: Partial (config exists; 0 warnings not verified)

## Evidence in mainline
- `.eslintrc.production.cjs` defines a production-focused ruleset and ignores list.
- `package.json` includes `lint` and `check` scripts for linting/type checks.

## Gaps / Missing info
- No automated check that production lint runs with zero warnings.
- No documented workflow for `eslint` using the production config.

## TODO / Plan
- Add a `lint:production` script that uses `.eslintrc.production.cjs` and document expected zero warnings.
- Add a CI step or a unit smoke test that enforces zero warnings in production config.

## Tests
- Not added in this PR. Suggested: add a lint CI step using the production config.
