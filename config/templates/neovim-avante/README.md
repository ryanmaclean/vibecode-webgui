# Neovim + Avante.nvim Template

## Overview

This template provides a minimal, ultra-fast Neovim environment with Avante.nvim for Cursor AI-like code editing capabilities. Perfect for developers who want AI-powered editing without the overhead of a full IDE.

## Features

### Core Components
- **Neovim v0.10.2**: Latest stable Neovim with Lua and Tree-sitter
- **Avante.nvim**: Cursor AI-like experience for code editing
- **Git**: Version control support
- **BusyBox**: Essential Unix utilities
- **MiniVim Kernel**: Minimal Linux kernel for fast boot

### AI Capabilities
- Ask AI questions about your code
- Edit code with natural language instructions
- Chat with AI for coding assistance
- Multiple AI provider support (OpenAI, Claude, Copilot)

### Performance
- **Boot Time**: < 3 seconds
- **Memory Usage**: ~200 MB
- **Disk Usage**: ~50 MB
- **Startup**: Instant editor launch

## Quick Start

### 1. Set Up AI Provider

Choose your AI provider and set the API key:

```bash
# OpenAI
export OPENAI_API_KEY="sk-..."

# Anthropic Claude
export ANTHROPIC_API_KEY="sk-ant-..."

# GitHub Copilot
export GITHUB_TOKEN="ghp_..."
```

### 2. Start Neovim

```bash
nvim
```

### 3. Try Avante.nvim

Open a code file:
```bash
nvim test.py
```

Use Avante commands:
```vim
:AvanteAsk "How do I optimize this function?"
:AvanteEdit "Add error handling and type hints"
:AvanteChat
```

## Avante.nvim Commands

| Command | Description | Shortcut |
|---------|-------------|----------|
| `:AvanteAsk <question>` | Ask AI about code | `<Space>aa` |
| `:AvanteEdit <instruction>` | Edit code with AI | `<Space>ae` |
| `:AvanteChat` | Open AI chat | `<Space>ac` |
| `:AvanteClear` | Clear AI context | `<Space>ar` |
| `:AvanteToggle` | Toggle Avante panel | `<Space>at` |

## Configuration

### AI Provider Setup

Edit `~/.config/nvim/init.lua`:

```lua
require("lazy").setup({
  {
    "yetone/avante.nvim",
    opts = {
      provider = "openai", -- or "claude", "copilot"
      openai = {
        endpoint = "https://api.openai.com/v1",
        model = "gpt-4",
        temperature = 0,
        max_tokens = 4096,
      },
    },
  },
})
```

### Custom Key Mappings

```lua
vim.keymap.set('n', '<leader>aa', ':AvanteAsk ', { desc = 'Avante Ask' })
vim.keymap.set('n', '<leader>ae', ':AvanteEdit ', { desc = 'Avante Edit' })
vim.keymap.set('n', '<leader>ac', ':AvanteChat<CR>', { desc = 'Avante Chat' })
```

## Use Cases

### 1. Code Review
```vim
:AvanteAsk "Review this function for bugs and improvements"
```

### 2. Refactoring
```vim
:AvanteEdit "Refactor this code to use async/await"
```

### 3. Documentation
```vim
:AvanteEdit "Add comprehensive docstrings"
```

### 4. Bug Fixing
```vim
:AvanteAsk "Why is this function returning None?"
```

### 5. Learning
```vim
:AvanteAsk "Explain how this algorithm works"
```

## Comparison with Other Editors

| Feature | MiniVim + Avante | Cursor | VS Code + Copilot |
|---------|------------------|--------|-------------------|
| Boot Time | < 3s | ~5-10s | ~10-20s |
| Memory | ~200 MB | ~500 MB | ~500 MB+ |
| AI Features | ✓ | ✓ | ✓ |
| Vim Bindings | Native | Emulated | Extension |
| Customization | Full | Limited | Moderate |
| Offline Use | ✓ | ✗ | ✗ |

## Advanced Usage

### Installing Additional Plugins

```lua
-- In ~/.config/nvim/init.lua
require("lazy").setup({
  -- Your existing plugins
  
  -- Add new plugins
  { "nvim-telescope/telescope.nvim" },
  { "lewis6991/gitsigns.nvim" },
})
```

### Network Configuration

The template includes network support via virtio-net:

```bash
# Check network
ip addr show

# Test connectivity
ping -c 3 google.com

# Install plugins
nvim +Lazy sync
```

### Git Integration

```bash
# Initialize repo
git init
git add .
git commit -m "Initial commit"

# Use in Neovim
:Git status
:Git commit
```

## Troubleshooting

### AI Not Responding

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

### Plugin Installation Issues

1. Ensure Git is working:
   ```bash
   git --version
   ```

2. Manually sync plugins:
   ```vim
   :Lazy sync
   ```

3. Check plugin status:
   ```vim
   :Lazy
   ```

### Performance Issues

1. Reduce AI temperature:
   ```lua
   temperature = 0
   ```

2. Use smaller model:
   ```lua
   model = "gpt-3.5-turbo"
   ```

3. Limit max tokens:
   ```lua
   max_tokens = 2048
   ```

## Performance Benchmarks

### Boot Time
- Kernel boot: ~1-2s
- Initramfs load: ~0.5s
- Neovim startup: ~0.1s
- **Total**: < 3s

### AI Response Time
- Simple queries: ~1-2s
- Code edits: ~2-5s
- Complex analysis: ~5-10s

### Resource Usage
- Idle: ~50 MB RAM
- With file open: ~100 MB RAM
- AI active: ~200 MB RAM

## Integration with VibeCode

This template integrates seamlessly with VibeCode:

1. **Workspace Template**: Available in template catalog
2. **Quick Provision**: < 3s workspace creation
3. **AI Integration**: Works with VibeCode's AI features
4. **Performance**: Exceeds VibeCode's < 5s provisioning target

## Resources

- [Avante.nvim Documentation](https://github.com/yetone/avante.nvim)
- [Neovim Documentation](https://neovim.io/doc/)
- [MiniVim Kernel Guide](../../docs/virtualization/minivim-kernel.md)
- [VibeCode Templates](../README.md)

## Support

For issues or questions:
- GitHub Issues: [vibecode-webgui/issues](https://github.com/ryanmaclean/vibecode-webgui/issues)
- Avante.nvim: [yetone/avante.nvim/issues](https://github.com/yetone/avante.nvim/issues)
- VibeCode Docs: [docs/](../../docs/)

## License

Same as VibeCode project (see root LICENSE file).

## Contributing

Contributions welcome! See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.
