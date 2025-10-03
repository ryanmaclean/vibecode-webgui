# MiniVim + Neovim Integration

## Overview

This document describes how to run Neovim (and potentially Avante.nvim) on the MiniVim minimal kernel for ultra-fast boot-to-editor benchmarks.

## Motivation

- **Fast Boot**: < 3 seconds from kernel start to Neovim prompt
- **Minimal Footprint**: Entire system (kernel + initramfs) < 50 MB
- **Avante.nvim Testing**: Test Cursor AI-like functionality in a minimal environment
- **Benchmark Platform**: Standardized environment for editor performance testing

## Architecture

```
┌─────────────────────────────────────┐
│   MiniVim Kernel (5-10 MB)          │
│   - Virtio drivers                  │
│   - Serial console                  │
│   - Minimal subsystems              │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│   Initramfs (15-30 MB compressed)   │
│   ┌───────────────────────────────┐ │
│   │ BusyBox (1-2 MB)              │ │
│   │ - sh, ls, cat, etc.           │ │
│   └───────────────────────────────┘ │
│   ┌───────────────────────────────┐ │
│   │ Neovim (10-15 MB)             │ │
│   │ - Static or with libs         │ │
│   │ - Lua runtime                 │ │
│   │ - Tree-sitter                 │ │
│   └───────────────────────────────┘ │
│   ┌───────────────────────────────┐ │
│   │ Avante.nvim (optional)        │ │
│   │ - AI-powered editing          │ │
│   │ - MCP integration             │ │
│   └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Building

### 1. Build the MiniVim Kernel

```bash
# Build x86_64 kernel
./scripts/benchmarks/build-minivim-kernel.sh x86_64 6.17

# Output: bench-images/minivim/bzImage-x86_64-6.17
```

### 2. Build Neovim Initramfs

```bash
# Build initramfs with Neovim
./scripts/benchmarks/build-neovim-initramfs.sh

# Output: bench-images/busybox/busybox-neovim-initrd.cpio.gz
```

### 3. Test with QEMU

```bash
qemu-system-x86_64 \
  -kernel bench-images/minivim/bzImage-x86_64-6.17 \
  -initrd bench-images/busybox/busybox-neovim-initrd.cpio.gz \
  -m 512M \
  -nographic \
  -append 'console=ttyS0'
```

## Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Kernel boot | < 2s | From BIOS to init |
| Initramfs load | < 1s | Decompression + mount |
| Neovim startup | < 0.3s | Cold start |
| **Total** | **< 3s** | **Boot to editor** |

## Avante.nvim Integration

### Requirements

- ✅ Neovim >= 0.10.0
- ✅ Lua support (built-in)
- ✅ Tree-sitter (built-in)
- ⚠️ Network access (for AI APIs)
- ⚠️ Git (optional)

### Network Configuration

To enable Avante.nvim's AI features, the kernel needs network support:

```bash
# Add to minivim-base.config
CONFIG_VIRTIO_NET=y
CONFIG_NET=y
CONFIG_INET=y
CONFIG_TCP_CONG_CUBIC=y
```

### Installing Avante.nvim

Add to the initramfs build script:

```bash
# In root/.config/nvim/init.lua
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.loop.fs_stat(lazypath) then
  vim.fn.system({
    "git", "clone", "--filter=blob:none",
    "https://github.com/folke/lazy.nvim.git",
    "--branch=stable",
    lazypath,
  })
end
vim.opt.rtp:prepend(lazypath)

require("lazy").setup({
  {
    "yetone/avante.nvim",
    event = "VeryLazy",
    build = "make",
    opts = {
      -- Avante configuration
    },
  }
})
```

## Use Cases

### 1. Editor Performance Benchmarking

Test Neovim startup and operation in a controlled environment:

```bash
# Measure cold start time
time nvim +q

# Measure with file loading
time nvim large_file.txt +q
```

### 2. Avante.nvim Development

Test Avante.nvim features without a full OS:

```bash
# Start with test file
nvim test.py

# Use Avante commands
:AvanteAsk "How do I optimize this function?"
:AvanteEdit "Add error handling"
```

### 3. CI/CD Testing

Use in GitHub Actions for automated testing:

```yaml
- name: Test Neovim in MiniVim
  run: |
    qemu-system-x86_64 \
      -kernel bzImage-x86_64-6.17 \
      -initrd busybox-neovim-initrd.cpio.gz \
      -m 512M -nographic \
      -append 'console=ttyS0' \
      -serial mon:stdio \
      < test_commands.txt
```

### 4. VibeCode Integration

Potential integration with VibeCode platform:

- **Workspace Template**: Pre-configured Neovim environment
- **Benchmark Suite**: Standard performance tests
- **Plugin Testing**: Isolated environment for plugin development
- **MCP Testing**: Test MCP integrations in minimal environment

## Comparison with Other Approaches

| Approach | Boot Time | Size | Complexity | Use Case |
|----------|-----------|------|------------|----------|
| **MiniVim + Neovim** | ~3s | ~50 MB | Low | Benchmarking, testing |
| Full Linux + Neovim | ~10-30s | ~500 MB+ | Medium | Development |
| Docker + Neovim | ~5-10s | ~200 MB | Medium | CI/CD |
| Native Neovim | ~0.1s | N/A | Low | Daily use |

## Limitations

1. **No Persistence**: Changes lost on reboot (by design)
2. **Limited Networking**: Basic TCP/IP only
3. **No Package Manager**: All tools must be in initramfs
4. **Memory Only**: Everything runs in RAM

## Future Enhancements

### Short Term

- [ ] Add Git to initramfs for Avante.nvim
- [ ] Include curl/wget for API calls
- [ ] Add SSH client for remote access
- [ ] Include common Neovim plugins

### Medium Term

- [ ] Persistent storage via virtio-blk
- [ ] Network boot support (PXE)
- [ ] Multiple editor support (Vim, Emacs)
- [ ] GPU passthrough for terminal rendering

### Long Term

- [ ] Full Avante.nvim Zen Mode support
- [ ] MCP server integration
- [ ] Multi-user support
- [ ] Container runtime (minimal)

## Related Projects

- **Avante.nvim**: https://github.com/yetone/avante.nvim
- **MiniVim Kernel**: `docs/virtualization/minivim-kernel.md`
- **VibeCode**: https://github.com/ryanmaclean/vibecode-webgui

## References

- [Neovim Documentation](https://neovim.io/doc/)
- [BusyBox Documentation](https://busybox.net/about.html)
- [Linux Kernel Initramfs](https://www.kernel.org/doc/html/latest/filesystems/ramfs-rootfs-initramfs.html)
- [QEMU Documentation](https://www.qemu.org/docs/master/)

## Contributing

To contribute improvements:

1. Test changes with `./scripts/benchmarks/test-neovim-minimal.sh`
2. Build full initramfs with `./scripts/benchmarks/build-neovim-initramfs.sh`
3. Benchmark boot time and document results
4. Submit PR with performance data

## License

Same as VibeCode project (see root LICENSE file).
