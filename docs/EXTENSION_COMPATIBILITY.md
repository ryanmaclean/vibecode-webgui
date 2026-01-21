# Extension Compatibility Matrix

This matrix shows which VS Code extensions work with each IDE platform in VibeCode.

## Legend
- ✅ Fully Compatible - Works without issues
- ⚠️ Partial Support - Works with limitations
- ❌ Not Compatible - Does not work or has major issues
- 🔄 Marketplace - Available through respective marketplace

## Popular Extensions

| Extension | OpenVSCode | Code-Server | Theia | Notes |
|-----------|-----------|-------------|-------|-------|
| **Python (ms-python.python)** | ✅ 🔄 | ✅ (Open VSX) | ✅ (Open VSX) | Full LSP support on all platforms |
| **ESLint (dbaeumer.vscode-eslint)** | ✅ 🔄 | ✅ (Open VSX) | ✅ (Open VSX) | Works great on all platforms |
| **Prettier (esbenp.prettier-vscode)** | ✅ 🔄 | ✅ (Open VSX) | ✅ (Open VSX) | No issues |
| **GitLens (eamodio.gitlens)** | ✅ 🔄 | ⚠️ (Open VSX) | ⚠️ (Open VSX) | Some features limited in non-MS marketplace |
| **GitHub Copilot** | ⚠️ | ❌ | ❌ | Microsoft marketplace only, limited OpenVSCode support |
| **Continue.dev (ai assistant)** | ✅ | ✅ (Open VSX) | ✅ (Open VSX) | Open source AI assistant, works everywhere |
| **Remote SSH** | ✅ | ✅ | ⚠️ | Requires plugin for Theia |
| **Docker** | ✅ 🔄 | ✅ (Open VSX) | ✅ (Open VSX) | Full support on all |
| **Kubernetes** | ✅ 🔄 | ✅ (Open VSX) | ✅ (Open VSX) | Works well |
| **Live Share** | ❌ | ❌ | ❌ | Microsoft proprietary, not available |
| **Thunder Client** | ✅ 🔄 | ✅ (Open VSX) | ✅ (Open VSX) | API testing tool |
| **Go (golang.go)** | ✅ 🔄 | ✅ (Open VSX) | ✅ (Open VSX) | Full Go support |
| **Rust (rust-lang.rust-analyzer)** | ✅ 🔄 | ✅ (Open VSX) | ✅ (Open VSX) | LSP works great |
| **TypeScript** | ✅ (built-in) | ✅ (built-in) | ✅ (built-in) | Built into all platforms |
| **Debugger for Chrome** | ✅ 🔄 | ✅ (Open VSX) | ✅ (Open VSX) | Browser debugging |
| **REST Client** | ✅ 🔄 | ✅ (Open VSX) | ✅ (Open VSX) | HTTP request testing |

## Language Support

| Language | OpenVSCode | Code-Server | Theia | Notes |
|----------|-----------|-------------|-------|-------|
| **JavaScript/TypeScript** | ✅ | ✅ | ✅ | Built-in support |
| **Python** | ✅ | ✅ | ✅ | Via extensions |
| **Go** | ✅ | ✅ | ✅ | Via extensions |
| **Rust** | ✅ | ✅ | ✅ | rust-analyzer works great |
| **Java** | ✅ | ✅ | ✅ | RedHat Java extension |
| **C/C++** | ✅ | ✅ | ✅ | Via extensions |
| **C#** | ✅ | ⚠️ | ⚠️ | OmniSharp, some limitations |
| **Ruby** | ✅ | ✅ | ✅ | Via extensions |
| **PHP** | ✅ | ✅ | ✅ | Via extensions |
| **Zig** | ✅ | ✅ | ✅ | Via zig LSP |

## Development Tools

| Tool | OpenVSCode | Code-Server | Theia | Notes |
|------|-----------|-------------|-------|-------|
| **Git Integration** | ✅ | ✅ | ✅ | Built-in all platforms |
| **Terminal** | ✅ | ✅ | ✅ | Full terminal support |
| **Debugging** | ✅ | ✅ | ✅ | DAP support |
| **Task Runner** | ✅ | ✅ | ✅ | VS Code tasks work |
| **Snippets** | ✅ | ✅ | ✅ | Full support |
| **IntelliSense** | ✅ | ✅ | ✅ | LSP-based |
| **Code Navigation** | ✅ | ✅ | ✅ | Full support |
| **Refactoring** | ✅ | ✅ | ✅ | Language-dependent |

## AI Coding Assistants

| Assistant | OpenVSCode | Code-Server | Theia | Notes |
|-----------|-----------|-------------|-------|-------|
| **GitHub Copilot** | ⚠️ | ❌ | ❌ | Limited/no official support |
| **Continue.dev** | ✅ | ✅ | ✅ | Open source, full support |
| **Tabnine** | ✅ | ✅ | ✅ | Available via Open VSX |
| **Codeium** | ✅ | ✅ | ✅ | Free alternative to Copilot |
| **Amazon CodeWhisperer** | ⚠️ | ⚠️ | ⚠️ | AWS marketplace |
| **Aider** | ✅ | ✅ | ✅ | CLI tool, terminal access needed |

## Marketplace Access

| Platform | Primary Marketplace | Alternative | Extension Count |
|----------|-------------------|-------------|-----------------|
| **OpenVSCode** | Microsoft Marketplace | Open VSX | ~40,000+ |
| **Code-Server** | Open VSX | Manual install | ~3,000+ |
| **Theia** | Open VSX | Manual install | ~3,000+ |

## Installation Methods

### OpenVSCode Server
```bash
# Via built-in marketplace
# Extensions install automatically from MS marketplace

# Via command line
./openvscode-server --install-extension ms-python.python
```

### Code-Server
```bash
# Via Open VSX (built-in)
code-server --install-extension ms-python.python

# Manual installation
code-server --install-extension ./extension.vsix
```

### Eclipse Theia
```bash
# Via built-in plugin manager
# Or pre-install in Docker image

# Manual VSIX installation
docker cp extension.vsix container:/home/theia/plugins/
```

## Recommended Extension Sets

### Web Development Stack
```yaml
extensions:
  - dbaeumer.vscode-eslint        # JavaScript linting
  - esbenp.prettier-vscode        # Code formatting
  - bradlc.vscode-tailwindcss     # Tailwind CSS IntelliSense
  - formulahendry.auto-rename-tag # HTML tag renaming
  - christian-kohler.path-intellisense  # Path completion
```

### Python Development
```yaml
extensions:
  - ms-python.python              # Python language support
  - ms-python.vscode-pylance      # Fast Python IntelliSense
  - ms-python.debugpy             # Python debugging
  - njpwerner.autodocstring       # Python docstrings
```

### Systems Programming (Rust/Zig/C++)
```yaml
extensions:
  - rust-lang.rust-analyzer       # Rust LSP
  - ziglang.vscode-zig            # Zig language support
  - ms-vscode.cpptools            # C/C++ support
  - llvm-vs-code-extensions.vscode-clangd  # Alternative C++ LSP
```

### DevOps & Cloud
```yaml
extensions:
  - ms-azuretools.vscode-docker   # Docker support
  - ms-kubernetes-tools.vscode-kubernetes-tools  # Kubernetes
  - hashicorp.terraform           # Terraform
  - amazonwebservices.aws-toolkit-vscode  # AWS toolkit
```

## Open VSX vs Microsoft Marketplace

### Microsoft Marketplace (OpenVSCode)
- **Pros**: Largest extension catalog (~40,000+), official Microsoft extensions
- **Cons**: Requires internet, telemetry, licensing restrictions

### Open VSX (Code-Server, Theia)
- **Pros**: Open source, privacy-friendly, self-hostable
- **Cons**: Smaller catalog (~3,000+), some popular extensions missing

### Manual Installation
All platforms support manual `.vsix` installation:
1. Download extension from marketplace or build from source
2. Install via `--install-extension path/to/extension.vsix`
3. Works for proprietary extensions if you have the files

## Migration Guide

### From VS Code to OpenVSCode
- ✅ Most extensions work without changes
- ✅ Settings sync compatible
- ⚠️ Some Microsoft-only features unavailable

### From VS Code to Code-Server
- ⚠️ Re-install extensions from Open VSX
- ✅ Settings can be copied
- ⚠️ Some extensions may have different versions

### From VS Code to Theia
- ⚠️ Extensions need to be compatible with Theia
- ⚠️ UI differences require adjustment
- ✅ Most language servers work identically

## Contributing

To add extensions to this compatibility matrix:
1. Test extension on all three platforms
2. Document any issues or limitations
3. Submit PR with updated matrix
4. Include version numbers tested

## Resources

- [Open VSX Registry](https://open-vsx.org/)
- [VS Code Marketplace](https://marketplace.visualstudio.com/)
- [Theia Extensions](https://theia-ide.org/docs/extensions/)
- [Code-Server FAQ](https://github.com/coder/code-server/blob/main/docs/FAQ.md)
