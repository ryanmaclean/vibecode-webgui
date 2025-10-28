# Zen + Codex (GitHub Copilot) - Sample Prompts

Examples of using Zen MCP Server with GitHub Copilot (Codex) for enhanced AI-assisted development.

## Overview

Combining Zen's focus management with Copilot's code suggestions creates a powerful workflow:
- **Zen** manages your focus, breaks, and productivity
- **Copilot** provides intelligent code completions and suggestions

## Basic Combinations

### 1. Focused Implementation with Copilot

```
@zen start focus --duration 30m

// Copilot will provide suggestions while Zen manages your focus
// Implement authentication middleware
function authenticateUser(req, res, next) {
  // Copilot suggests: const token = req.headers.authorization?.split(' ')[1];
}
```

**What Happens:**
- Zen starts a 30-minute focus timer
- Copilot provides code suggestions as you type
- Zen reminds you when the session ends

### 2. Pomodoro with Code Generation

```
@zen pomodoro --work 25 --break 5 --cycles 4

// Cycle 1: Write user model
// Copilot assists with model definition
class User {
  // Copilot suggests properties and methods
}

// Cycle 2: Write user controller
// Copilot assists with CRUD operations

// Cycle 3: Write tests
// Copilot suggests test cases

// Cycle 4: Refactor and document
```

**Benefits:**
- Structured work intervals
- Natural breaks between implementation phases
- Copilot suggestions remain available throughout

### 3. Deep Work with Complex Features

```
@zen start deep-work --duration 120m --breaks-disabled

// Implementing OAuth2 authentication flow
// Copilot provides detailed implementation suggestions
// Zen ensures uninterrupted focus for complex logic
```

## Advanced Workflows

### Workflow 1: Test-Driven Development

```
@zen pomodoro --cycles 6 --work 25 --break 5

// Pomodoro 1: Write failing tests
describe('Authentication', () => {
  it('should authenticate valid users', () => {
    // Copilot suggests test implementation
  });
});

// Pomodoro 2: Implement authentication
function authenticate(credentials) {
  // Copilot suggests implementation
}

// Pomodoro 3: Make tests pass
// Copilot helps fix failing tests

// Pomodoro 4: Refactor
// Copilot suggests improvements

// Pomodoro 5: Add edge cases
// Copilot suggests additional tests

// Pomodoro 6: Documentation
// Copilot generates JSDoc comments
```

### Workflow 2: API Development

```
@zen start focus --duration 45m

// Create RESTful API endpoints
// Copilot suggests route handlers, middleware, and error handling

// GET /api/users
app.get('/api/users', async (req, res) => {
  // Copilot suggests: try { const users = await User.find(); res.json(users); }
});

// POST /api/users
app.post('/api/users', async (req, res) => {
  // Copilot suggests validation and creation logic
});

// Zen manages focus while Copilot accelerates implementation
```

### Workflow 3: Refactoring Session

```
@zen mindful-review --file src/legacy-code.js

// Review this legacy code with Copilot's help
// Copilot suggests modern patterns and improvements

// Old code:
function processData(data) {
  var result = [];
  for (var i = 0; i < data.length; i++) {
    result.push(data[i] * 2);
  }
  return result;
}

// Copilot suggests:
const processData = (data) => data.map(item => item * 2);

// Zen ensures thorough, mindful review
// Copilot provides modernization suggestions
```

## Productivity Patterns

### Pattern 1: Morning Coding Session

```
@zen start morning-focus --duration 90m

// Check yesterday's progress
@zen stats yesterday

// Start with Copilot-assisted implementation
// 1. Review TODOs (Copilot suggests next steps)
// 2. Implement high-priority features (Copilot accelerates)
// 3. Write tests (Copilot generates test cases)

// Zen ensures sustained focus
// Copilot maintains high velocity
```

### Pattern 2: Bug Fixing Sprint

```
@zen start debugging --duration 60m --break-frequency 20m

// Fix critical bugs with Copilot's assistance
// 1. Reproduce bug (Copilot suggests test cases)
// 2. Analyze root cause (Copilot highlights patterns)
// 3. Implement fix (Copilot suggests solutions)
// 4. Add regression tests (Copilot generates tests)

// Zen provides structured breaks
// Copilot speeds up debugging
```

### Pattern 3: Feature Development

```
@zen pomodoro --cycles 8

// Complete feature from start to finish
// Pomodoro 1-2: Design and planning
// Pomodoro 3-5: Implementation (Copilot assists)
// Pomodoro 6: Testing (Copilot generates tests)
// Pomodoro 7: Documentation (Copilot writes docs)
// Pomodoro 8: Code review and cleanup

// Zen structures the workflow
// Copilot accelerates each phase
```

## Code Quality with Zen + Copilot

### Security-Focused Development

```
@zen start security-review --duration 45m

// Implement authentication with security in mind
// Copilot suggests secure patterns

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

async function hashPassword(password) {
  // Copilot suggests: return bcrypt.hash(password, 10);
}

async function verifyPassword(password, hash) {
  // Copilot suggests: return bcrypt.compare(password, hash);
}

function generateToken(userId) {
  // Copilot suggests secure token generation
}

// Zen ensures thorough security review
// Copilot provides security best practices
```

### Performance Optimization

```
@zen start optimization --duration 60m

// Optimize database queries with Copilot
// Copilot suggests efficient patterns

// Before (Copilot identifies N+1 query)
const users = await User.findAll();
for (const user of users) {
  user.posts = await Post.findAll({ where: { userId: user.id } });
}

// After (Copilot suggests eager loading)
const users = await User.findAll({
  include: [{ model: Post }]
});

// Zen maintains focus on optimization
// Copilot suggests performance improvements
```

## Tips for Zen + Copilot

### 1. Use Zen for Focus, Copilot for Speed

```
@zen start focus --duration 25m

// Let Copilot handle boilerplate
// Focus your attention on business logic
// Zen ensures you stay in flow state
```

### 2. Take Mindful Breaks

```
@zen schedule break --in 30m --type "stretch"

// Copilot works best when you're fresh
// Zen ensures regular breaks
// Return to coding refreshed
```

### 3. Review Copilot Suggestions Mindfully

```
@zen mindful-review

// Don't blindly accept Copilot suggestions
// Zen encourages thoughtful review
// Ensure code quality and understanding
```

### 4. Track Productivity Patterns

```
@zen stats --period week

// See when Copilot + Zen is most effective
// Adjust your schedule accordingly
// Optimize your workflow
```

## Keyboard Shortcuts

### Neovim

```lua
-- Start focus with Copilot enabled
<leader>zc  -- Zen + Copilot focus session

-- Accept Copilot suggestion during focus
<Tab>       -- Accept suggestion
<C-]>       -- Dismiss suggestion
```

### VSCode

```json
// Custom keybindings
{
  "key": "ctrl+shift+z c",
  "command": "workbench.action.chat.open",
  "args": "@zen start focus --duration 25m"
}
```

## Troubleshooting

### Copilot Not Responding During Zen Session

```
// Copilot is independent of Zen
// If Copilot stops working:
1. Check Copilot status in IDE
2. Restart Copilot service
3. Zen session continues unaffected
```

### Too Many Distractions

```
@zen start deep-work --duration 90m --notifications off

// Disable all notifications
// Focus solely on Copilot suggestions
// Minimize context switching
```

## Best Practices

1. **Start with Zen, then code with Copilot**
   ```
   @zen start focus --duration 30m
   // Now use Copilot suggestions
   ```

2. **Use Pomodoro for sustained productivity**
   ```
   @zen pomodoro --cycles 4
   // Copilot assists during work intervals
   ```

3. **Review Copilot code mindfully**
   ```
   @zen mindful-review
   // Carefully review all Copilot suggestions
   ```

4. **Track your productivity**
   ```
   @zen stats today
   // See how Zen + Copilot affects output
   ```

## Resources

- [GitHub Copilot Documentation](https://docs.github.com/copilot)
- [Zen MCP Server](https://github.com/BeehiveInnovations/zen-mcp-server)
- [More Sample Prompts](./README.md)
