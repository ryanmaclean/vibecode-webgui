# Zen MCP Server - Neovim Configuration

Integration guide for using Zen MCP Server with Neovim and Avante.nvim.

## Prerequisites

- Neovim >= 0.9.0
- [Avante.nvim](https://github.com/yetone/avante.nvim) plugin installed
- Node.js >= 18.0.0

## Installation

### 1. Install Avante.nvim

Using [lazy.nvim](https://github.com/folke/lazy.nvim):

```lua
-- In your plugins configuration (e.g., ~/.config/nvim/lua/plugins/avante.lua)
return {
  "yetone/avante.nvim",
  event = "VeryLazy",
  lazy = false,
  version = false,
  opts = {
    -- Configuration will be added below
  },
  build = "make",
  dependencies = {
    "nvim-treesitter/nvim-treesitter",
    "stevearc/dressing.nvim",
    "nvim-lua/plenary.nvim",
    "MunifTanjim/nui.nvim",
    "nvim-tree/nvim-web-devicons",
  },
}
```

### 2. Configure MCP Servers

Add Zen MCP Server to your Avante configuration:

```lua
-- In ~/.config/nvim/lua/plugins/avante.lua
return {
  "yetone/avante.nvim",
  event = "VeryLazy",
  opts = {
    provider = "claude", -- or "openai", "copilot", etc.
    mcp = {
      enabled = true,
      servers = {
        zen = {
          command = "npx",
          args = { "-y", "@beehiveinnovations/zen-mcp-server" },
          env = {
            NODE_ENV = "development"
          }
        },
        -- Add other MCP servers here
        ["sequential-thinking"] = {
          command = "npx",
          args = { "-y", "@modelcontextprotocol/server-sequential-thinking" }
        }
      }
    }
  },
  build = "make",
  dependencies = {
    "nvim-treesitter/nvim-treesitter",
    "stevearc/dressing.nvim",
    "nvim-lua/plenary.nvim",
    "MunifTanjim/nui.nvim",
    "nvim-tree/nvim-web-devicons",
  },
}
```

### 3. Full Configuration Example

Complete configuration with multiple AI providers and MCP servers:

```lua
-- ~/.config/nvim/lua/plugins/avante.lua
return {
  "yetone/avante.nvim",
  event = "VeryLazy",
  lazy = false,
  version = false,
  opts = {
    -- AI Provider Configuration
    provider = "claude",
    auto_suggestions_provider = "copilot",
    
    claude = {
      endpoint = "https://api.anthropic.com",
      model = "claude-3-5-sonnet-20241022",
      temperature = 0,
      max_tokens = 4096,
    },
    
    -- MCP Server Configuration
    mcp = {
      enabled = true,
      servers = {
        -- Zen MCP Server for mindfulness and focus
        zen = {
          command = "npx",
          args = { "-y", "@beehiveinnovations/zen-mcp-server" },
          env = {
            NODE_ENV = "development",
            ZEN_CONFIG_PATH = vim.fn.expand("~/.config/zen-mcp")
          }
        },
        
        -- Sequential Thinking for complex problem solving
        ["sequential-thinking"] = {
          command = "npx",
          args = { "-y", "@modelcontextprotocol/server-sequential-thinking" }
        },
        
        -- Filesystem access (if needed)
        filesystem = {
          command = "npx",
          args = { "-y", "@modelcontextprotocol/server-filesystem", vim.fn.getcwd() }
        }
      }
    },
    
    -- Keybindings
    mappings = {
      ask = "<leader>aa",
      edit = "<leader>ae",
      refresh = "<leader>ar",
      toggle = {
        default = "<leader>at",
        debug = "<leader>ad",
        hint = "<leader>ah",
      },
    },
  },
  build = "make",
  dependencies = {
    "nvim-treesitter/nvim-treesitter",
    "stevearc/dressing.nvim",
    "nvim-lua/plenary.nvim",
    "MunifTanjim/nui.nvim",
    "nvim-tree/nvim-web-devicons",
  },
}
```

## Usage in Neovim

### Starting Avante

Press `<leader>aa` (default) to open Avante chat interface.

### Using Zen Commands

In the Avante chat window:

```
@zen start focus --duration 25m
```

```
@zen schedule break --in 45m
```

```
@zen stats today
```

### Sample Workflows

#### 1. Deep Work Session

```vim
" Open Avante
<leader>aa

" In Avante chat:
@zen start deep-work --duration 90m --breaks-disabled

Help me refactor this authentication module. Let's work methodically through each function.
```

#### 2. Pomodoro Coding

```vim
" Start a pomodoro session
<leader>aa

@zen pomodoro --cycles 4

Let's implement these unit tests one pomodoro at a time. Start with the authentication tests.
```

#### 3. Mindful Code Review

```vim
" Review current buffer
<leader>aa

@zen mindful-review

Review the code in this buffer for clarity, security, and maintainability. Take your time with each section.
```

### Combining with Other AI Assistants

#### Zen + Claude Code

```vim
@zen start focus --duration 30m

@claude analyze this API design for potential security vulnerabilities and suggest improvements
```

#### Zen + Copilot

```vim
@zen check-focus

" Use Copilot suggestions while maintaining focus
" Zen will remind you to take breaks
```

#### Zen + Gemini

```vim
@zen productivity-report --period today

@gemini based on my focus patterns, suggest the optimal time to tackle this complex algorithm
```

## Keybinding Suggestions

Add these to your Neovim config for quick Zen access:

```lua
-- In your keymaps configuration
vim.keymap.set('n', '<leader>zf', function()
  vim.cmd('AvanteAsk @zen start focus --duration 25m')
end, { desc = 'Zen: Start focus session' })

vim.keymap.set('n', '<leader>zb', function()
  vim.cmd('AvanteAsk @zen schedule break --in 30m')
end, { desc = 'Zen: Schedule break' })

vim.keymap.set('n', '<leader>zs', function()
  vim.cmd('AvanteAsk @zen stats today')
end, { desc = 'Zen: Show stats' })

vim.keymap.set('n', '<leader>zp', function()
  vim.cmd('AvanteAsk @zen pomodoro --cycles 4')
end, { desc = 'Zen: Start pomodoro' })
```

## Troubleshooting

### MCP Server Not Starting

Check Avante logs:
```vim
:messages
```

Verify npx is in PATH:
```bash
which npx
npx -y @beehiveinnovations/zen-mcp-server --version
```

### Commands Not Recognized

Ensure you're using the `@zen` prefix in Avante chat:
```
✓ @zen start focus
✗ zen start focus
```

### Performance Issues

If Neovim feels slow with MCP servers:

```lua
opts = {
  mcp = {
    enabled = true,
    timeout = 5000, -- Increase timeout
    servers = {
      zen = {
        command = "npx",
        args = { "-y", "@beehiveinnovations/zen-mcp-server" },
        lazy = true -- Only start when needed
      }
    }
  }
}
```

## Advanced Configuration

### Custom Zen Config Path

```lua
zen = {
  command = "npx",
  args = { "-y", "@beehiveinnovations/zen-mcp-server" },
  env = {
    ZEN_CONFIG_PATH = vim.fn.expand("~/.config/zen-mcp"),
    ZEN_DATA_PATH = vim.fn.expand("~/.local/share/zen-mcp")
  }
}
```

### Datadog Integration

```lua
zen = {
  command = "npx",
  args = { "-y", "@beehiveinnovations/zen-mcp-server" },
  env = {
    DD_AGENT_HOST = "localhost",
    DD_TRACE_AGENT_PORT = "8126",
    DD_ENV = "development",
    DD_SERVICE = "mcp-zen-neovim"
  }
}
```

## Resources

- [Avante.nvim Documentation](https://github.com/yetone/avante.nvim)
- [Zen MCP Server](https://github.com/BeehiveInnovations/zen-mcp-server)
- [Sample Prompts](../sample-prompts/)
- [Neovim MCP Template](./mcp-config-template.lua)

## Example Configuration Files

See [mcp-config-template.lua](./mcp-config-template.lua) for a complete, copy-paste ready configuration.
