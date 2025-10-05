# Zen + Gemini CLI - Sample Prompts

Examples of using Zen MCP Server with Google's Gemini AI through CLI and IDE integrations.

## Overview

Combining Zen with Gemini provides:
- **Zen** manages focus and mindful coding practices
- **Gemini** offers multimodal AI capabilities and code understanding
- **Long context** for analyzing entire codebases
- **Fast responses** for real-time assistance

## Setup

### Gemini CLI Installation

```bash
# Install Gemini CLI
npm install -g @google/generative-ai-cli

# Or use via npx
npx @google/generative-ai-cli

# Set API key
export GEMINI_API_KEY="your-api-key"
```

### IDE Integration

```json
// VSCode/Cursor settings.json
{
  "gemini.apiKey": "${env:GEMINI_API_KEY}",
  "gemini.model": "gemini-1.5-pro",
  "gemini.maxTokens": 8192
}
```

## Basic Combinations

### 1. Focused Development

```
@zen start focus --duration 30m

@gemini Analyze this codebase and suggest improvements for the authentication module.
Focus on security and performance.

[CODE CONTEXT]
```

**What Happens:**
- Zen starts focus timer
- Gemini analyzes with long context window
- You receive comprehensive insights
- Zen keeps you focused on implementation

### 2. Codebase Analysis

```
@zen start analysis --duration 45m

@gemini Review the entire src/ directory and:
1. Identify architectural patterns
2. Find potential bugs
3. Suggest refactoring opportunities
4. Highlight security concerns

Use your long context window to understand the full codebase.
```

**Benefits:**
- Gemini's 1M+ token context
- Holistic codebase understanding
- Zen ensures focused review

### 3. Multimodal Development

```
@zen start design-review --duration 30m

@gemini I have a UI mockup and the current implementation.
Compare them and suggest changes to match the design.

[Attach screenshot]
[CODE]

Analyze both the visual design and code.
```

## Advanced Workflows

### Workflow 1: Full Codebase Refactoring

```
@zen start refactoring --duration 120m

@gemini Analyze the entire codebase in src/ and help me refactor it.

Phase 1 (30min): Analysis
- Identify code smells
- Find duplication
- Spot inconsistencies

Phase 2 (60min): Refactoring
- Suggest specific changes
- Prioritize by impact
- Guide implementation

Phase 3 (30min): Validation
- Review changes
- Ensure consistency
- Update tests

Use your long context to maintain consistency across all files.
```

### Workflow 2: Architecture Design

```
@zen start architecture --duration 90m

@gemini Design a microservices architecture for this monolith.

Current codebase: [REPO CONTEXT]

Requirements:
- Service boundaries
- Communication patterns
- Data consistency
- Deployment strategy

Analyze the entire codebase to suggest optimal service boundaries.
```

### Workflow 3: Bug Investigation

```
@zen start debugging --duration 60m

@gemini Help me find the root cause of this bug.

Symptoms: [DESCRIPTION]
Error logs: [LOGS]
Relevant code: [ENTIRE MODULE]

Analyze all related code paths and identify the issue.
Use your long context to trace through the entire flow.
```

## Productivity Patterns

### Pattern 1: Morning Codebase Review

```
@zen start morning-review --duration 45m

@gemini Review yesterday's commits and today's PRs.

Yesterday's changes:
[GIT DIFF]

Open PRs:
[PR LINKS]

Provide:
1. Summary of changes
2. Potential issues
3. Testing suggestions
4. Priority recommendations

Analyze all changes together for consistency.
```

### Pattern 2: Feature Planning

```
@zen start planning --duration 60m

@gemini Help me plan this feature implementation.

Feature: [DESCRIPTION]
Current codebase: [CONTEXT]
Requirements: [SPECS]

Create:
1. Implementation plan
2. File structure
3. API design
4. Test strategy
5. Migration path

Consider the entire codebase architecture.
```

### Pattern 3: Documentation Sprint

```
@zen start documentation --duration 90m

@gemini Generate comprehensive documentation for this project.

Codebase: [FULL REPO]

Create:
1. README with setup instructions
2. API documentation
3. Architecture overview
4. Contributing guidelines
5. Code examples

Analyze the entire codebase to ensure accurate documentation.
```

## Code Quality with Zen + Gemini

### Comprehensive Security Audit

```
@zen start security-audit --duration 120m

@gemini Perform a thorough security audit of this application.

Codebase: [FULL REPO]

Analyze:
1. Authentication and authorization
2. Input validation
3. SQL injection risks
4. XSS vulnerabilities
5. CSRF protection
6. Secrets management
7. Dependency vulnerabilities

Use your long context to trace security implications across the entire codebase.
```

### Performance Optimization

```
@zen start optimization --duration 90m

@gemini Analyze this application for performance bottlenecks.

Codebase: [FULL REPO]
Performance data: [METRICS]

Identify:
1. Slow database queries
2. N+1 query problems
3. Memory leaks
4. Inefficient algorithms
5. Caching opportunities

Analyze the entire request flow across all modules.
```

## Advanced Patterns

### Pattern 1: Multi-File Refactoring

```
@zen start refactoring --duration 120m

@gemini Refactor these related files to improve consistency:

Files:
- src/auth/login.ts
- src/auth/register.ts
- src/auth/password-reset.ts
- src/middleware/auth.ts
- src/models/user.ts

Goals:
- Consistent error handling
- Shared validation logic
- Improved type safety
- Better test coverage

Analyze all files together and suggest coordinated changes.
```

### Pattern 2: Migration Planning

```
@zen start migration --duration 90m

@gemini Plan migration from REST to GraphQL.

Current API: [ALL ENDPOINTS]
Data models: [ALL MODELS]
Client usage: [FRONTEND CODE]

Create:
1. GraphQL schema
2. Resolver implementation plan
3. Migration strategy
4. Backward compatibility approach
5. Testing plan

Consider the entire API surface and all clients.
```

### Pattern 3: Test Generation

```
@zen start testing --duration 60m

@gemini Generate comprehensive tests for this module.

Module: [FULL MODULE CODE]
Dependencies: [RELATED CODE]

Generate:
1. Unit tests for all functions
2. Integration tests for workflows
3. Edge case tests
4. Error handling tests
5. Performance tests

Analyze the entire module to ensure complete coverage.
```

## Multimodal Capabilities

### UI/UX Review

```
@zen start design-review --duration 45m

@gemini Compare this UI mockup with the implementation.

Mockup: [SCREENSHOT]
Implementation: [COMPONENT CODE]
Rendered output: [SCREENSHOT]

Identify:
1. Visual differences
2. Missing features
3. Styling issues
4. Responsive behavior
5. Accessibility concerns
```

### Diagram Analysis

```
@zen start architecture-review --duration 60m

@gemini Review this architecture diagram and the implementation.

Diagram: [ARCHITECTURE DIAGRAM]
Codebase: [FULL REPO]

Verify:
1. Implementation matches design
2. All components present
3. Communication patterns correct
4. Data flow accurate
5. Suggest improvements
```

## Tips for Zen + Gemini

### 1. Leverage Long Context

```
@zen start analysis --duration 60m

@gemini Analyze the entire codebase (provide full context)

// Gemini can handle 1M+ tokens
// Provide entire files, not snippets
// Get holistic understanding
```

### 2. Use Multimodal Features

```
@zen start review --duration 30m

@gemini Compare these:
- Design mockup [IMAGE]
- Current implementation [CODE]
- Rendered output [SCREENSHOT]

Provide specific changes needed.
```

### 3. Batch Related Questions

```
@zen pomodoro --cycles 4

// Cycle 1: Gather all questions
// Cycle 2: Ask Gemini with full context
// Cycle 3: Implement suggestions
// Cycle 4: Review and test

// Efficient use of long context
```

### 4. Track Productivity Patterns

```
@zen stats --period week

@gemini Analyze my productivity data:
[ZEN STATS]

Suggest:
- Optimal focus session lengths
- Best times for complex tasks
- Break frequency adjustments
- Workflow improvements
```

## CLI Workflows

### Terminal-Based Development

```bash
# Start zen session
@zen start focus --duration 45m

# Use Gemini CLI
gemini chat

# In Gemini chat:
> Analyze this file and suggest improvements
> [Paste code]

# Or pipe directly:
cat src/auth/login.ts | gemini analyze --focus security

# Check zen stats
@zen stats today
```

### Automated Code Review

```bash
#!/bin/bash
# review-pr.sh

@zen start code-review --duration 30m

# Get PR diff
git diff main...feature-branch > pr.diff

# Review with Gemini
gemini review pr.diff \
  --context "$(cat README.md)" \
  --focus "security,performance,tests"

# Zen tracks review time
@zen task-complete --task "PR review"
```

## Best Practices

### 1. Provide Full Context

```
@zen start focus --duration 45m

@gemini [Provide entire relevant codebase]

// Don't: Provide snippets
// Do: Provide full files and context
// Gemini's long context handles it
```

### 2. Use for Holistic Analysis

```
@zen start analysis --duration 60m

@gemini Analyze the entire application architecture

[FULL CODEBASE]

// Gemini excels at seeing the big picture
```

### 3. Combine with Visual Analysis

```
@zen start design --duration 30m

@gemini Review this feature:
- Mockup: [IMAGE]
- Code: [FULL IMPLEMENTATION]
- Tests: [TEST FILES]

// Multimodal analysis
```

### 4. Iterate with Context

```
@zen pomodoro --cycles 3

// Cycle 1: Initial analysis
@gemini Analyze this module

// Cycle 2: Deep dive
@gemini Based on previous analysis, focus on [SPECIFIC AREA]

// Cycle 3: Implementation
@gemini Guide implementation of suggested changes

// Gemini maintains context across conversation
```

## Cost Optimization

### Efficient Context Usage

```
@zen start focus --duration 30m

// Gemini pricing based on tokens
// But long context is cost-effective

// Strategy:
// 1. Provide full context once
// 2. Ask multiple related questions
// 3. Batch similar analyses
// 4. Use Zen to structure work efficiently
```

## Resources

- [Gemini API Documentation](https://ai.google.dev/docs)
- [Gemini CLI](https://github.com/google/generative-ai-cli)
- [Zen MCP Server](https://github.com/BeehiveInnovations/zen-mcp-server)
- [More Sample Prompts](./README.md)
- [Multimodal Examples](./multimodal-examples.md)
