# Neovim + Avante.nvim User Guide

## Introduction

This guide will help you get started with the Neovim + Avante.nvim template on VibeCode. This template provides a minimal, ultra-fast development environment with Cursor AI-like capabilities.

## What is Avante.nvim?

Avante.nvim is a Neovim plugin that brings Cursor AI IDE functionality to Neovim. It allows you to:

- Ask AI questions about your code
- Edit code using natural language instructions
- Chat with AI for coding assistance
- Get code suggestions and completions

## Getting Started

### Step 1: Create Workspace

1. Log in to VibeCode
2. Click "New Workspace"
3. Select "Neovim + Avante.nvim" template
4. Wait < 3 seconds for provisioning

### Step 2: Configure AI Provider

Choose your preferred AI provider and set the API key:

#### Option A: OpenAI (Recommended)

```bash
export OPENAI_API_KEY="sk-your-key-here"
```

Get your API key from: https://platform.openai.com/api-keys

#### Option B: Anthropic Claude

```bash
export ANTHROPIC_API_KEY="sk-ant-your-key-here"
```

Get your API key from: https://console.anthropic.com/

#### Option C: GitHub Copilot

```bash
export GITHUB_TOKEN="ghp_your-token-here"
```

Get your token from: https://github.com/settings/tokens

### Step 3: Start Neovim

```bash
nvim
```

The editor will start instantly (< 0.1s).

## Basic Usage

### Opening Files

```bash
# Open a file
nvim myfile.py

# Open multiple files
nvim file1.js file2.js

# Open with specific line
nvim +42 myfile.py
```

### Neovim Basics

If you're new to Neovim:

```vim
:Tutor          " Start interactive tutorial
:help           " Open help
:help avante    " Avante.nvim help
```

### Key Bindings

| Key | Action |
|-----|--------|
| `i` | Enter insert mode |
| `Esc` | Exit insert mode |
| `:w` | Save file |
| `:q` | Quit |
| `:wq` | Save and quit |
| `<Space>aa` | Avante Ask |
| `<Space>ae` | Avante Edit |
| `<Space>ac` | Avante Chat |

## Using Avante.nvim

### Asking Questions

Ask AI about your code:

```vim
:AvanteAsk How does this function work?
:AvanteAsk What's the time complexity?
:AvanteAsk Are there any bugs in this code?
```

Or use the shortcut:
```
<Space>aa
```

### Editing with AI

Edit code using natural language:

```vim
:AvanteEdit Add error handling
:AvanteEdit Refactor to use async/await
:AvanteEdit Add type hints and docstrings
:AvanteEdit Optimize for performance
```

Or use the shortcut:
```
<Space>ae
```

### AI Chat

Open an interactive chat with AI:

```vim
:AvanteChat
```

Or use the shortcut:
```
<Space>ac
```

### Example Workflow

1. Open a Python file:
   ```bash
   nvim calculator.py
   ```

2. Write some code:
   ```python
   def add(a, b):
       return a + b
   ```

3. Ask AI for improvements:
   ```vim
   :AvanteAsk How can I improve this function?
   ```

4. Apply AI suggestions:
   ```vim
   :AvanteEdit Add type hints and error handling
   ```

5. Result:
   ```python
   def add(a: float, b: float) -> float:
       """Add two numbers together.
       
       Args:
           a: First number
           b: Second number
           
       Returns:
           Sum of a and b
           
       Raises:
           TypeError: If inputs are not numbers
       """
       if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
           raise TypeError("Both arguments must be numbers")
       return a + b
   ```

## Advanced Features

### Custom AI Configuration

Edit `~/.config/nvim/init.lua`:

```lua
require("lazy").setup({
  {
    "yetone/avante.nvim",
    opts = {
      provider = "openai",
      openai = {
        endpoint = "https://api.openai.com/v1",
        model = "gpt-4",
        temperature = 0.2,
        max_tokens = 4096,
      },
      -- Custom mappings
      mappings = {
        ask = "<leader>aa",
        edit = "<leader>ae",
        refresh = "<leader>ar",
        chat = "<leader>ac",
      },
    },
  },
})
```

### Using Different Models

```lua
-- GPT-4 (best quality, slower)
model = "gpt-4"

-- GPT-3.5 Turbo (faster, cheaper)
model = "gpt-3.5-turbo"

-- Claude 3 Opus (best for code)
model = "claude-3-opus-20240229"

-- Claude 3 Sonnet (balanced)
model = "claude-3-sonnet-20240229"
```

### Temperature Settings

```lua
-- More creative (0.7-1.0)
temperature = 0.8

-- Balanced (0.3-0.7)
temperature = 0.5

-- More deterministic (0.0-0.3)
temperature = 0.1
```

### Installing Additional Plugins

```lua
require("lazy").setup({
  -- Existing plugins
  
  -- File explorer
  {
    "nvim-tree/nvim-tree.lua",
    dependencies = { "nvim-tree/nvim-web-devicons" },
  },
  
  -- Fuzzy finder
  {
    "nvim-telescope/telescope.nvim",
    dependencies = { "nvim-lua/plenary.nvim" },
  },
  
  -- Git integration
  {
    "lewis6991/gitsigns.nvim",
    config = function()
      require("gitsigns").setup()
    end,
  },
})
```

## Common Use Cases

### 1. Code Review

```vim
" Select code in visual mode (V)
" Then ask AI
:AvanteAsk Review this code for bugs and improvements
```

### 2. Refactoring

```vim
:AvanteEdit Refactor this function to be more modular
:AvanteEdit Extract this logic into a separate function
:AvanteEdit Apply SOLID principles
```

### 3. Documentation

```vim
:AvanteEdit Add comprehensive docstrings
:AvanteEdit Add inline comments explaining the logic
:AvanteEdit Generate README documentation
```

### 4. Testing

```vim
:AvanteEdit Write unit tests for this function
:AvanteEdit Add edge case tests
:AvanteEdit Generate test fixtures
```

### 5. Debugging

```vim
:AvanteAsk Why is this function returning None?
:AvanteAsk What's causing this error?
:AvanteEdit Add debugging print statements
```

### 6. Learning

```vim
:AvanteAsk Explain how this algorithm works
:AvanteAsk What design pattern is this using?
:AvanteAsk How can I optimize this code?
```

## Tips and Tricks

### 1. Context Matters

Avante.nvim uses the current buffer as context. For best results:
- Keep related code in the same file
- Use clear variable and function names
- Add comments for complex logic

### 2. Be Specific

Instead of:
```vim
:AvanteEdit Make this better
```

Try:
```vim
:AvanteEdit Improve error handling and add input validation
```

### 3. Iterative Refinement

You can ask follow-up questions:
```vim
:AvanteAsk How does this work?
" Read the response
:AvanteAsk Can you explain the algorithm in more detail?
```

### 4. Use Visual Selection

Select code in visual mode (V) before asking:
```vim
" Select lines 10-20
:10,20AvanteAsk What does this code do?
```

### 5. Save AI Responses

AI responses are shown in a split window. You can:
- Copy useful parts
- Save to a file
- Reference later

## Troubleshooting

### AI Not Responding

**Problem**: Avante commands don't work

**Solutions**:
1. Check API key is set:
   ```bash
   echo $OPENAI_API_KEY
   ```

2. Verify network connectivity:
   ```bash
   ping api.openai.com
   ```

3. Check Neovim health:
   ```vim
   :checkhealth avante
   ```

### Slow Responses

**Problem**: AI takes too long to respond

**Solutions**:
1. Use faster model (gpt-3.5-turbo)
2. Reduce max_tokens
3. Lower temperature
4. Check network speed

### Plugin Installation Failed

**Problem**: Lazy.nvim can't install plugins

**Solutions**:
1. Check Git is working:
   ```bash
   git --version
   ```

2. Manually sync:
   ```vim
   :Lazy sync
   ```

3. Check network:
   ```bash
   ping github.com
   ```

### Out of Memory

**Problem**: System runs out of memory

**Solutions**:
1. Close other applications
2. Reduce buffer size
3. Use smaller AI model
4. Restart Neovim

## Performance Optimization

### Startup Time

Already optimized to < 0.1s. To verify:
```bash
nvim --startuptime startup.log
```

### AI Response Time

Typical response times:
- Simple queries: 1-2s
- Code edits: 2-5s
- Complex analysis: 5-10s

To improve:
1. Use faster model
2. Reduce max_tokens
3. Lower temperature
4. Better network connection

### Memory Usage

Typical memory usage:
- Idle: ~50 MB
- With file: ~100 MB
- AI active: ~200 MB

To reduce:
1. Close unused buffers
2. Limit plugin count
3. Use smaller models

## Keyboard Shortcuts Reference

### Neovim Basics

| Key | Mode | Action |
|-----|------|--------|
| `i` | Normal | Insert mode |
| `a` | Normal | Append mode |
| `v` | Normal | Visual mode |
| `V` | Normal | Visual line mode |
| `Esc` | Any | Normal mode |
| `:w` | Normal | Save |
| `:q` | Normal | Quit |
| `:wq` | Normal | Save and quit |
| `u` | Normal | Undo |
| `Ctrl+r` | Normal | Redo |
| `dd` | Normal | Delete line |
| `yy` | Normal | Copy line |
| `p` | Normal | Paste |

### Avante.nvim

| Key | Action |
|-----|--------|
| `<Space>aa` | Ask AI |
| `<Space>ae` | Edit with AI |
| `<Space>ac` | Chat with AI |
| `<Space>ar` | Refresh/Clear |
| `<Space>at` | Toggle panel |

### Navigation

| Key | Action |
|-----|--------|
| `h` | Left |
| `j` | Down |
| `k` | Up |
| `l` | Right |
| `gg` | Go to top |
| `G` | Go to bottom |
| `0` | Start of line |
| `$` | End of line |
| `w` | Next word |
| `b` | Previous word |

## Resources

### Documentation
- [Avante.nvim GitHub](https://github.com/yetone/avante.nvim)
- [Neovim Documentation](https://neovim.io/doc/)
- [Vim Tutorial](https://www.openvim.com/)

### Video Tutorials
- [Neovim from Scratch](https://www.youtube.com/results?search_query=neovim+from+scratch)
- [Avante.nvim Demo](https://github.com/yetone/avante.nvim#demo)

### Community
- [Neovim Discourse](https://neovim.discourse.group/)
- [r/neovim](https://reddit.com/r/neovim)
- [VibeCode Community](https://github.com/ryanmaclean/vibecode-webgui/discussions)

## Next Steps

1. **Master Neovim Basics**: Complete `:Tutor`
2. **Explore Avante.nvim**: Try different AI commands
3. **Customize**: Edit `~/.config/nvim/init.lua`
4. **Add Plugins**: Install useful plugins via Lazy.nvim
5. **Share**: Contribute improvements back to VibeCode

## Support

Need help?

- **VibeCode Issues**: [GitHub Issues](https://github.com/ryanmaclean/vibecode-webgui/issues)
- **Avante.nvim Issues**: [Avante Issues](https://github.com/yetone/avante.nvim/issues)
- **Documentation**: [VibeCode Docs](../../)

---

**Happy Coding with AI! 🚀**
