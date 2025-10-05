# OpenAI Agents FAQ

**Version**: 1.0.0
**Last Updated**: 2025-10-02

## Table of Contents

1. [General Questions](#general-questions)
2. [Getting Started](#getting-started)
3. [Agent Types](#agent-types)
4. [Technical Questions](#technical-questions)
5. [Billing & Limits](#billing--limits)
6. [Troubleshooting](#troubleshooting)
7. [Security & Privacy](#security--privacy)
8. [Integration & API](#integration--api)

---

## General Questions

### What are OpenAI Agents?

OpenAI Agents are AI-powered coding assistants that can autonomously perform development tasks like code editing, refactoring, review, and testing. VibeCode supports three agent types: Aider (code editing), Goose (code review), and Cline (general-purpose tasks).

### How are agents different from AI chat assistants?

Agents are action-oriented and can directly modify your code, while chat assistants provide guidance. Agents:
- Execute tasks autonomously
- Modify files directly
- Run tests and verify changes
- Work within your development environment
- Provide real-time progress updates

### What models are supported?

Supported LLM models:
- **Claude 3.5 Sonnet** (claude-3-5-sonnet-20241022) - Best for complex tasks
- **Claude 3.5 Haiku** (claude-3-5-haiku-20241022) - Faster, cost-effective
- **GPT-4o** - OpenAI's latest model
- **GPT-4o Mini** - Budget-friendly option
- **DeepSeek Chat** - Open-source alternative

### Are my code and data secure?

Yes. All agent operations:
- Run in isolated environments
- Use encrypted communication
- Never store code permanently
- Follow GDPR/CCPA compliance
- Can be self-hosted for maximum control

---

## Getting Started

### How do I create my first agent?

1. Log into VibeCode
2. Navigate to Agents dashboard
3. Click "Create Agent"
4. Select agent type (Aider, Goose, or Cline)
5. Configure workspace, files, model, and task
6. Click "Start Agent"

See [User Guide](./01-USER-GUIDE.md#creating-your-first-agent) for detailed walkthrough.

### What makes a good task description?

Good task descriptions are:
- **Specific**: "Add error handling to login function" vs "Fix the code"
- **Detailed**: Include what to do and how
- **Contextual**: Mention relevant files and dependencies
- **Bounded**: Clear scope with defined outcomes

Example:
```
Add comprehensive error handling to the login function in src/auth.py:
- Try-catch blocks for network errors
- Validation for invalid credentials
- Logging for failed attempts
- Return appropriate HTTP status codes
```

### Can I guide agents during execution?

Yes! You can:
- Send messages to provide clarification
- Request status updates
- Add new requirements
- Correct the agent's direction
- Ask questions about changes

The agent incorporates your feedback in real-time.

### How long do agents take to complete tasks?

Task completion time varies:
- **Simple tasks**: 30 seconds to 2 minutes
- **Medium tasks**: 2-5 minutes
- **Complex tasks**: 5-15 minutes
- **Very complex**: May require multiple agents or sessions

Default timeout is 5 minutes (configurable).

---

## Agent Types

### Which agent should I use?

**Use Aider when:**
- Modifying existing code
- Refactoring
- Adding new features
- Need git integration

**Use Goose when:**
- Code review needed
- Security audit
- Performance analysis
- Quality assessment

**Use Cline when:**
- Documentation generation
- Test creation
- General coding tasks
- Multi-step workflows

### Can I use multiple agents together?

Yes! Common workflows:
1. **Aider** implements feature
2. **Cline** generates tests
3. **Goose** reviews for issues

You can run agents sequentially or in parallel (within your concurrency limit).

### What's the difference between Aider and Cline for code editing?

**Aider:**
- Specialized for code modification
- Git-aware (understands history)
- Better for refactoring
- Atomic multi-file changes

**Cline:**
- More versatile
- Better for documentation/tests
- Handles diverse tasks
- Less opinionated about code structure

### Can agents work across multiple files?

Yes, all agent types support multiple files:
- **Aider**: Up to 50 files, optimized for related changes
- **Goose**: Can analyze entire directories
- **Cline**: Flexible file handling

Specify files in the `files` array when creating the agent.

---

## Technical Questions

### What programming languages are supported?

All major languages are supported:
- **Strongly supported**: Python, JavaScript, TypeScript, Java, Go, Rust
- **Well supported**: C++, C#, Ruby, PHP, Swift, Kotlin
- **Supported**: Most other languages with syntax highlighting

Agent performance may vary by language based on training data.

### Can agents run tests?

Yes! Agents can:
- Run existing test suites
- Generate new tests
- Fix failing tests
- Verify changes don't break tests

Specify test requirements in your task description.

### How do I integrate agents with my CI/CD pipeline?

Use the REST API to trigger agents from CI/CD:

```bash
# Example GitHub Actions workflow
- name: Run Code Review Agent
  run: |
    AGENT_ID=$(curl -X POST $API_URL/agents \
      -H "Authorization: Bearer $API_KEY" \
      -d '{"agent_type":"goose","task":"Review PR changes"}' \
      | jq -r '.agent_id')

    # Wait for completion
    while [ "$(curl $API_URL/agents/$AGENT_ID | jq -r '.status')" == "running" ]; do
      sleep 5
    done
```

See [API Reference](./02-API-REFERENCE.md) for details.

### Can I use agents with VS Code or other IDEs?

Yes, through:
1. **Web interface**: Access from any browser
2. **API integration**: Build custom IDE extensions
3. **VS Code extension**: (Coming soon)
4. **CLI tool**: Command-line interface for terminal users

### What's the difference between SSE and WebSocket connections?

**Server-Sent Events (SSE):**
- One-way: Server to client
- Automatic reconnection
- Simpler to implement
- Better for monitoring

**WebSocket:**
- Two-way: Bidirectional communication
- Lower latency
- Better for interactive sessions
- Can send messages to agent

Both provide real-time updates. Choose based on your needs.

---

## Billing & Limits

### What are the rate limits?

**Per User:**
- 5 concurrent agents maximum
- 30 messages per minute per agent
- 1000 messages per hour per workspace

**Global:**
- 10,000 active agents system-wide
- 100 messages per second across all agents

See [API Reference](./02-API-REFERENCE.md#rate-limiting) for details.

### How is agent usage billed?

Billing is based on:
- **Compute time**: Time agent is actively running
- **Model costs**: API calls to LLM providers
- **Storage**: (Minimal) Temporary workspace storage

Pricing varies by:
- Agent type
- Model selected
- Task complexity
- Execution time

### Can I set spending limits?

Yes, you can configure:
- Maximum concurrent agents
- Maximum execution time per agent
- Monthly spending cap
- Per-agent cost alerts

Configure in Account Settings > Billing > Limits.

### What happens if I hit rate limits?

When rate limited:
1. Request returns 429 status
2. Response includes `Retry-After` header
3. Request is queued (optional)
4. Automatic retry with exponential backoff

Your code should implement backoff strategy:

```typescript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After');
  await sleep(retryAfter * 1000);
  // Retry request
}
```

### Can I increase my limits?

Yes! Contact sales for:
- Higher concurrent agent limits
- Increased message rates
- Custom timeout values
- Dedicated infrastructure

Email: sales@vibecode.com

---

## Troubleshooting

### My agent won't start. What should I check?

Common issues:
1. **Concurrent agent limit reached**: Stop inactive agents
2. **Invalid workspace path**: Must start with `/home/coder/workspace`
3. **File permissions**: Verify read/write access
4. **Model unavailable**: Check model status
5. **AgentAPI service down**: Check health endpoint

See [Troubleshooting Guide](./04-TROUBLESHOOTING.md#agent-wont-start) for solutions.

### Agent is stuck and not responding. What should I do?

1. **Check metrics**: Is CPU/memory normal?
2. **Send status request**: Ask agent for update
3. **Check SSE connection**: May be disconnected
4. **Wait 2 minutes**: Task may be complex
5. **Force restart**: Last resort

```typescript
// Force restart
await stopAgent(agentId, true);
await restartAgent(agentId);
```

### Connection keeps dropping. How do I fix this?

Implement reconnection logic:

```typescript
function createResilientSSE(url, maxRetries = 10) {
  let retries = 0;

  function connect() {
    const es = new EventSource(url);

    es.onerror = () => {
      es.close();
      if (retries++ < maxRetries) {
        setTimeout(connect, Math.min(1000 * Math.pow(2, retries), 30000));
      }
    };

    return es;
  }

  return connect();
}
```

### Agent made incorrect changes. Can I undo them?

Yes:
1. **Before accepting**: Review changes in diff viewer
2. **After accepting**: Use git to revert
3. **Prevention**: Provide clearer task descriptions

```bash
# Revert changes
git diff HEAD
git checkout -- <file>  # Discard changes
git revert <commit>     # Revert commit
```

### How do I report a bug?

1. **Collect diagnostics**:
   ```typescript
   const diagnostics = await collectDiagnostics(agentId);
   ```

2. **Create GitHub issue**:
   - Repository: vibecode/vibecode
   - Label: `agents`
   - Include: Task description, error messages, diagnostics

3. **Email support**: support@vibecode.com for urgent issues

---

## Security & Privacy

### Who can access my agents?

Only you can access your agents:
- Agents are user-scoped
- No cross-user access
- Session-based authentication required
- API keys are user-specific

### Is my code sent to third-party APIs?

Yes, when using cloud models:
- **Claude models**: Sent to Anthropic API
- **GPT models**: Sent to OpenAI API
- **DeepSeek**: Sent to DeepSeek API

Code is:
- Encrypted in transit (TLS 1.3)
- Not stored by providers (per their policies)
- Only includes files you specify

For maximum security, use self-hosted models.

### Can I self-host the agent infrastructure?

Yes! Enterprise plan includes:
- Self-hosted AgentAPI server
- Local model support
- Air-gapped deployments
- Custom model integration

Contact sales: enterprise@vibecode.com

### How long is agent data retained?

**Active agents:**
- Output: Retained while agent is running
- Logs: 24 hours after completion
- Metrics: 7 days

**Archived agents:**
- Summary data: 90 days
- Full logs: Deleted after 24 hours
- Metrics: Aggregated only

Configure retention in Settings > Data & Privacy.

### Are agents GDPR compliant?

Yes:
- Data processing agreements available
- Right to erasure supported
- Data portability supported
- EU data residency available
- Privacy policy: vibecode.com/privacy

---

## Integration & API

### How do I authenticate API requests?

Two methods:

**1. Session Cookies (Web):**
```typescript
fetch('/api/agents', {
  credentials: 'include'  // Include session cookie
});
```

**2. API Key (Programmatic):**
```typescript
fetch('/api/agents', {
  headers: {
    'X-API-Key': 'your-api-key'
  }
});
```

Generate API keys in Settings > API Keys.

### What's the API response time?

**Target latencies:**
- Agent creation: <200ms (P95)
- Status check: <50ms (P95)
- List agents: <100ms (P95)
- SSE connection: <100ms initial

**Factors affecting latency:**
- Network distance
- Current load
- Agent complexity
- Model response time

### Can I use the API from mobile apps?

Yes, the API is platform-agnostic:
- iOS: Use URLSession or Alamofire
- Android: Use Retrofit or OkHttp
- React Native: Use fetch API
- Flutter: Use http package

CORS is configured for cross-origin requests.

### Is there an SDK available?

Official SDKs:

**JavaScript/TypeScript:**
```bash
npm install @vibecode/agent-sdk
```

**Python:**
```bash
pip install vibecode-agents
```

**Go:**
```bash
go get github.com/vibecode/agent-sdk-go
```

See [SDK Documentation](https://docs.vibecode.com/sdk) for usage.

### How do I handle webhooks for agent events?

Configure webhooks in Settings > Webhooks:

```typescript
// Webhook payload
{
  "event": "agent.completed",
  "agent_id": "aider-abc12345",
  "status": "completed",
  "exit_code": 0,
  "timestamp": "2025-10-02T10:30:00Z"
}
```

Your endpoint must:
- Return 200 OK within 5 seconds
- Verify webhook signature
- Handle idempotency (duplicate events)

### Can I batch create multiple agents?

Yes, use Promise.all for parallel creation:

```typescript
const configs = [
  { agent_type: 'aider', task: 'Task 1' },
  { agent_type: 'goose', task: 'Task 2' },
  { agent_type: 'cline', task: 'Task 3' }
];

const agents = await Promise.all(
  configs.map(config => startAgent(config))
);
```

Respects your concurrent agent limit.

---

## Still Have Questions?

### Resources

- **Documentation**: https://docs.vibecode.com/agents
- **API Reference**: [API Reference](./02-API-REFERENCE.md)
- **Tutorials**: [Video Tutorials](./06-VIDEO-TUTORIAL-SCRIPTS.md)
- **Community**: https://discord.gg/vibecode

### Support

- **GitHub Issues**: https://github.com/vibecode/issues
- **Email**: support@vibecode.com
- **Live Chat**: Available in VibeCode dashboard
- **Office Hours**: Mon-Fri 9AM-5PM EST

### Feedback

We'd love to hear from you:
- Feature requests: feedback@vibecode.com
- Bug reports: GitHub Issues
- General feedback: Community Discord

---

*Last updated: 2025-10-02*
