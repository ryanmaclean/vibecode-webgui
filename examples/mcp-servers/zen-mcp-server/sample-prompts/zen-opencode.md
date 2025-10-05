# Zen + OpenCode - Sample Prompts

Examples of using Zen MCP Server with open source AI coding assistants (OpenCode, Continue, Aider, etc.).

## Overview

Combining Zen with open source AI tools provides:
- **Zen** manages focus and productivity
- **OpenCode** provides flexible, privacy-focused AI assistance
- **Local models** for sensitive codebases
- **Cost-effective** development workflow

## Supported Tools

- **Continue** - Open source Copilot alternative
- **Aider** - AI pair programming in terminal
- **Tabby** - Self-hosted code completion
- **CodeGPT** - Multiple model support
- **LocalAI** - Run models locally

## Basic Combinations

### 1. Focused Development with Continue

```
@zen start focus --duration 30m

// Use Continue for code suggestions
// Continue works with local or remote models
// Zen manages your focus time

// Implement authentication
function authenticate(credentials) {
  // Continue suggests implementation
}
```

### 2. Terminal-Based Development with Aider

```bash
# Start zen focus session
@zen start focus --duration 45m

# Use aider for AI pair programming
aider src/auth/login.ts

# In aider:
/add src/auth/login.ts
/code Implement JWT authentication with refresh tokens

# Zen manages focus while aider assists with code
```

### 3. Self-Hosted with Tabby

```
@zen pomodoro --cycles 4

// Tabby provides code completion from your self-hosted server
// Privacy-focused, no data leaves your infrastructure
// Zen structures your work intervals

// Implement user service
class UserService {
  // Tabby suggests methods based on your codebase
}
```

## Advanced Workflows

### Workflow 1: Local Model Development

```
@zen start deep-work --duration 90m

// Using Continue with local Llama model
// No API costs, complete privacy
// Zen ensures sustained focus

// Configure Continue for local model:
{
  "models": [{
    "title": "Llama 3",
    "provider": "ollama",
    "model": "llama3:70b"
  }]
}

// Implement complex feature with local AI assistance
```

### Workflow 2: Privacy-First Code Review

```
@zen mindful-review --file src/proprietary-algorithm.ts

// Use local AI model for sensitive code
// No code sent to external APIs
// Zen encourages thorough review

// In Continue or Aider:
Review this proprietary algorithm for:
- Performance optimization
- Edge case handling
- Code clarity
```

### Workflow 3: Cost-Effective Development

```
@zen pomodoro --cycles 8

// Use open source models to reduce costs
// Pomodoro 1-4: Implementation with Continue
// Pomodoro 5-6: Testing with local AI
// Pomodoro 7-8: Documentation

// No per-token costs
// Unlimited usage
// Zen structures the workflow
```

## Productivity Patterns

### Pattern 1: Aider + Zen Terminal Workflow

```bash
# Start zen session
@zen start focus --duration 60m

# Launch aider with multiple files
aider src/auth/*.ts src/models/user.ts

# In aider session:
/add src/auth/middleware.ts
/code Implement rate limiting middleware using Redis

# Aider makes changes while Zen tracks focus
# Review changes mindfully

# Commit when satisfied
/commit "Add rate limiting middleware"

# Check zen stats
@zen stats today
```

### Pattern 2: Continue + Zen IDE Workflow

```
@zen start morning-focus --duration 90m

// Configure Continue in VSCode/Neovim
// Use local or remote models

// 1. Review yesterday's work
// Continue suggests next steps

// 2. Implement high-priority features
// Continue provides completions

// 3. Write tests
// Continue generates test cases

// Zen manages focus throughout
```

### Pattern 3: Multi-Model Approach

```
@zen start optimization --duration 60m

// Use different models for different tasks:

// Fast local model for completions (Tabby)
// Zen keeps you focused

// Larger model for complex reasoning (Continue + GPT-4)
// When you need deep analysis

// Local model for sensitive code (Ollama)
// Privacy-first approach
```

## Configuration Examples

### Continue Configuration

```json
{
  "models": [
    {
      "title": "GPT-4",
      "provider": "openai",
      "model": "gpt-4-turbo-preview",
      "apiKey": "${OPENAI_API_KEY}"
    },
    {
      "title": "Local Llama",
      "provider": "ollama",
      "model": "codellama:34b"
    },
    {
      "title": "DeepSeek Coder",
      "provider": "ollama",
      "model": "deepseek-coder:33b"
    }
  ],
  "tabAutocompleteModel": {
    "title": "Tabby",
    "provider": "tabby",
    "endpoint": "http://localhost:8080"
  }
}
```

### Aider Configuration

```bash
# ~/.aider.conf.yml
model: gpt-4-turbo-preview
edit-format: diff
auto-commits: false
pretty: true

# Use with zen
alias aider-zen='@zen start focus --duration 45m && aider'
```

### Tabby Configuration

```toml
# ~/.tabby/config.toml
[server]
host = "0.0.0.0"
port = 8080

[model]
name = "StarCoder"
device = "cuda"

[completion]
max_tokens = 128
temperature = 0.1
```

## Code Quality with Zen + OpenCode

### Comprehensive Review with Local Models

```
@zen mindful-review --comprehensive

// Use Continue with local model
// Review code without sending to external APIs

Cmd+L (Continue chat):
Review this code comprehensively:
- Architecture and design
- Security implications
- Performance considerations
- Test coverage
- Documentation quality

Use local model for privacy.
```

### Refactoring with Aider

```bash
@zen start refactoring --duration 60m

aider src/legacy/*.js

# In aider:
/add src/legacy/payment.js
/architect Refactor this to modern async/await with proper error handling

# Aider proposes changes
# Review with zen mindfulness
# Accept or modify

/commit "Refactor payment processing to async/await"
```

## Advanced Patterns

### Pattern 1: Hybrid Model Strategy

```
@zen start focus --duration 90m

// Use different models strategically:

// 1. Fast local model for autocomplete (Tabby)
//    - Instant suggestions
//    - No API latency
//    - Privacy-first

// 2. Medium model for code generation (Continue + CodeLlama)
//    - Good balance of speed and quality
//    - Run locally or remote

// 3. Large model for complex problems (Continue + GPT-4)
//    - Deep reasoning
//    - Architecture decisions
//    - Use sparingly for cost

// Zen manages focus across all tools
```

### Pattern 2: Offline Development

```
@zen start offline-work --duration 120m

// Complete development workflow offline:

// 1. Code completion: Tabby (self-hosted)
// 2. Code generation: Ollama (local)
// 3. Code review: Continue (local model)
// 4. Documentation: Local LLM

// No internet required
// Complete privacy
// Zen ensures productivity
```

### Pattern 3: Team Collaboration

```
@zen start pair-programming --duration 60m

// Self-hosted AI for team:
// - Shared Tabby server
// - Team-specific model fine-tuning
// - Codebase-aware suggestions

// Benefits:
// - Consistent AI assistance
// - Privacy for proprietary code
// - Cost control
// - Zen manages focus for all team members
```

## Tips for Zen + OpenCode

### 1. Choose the Right Model

```
@zen start focus --duration 30m

// Fast tasks: Use local small model
// Complex tasks: Use larger model
// Sensitive code: Always use local model
```

### 2. Optimize for Your Hardware

```bash
# Check GPU availability
nvidia-smi

# Run appropriate model size
# 7B models: 8GB VRAM
# 13B models: 16GB VRAM
# 34B models: 24GB+ VRAM

@zen start focus --duration 45m
# Use model that fits your hardware
```

### 3. Batch API Calls

```
@zen pomodoro --cycles 4

// Cycle 1: Gather all questions
// Cycle 2: Batch process with AI
// Cycle 3: Implement suggestions
// Cycle 4: Review and test

// Reduces API costs
// More efficient workflow
```

### 4. Use Local Models for Iteration

```
@zen start rapid-prototyping --duration 60m

// Use local model for fast iteration
// No API rate limits
// Instant feedback
// Switch to larger model for final review
```

## Cost Comparison

### Traditional API Approach

```
Monthly costs with GPT-4:
- Code completion: $50-100
- Code generation: $100-200
- Code review: $50-100
Total: $200-400/month
```

### Open Source Approach

```
One-time setup:
- GPU server: $500-2000 (or use existing)
- Models: Free (open source)

Monthly costs:
- Electricity: $10-30
- Maintenance: Minimal
Total: $10-30/month

@zen stats --period month --cost-savings
# Track your savings
```

## Troubleshooting

### Model Running Slow

```bash
# Check system resources
htop

# Optimize model settings
# Reduce context window
# Use quantized models
# Enable GPU acceleration

@zen start focus --duration 30m
# Continue working while optimizing
```

### Out of Memory

```bash
# Use smaller model
ollama run codellama:7b  # Instead of 34b

# Or use quantized version
ollama run codellama:7b-q4_0

@zen start focus --duration 45m
# Smaller model still effective with zen focus
```

## Best Practices

### 1. Start Local, Scale as Needed

```
@zen start focus --duration 30m

// Begin with local models
// Upgrade to cloud when necessary
// Zen works with any model
```

### 2. Fine-Tune for Your Codebase

```bash
# Fine-tune model on your code
# Better suggestions
# Codebase-aware completions

@zen start training --duration 120m
# Fine-tune model with zen focus
```

### 3. Combine Multiple Tools

```
@zen pomodoro --cycles 4

// Cycle 1: Tabby for completion
// Cycle 2: Continue for generation
// Cycle 3: Aider for refactoring
// Cycle 4: Local LLM for review

// Best tool for each task
```

### 4. Track Productivity

```
@zen stats --period week

// Compare productivity with:
// - Different models
// - Local vs cloud
// - Various tools

// Optimize your workflow
```

## Resources

- [Continue Documentation](https://continue.dev/docs)
- [Aider Documentation](https://aider.chat/)
- [Tabby Documentation](https://tabby.tabbyml.com/)
- [Ollama Models](https://ollama.ai/library)
- [Zen MCP Server](https://github.com/BeehiveInnovations/zen-mcp-server)
- [More Sample Prompts](./README.md)
