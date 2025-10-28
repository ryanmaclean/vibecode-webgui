# GenAI VM Quick Reference

## 🚀 Access Your GenAI VM

### Local Access (Primary)
```bash
limactl shell vibecode-minimal
```

### Remote Access (Tailscale)
```bash
ssh studio@100.81.117.81
```

## 🤖 Available AI Tools

| Tool | Command | Version | Status |
|------|---------|---------|--------|
| Claude Code | `claude` | v2.0.26 | ✅ Ready |
| OpenAI Codex | `codex` | v0.48.0 | ✅ Ready |
| just-every/code | `coder` | v0.2.188 | ✅ Ready |
| Google Gemini | `gemini` | v0.10.0 | ✅ Ready |
| OpenCode | `opencode` | v0.15.16 | ✅ Ready |
| Aider | `~/ai-tools/bin/python3 -m aider` | v0.2.6 | ✅ Ready |

## 🔧 VM Management

```bash
# Start VM
limactl start vibecode-minimal

# Stop VM  
limactl stop vibecode-minimal

# Check status
limactl list

# Check Tailscale
limactl shell vibecode-minimal -- tailscale status
```

## 🌐 Tailscale Info

- **IP**: `100.81.117.81`
- **IPv6**: `fd7a:115c:a1e0::b01:756b`
- **Hostname**: `lima-vibecode-minimal`

## 🧪 Test All Tools

```bash
# Connect to VM
limactl shell vibecode-minimal

# Test each tool
claude --version
codex --version  
coder --version
gemini --version
opencode --version
~/ai-tools/bin/python3 -m aider --version
```

## 📖 Full Documentation

See [GenAI VM Setup Guide](docs/genai-vm-setup.md) for complete details.

---

**VM Status**: ✅ Running and Ready  
**Tailscale**: ✅ Connected (`100.81.117.81`)  
**AI Tools**: ✅ All Installed and Working
