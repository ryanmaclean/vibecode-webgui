# Code-Server VM Build for Alpine Linux ARM64

A lightweight, MIT-licensed VS Code alternative packaged as a minimal VM image for Swift Virtualization.framework.

## Overview

This build creates a minimal Code-Server VM image based on Alpine Linux with musl libc, providing a web-based IDE that's compatible with vfkit and the Virtualization.framework on macOS.

### Key Features

- **Code-Server v4.105.1** (MIT licensed)
- **Alpine Linux base** with musl libc (not glibc)
- **ARM64 architecture** (aarch64)
- **Node.js 20.18.0** (musl build)
- **30-40MB compressed** initramfs target
- **VSIX extension support** with marketplace access
- **LSP ready** (Language Server Protocol)
- **MCP ready** (Model Context Protocol)
- **RAG integration capable**
- **Built-in terminal**
- **Web-based interface** on port 8080

## Architecture

### Components

1. **Code-Server** (114 MB download, ~80 MB installed)
   - Web-based VS Code interface
   - Full extension marketplace support
   - Built-in terminal and LSP support

2. **Node.js musl** (unofficial builds)
   - Compiled against musl libc for Alpine compatibility
   - ARM64 optimized
   - Memory limited to 384 MB (NODE_OPTIONS)

3. **BusyBox** (ARM64)
   - Minimal Unix utilities
   - Network tools (ip, udhcpc)
   - Essential commands

4. **Minimal rootfs**
   - Only necessary dependencies
   - Stripped binaries
   - xz/gzip compression

### Size Breakdown

```
Component           Uncompressed    Compressed (est.)
-------------------------------------------------
Code-Server         ~80 MB          ~25 MB
Node.js (musl)      ~40 MB          ~12 MB
BusyBox + Utils     ~2 MB           ~0.5 MB
Config files        ~1 MB           ~0.1 MB
-------------------------------------------------
Total               ~123 MB         ~38 MB
```

## Build Script

### Location

```bash
~/vibecode-webgui/azure/build-code-server.py
```

### Usage

```bash
# Make executable (already done)
chmod +x ~/vibecode-webgui/azure/build-code-server.py

# Run the build
~/vibecode-webgui/azure/build-code-server.py
```

### Build Process

The script performs the following steps:

1. **Download Components**
   - Code-Server v4.105.1 ARM64 (SHA256 verified)
   - Node.js v20.18.0 musl build
   - BusyBox ARM64 binaries

2. **Create Root Filesystem**
   - Minimal directory structure
   - Only essential directories created

3. **Install Components**
   - Extract Code-Server (selective - only bin, lib, out)
   - Install Node.js runtime
   - Install BusyBox with symlinks

4. **Optimize**
   - Strip all ELF binaries
   - Remove debug symbols
   - Reduce binary sizes

5. **Configure**
   - Create init script with console=hvc0
   - Configure Code-Server for port 8080
   - Setup network (DHCP)
   - Create system files (passwd, group, hosts)

6. **Package**
   - Create CPIO archive
   - Compress with gzip -9
   - Output: `code-server-initramfs.cpio.gz`

## Configuration

### Code-Server Settings

Default configuration at `/home/coder/.config/code-server/config.yaml`:

```yaml
bind-addr: 0.0.0.0:8080
auth: none
cert: false
```

**Note**: Authentication is disabled for development mode. Enable it for production use.

### Init Script Features

The init script (`/init`) provides:

- Serial console output on hvc0
- Automatic network configuration (DHCP)
- IP address detection and display
- Node.js memory optimization (384 MB limit)
- Graceful startup sequence with status messages

### Network Configuration

- **Interface**: Auto-detected (eth0, enp*)
- **DHCP**: Automatic via udhcpc
- **Fallback**: localhost if no network

## Running the VM

### Prerequisites

- vfkit installed
- Kernel: `~/.vfkit/vms/vibecode-alpine/kernel/vmlinux-raw`
- Initramfs: `~/vibecode-webgui/azure/code-server-initramfs.cpio.gz`

### Command

```bash
vfkit \
  --cpus 2 \
  --memory 1024 \
  --kernel ~/.vfkit/vms/vibecode-alpine/kernel/vmlinux-raw \
  --initrd ~/vibecode-webgui/azure/code-server-initramfs.cpio.gz \
  --kernel-cmdline "console=hvc0 quiet" \
  --device virtio-net,nat,mac=52:54:00:12:34:61 \
  --device virtio-rng
```

### Access

1. The VM will boot and display its IP address on the console
2. Open your browser to: `http://<VM-IP>:8080`
3. Code-Server interface will load

Example console output:
```
========================================
  Code-Server VM (Alpine ARM64)
  Version: 4.105.1
========================================

[1/6] Mounting filesystems...
[2/6] Configuring network...
  Found interface: eth0
  IP Address: 192.168.64.5
[3/6] Setting up environment...
[4/6] Configuring Code-Server...
  Configuration:
    Port: 8080
    Auth: disabled (development mode)
    Data dir: /home/coder/.local/share/code-server

[5/6] Starting Code-Server...
========================================
  Code-Server is starting...
  Access URL: http://192.168.64.5:8080

  Features:
    - VSIX extension support
    - Built-in terminal
    - LSP ready
    - MCP ready
    - RAG integration capable

  Press Ctrl+C to stop
========================================

[6/6] Launching Code-Server...
```

## Extension Support

### VSIX Marketplace

Code-Server has full access to the Open VSX Registry:
- https://open-vsx.org/

### Installing Extensions

1. **Via Web UI**: Click Extensions icon, search, and install
2. **Via CLI**: Connect to VM and use `code-server --install-extension <ext-id>`
3. **Via VSIX file**: Upload .vsix file through the UI

### Popular Extensions

- Python (ms-python.python)
- ESLint (dbaeumer.vscode-eslint)
- Prettier (esbenp.prettier-vscode)
- GitLens (eamodio.gitlens)
- Docker (ms-azuretools.vscode-docker)

## Language Server Protocol (LSP)

Code-Server supports LSP for intelligent code completion and navigation. Install language servers as needed:

### Python
```bash
pip install python-lsp-server
```

### JavaScript/TypeScript
Already included with Code-Server

### Go
```bash
go install golang.org/x/tools/gopls@latest
```

### Rust
```bash
rustup component add rust-analyzer
```

## Model Context Protocol (MCP) Integration

Code-Server is MCP-ready. To integrate with MCP servers:

1. Install the MCP extension from Open VSX
2. Configure MCP server endpoints
3. Connect to your MCP services

Example configuration in Code-Server settings.json:
```json
{
  "mcp.servers": [
    {
      "name": "local-mcp",
      "url": "http://localhost:3001"
    }
  ]
}
```

## RAG Integration

For Retrieval-Augmented Generation (RAG) capabilities:

1. Install vector database extensions
2. Configure embeddings
3. Connect to your knowledge base

Compatible with:
- PostgreSQL + pgvector
- Qdrant
- Weaviate
- Pinecone

## Customization

### Modify Init Script

Edit the script at line 186 in `build-code-server.py`:

```python
def create_init_script(self):
    """Create init script"""
    # Modify the init script here
```

### Add Additional Packages

To include more Alpine packages, modify the `create_rootfs_structure` and `extract_and_install_components` methods.

### Change Port

Modify the config.yaml generation in `create_init_script`:

```yaml
bind-addr: 0.0.0.0:3000  # Change to your preferred port
```

### Enable Authentication

Change auth setting:

```yaml
auth: password
```

And set password:
```bash
export PASSWORD="your-secure-password"
```

## Troubleshooting

### VM Won't Boot

- Verify kernel path exists
- Check initramfs was created successfully
- Ensure sufficient memory (minimum 512 MB, recommended 1024 MB)

### Network Issues

- Check virtio-net device is configured
- Verify DHCP server is available
- Try static IP configuration in init script

### Code-Server Won't Start

- Check console output for errors
- Verify Node.js is in PATH
- Ensure sufficient memory
- Check /tmp has write permissions

### Extensions Won't Install

- Verify network connectivity
- Check Open VSX registry is accessible
- Ensure sufficient disk space (tmpfs size)

## Comparison with OpenVSCode Server

| Feature | Code-Server | OpenVSCode Server |
|---------|-------------|-------------------|
| License | MIT | MIT |
| Size | ~38 MB | ~280 MB |
| Authentication | Built-in | External |
| Extensions | Open VSX | Open VSX |
| Mobile Support | Yes | Limited |
| Terminal | Yes | Yes |
| Settings Sync | Yes | Via extension |

## Performance Optimization

### Memory Usage

- Minimum: 512 MB
- Recommended: 1024 MB
- Optimal: 2048 MB

### CPU Usage

- Minimum: 1 vCPU
- Recommended: 2 vCPUs
- Optimal: 4 vCPUs

### Disk Space

tmpfs is used for /tmp and /run:
- Minimum: 512 MB
- Recommended: 1024 MB

## Security Considerations

### Development Mode

The default configuration **disables authentication** for easy development. This is **NOT suitable for production** or exposure to untrusted networks.

### Production Deployment

For production use:

1. Enable authentication:
   ```yaml
   auth: password
   ```

2. Set a strong password:
   ```bash
   export PASSWORD="$(openssl rand -base64 32)"
   ```

3. Enable HTTPS:
   - Generate TLS certificates
   - Configure cert paths in config.yaml

4. Restrict network access:
   - Use firewall rules
   - Bind to localhost only if accessing via reverse proxy

5. Regular updates:
   - Rebuild with latest Code-Server version
   - Update Node.js runtime
   - Apply security patches

## Advanced Usage

### Persistent Storage

To add persistent storage, modify the vfkit command:

```bash
vfkit \
  --cpus 2 \
  --memory 1024 \
  --kernel ~/.vfkit/vms/vibecode-alpine/kernel/vmlinux-raw \
  --initrd ~/vibecode-webgui/azure/code-server-initramfs.cpio.gz \
  --kernel-cmdline "console=hvc0 quiet" \
  --device virtio-net,nat,mac=52:54:00:12:34:61 \
  --device virtio-rng \
  --device virtio-blk,path=/path/to/workspace.img
```

Then mount in init script:
```bash
mount /dev/vda /mnt/workspace
```

### Multi-User Setup

To support multiple users:

1. Create additional user accounts in /etc/passwd
2. Configure Code-Server with workspaces
3. Use authentication with user-specific tokens

### Integration with CI/CD

Code-Server can be integrated into CI/CD pipelines:

```bash
# Start VM
vfkit ... &

# Wait for ready
while ! curl -s http://localhost:8080 >/dev/null; do
  sleep 1
done

# Run automated tests via API
curl -X POST http://localhost:8080/api/...
```

## Development

### Building from Source

To build Code-Server from source (optional):

```bash
git clone https://github.com/coder/code-server
cd code-server
git checkout v4.105.1
npm install
npm run build
npm run package
```

### Custom Builds

Modify `build-code-server.py` to:
- Use custom Code-Server version
- Include additional tools
- Change compression settings
- Add custom scripts

## Support and Resources

### Documentation

- Code-Server: https://coder.com/docs/code-server
- Alpine Linux: https://wiki.alpinelinux.org/
- vfkit: https://github.com/crc-org/vfkit

### Community

- Code-Server GitHub: https://github.com/coder/code-server
- Code-Server Discussions: https://github.com/coder/code-server/discussions
- Alpine Linux Forums: https://forum.alpinelinux.org/

### Issues

Report issues specific to this build at your project repository.

For Code-Server issues: https://github.com/coder/code-server/issues

## License

- **Code-Server**: MIT License
- **Alpine Linux**: Various (mostly MIT, GPL, LGPL)
- **Node.js**: MIT License
- **BusyBox**: GPL v2
- **This Build Script**: (Your license)

## Changelog

### v1.0.0 (2025-10-29)
- Initial release
- Code-Server v4.105.1
- Node.js v20.18.0 (musl)
- Alpine Linux 3.20 base
- ARM64 architecture
- ~38 MB compressed size
- Full VSIX extension support
- LSP and MCP ready
- RAG integration capable

## Future Enhancements

Potential improvements:

1. **Auto-update mechanism**: Check for new Code-Server versions
2. **Extensions preloading**: Bundle popular extensions
3. **Multi-architecture**: Add x86_64 support
4. **Kernel optimization**: Custom minimal kernel (800 KB target)
5. **Persistent configuration**: Save settings across reboots
6. **Cluster support**: Multi-node Code-Server setup
7. **GPU support**: Enable GPU passthrough for ML workloads
8. **Container support**: Built-in Docker/Podman

## Contributing

Contributions welcome! Areas for improvement:

- Size optimization
- Performance tuning
- Additional features
- Documentation
- Testing

## Acknowledgments

- Code-Server team at Coder
- Alpine Linux community
- Node.js unofficial builds maintainers
- BusyBox developers
- vfkit contributors
