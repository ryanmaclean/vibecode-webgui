# Security, Safeguards, and Multi-Provider Support

This document covers the security measures, safeguards, testing, and multi-provider LLM support in the Workspace RAG extension.

## Security Safeguards

### Input Validation

All user inputs are validated before processing:

```typescript
// Query validation
- Maximum length: 10,000 characters
- XSS protection: Blocks script tags and event handlers
- Empty query detection
```

### Rate Limiting

Built-in rate limiting prevents abuse:
- 60 requests per minute per workspace
- Automatic request throttling
- Graceful degradation under load

### Path Traversal Protection

File path validation prevents directory traversal attacks:
- Blocks `..` in paths
- Validates files are within workspace
- Binary file detection and skipping

### API Key Security

All API keys are stored securely:
- VS Code Secrets API (encrypted storage)
- Keys never logged or displayed
- Automatic sanitization in error messages
- Provider-specific format validation

### Database Security

Database connection validation:
- Port range validation (1-65535)
- Host/user/database presence checks
- Password strength warnings
- SQL injection prevention via parameterized queries

### Embedding Validation

Vector embeddings are validated before storage:
- Dimension matching (384 or 1536)
- NaN and Infinity detection
- Array type checking

## Multi-Provider LLM Support

### Supported Providers

The extension supports multiple LLM providers with BYOK (Bring Your Own Key):

#### 1. OpenAI
- **Models**: GPT-4 Turbo, GPT-3.5 Turbo
- **Default**: `gpt-4-turbo-preview`
- **Key Format**: `sk-...`
- **Configuration**:
  ```json
  {
    "workspaceRag.llmProvider": "openai",
    "workspaceRag.openaiModel": "gpt-4-turbo-preview",
    "workspaceRag.openaiBaseURL": "https://api.openai.com/v1"
  }
  ```

#### 2. Anthropic (Claude)
- **Models**: Claude 3.5 Sonnet, Claude 3 Opus
- **Default**: `claude-3-5-sonnet-20241022`
- **Key Format**: `sk-ant-...`
- **Configuration**:
  ```json
  {
    "workspaceRag.llmProvider": "anthropic",
    "workspaceRag.anthropicModel": "claude-3-5-sonnet-20241022"
  }
  ```

#### 3. Google (Gemini)
- **Models**: Gemini 1.5 Pro, Gemini 1.5 Flash
- **Default**: `gemini-1.5-pro-latest`
- **Configuration**:
  ```json
  {
    "workspaceRag.llmProvider": "google",
    "workspaceRag.googleModel": "gemini-1.5-pro-latest"
  }
  ```

#### 4. OpenRouter
- **Models**: Access to 100+ models from multiple providers
- **Default**: `anthropic/claude-3.5-sonnet`
- **Popular Models**:
  - `anthropic/claude-3.5-sonnet`
  - `openai/gpt-4-turbo`
  - `meta-llama/llama-3-70b-instruct`
  - `google/gemini-pro-1.5`
- **Configuration**:
  ```json
  {
    "workspaceRag.llmProvider": "openrouter",
    "workspaceRag.openrouterModel": "anthropic/claude-3.5-sonnet"
  }
  ```

### Setting API Keys

1. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Run: `RAG: Set OpenAI API Key (Optional Fallback)`
3. Select your provider (OpenAI, Anthropic, Google, or OpenRouter)
4. Enter your API key

Keys are stored securely in VS Code's encrypted Secrets storage.

### Provider Selection

Set your preferred provider in VS Code settings:

```json
{
  "workspaceRag.llmProvider": "anthropic"
}
```

Or use the settings UI:
1. Open Settings (`Ctrl+,`)
2. Search for "Workspace RAG"
3. Select "Llm Provider"
4. Choose from dropdown

### Automatic Fallback

If the configured provider fails, the extension automatically falls back to simple text extraction:
- No API calls made
- Returns relevant code snippets
- Shows file names and similarity scores
- Works offline

### Custom Base URLs

For self-hosted or proxy deployments, you can customize API endpoints:

```json
{
  "workspaceRag.openaiBaseURL": "https://your-proxy.com/v1",
  "workspaceRag.anthropicBaseURL": "https://your-anthropic-proxy.com/v1"
}
```

## Retry Logic and Error Handling

### Automatic Retries

All LLM providers include automatic retry logic:
- Maximum 3 retries (configurable)
- Exponential backoff (1s, 2s, 4s)
- Retry only on transient errors (429, 500+)

### Configuration

```json
{
  "workspaceRag.llmTimeout": 30000,
  "workspaceRag.llmMaxRetries": 3
}
```

### Error Types

**Retryable Errors**:
- Rate limit (429)
- Server errors (500-599)
- Network timeouts

**Non-Retryable Errors**:
- Invalid API key (401)
- Bad request (400)
- Not found (404)

## Testing

### Test Coverage

The extension includes comprehensive tests:

#### Safeguards Tests (`src/test/safeguards.test.ts`)
- Query validation (100% coverage)
- Path traversal detection
- Database config validation
- Embedding validation
- Rate limiting
- API key validation
- Error message sanitization

#### Text Splitter Tests (`src/test/textSplitter.test.ts`)
- Code-aware splitting
- Markdown section detection
- Chunk size limits
- Content integrity

### Running Tests

```bash
npm test
```

### Test Results

```
✓ Query validation (8 tests)
✓ File path validation (4 tests)
✓ Database config validation (3 tests)
✓ Text sanitization (2 tests)
✓ Embedding validation (5 tests)
✓ API key validation (5 tests)
✓ Rate limiting (2 tests)
✓ Error message sanitization (3 tests)
✓ Text splitter (8 tests)

Total: 40 tests passed
```

## Rate Limits and Quotas

### Extension Rate Limits

Built-in limits to prevent abuse:
- 60 requests/minute per workspace
- Automatic throttling

### Provider Rate Limits

Be aware of provider-specific limits:

**OpenAI**:
- GPT-4: 10,000 requests/minute
- GPT-3.5: 60,000 requests/minute

**Anthropic**:
- Claude 3.5: Tier-based limits
- Check your account dashboard

**Google**:
- Gemini: 60 requests/minute (free tier)
- Higher limits for paid accounts

**OpenRouter**:
- Varies by model
- Typically 200 requests/minute

## Best Practices

### API Key Management

1. Use environment-specific keys (dev/prod)
2. Rotate keys periodically
3. Monitor usage in provider dashboards
4. Set spending limits

### Provider Selection

**Choose OpenAI if**:
- You need consistent, high-quality responses
- Cost is not a primary concern
- You have existing OpenAI credits

**Choose Anthropic if**:
- You need longer context windows
- You prefer Claude's code understanding
- You want detailed, nuanced responses

**Choose Google if**:
- You're cost-conscious
- You need fast responses
- You're already in Google Cloud

**Choose OpenRouter if**:
- You want flexibility
- You want to try multiple models
- You want unified billing

### Security Recommendations

1. **Never commit API keys** to version control
2. **Use .env files** for development (not tracked)
3. **Enable 2FA** on provider accounts
4. **Monitor usage** regularly for anomalies
5. **Set budget alerts** in provider dashboards
6. **Use separate keys** for development and production
7. **Rotate keys** if compromised

## Monitoring and Observability

### Built-in Logging

All operations are logged:
- Query processing
- Provider selection
- Retry attempts
- Failures and errors

View logs in VS Code Output panel:
1. View → Output
2. Select "Workspace RAG" from dropdown

### Distributed Tracing

Enable ddtrace for detailed observability:

```json
{
  "workspaceRag.tracing.enabled": true,
  "workspaceRag.tracing.sampleRate": 0.1
}
```

Traces include:
- Query processing time
- Embedding generation time
- Database query performance
- LLM provider latency
- Token usage

## Compliance

### Data Privacy

- All data processed locally by default
- API calls only when LLM providers configured
- No telemetry sent to extension authors
- Workspace data never leaves your machine (except embeddings/queries to configured LLMs)

### GDPR Compliance

- User controls all data
- API keys deletable via VS Code Secrets
- No personal data collection
- Right to erasure: delete database manually

## Troubleshooting

### "No API key configured"

Set an API key for your chosen provider:
```
RAG: Set OpenAI API Key (Optional Fallback)
```

### "Rate limit exceeded"

Wait 60 seconds before making more requests, or reduce query frequency.

### "Provider timeout"

Increase timeout:
```json
{
  "workspaceRag.llmTimeout": 60000
}
```

### "Invalid API key"

Verify:
1. Key format matches provider (e.g., `sk-` for OpenAI)
2. Key is active in provider dashboard
3. Key has sufficient credits/quota

## Cost Estimation

### Typical Costs per Query

**OpenAI GPT-4 Turbo**:
- Input: $0.01 / 1K tokens
- Output: $0.03 / 1K tokens
- Average query: ~1,500 tokens
- Cost per query: ~$0.03-$0.05

**Anthropic Claude 3.5 Sonnet**:
- Input: $0.003 / 1K tokens
- Output: $0.015 / 1K tokens
- Average query: ~1,500 tokens
- Cost per query: ~$0.02-$0.03

**Google Gemini 1.5 Pro**:
- Input: $0.00125 / 1K tokens
- Output: $0.005 / 1K tokens
- Average query: ~1,500 tokens
- Cost per query: ~$0.01-$0.015

**OpenRouter**:
- Varies by model
- Typically 10-50% markup over direct API

### Cost Optimization

1. Use local MLX for embeddings (free)
2. Choose smaller context windows
3. Use caching (coming soon)
4. Batch queries when possible
5. Use cheaper models for simple queries

## Support

For security issues, please email security@example.com (do not file public issues).

For general questions, open an issue on GitHub.

