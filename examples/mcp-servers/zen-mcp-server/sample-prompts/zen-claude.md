# Zen + Claude Code - Sample Prompts

Examples of using Zen MCP Server with Claude (Anthropic) for thoughtful, high-quality AI-assisted development.

## Overview

Combining Zen's mindfulness with Claude's reasoning capabilities creates an ideal environment for:
- **Zen** provides focus management and mindful coding practices
- **Claude** offers deep analysis, reasoning, and code generation

## Basic Combinations

### 1. Mindful Code Review

```
@zen mindful-review --file src/auth/login.ts

@claude Review this authentication code thoroughly. Focus on:
1. Security vulnerabilities (SQL injection, XSS, CSRF)
2. Error handling and edge cases
3. Code clarity and maintainability
4. Performance implications

Take your time with each aspect.
```

**What Happens:**
- Zen sets a mindful review context
- Claude provides comprehensive, thoughtful analysis
- You receive detailed feedback on multiple dimensions

### 2. Deep Work with Complex Problem Solving

```
@zen start deep-work --duration 120m

@claude I need to design a distributed caching system for our microservices architecture. 
Let's think through:
1. Cache invalidation strategies
2. Consistency models
3. Failure scenarios
4. Performance trade-offs

Work through this systematically.
```

**Benefits:**
- Extended focus time for complex problems
- Claude's step-by-step reasoning
- Thorough exploration of design space

### 3. Focused Implementation

```
@zen start focus --duration 45m

@claude Help me implement a rate limiting middleware for our API.
Requirements:
- Token bucket algorithm
- Redis-backed storage
- Per-user and per-endpoint limits
- Graceful degradation

Let's build this carefully with proper error handling.
```

## Advanced Workflows

### Workflow 1: Architecture Design Session

```
@zen start architecture-session --duration 90m

@claude Let's design the authentication system for our application.

Current context:
- Microservices architecture
- 100k+ users
- Mobile and web clients
- Need SSO support

Walk me through:
1. Authentication flow design
2. Token management strategy
3. Session handling
4. Security considerations
5. Scalability approach

Let's be thorough and consider edge cases.
```

**Claude's Response Pattern:**
- Systematic analysis of requirements
- Multiple solution approaches
- Trade-off discussions
- Implementation recommendations
- Security best practices

### Workflow 2: Security Audit

```
@zen start security-audit --duration 60m

@claude Perform a comprehensive security audit of this API endpoint:

[CODE BLOCK]

Analyze:
1. Input validation
2. Authentication/authorization
3. Data exposure risks
4. Injection vulnerabilities
5. Rate limiting
6. Error handling
7. Logging and monitoring

Be thorough and explain each finding.
```

### Workflow 3: Refactoring Legacy Code

```
@zen mindful-review --file src/legacy/payment-processor.js

@claude This legacy payment processing code needs refactoring.

Current issues:
- Callback hell
- No error handling
- Hard to test
- Security concerns

Help me refactor this to:
- Modern async/await
- Proper error handling
- Testable design
- Security best practices

Let's do this step by step, explaining each change.
```

## Productivity Patterns

### Pattern 1: Morning Planning Session

```
@zen start morning-planning --duration 30m

@claude Review yesterday's progress:
[YESTERDAY'S WORK]

Today's goals:
[TODAY'S TASKS]

Help me:
1. Prioritize tasks by complexity and dependencies
2. Identify potential blockers
3. Suggest optimal task ordering
4. Estimate realistic time allocations

Let's plan a productive day.
```

### Pattern 2: Test-Driven Development

```
@zen pomodoro --cycles 6

Pomodoro 1:
@claude Help me write comprehensive tests for this authentication module.
Consider edge cases, error scenarios, and security implications.

Pomodoro 2-4:
@claude Guide me through implementing the authentication logic to pass these tests.
Let's ensure security and maintainability.

Pomodoro 5:
@claude Review the implementation. Suggest improvements and optimizations.

Pomodoro 6:
@claude Help me write documentation explaining the authentication flow.
```

### Pattern 3: Learning New Technology

```
@zen start learning-session --duration 90m

@claude I'm learning GraphQL. Help me understand:

Session 1 (30min): Core concepts
- Schema design
- Resolvers
- Queries vs Mutations

Session 2 (30min): Advanced patterns
- DataLoader for N+1 problems
- Error handling
- Authentication

Session 3 (30min): Hands-on implementation
- Build a simple GraphQL API
- Best practices

Explain each concept thoroughly with examples.
```

## Code Quality with Zen + Claude

### Comprehensive Code Review

```
@zen mindful-review --comprehensive

@claude Perform a multi-dimensional code review:

**Code Quality:**
- Readability and clarity
- Naming conventions
- Code organization
- DRY principle adherence

**Architecture:**
- Design patterns usage
- Separation of concerns
- Dependency management
- Scalability considerations

**Security:**
- Input validation
- Authentication/authorization
- Data protection
- Vulnerability assessment

**Performance:**
- Algorithm efficiency
- Database query optimization
- Caching opportunities
- Resource usage

**Testing:**
- Test coverage
- Test quality
- Edge case handling
- Integration test needs

Be thorough and provide specific recommendations.
```

### Pair Programming with Claude

```
@zen start pair-programming --duration 60m

@claude Let's pair program on implementing this feature.

I'll write the code, you:
1. Review each function as I write it
2. Suggest improvements in real-time
3. Point out potential issues
4. Recommend best practices
5. Help with debugging

Let's work together thoughtfully.
```

## Advanced Patterns

### Pattern 1: Systematic Debugging

```
@zen start debugging --duration 90m

@claude Help me debug this complex issue:

**Problem:**
[DESCRIPTION]

**Symptoms:**
[OBSERVED BEHAVIOR]

**Expected:**
[CORRECT BEHAVIOR]

**Code:**
[RELEVANT CODE]

Let's debug this systematically:
1. Reproduce the issue
2. Analyze the stack trace
3. Identify root cause
4. Propose solutions
5. Implement fix
6. Add regression tests

Walk me through each step.
```

### Pattern 2: Performance Optimization

```
@zen start optimization --duration 60m

@claude This endpoint is slow. Help me optimize it:

**Current performance:**
- Response time: 2.5s
- Database queries: 15
- Memory usage: 500MB

**Code:**
[CODE BLOCK]

Analyze and suggest optimizations for:
1. Database query efficiency
2. N+1 query problems
3. Caching opportunities
4. Algorithm improvements
5. Memory optimization

Explain the impact of each optimization.
```

### Pattern 3: Documentation Sprint

```
@zen start documentation --duration 45m

@claude Help me write comprehensive documentation for this module:

[CODE]

Create:
1. High-level overview
2. API documentation
3. Usage examples
4. Architecture diagrams (in text)
5. Common pitfalls
6. Troubleshooting guide

Make it clear and thorough.
```

## Tips for Zen + Claude

### 1. Ask for Thorough Analysis

```
@zen mindful-review

@claude Don't rush. Take your time to analyze this code thoroughly.
Consider all aspects: security, performance, maintainability, and correctness.
```

### 2. Request Step-by-Step Reasoning

```
@zen start focus --duration 30m

@claude Walk me through this algorithm step by step.
Explain your reasoning at each stage.
```

### 3. Combine with Sequential Thinking

```
@zen start deep-work --duration 90m

@claude @sequential-thinking 

Solve this complex architectural problem:
[PROBLEM DESCRIPTION]

Use sequential thinking to explore the solution space thoroughly.
```

### 4. Use for Code Reviews

```
@zen mindful-review --file src/critical-module.ts

@claude This is a critical security module. 
Review it as if you're conducting a security audit.
Be extremely thorough.
```

## Keyboard Shortcuts

### Neovim

```lua
-- Start mindful review with Claude
<leader>zmc  -- Zen + Claude mindful review

-- Deep work session
<leader>zdc  -- Zen + Claude deep work
```

### VSCode/Cursor

```json
{
  "key": "ctrl+shift+z m",
  "command": "workbench.action.chat.open",
  "args": "@zen mindful-review\n@claude Review this code thoroughly"
}
```

## Best Practices

### 1. Set Context with Zen First

```
@zen start focus --duration 45m

@claude [Your detailed request]
```

### 2. Ask for Comprehensive Analysis

```
@zen mindful-review

@claude Provide a comprehensive analysis, not just a quick review.
```

### 3. Use for Complex Problems

```
@zen start deep-work --duration 120m

@claude [Complex architectural or algorithmic problem]
```

### 4. Request Explanations

```
@claude Don't just give me the code. 
Explain your reasoning and the trade-offs involved.
```

### 5. Combine with Other Tools

```
@zen start focus --duration 60m
@sequential-thinking
@claude

[Complex problem requiring deep analysis]
```

## Sample Conversations

### Example 1: API Design

```
User: @zen start architecture-session --duration 60m

User: @claude Design a RESTful API for a task management system.
Requirements:
- User authentication
- Task CRUD operations
- Task assignments
- Due dates and priorities
- Search and filtering

Be thorough with endpoint design, request/response formats, and error handling.

Claude: [Provides comprehensive API design with detailed explanations]

User: @claude Now help me implement the authentication endpoints with proper security.

Claude: [Provides secure implementation with explanations]
```

### Example 2: Security Review

```
User: @zen mindful-review --file src/api/auth.ts

User: @claude Perform a security audit of this authentication code.
Focus on:
- Token generation and validation
- Password hashing
- Session management
- CSRF protection
- Rate limiting

[CODE]

Claude: [Provides detailed security analysis with specific recommendations]

User: @claude Help me implement your security recommendations.

Claude: [Provides secure implementation with explanations]
```

## Resources

- [Claude Documentation](https://docs.anthropic.com/claude)
- [Zen MCP Server](https://github.com/BeehiveInnovations/zen-mcp-server)
- [More Sample Prompts](./README.md)
- [Sequential Thinking Integration](./zen-sequential-thinking.md)
