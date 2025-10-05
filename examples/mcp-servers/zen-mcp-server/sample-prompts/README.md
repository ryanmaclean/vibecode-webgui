# Zen MCP Server - Sample Prompts

This directory contains example prompts demonstrating how to use Zen MCP Server with various AI coding assistants.

## Prompt Categories

### Focus & Productivity
- [Focus Sessions](./focus-sessions.md)
- [Pomodoro Technique](./pomodoro.md)
- [Deep Work](./deep-work.md)

### Code Quality
- [Mindful Code Review](./code-review.md)
- [Refactoring Sessions](./refactoring.md)
- [Test-Driven Development](./tdd.md)

### AI Assistant Combinations
- [Zen + Codex](./zen-codex.md)
- [Zen + Claude Code](./zen-claude.md)
- [Zen + OpenCode](./zen-opencode.md)
- [Zen + Gemini CLI](./zen-gemini.md)

### Workflow Examples
- [Morning Routine](./workflows/morning-routine.md)
- [Code Review Session](./workflows/code-review.md)
- [Debugging Marathon](./workflows/debugging.md)
- [Learning New Technology](./workflows/learning.md)

## Quick Reference

### Basic Commands

```bash
# Start a focus session
@zen start focus --duration 25m

# Schedule a break
@zen schedule break --in 45m

# Check productivity stats
@zen stats today

# Start pomodoro
@zen pomodoro --cycles 4

# Mindful code review
@zen mindful-review
```

### Combined with AI Assistants

```bash
# With Codex
@zen start focus --duration 30m
@codex implement authentication using JWT

# With Claude
@zen mindful-review
@claude analyze this code for security vulnerabilities

# With OpenCode
@zen pomodoro --cycles 3
@opencode refactor this component using best practices

# With Gemini
@zen check-focus
@gemini suggest optimizations for this algorithm
```

## Prompt Templates

### Template 1: Focused Implementation

```
@zen start focus --duration [DURATION]

Help me implement [FEATURE] in [FILE/MODULE]. 
Let's work methodically through:
1. [STEP 1]
2. [STEP 2]
3. [STEP 3]

Focus on [QUALITY_ASPECT] and [QUALITY_ASPECT].
```

### Template 2: Mindful Review

```
@zen mindful-review --file [FILE_PATH]

Review this code for:
- [ASPECT 1]
- [ASPECT 2]
- [ASPECT 3]

Take your time with each section and provide detailed feedback.
```

### Template 3: Pomodoro Sprint

```
@zen pomodoro --work [WORK_MINS] --break [BREAK_MINS] --cycles [N]

Let's tackle [TASK_LIST] one pomodoro at a time.
Start with [FIRST_TASK].
```

### Template 4: Deep Work Session

```
@zen start deep-work --duration [DURATION] --breaks-disabled

I need to [COMPLEX_TASK]. This requires deep focus.
Let's approach this systematically:
[DETAILED_PLAN]
```

## Usage Tips

### 1. Be Specific with Duration

```
✓ @zen start focus --duration 25m
✗ @zen start focus
```

### 2. Combine Multiple Tools

```
@zen start focus --duration 45m
@sequential-thinking analyze this problem step by step
@claude implement the solution
```

### 3. Use Breaks Strategically

```
@zen schedule break --in 30m --reminder "Review progress"
```

### 4. Track Your Patterns

```
@zen stats --period week --export json
@zen productivity-report --insights
```

## IDE-Specific Examples

### Neovim

```lua
-- Quick command in Avante
<leader>aa
@zen start focus --duration 25m
Help me refactor this authentication module
```

### VSCode/Cursor

```
Ctrl+Shift+Z F  (custom keybinding)
or
@zen start focus --duration 25m
```

### Web-Based IDEs

```
# In chat panel
@zen start remote-work --duration 120m
Let's set up this development environment
```

## Best Practices

### 1. Start Your Day with Zen

```
@zen stats yesterday
@zen start morning-focus --duration 90m
Help me prioritize today's tasks based on complexity
```

### 2. Use Pomodoro for Repetitive Tasks

```
@zen pomodoro --cycles 4
Let's write unit tests for all these components
```

### 3. Deep Work for Complex Problems

```
@zen start deep-work --duration 120m
I need to redesign this entire architecture
```

### 4. Mindful Reviews for Quality

```
@zen mindful-review
Review this pull request thoroughly for:
- Security vulnerabilities
- Performance issues
- Code maintainability
- Test coverage
```

### 5. Regular Breaks for Sustainability

```
@zen schedule break --in 45m --type "stretch"
@zen schedule break --in 90m --type "lunch"
```

## Advanced Patterns

### Pattern 1: Test-Driven Development

```
@zen pomodoro --cycles 6

Cycle 1: Write failing tests for authentication
Cycle 2: Implement authentication logic
Cycle 3: Refactor and optimize
Cycle 4: Write integration tests
Cycle 5: Documentation
Cycle 6: Code review and cleanup
```

### Pattern 2: Learning Session

```
@zen start learning --duration 60m --notes-enabled

Help me understand [NEW_TECHNOLOGY].
Explain concepts one at a time with examples.
I'll take notes after each section.
```

### Pattern 3: Debugging Marathon

```
@zen start debugging --duration 120m --break-frequency 30m

This bug is complex. Let's:
1. Reproduce the issue
2. Analyze the stack trace
3. Identify root cause
4. Implement fix
5. Add regression tests
```

### Pattern 4: Pair Programming

```
@zen start pair-programming --duration 90m

Let's work together on this feature.
I'll write the code, you review in real-time.
Suggest improvements as we go.
```

## Customization

### Create Custom Profiles

```
@zen create-profile morning-routine \
  --duration 90m \
  --break-frequency 30m \
  --notifications on \
  --music "focus-playlist"

@zen start morning-routine
```

### Set Default Preferences

```
@zen config set default-duration 25m
@zen config set break-duration 5m
@zen config set notification-style gentle
```

## Troubleshooting Prompts

### If Zen Isn't Responding

```
@zen status
@zen restart
@zen version
```

### If You Need Help

```
@zen help
@zen help focus
@zen examples
```

## Contributing

Have a great prompt pattern? Add it to this collection:

1. Create a new markdown file in the appropriate category
2. Include clear examples and explanations
3. Test with multiple AI assistants
4. Submit a pull request

## Resources

- [Zen MCP Server Documentation](https://github.com/BeehiveInnovations/zen-mcp-server)
- [MCP Specification](https://modelcontextprotocol.io/)
- [AI Coding Best Practices](../../docs/ai-coding-best-practices.md)
