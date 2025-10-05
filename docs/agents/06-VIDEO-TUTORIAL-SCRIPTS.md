# OpenAI Agents Video Tutorial Scripts

**Version**: 1.0.0
**Last Updated**: 2025-10-02
**Target Audience**: New Users, Developers

## Table of Contents

1. [Tutorial 1: Getting Started (5 minutes)](#tutorial-1-getting-started)
2. [Tutorial 2: Agent Types Deep Dive (8 minutes)](#tutorial-2-agent-types-deep-dive)
3. [Tutorial 3: Real-Time Monitoring (6 minutes)](#tutorial-3-real-time-monitoring)
4. [Tutorial 4: Advanced Configuration (10 minutes)](#tutorial-4-advanced-configuration)
5. [Tutorial 5: Troubleshooting Common Issues (7 minutes)](#tutorial-5-troubleshooting-common-issues)
6. [Tutorial 6: API Integration (12 minutes)](#tutorial-6-api-integration)

---

## Tutorial 1: Getting Started

**Duration**: 5 minutes
**Skill Level**: Beginner
**Prerequisites**: VibeCode account

### Script

#### Introduction (30 seconds)

"Welcome to VibeCode OpenAI Agents! In this tutorial, you'll learn how to create your first AI coding agent in under 5 minutes.

By the end of this video, you'll know how to:
- Access the Agents dashboard
- Choose the right agent for your task
- Start and monitor an agent
- View and apply agent results

Let's get started!"

#### Step 1: Access Agents Dashboard (45 seconds)

"First, log into your VibeCode workspace.

[SCREEN: Show VibeCode login]

From the sidebar, click on 'Agents' to open the Agents dashboard.

[SCREEN: Click Agents in sidebar]

Here you'll see:
- Active agents count
- Available agent types
- Quick start buttons
- Recent agent history

[SCREEN: Point to each section]

Let's create our first agent!"

#### Step 2: Choose Agent Type (1 minute)

"VibeCode supports three types of agents:

**Aider** [SCREEN: Click Aider card]
Best for code editing and refactoring. Great when you need to modify existing files.

**Goose** [SCREEN: Show Goose card]
Specialized in code review and analysis. Perfect for security audits and quality checks.

**Cline** [SCREEN: Show Cline card]
General-purpose coding assistant. Versatile for various development tasks.

For this tutorial, we'll use Aider to add error handling to a function.

[SCREEN: Click 'Create Aider Agent']"

#### Step 3: Configure Agent (1 minute 30 seconds)

"Now let's configure our agent.

**Workspace** [SCREEN: Show workspace field]
Select your project workspace. This is where the agent will work.

[SCREEN: Select '/home/coder/workspace/my-project']

**Files** [SCREEN: Show files selector]
Choose which files the agent should focus on. You can select up to 50 files.

[SCREEN: Select 'src/auth.py']

For now, let's just select our authentication file.

**Model** [SCREEN: Show model dropdown]
Choose your AI model. Claude 3.5 Sonnet is recommended for complex tasks.

[SCREEN: Select 'claude-3-5-sonnet-20241022']

**Task Description** [SCREEN: Show task textbox]
Be specific about what you want. Good task descriptions get better results.

[SCREEN: Type: 'Add comprehensive error handling to the login function. Include try-catch blocks for network errors and invalid credentials. Add logging for failed attempts.']

Notice how we:
- Clearly stated the goal
- Specified what to include
- Mentioned additional requirements

[SCREEN: Click 'Start Agent']"

#### Step 4: Monitor Progress (1 minute)

"Great! Your agent is now running.

[SCREEN: Show agent status panel]

The dashboard shows:
- Real-time output from the agent
- Current status and progress
- Resource usage (CPU, memory)
- Elapsed time

[SCREEN: Point to each metric]

Watch as the agent:
- Analyzes your code
- Plans the changes
- Implements error handling
- Runs tests

[SCREEN: Show scrolling output]

You can send messages to guide the agent at any time.

[SCREEN: Type message 'Please also add timeout handling']

The agent will incorporate your feedback in real-time!"

#### Step 5: Review Results (45 seconds)

"Perfect! The agent has completed the task.

[SCREEN: Show completion notification]

You can now:
- Review the changes made
- See before/after comparisons
- Run the updated code
- Accept or reject changes

[SCREEN: Show diff viewer]

The agent added:
- Try-catch blocks
- Network error handling
- Credential validation
- Logging for failed attempts
- Timeout handling (from our feedback!)

[SCREEN: Click 'Accept Changes']"

#### Conclusion (15 seconds)

"That's it! You've successfully created and run your first AI coding agent.

In the next tutorial, we'll explore each agent type in detail and learn when to use each one.

Thanks for watching!"

#### On-Screen Text Summary

```
Getting Started with OpenAI Agents
1. Access Agents Dashboard
2. Choose Agent Type (Aider, Goose, Cline)
3. Configure:
   - Workspace
   - Files
   - Model
   - Task
4. Monitor Real-Time Progress
5. Review and Apply Results

Next: Agent Types Deep Dive
```

---

## Tutorial 2: Agent Types Deep Dive

**Duration**: 8 minutes
**Skill Level**: Beginner to Intermediate
**Prerequisites**: Tutorial 1

### Script

#### Introduction (30 seconds)

"Welcome back! In this tutorial, we'll dive deep into each agent type to help you choose the right one for your task.

We'll cover:
- Aider for code editing
- Goose for code review
- Cline for general tasks
- When to use each agent
- Best practices for each type

Let's explore!"

#### Aider: The Code Editor (2 minutes)

"Let's start with Aider, your intelligent code editing assistant.

[SCREEN: Show Aider overview]

**Best For:**
- Refactoring code
- Adding new features
- Updating existing functions
- Git-aware changes

[SCREEN: Show use case examples]

**Unique Features:**
- Understands git history
- Can modify multiple files atomically
- Suggests commit messages
- Preserves code style

**Demo: Refactoring Example**

[SCREEN: Show code before]

Let's refactor a monolithic function into smaller modules.

[SCREEN: Create Aider agent with task: 'Refactor the UserManager class into separate modules for authentication, validation, and storage']

Watch as Aider:
1. Analyzes the existing structure
2. Creates new module files
3. Moves related functions
4. Updates imports
5. Preserves functionality

[SCREEN: Show agent progress]

**Result:**

[SCREEN: Show refactored structure]

Three clean modules with:
- Clear separation of concerns
- Proper imports
- Original functionality intact
- Improved testability

**Best Practices:**
- Be specific about file locations
- Mention style preferences
- Include test requirements
- Specify git commit strategy"

#### Goose: The Code Reviewer (2 minutes)

"Next up is Goose, your AI code reviewer.

[SCREEN: Show Goose overview]

**Best For:**
- Security audits
- Performance analysis
- Code quality reviews
- Best practice checks

[SCREEN: Show use case examples]

**Unique Features:**
- Multi-language analysis
- Security vulnerability detection
- Performance bottleneck identification
- Detailed recommendations

**Demo: Security Review**

[SCREEN: Show vulnerable code]

Here's an API endpoint with potential security issues.

[SCREEN: Create Goose agent with task: 'Perform a comprehensive security audit of the authentication endpoints']

Goose will:
1. Check for SQL injection vulnerabilities
2. Verify input validation
3. Review authentication logic
4. Check for sensitive data exposure

[SCREEN: Show analysis output]

**Report Generated:**

[SCREEN: Show security report]

Goose found:
- 🚨 Critical: SQL injection in login endpoint
- ⚠️ Warning: Missing rate limiting
- ℹ️ Info: Consider using prepared statements
- ✅ Good: Password hashing implemented correctly

Each issue includes:
- Severity level
- Code location
- Explanation
- Remediation steps

[SCREEN: Show specific issue detail]

**Best Practices:**
- Include multiple related files
- Specify focus areas (security, performance, style)
- Request actionable recommendations
- Run regularly as part of CI/CD"

#### Cline: The Versatile Assistant (2 minutes)

"Finally, meet Cline, your versatile coding companion.

[SCREEN: Show Cline overview]

**Best For:**
- Documentation generation
- Test creation
- Bug investigation
- General coding tasks

[SCREEN: Show use case examples]

**Unique Features:**
- Flexible task handling
- Multi-step workflows
- Context-aware suggestions
- Language agnostic

**Demo: Documentation Generation**

[SCREEN: Show undocumented code]

Let's generate comprehensive documentation.

[SCREEN: Create Cline agent with task: 'Generate JSDoc comments for all public APIs. Include usage examples, parameter descriptions, and return types.']

Cline will:
1. Analyze each function
2. Generate JSDoc comments
3. Add usage examples
4. Document edge cases

[SCREEN: Show documentation being added]

**Result:**

[SCREEN: Show documented code]

Professional documentation with:
- Clear function descriptions
- Parameter documentation
- Return type information
- Usage examples
- Edge case notes

**Demo: Test Generation**

[SCREEN: Create Cline agent with task: 'Generate comprehensive unit tests for the StringUtils module. Aim for 90%+ coverage.']

Watch Cline create:
- Happy path tests
- Edge case tests
- Error handling tests
- Integration tests

[SCREEN: Show generated tests]

**Best Practices:**
- Break complex tasks into steps
- Provide context about project structure
- Mention specific frameworks or tools
- Include quality criteria (coverage, documentation level)"

#### Choosing the Right Agent (1 minute 30 seconds)

"So which agent should you use?

[SCREEN: Show decision tree]

**Use Aider when:**
- ✅ Modifying existing code
- ✅ Refactoring
- ✅ Adding features
- ✅ Git integration needed

**Use Goose when:**
- ✅ Code review required
- ✅ Security audit needed
- ✅ Performance analysis
- ✅ Quality assessment

**Use Cline when:**
- ✅ Documentation needed
- ✅ Tests needed
- ✅ General coding tasks
- ✅ Multi-step workflows

[SCREEN: Show example scenarios]

**Scenario 1:** 'I need to add authentication to my API'
→ Use **Aider** (code modification)

**Scenario 2:** 'Is my code secure?'
→ Use **Goose** (security audit)

**Scenario 3:** 'I need comprehensive tests'
→ Use **Cline** (test generation)

**Pro Tip:** You can use multiple agents in sequence!

[SCREEN: Show workflow diagram]

1. **Aider** implements feature
2. **Cline** generates tests
3. **Goose** reviews for issues"

#### Conclusion (30 seconds)

"Now you know when to use each agent type!

Remember:
- Aider for editing
- Goose for reviewing
- Cline for versatile tasks

In the next tutorial, we'll explore real-time monitoring and how to guide agents during execution.

Thanks for watching!"

---

## Tutorial 3: Real-Time Monitoring

**Duration**: 6 minutes
**Skill Level**: Intermediate
**Prerequisites**: Tutorials 1 & 2

### Script

#### Introduction (30 seconds)

"Welcome! In this tutorial, you'll learn how to effectively monitor and guide your agents in real-time.

Topics covered:
- Understanding agent output
- Monitoring progress and metrics
- Interacting with running agents
- Troubleshooting issues
- Best practices for monitoring

Let's dive in!"

#### Understanding Agent Output (1 minute 30 seconds)

"When an agent starts, you'll see real-time output in the monitor panel.

[SCREEN: Show agent output panel]

**Output Types:**

**1. Status Messages** [SCREEN: Highlight status line]
```
[Agent] Analyzing code structure...
[Agent] Planning changes...
[Agent] Implementing solution...
```
These show high-level progress.

**2. Code Analysis** [SCREEN: Highlight analysis]
```
Found 3 functions to modify
Identified 2 dependencies
Tests detected: 5 files
```
Detailed information about findings.

**3. Actions Taken** [SCREEN: Highlight actions]
```
Modified: src/auth.py
Created: tests/test_auth.py
Updated: requirements.txt
```
Real-time file changes.

**4. Warnings & Errors** [SCREEN: Highlight warning]
```
⚠️ Warning: Function complexity high
🚨 Error: Import not found
```
Issues requiring attention.

**Reading Output Effectively:**

[SCREEN: Show full output scroll]

Notice the logical flow:
1. Analysis phase
2. Planning phase
3. Implementation phase
4. Verification phase

Each phase provides different information to help you understand what the agent is doing."

#### Progress and Resource Metrics (1 minute 30 seconds)

"The metrics panel shows important performance data.

[SCREEN: Show metrics panel]

**Progress Indicator**
[SCREEN: Point to progress bar]
- Shows task completion (0-100%)
- Updates in real-time
- Based on agent's self-assessment

**Resource Usage**
[SCREEN: Point to resource metrics]

**CPU Usage:** [SCREEN: Show CPU graph]
- Normal: 20-50%
- High: 50-80%
- Very High: 80-100% (may indicate issues)

**Memory Usage:** [SCREEN: Show memory graph]
- Typical: 200-500 MB
- High: 500-1000 MB
- Critical: >1000 MB (may need restart)

**Uptime:** [SCREEN: Point to timer]
- How long agent has been running
- Useful for timeout tracking

**Warning Signs:**

[SCREEN: Show problematic metrics]

🚨 **High CPU (>80%) + No Output**
→ Agent may be stuck

🚨 **Memory Climbing Steadily**
→ Possible memory leak

🚨 **No Progress Update for 5+ minutes**
→ Task may be too complex

[SCREEN: Show normal metrics for comparison]"

#### Interacting with Running Agents (1 minute 30 seconds)

"You can guide agents during execution using the message panel.

[SCREEN: Show message input]

**Use Cases:**

**1. Request Status Update**
[SCREEN: Type message]
```
Please provide a status update
```

Agent responds:
```
[Agent] Currently implementing error handling for login function.
Completed: authentication validation
In Progress: network error handling
Remaining: timeout handling, logging
```

**2. Provide Clarification**
[SCREEN: Show agent asking question]
```
[Agent] Should I add logging for successful logins too?
```

[SCREEN: Type response]
```
Yes, log all login attempts with timestamp and user ID
```

**3. Request Changes**
[SCREEN: Type message]
```
Please also add rate limiting to prevent brute force attacks
```

Agent incorporates the request:
```
[Agent] Understood. Adding rate limiting middleware...
```

**4. Debug Issues**
[SCREEN: Show error in output]
```
[Agent] Error: Module 'redis' not found
```

[SCREEN: Type message]
```
Please add redis to requirements.txt and use mock for tests
```

**Best Practices:**
- ✅ Be clear and specific
- ✅ One request at a time
- ✅ Wait for agent to respond
- ❌ Don't flood with messages
- ❌ Don't contradict yourself"

#### Troubleshooting in Real-Time (1 minute)

"If you notice issues, act quickly.

**Issue 1: No Output**
[SCREEN: Show stalled output]

Actions:
1. Check CPU/memory metrics
2. Send status request
3. If no response after 2 minutes, restart

[SCREEN: Click restart button]

**Issue 2: Incorrect Direction**
[SCREEN: Show agent heading wrong way]

```
[Agent] Removing the authentication function...
```

Immediately intervene:
[SCREEN: Type message]
```
STOP - Do not remove authentication. Instead, enhance it with error handling.
```

**Issue 3: Timeout Warning**
[SCREEN: Show timeout notification]

```
⚠️ Agent will timeout in 2 minutes
```

Options:
1. Send message: 'Please prioritize main changes'
2. Extend timeout (if available)
3. Let complete and review partial results

[SCREEN: Show options]"

#### Best Practices (45 seconds)

"**Monitoring Best Practices:**

1. **Watch First 30 Seconds**
   - Verify agent understands task
   - Check if approaching correctly
   - Intervene early if needed

2. **Check Progress Every 2 Minutes**
   - Verify still making progress
   - Review recent changes
   - Monitor resource usage

3. **Stay Available**
   - Agent may ask questions
   - Quick responses improve results
   - Faster iteration cycles

4. **Save Output**
   - Copy important messages
   - Document decisions made
   - Useful for future reference

[SCREEN: Show monitoring checklist]"

#### Conclusion (15 seconds)

"You now know how to effectively monitor and guide your agents!

Next tutorial: Advanced configuration options for power users.

Thanks for watching!"

---

## Tutorial 4: Advanced Configuration

**Duration**: 10 minutes
**Skill Level**: Advanced
**Prerequisites**: Tutorials 1-3

### Script

(This tutorial covers advanced topics like custom models, workspace configuration, rate limiting, batch operations, and performance tuning)

[Due to length constraints, I'll create a summary. Full scripts available on request]

**Topics:**
- Custom model integration
- Workspace templates
- File pattern matching
- Advanced task descriptions
- Concurrent agent management
- Rate limit optimization
- Performance tuning
- Custom error handling
- Integration with CI/CD

---

## Tutorial 5: Troubleshooting Common Issues

**Duration**: 7 minutes
**Skill Level**: Intermediate
**Prerequisites**: Tutorials 1-3

### Script

(Covers common problems users face and step-by-step solutions)

**Topics:**
- Agent won't start
- Connection issues
- Stuck agents
- Rate limiting
- Memory problems
- Unexpected behavior
- Debug tools
- Support resources

---

## Tutorial 6: API Integration

**Duration**: 12 minutes
**Skill Level**: Advanced
**Prerequisites**: All previous tutorials

### Script

(Developer-focused tutorial on integrating agents into applications)

**Topics:**
- REST API overview
- Authentication setup
- Making API calls
- SSE streaming
- WebSocket communication
- Error handling
- Rate limiting strategies
- SDK usage
- Example applications

---

## Production Notes

### Video Requirements

**Technical Specs:**
- Resolution: 1920x1080 (1080p)
- Frame Rate: 30 fps
- Format: MP4 (H.264)
- Audio: 128 kbps AAC

**Screen Recording:**
- Use high-contrast theme
- Font size: 14-16pt
- Highlight cursor
- Zoom to relevant sections
- Hide sensitive information

**Audio:**
- Clear narration
- No background noise
- Consistent volume
- Professional microphone recommended

### Editing Guidelines

**Transitions:**
- Fade between major sections
- Quick cuts within demos
- No distracting effects

**Text Overlays:**
- Key points
- Commands/code
- URLs and resources
- Timestamps for chapters

**Pacing:**
- 150-160 words per minute
- Pause after code examples
- Allow time to read output
- Not too fast for beginners

### Accessibility

**Captions:**
- Auto-generate from script
- Review for accuracy
- Include code in captions
- Sync timing carefully

**Descriptions:**
- Describe visual actions
- Explain what's on screen
- Verbalize code changes
- Describe metrics/graphs

---

## Distribution

### Platforms

- YouTube (primary)
- Vimeo (backup)
- Documentation site (embedded)
- LMS (if applicable)

### Metadata

**Title Format:**
```
VibeCode Agents Tutorial #N: [Topic] | [Duration]
```

**Description Template:**
```
Learn [topic] in this [duration] tutorial for VibeCode OpenAI Agents.

🎯 Topics Covered:
• [Topic 1]
• [Topic 2]
• [Topic 3]

📚 Resources:
• Documentation: [link]
• API Reference: [link]
• Code Examples: [link]

⏱ Timestamps:
00:00 - Introduction
01:30 - [Section 1]
...

👉 Next Tutorial: [link]
```

**Tags:**
```
VibeCode, AI Agents, OpenAI, Claude, GPT, coding assistant,
code review, refactoring, automation, development tools
```

---

## Next Steps

- [User Guide](./01-USER-GUIDE.md)
- [API Reference](./02-API-REFERENCE.md)
- [FAQ](./07-FAQ.md)
