# VibeCode Documentation

> AI-powered development environment with native Apple Silicon support

## 🎯 Quick Start: Demo Environment

**Get VibeCode running in minutes on your M-Series Mac!**

### One-Command Demo Setup

```bash
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui
./scripts/vfkit/setup-demo-environment.sh
```

This creates a complete development environment with:
- 🖥️ **code-server** - Web-based VS Code IDE
- 🗄️ **PostgreSQL** - Production database
- ⚡ **Valkey** - High-performance cache (Redis alternative)
- 🌐 **nginx** - Reverse proxy

**Total footprint**: 8 CPU cores, 7GB RAM (minimal on M2 Ultra!)

### Why Alpine ARM64 + vfkit?

| Feature | Benefit |
|---------|---------|
| **Native ARM64** | Zero emulation, maximum performance |
| **Alpine Linux** | 130MB base, <6s boot time |
| **vfkit** | Apple Virtualization framework |
| **musl libc** | Smaller binaries, faster execution |

---

## 📚 Documentation

### 🎯 Featured
- **[Platform Overview](./PLATFORM_OVERVIEW.md)** - Complete system overview ⭐⭐⭐
- **[Multi-Agent Workflow Complete](./MULTI_AGENT_WORKFLOW_COMPLETE.md)** - Full implementation ⭐
- **[RAG System Architecture](./ARCHITECTURE_RAG_SYSTEM.md)** - Technical deep-dive ⭐
- **[VibeCode CLI](../cli-tools/README.md)** - Unified development toolkit ⭐

### Getting Started
- **[VibeCode CLI Integration](./CLI_INTEGRATION.md)** - Unified toolkit guide
- **[Demo Environment Guide](./VFKIT_DEMO_GUIDE.md)** - Complete setup walkthrough
- **[vfkit Quick Start](../scripts/vfkit/QUICK_START.md)** - VM basics
- **[Alpine VM Setup](../scripts/vfkit/README.md)** - Detailed Alpine guide

### Advanced Topics
- **[Valkey ARM64 Compilation](../scripts/vfkit/compile-valkey-musl.md)** - Optimize for musl
- **[Performance Tuning](../scripts/vfkit/BOOT_TIME_COMPARISON.md)** - Boot time optimization
- **[Kernel Optimization](../scripts/vfkit/KERNEL_OPTIMIZATION_ANALYSIS.md)** - Custom kernels

### Architecture
- **[RAG System Architecture](./ARCHITECTURE_RAG_SYSTEM.md)** - Complete RAG pipeline ⭐
- **[M-Series Testing](./M2_ULTRA_FINAL_SESSION_SUMMARY.md)** - Hardware validation
- **[VM Profiles](../config/lima/)** - Lima configurations
- **[Build Scripts](../scripts/vfkit/)** - Automation tools

---

## 🔥 Featured: Valkey ARM64 Build

**Ultra-optimized Redis alternative for Alpine ARM64**

### Quick Compile

```bash
# In your Alpine VM
./scripts/vfkit/compile-valkey-musl.sh
```

### Optimization Highlights

```bash
# Build configuration
MALLOC=libc              # Use musl allocator
OPTIMIZATION=-Os         # Size-optimized
LDFLAGS=-static          # No runtime deps
CFLAGS="-fomit-frame-pointer -ffunction-sections"
```

**Result**: ~2-3MB static binary, native ARM64 performance

### Why Valkey?

- ✅ **Redis-compatible** - Drop-in replacement
- ✅ **Open source** - No licensing concerns
- ✅ **Optimized** - Built specifically for musl/Alpine
- ✅ **Minimal** - Static linking, stripped binaries

**[📖 Full Compilation Guide →](../scripts/vfkit/compile-valkey-musl.sh)**

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────┐
│     macOS Host (M-Series)           │
│     24 cores, 64GB RAM              │
└────────────┬────────────────────────┘
             │ vfkit (Apple Virtualization)
    ┌────────┴────────┬──────────────┐
    │                 │              │
┌───▼────────────┐ ┌──▼──────────┐ ┌▼────────────┐
│ Development    │ │ Database    │ │ Services    │
│ Alpine ARM64   │ │ Alpine ARM64│ │ Alpine ARM64│
│ 4 CPU, 4GB     │ │ 2 CPU, 2GB  │ │ 2 CPU, 1GB  │
│                │ │             │ │             │
│ • code-server  │ │ • PostgreSQL│ │ • Valkey    │
│ • Node.js 24   │ │ • 100GB data│ │ • nginx     │
│ • VibeCode API │ │             │ │             │
└────────────────┘ └─────────────┘ └─────────────┘
```

**Total**: 8 cores, 7GB RAM | **Available**: 16 cores, 57GB RAM

---

## 🚀 Performance Benchmarks

### Boot Times (Alpine ARM64 on M2 Ultra)

| Component | Time | vs Lima |
|-----------|------|---------|
| VM Boot | 6.5s | 57% faster |
| PostgreSQL Start | 2.1s | Native |
| Valkey Start | 0.8s | Optimized |
| code-server Ready | 4.2s | ARM64 native |

### Resource Usage

| Metric | Development | Database | Services |
|--------|-------------|----------|----------|
| Memory | 3.8GB | 1.9GB | 0.9GB |
| Disk | 18GB | 45GB | 8GB |
| Boot | 6.2s | 6.8s | 6.1s |

---

## 🛠️ Development

### Prerequisites

- macOS 13+ (Ventura or later)
- Apple Silicon (M1/M2/M3/M4)
- Homebrew
- 16GB+ RAM recommended

### Installation

```bash
# Install vfkit
brew install vfkit

# Clone repository
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui

# Run demo setup
./scripts/vfkit/setup-demo-environment.sh
```

### Access Services

Once running:
- **code-server**: http://localhost:8080 (password: vibecode)
- **PostgreSQL**: localhost:5432 (user/pass: vibecode)
- **Valkey**: localhost:6379
- **nginx**: http://localhost:80

---

## 📖 Additional Resources

### Documentation
- [vfkit Wiki](../scripts/vfkit/WIKI.md) - Comprehensive guide
- [Setup Summary](../scripts/vfkit/SETUP_SUMMARY.md) - Quick reference
- [Node.js 24 Upgrade](../scripts/vfkit/NODE_24_UPGRADE.md) - Latest runtime

### Scripts
- [Install Alpine VM](../scripts/vfkit/install-alpine-vm.sh) - One-command setup
- [Compile Valkey](../scripts/vfkit/compile-valkey-musl.sh) - Optimized build
- [Performance Tests](../scripts/vfkit/comprehensive-performance-test.sh) - Benchmarking

### Configuration
- [VM Profiles](../config/lima/) - Lima configurations
- [vfkit Configs](../config/vfkit/) - VM definitions

---

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](../CONTRIBUTING.md) for details.

### Key Areas
- Alpine ARM64 optimizations
- Valkey performance tuning
- vfkit automation
- Documentation improvements

---

## 📝 License

See [LICENSE](../LICENSE) for details.

---

## 🔗 Links

- **GitHub**: [ryanmaclean/vibecode-webgui](https://github.com/ryanmaclean/vibecode-webgui)
- **Issues**: [Report bugs](https://github.com/ryanmaclean/vibecode-webgui/issues)
- **Discussions**: [Community forum](https://github.com/ryanmaclean/vibecode-webgui/discussions)

---

<div align="center">

**Built with ❤️ for Apple Silicon**

[Get Started](./VFKIT_DEMO_GUIDE.md) • [View on GitHub](https://github.com/ryanmaclean/vibecode-webgui)

</div>
