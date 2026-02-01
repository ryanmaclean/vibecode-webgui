# Feature Audit: Multi-Language Support (Issue #1438)

Source release: VibeCode Desktop v1.5.0 - Apple Virtualization Framework & Performance (v1.5.0)
Status: Partial (Monaco supports languages; coverage not documented)

## Evidence in mainline
- Monaco editor is bundled and used in editor components.
- Editor `language` prop allows switching language modes.

## Gaps / Missing info
- No documented list of supported languages (Python, Rust, Go, Java, etc.).
- No tests verifying non-TS language modes.

## TODO / Plan
- Document supported language IDs and examples for common languages.
- Add a test/demo that cycles through several language modes.

## Tests
- Not added in this PR. Suggested: Playwright smoke test with language switching.
