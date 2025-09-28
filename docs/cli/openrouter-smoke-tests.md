# OpenRouter Smoke Tests

Use this guide to verify the OpenRouter integration locally before enabling the “real” integration suites in CI.

## Environment

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
export OPENROUTER_FREE_MODEL="openai/gpt-oss-20b:free"
export ENABLE_REAL_AI_TESTS=true
export RUN_REAL_OPENROUTER_TESTS=true
```

Optionally set additional headers (OpenRouter recommends these when you proxy traffic):

```bash
export OPENROUTER_HTTP_REFERER="https://vibecode.dev"
export OPENROUTER_APP_TITLE="VibeCode WebGUI"
```

## CLI Smoke Test

```bash
node scripts/smoke/openrouter-chat.js
```

(The script makes a single call to `https://openrouter.ai/api/v1/chat/completions` using the free model and prints the JSON response.)
If the primary free model returns an upstream error, the script automatically retries with additional free-tier models (for example, `deepseek/deepseek-chat-v3.1:free`).

## Jest Integration Suite

```bash
OPENROUTER_FREE_MODEL=${OPENROUTER_FREE_MODEL:-openai/gpt-oss-20b:free} \
ENABLE_REAL_AI_TESTS=true \
RUN_REAL_OPENROUTER_TESTS=true \
npx jest tests/integration/real-openrouter-integration.test.ts --runInBand --verbose
```

The suite exercises:

1. `/auth/key` to verify the key is recognised
2. `/models` to ensure the free-tier list is populated
3. `chat/completions` using the primary free model
4. `chat/completions` using a secondary free model (handles transient 4xx gracefully)

## Troubleshooting

- **401 User not found**: The key is invalid or expired—request a new OpenRouter key.
- **400 model not valid**: The free model has rotated. Call `/models` to fetch the latest IDs and update `OPENROUTER_FREE_MODEL` accordingly.
- **429 rate limit**: Retry after 10s. The suite already tolerates occasional 4xx responses.
