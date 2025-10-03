# Legacy Manual HTML Harnesses

These HTML files are kept for quick manual validation of authentication flows. They are not wired into automated tests yet.

## Files

- `test-gui-auth.html` – exercises GUI login flows against the local dev server.
- `test-web-auth.html` – minimal client for verifying web auth redirect behaviour.
- `manual-gui-test-legacy.html` – archived pre-consolidation harness kept for backward compatibility.

## Usage

Preferred approach: run the Playwright-based replacement (see below). The HTML files remain for quick visual checks if you want to validate layouts manually.

### Automated (recommended)

```bash
# Start the dev server in another terminal
npm run dev

# Run the legacy auth smoke tests via npm script
npm run tests:monitoring:legacy
```

You can override the credential list by exporting `LEGACY_AUTH_CREDENTIALS` with a JSON array, and you can change the base URL with `LEGACY_AUTH_BASE_URL`.

### Manual fallback

```bash
npm run dev
open tests/manual/legacy/test-gui-auth.html
```

## Next Steps

These checks should transition to fully automated Playwright coverage. Track progress in TODO.md under the repository consolidation follow-up section.
