-- Zen MCP Server - Complete Neovim Configuration Template
-- Copy this to ~/.config/nvim/lua/plugins/avante.lua

return {
  "yetone/avante.nvim",
  event = "VeryLazy",
  lazy = false,
  version = false,
  opts = {
    -- ============================================
    -- AI Provider Configuration
    -- ============================================
    provider = "claude", -- Options: "claude", "openai", "copilot", "gemini"
    auto_suggestions_provider = "copilot",
    
    -- Claude Configuration
    claude = {
      endpoint = "https://api.anthropic.com",
      model = "claude-3-5-sonnet-20241022",
      temperature = 0,
      max_tokens = 4096,
    },
    
    -- OpenAI Configuration (if using)
    openai = {
      endpoint = "https://api.openai.com/v1",
      model = "gpt-4-turbo-preview",
      temperature = 0,
      max_tokens = 4096,
    },
    
    -- ============================================
    -- MCP Server Configuration
    -- ============================================
    mcp = {
      enabled = true,
      timeout = 10000, -- 10 seconds timeout for MCP operations
      
      servers = {
        -- Zen MCP Server - Mindfulness and Focus Tools
        zen = {
          command = "npx",
          args = { "-y", "@beehiveinnovations/zen-mcp-server" },
          env = {
            NODE_ENV = "development",
            -- Optional: Custom config paths
            -- ZEN_CONFIG_PATH = vim.fn.expand("~/.config/zen-mcp"),
            -- ZEN_DATA_PATH = vim.fn.expand("~/.local/share/zen-mcp"),
            
            -- Optional: Datadog tracing
            -- DD_AGENT_HOST = "localhost",
            -- DD_TRACE_AGENT_PORT = "8126",
            -- DD_ENV = "development",
            -- DD_SERVICE = "mcp-zen-neovim",
          },
          lazy = false, -- Start immediately
        },
        
        -- Sequential Thinking - Complex Problem Solving
        ["sequential-thinking"] = {
          command = "npx",
          args = { "-y", "@modelcontextprotocol/server-sequential-thinking" },
          lazy = true, -- Only start when needed
        },
        
        -- Filesystem Access (optional)
        filesystem = {
          command = "npx",
          args = { 
            "-y", 
            "@modelcontextprotocol/server-filesystem",
            vim.fn.getcwd() -- Current working directory
          },
          lazy = true,
        },
        
        -- GitHub Integration (optional)
        -- Uncomment if you need GitHub access
        -- github = {
        --   command = "npx",
        --   args = { "-y", "@modelcontextprotocol/server-github" },
        --   env = {
        --     GITHUB_TOKEN = vim.env.GITHUB_TOKEN or "",
        --   },
        --   lazy = true,
        -- },
      }
    },
    
    -- ============================================
    -- UI Configuration
    -- ============================================
    windows = {
      position = "right", -- "left", "right", "top", "bottom"
      width = 30, -- Width percentage
      sidebar_header = {
        align = "center",
        rounded = true,
      },
    },
    
    -- ============================================
    -- Keybindings
    -- ============================================
    mappings = {
      ask = "<leader>aa",
      edit = "<leader>ae",
      refresh = "<leader>ar",
      
      -- Diff view mappings
      diff = {
        ours = "co",
        theirs = "ct",
        all_theirs = "ca",
        both = "cb",
        cursor = "cc",
        next = "]x",
        prev = "[x",
      },
      
      -- Suggestion mappings
      suggestion = {
        accept = "<M-l>",
        next = "<M-]>",
        prev = "<M-[>",
        dismiss = "<C-]>",
      },
      
      -- Jump mappings
      jump = {
        next = "]]",
        prev = "[[",
      },
      
      -- Submit mappings
      submit = {
        normal = "<CR>",
        insert = "<C-s>",
      },
      
      -- Toggle mappings
      toggle = {
        default = "<leader>at",
        debug = "<leader>ad",
        hint = "<leader>ah",
      },
    },
    
    -- ============================================
    -- Hints Configuration
    -- ============================================
    hints = {
      enabled = true,
    },
    
    -- ============================================
    -- Behaviour Configuration
    -- ============================================
    behaviour = {
      auto_suggestions = false, -- Set to true for automatic suggestions
      auto_set_highlight_group = true,
      auto_set_keymaps = true,
      auto_apply_diff_after_generation = false,
      support_paste_from_clipboard = false,
    },
  },
  
  -- ============================================
  -- Build Configuration
  -- ============================================
  build = "make",
  
  -- ============================================
  -- Dependencies
  -- ============================================
  dependencies = {
    "nvim-treesitter/nvim-treesitter",
    "stevearc/dressing.nvim",
    "nvim-lua/plenary.nvim",
    "MunifTanjim/nui.nvim",
    "nvim-tree/nvim-web-devicons",
    
    -- Optional: Image support
    -- {
    --   "3rd/image.nvim",
    --   opts = {
    --     backend = "kitty",
    --   },
    -- },
  },
}

-- ============================================
-- Additional Keybindings for Zen
-- ============================================
-- Add these to your keymaps file (e.g., ~/.config/nvim/lua/config/keymaps.lua)

-- Quick Zen Commands
-- vim.keymap.set('n', '<leader>zf', function()
--   vim.cmd('AvanteAsk @zen start focus --duration 25m')
-- end, { desc = 'Zen: Start 25min focus session' })
--
-- vim.keymap.set('n', '<leader>zb', function()
--   vim.cmd('AvanteAsk @zen schedule break --in 30m')
-- end, { desc = 'Zen: Schedule break in 30min' })
--
-- vim.keymap.set('n', '<leader>zs', function()
--   vim.cmd('AvanteAsk @zen stats today')
-- end, { desc = 'Zen: Show today\'s stats' })
--
-- vim.keymap.set('n', '<leader>zp', function()
--   vim.cmd('AvanteAsk @zen pomodoro --cycles 4')
-- end, { desc = 'Zen: Start 4-cycle pomodoro' })
--
-- vim.keymap.set('n', '<leader>zm', function()
--   vim.cmd('AvanteAsk @zen mindful-review')
-- end, { desc = 'Zen: Mindful code review' })

-- ============================================
-- Usage Examples
-- ============================================
--[[

After installing, use these commands in Avante:

1. Start a focus session:
   <leader>aa
   @zen start focus --duration 25m

2. Schedule a break:
   <leader>aa
   @zen schedule break --in 45m

3. Check productivity stats:
   <leader>aa
   @zen stats today

4. Start pomodoro:
   <leader>aa
   @zen pomodoro --cycles 4

5. Mindful code review:
   <leader>aa
   @zen mindful-review
   Review this code for clarity and maintainability

6. Combine with Claude:
   <leader>aa
   @zen start deep-work --duration 90m
   @claude help me refactor this authentication module

--]]
