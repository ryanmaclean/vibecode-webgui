# WireGuard Integration as Alternative to Tailscale
**Date**: 2026-02-14
**Status**: 🔬 **RESEARCH & FEASIBILITY**

## Executive Summary

This document explores WireGuard as a self-hosted alternative to Tailscale for zero-trust networking in VibeCode. While Tailscale provides a managed WireGuard solution with coordinated mesh networking, a direct WireGuard integration offers more control, no external dependencies, and full data sovereignty.

## WireGuard vs Tailscale

### Technology Comparison

| Aspect | WireGuard | Tailscale |
|--------|-----------|-----------|
| **Protocol** | WireGuard (direct) | WireGuard (wrapped) |
| **Coordination** | Manual configuration | Automatic mesh |
| **NAT Traversal** | STUN/TURN required | Built-in coordination |
| **Key Management** | Manual | Automatic rotation |
| **ACLs** | iptables/nftables | Built-in policy engine |
| **Deployment** | Self-hosted | SaaS + on-prem |
| **Complexity** | High (manual setup) | Low (automatic) |
| **Cost** | Free (infrastructure only) | Free tier + paid plans |
| **Data Sovereignty** | 100% self-hosted | Coordination server |
| **Audit Trail** | Manual logging | Built-in |

### Security Model

Both use the same WireGuard protocol for encryption:
- ChaCha20 for symmetric encryption
- Poly1305 for authentication
- Curve25519 for key exchange
- BLAKE2s for hashing
- HKDF for key derivation

**Key Difference**: Tailscale adds a coordination layer that manages keys and routing automatically, while pure WireGuard requires manual configuration.

## Architecture Options

### Option 1: Direct WireGuard (Point-to-Point)

```
┌─────────────────────────────────────────────────────┐
│  User's Device                                      │
│  - WireGuard client (wg0)                          │
│  - IP: 10.0.0.1/24                                 │
│  - Public key: CLIENT_PUB                          │
└─────────────────┬───────────────────────────────────┘
                  │ WireGuard Tunnel (UDP 51820)
                  │ Encrypted with shared keys
                  ↓
┌─────────────────────────────────────────────────────┐
│  VibeCode Desktop                                   │
│  - WireGuard interface (wg0)                       │
│  - IP: 10.0.0.2/24                                 │
│  - Public key: SERVER_PUB                          │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │  code-server                                  │ │
│  │  Listen: 10.0.0.2:8080                       │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │  AI Backend                                   │ │
│  │  Listen: 10.0.0.2:3001                       │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Pros**:
- Simple architecture
- Direct connection (lowest latency)
- No coordination server needed
- Full control

**Cons**:
- Manual key exchange
- Manual endpoint configuration
- NAT traversal challenges
- Single point-to-point only

### Option 2: WireGuard + Coordination Server (Headscale)

Headscale is an open-source, self-hosted implementation of the Tailscale coordination server.

```
┌─────────────────────────────────────────────────────┐
│  Headscale Coordination Server (Self-Hosted)        │
│  - Manages peer discovery                          │
│  - Distributes keys and endpoints                  │
│  - ACL policy enforcement                          │
│  - No access to encrypted traffic                  │
│  - Can run on same machine or separate             │
└────────────────────┬────────────────────────────────┘
                     │ HTTPS API
        ┌────────────┴────────────┐
        │                         │
┌───────▼─────────┐    ┌─────────▼──────────┐
│  User Device    │    │  VibeCode Desktop  │
│  WireGuard      │◄───┤  WireGuard         │
│  10.0.0.1       │    │  10.0.0.2          │
└─────────────────┘    └────────────────────┘
     Encrypted WireGuard tunnel (peer-to-peer)
     Coordination server never sees traffic
```

**Pros**:
- Automatic mesh networking
- Automatic NAT traversal
- Tailscale-compatible (can use Tailscale clients)
- Built-in ACLs
- Self-hosted (full control)

**Cons**:
- Additional infrastructure (coordination server)
- More complex setup
- Requires domain/TLS for coordination server

### Option 3: Hybrid (WireGuard + Manual Mesh)

Build custom mesh coordination in Tauri:

```
┌─────────────────────────────────────────────────────┐
│  VibeCode Desktop (Rust)                            │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │  WireGuard Manager (Rust)                     │ │
│  │  - Generate keypairs                          │ │
│  │  - Configure interfaces                       │ │
│  │  - Manage peers                               │ │
│  │  - NAT traversal (STUN)                       │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │  Peer Discovery (mDNS/Bonjour)                │ │
│  │  - Local network discovery                    │ │
│  │  - Key exchange via QR/pairing code           │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

**Pros**:
- No external services
- Complete control
- Custom UX
- Embedded in VibeCode

**Cons**:
- Highest development effort
- Complex NAT traversal
- Key management complexity

## Implementation Approach

### Recommended: Headscale + WireGuard

This provides the best balance of control, security, and usability.

#### Phase 1: Headscale Deployment

**Option A: Embedded Headscale (Recommended)**
```rust
// src-tauri/src/headscale/mod.rs
use std::process::Command;

pub struct HeadscaleManager {
    data_dir: PathBuf,
    port: u16,
}

impl HeadscaleManager {
    /// Start embedded Headscale server
    pub fn start() -> Result<(), Error> {
        // Embed headscale binary in Tauri app
        let headscale_bin = include_bytes!("../bin/headscale");

        Command::new("./headscale")
            .arg("serve")
            .arg("--config")
            .arg("./headscale-config.yaml")
            .spawn()?;

        Ok(())
    }

    /// Create pre-auth key for new device
    pub fn create_auth_key() -> Result<String, Error> {
        let output = Command::new("./headscale")
            .arg("preauthkeys")
            .arg("create")
            .arg("--user")
            .arg("vibecode")
            .output()?;

        Ok(String::from_utf8(output.stdout)?)
    }
}
```

**Option B: Separate Headscale Server**
- Deploy on local NAS/server
- Docker container
- Always-on availability

#### Phase 2: WireGuard Integration

```rust
// src-tauri/src/wireguard/mod.rs
use std::process::Command;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct WireGuardConfig {
    pub interface: String,
    pub private_key: String,
    pub address: String,
    pub listen_port: u16,
    pub peers: Vec<WireGuardPeer>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WireGuardPeer {
    pub public_key: String,
    pub endpoint: Option<String>,
    pub allowed_ips: Vec<String>,
}

pub struct WireGuardManager;

impl WireGuardManager {
    /// Check if WireGuard is installed
    pub fn is_installed() -> bool {
        #[cfg(target_os = "macos")]
        {
            // Check for WireGuard.app or wireguard-tools
            Command::new("which")
                .arg("wg")
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
        }

        #[cfg(target_os = "linux")]
        {
            // Check for wireguard kernel module or wireguard-go
            std::path::Path::new("/sys/module/wireguard").exists() ||
            Command::new("which").arg("wg").output().map(|o| o.status.success()).unwrap_or(false)
        }

        #[cfg(target_os = "windows")]
        {
            // Check for WireGuard Windows service
            Command::new("sc")
                .args(&["query", "WireGuardTunnel$wg0"])
                .output()
                .map(|o| o.status.success())
                .unwrap_or(false)
        }
    }

    /// Generate WireGuard keypair
    pub fn generate_keypair() -> Result<(String, String), Error> {
        // Generate private key
        let private_key = Command::new("wg")
            .arg("genkey")
            .output()?;
        let private_key = String::from_utf8(private_key.stdout)?
            .trim()
            .to_string();

        // Derive public key
        let public_key = Command::new("wg")
            .arg("pubkey")
            .stdin(std::process::Stdio::piped())
            .output()?;
        let public_key = String::from_utf8(public_key.stdout)?
            .trim()
            .to_string();

        Ok((private_key, public_key))
    }

    /// Configure WireGuard interface
    pub fn configure(config: &WireGuardConfig) -> Result<(), Error> {
        // Write configuration file
        let config_path = format!("/etc/wireguard/{}.conf", config.interface);
        let mut conf = format!(
            "[Interface]\n\
             PrivateKey = {}\n\
             Address = {}\n\
             ListenPort = {}\n\n",
            config.private_key,
            config.address,
            config.listen_port
        );

        // Add peers
        for peer in &config.peers {
            conf.push_str(&format!(
                "[Peer]\n\
                 PublicKey = {}\n\
                 AllowedIPs = {}\n",
                peer.public_key,
                peer.allowed_ips.join(",")
            ));

            if let Some(endpoint) = &peer.endpoint {
                conf.push_str(&format!("Endpoint = {}\n", endpoint));
            }

            conf.push_str("\n");
        }

        std::fs::write(&config_path, conf)?;

        // Bring up interface
        Command::new("wg-quick")
            .arg("up")
            .arg(&config.interface)
            .output()?;

        Ok(())
    }

    /// Get current WireGuard status
    pub fn status(interface: &str) -> Result<WireGuardStatus, Error> {
        let output = Command::new("wg")
            .arg("show")
            .arg(interface)
            .arg("dump")
            .output()?;

        // Parse output
        let status = String::from_utf8(output.stdout)?;

        // TODO: Parse dump format into WireGuardStatus struct

        Ok(WireGuardStatus::default())
    }

    /// Get WireGuard interface IP
    pub fn get_ip(interface: &str) -> Result<String, Error> {
        #[cfg(unix)]
        {
            let output = Command::new("ip")
                .args(&["addr", "show", interface])
                .output()?;

            let output = String::from_utf8(output.stdout)?;

            // Parse IP from output
            // Example: inet 10.0.0.2/24 scope global wg0
            for line in output.lines() {
                if line.contains("inet ") {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if let Some(ip) = parts.get(1) {
                        return Ok(ip.split('/').next().unwrap().to_string());
                    }
                }
            }
        }

        Err("Could not determine IP".into())
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct WireGuardStatus {
    pub connected: bool,
    pub interface: String,
    pub ip: Option<String>,
    pub peers: Vec<PeerStatus>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PeerStatus {
    pub public_key: String,
    pub endpoint: Option<String>,
    pub latest_handshake: Option<u64>,
    pub transfer_rx: u64,
    pub transfer_tx: u64,
}
```

#### Phase 3: Tauri Commands

```rust
// src-tauri/src/commands.rs
use crate::wireguard::WireGuardManager;
use crate::headscale::HeadscaleManager;

#[tauri::command]
pub async fn check_wireguard() -> Result<bool, String> {
    Ok(WireGuardManager::is_installed())
}

#[tauri::command]
pub async fn get_wireguard_status(interface: String) -> Result<WireGuardStatus, String> {
    WireGuardManager::status(&interface)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn setup_wireguard() -> Result<String, String> {
    // 1. Start embedded Headscale (if not running)
    HeadscaleManager::start()
        .map_err(|e| format!("Failed to start Headscale: {}", e))?;

    // 2. Generate keypair
    let (private_key, public_key) = WireGuardManager::generate_keypair()
        .map_err(|e| format!("Failed to generate keys: {}", e))?;

    // 3. Register with Headscale
    let auth_key = HeadscaleManager::create_auth_key()
        .map_err(|e| format!("Failed to create auth key: {}", e))?;

    // 4. Configure WireGuard
    let config = WireGuardConfig {
        interface: "wg0".to_string(),
        private_key,
        address: "10.0.0.2/24".to_string(),
        listen_port: 51820,
        peers: vec![], // Managed by Headscale
    };

    WireGuardManager::configure(&config)
        .map_err(|e| format!("Failed to configure WireGuard: {}", e))?;

    Ok(public_key)
}

#[tauri::command]
pub async fn start_secure_services() -> Result<Vec<String>, String> {
    // Get WireGuard IP
    let wg_ip = WireGuardManager::get_ip("wg0")
        .map_err(|e| format!("WireGuard not configured: {}", e))?;

    // Start code-server on WireGuard IP only
    Command::new("code-server")
        .arg("--bind-addr")
        .arg(format!("{}:8080", wg_ip))
        .arg("--auth")
        .arg("none")
        .spawn()
        .map_err(|e| format!("Failed to start code-server: {}", e))?;

    Ok(vec![
        format!("http://{}:8080", wg_ip),
        format!("http://{}:3001", wg_ip),
    ])
}
```

#### Phase 4: User Experience

```typescript
// src/components/WireGuardSetup.tsx
import { invoke } from '@tauri-apps/api';
import { useState } from 'react';

export function WireGuardSetup() {
  const [status, setStatus] = useState<'checking' | 'not_installed' | 'ready' | 'connected'>('checking');
  const [publicKey, setPublicKey] = useState<string>('');

  async function checkStatus() {
    const installed = await invoke('check_wireguard');

    if (!installed) {
      setStatus('not_installed');
      return;
    }

    try {
      const wgStatus = await invoke('get_wireguard_status', { interface: 'wg0' });
      setStatus(wgStatus.connected ? 'connected' : 'ready');
    } catch {
      setStatus('ready');
    }
  }

  async function setup() {
    try {
      const pubKey = await invoke('setup_wireguard');
      setPublicKey(pubKey);
      setStatus('connected');

      // Start services
      await invoke('start_secure_services');
    } catch (error) {
      alert(`Setup failed: ${error}`);
    }
  }

  if (status === 'not_installed') {
    return (
      <div className="setup-panel">
        <h3>⚠️ WireGuard Not Installed</h3>
        <p>Install WireGuard to enable secure zero-trust networking:</p>
        <ul>
          <li>macOS: <code>brew install wireguard-tools</code></li>
          <li>Linux: <code>sudo apt install wireguard</code></li>
          <li>Windows: Download from <a href="https://www.wireguard.com/install/">wireguard.com</a></li>
        </ul>
      </div>
    );
  }

  if (status === 'ready') {
    return (
      <div className="setup-panel">
        <h3>🔧 WireGuard Setup</h3>
        <p>Click to configure secure networking:</p>
        <button onClick={setup}>Setup WireGuard</button>
      </div>
    );
  }

  if (status === 'connected') {
    return (
      <div className="status-panel success">
        <h3>🔒 Secure Connection Active</h3>
        <p>WireGuard tunnel established</p>
        <details>
          <summary>Connection Details</summary>
          <pre>Public Key: {publicKey}</pre>
        </details>
      </div>
    );
  }

  return <div>Checking WireGuard status...</div>;
}
```

## NAT Traversal Strategy

### Problem
Direct WireGuard requires knowing peer endpoints (IP:port), which is challenging behind NAT/firewall.

### Solutions

#### 1. Headscale (Recommended)
Headscale handles NAT traversal automatically:
- DERP relay servers for holepunching
- Automatic endpoint discovery
- Fallback relay when direct connection fails

#### 2. Manual STUN/TURN
For direct WireGuard without Headscale:

```rust
// src-tauri/src/nat/stun.rs
use stun_client::StunClient;

pub async fn discover_public_endpoint() -> Result<SocketAddr, Error> {
    let stun_server = "stun.l.google.com:19302";
    let client = StunClient::new(stun_server);
    let public_addr = client.query_external_address().await?;
    Ok(public_addr)
}
```

#### 3. UPnP/NAT-PMP
Automatic port forwarding:

```rust
// src-tauri/src/nat/upnp.rs
use igd::Gateway;

pub fn setup_port_forwarding(port: u16) -> Result<(), Error> {
    let gateway = igd::search_gateway(Default::default())?;

    gateway.add_port(
        igd::PortMappingProtocol::UDP,
        port,
        SocketAddrV4::new(local_ip()?, port),
        3600, // 1 hour lease
        "VibeCode WireGuard",
    )?;

    Ok(())
}
```

## Security Considerations

### Key Management

**Challenge**: Secure key generation and storage

**Solution**:
```rust
// Use system keychain for private key storage
use keyring::Entry;

pub fn store_private_key(key: &str) -> Result<(), Error> {
    let entry = Entry::new("com.vibecode.wireguard", "private_key")?;
    entry.set_password(key)?;
    Ok(())
}

pub fn retrieve_private_key() -> Result<String, Error> {
    let entry = Entry::new("com.vibecode.wireguard", "private_key")?;
    Ok(entry.get_password()?)
}
```

### Access Control

**With Headscale**:
```yaml
# headscale-acl.yaml
acls:
  - action: accept
    src:
      - "user:vibecode"
    dst:
      - "tag:code-server:8080"
      - "tag:ai-backend:3001"
```

**Without Headscale** (using iptables):
```rust
// src-tauri/src/firewall/mod.rs
pub fn configure_firewall(wg_interface: &str) -> Result<(), Error> {
    // Allow only WireGuard interface to access services
    Command::new("iptables")
        .args(&[
            "-A", "INPUT",
            "-i", wg_interface,
            "-p", "tcp",
            "--dport", "8080",
            "-j", "ACCEPT"
        ])
        .output()?;

    // Drop all other traffic to port 8080
    Command::new("iptables")
        .args(&[
            "-A", "INPUT",
            "-p", "tcp",
            "--dport", "8080",
            "-j", "DROP"
        ])
        .output()?;

    Ok(())
}
```

## Platform Support

### macOS
- WireGuard.app (GUI)
- wireguard-tools (CLI)
- Requires admin privileges for interface creation

### Linux
- Kernel module (built-in on modern kernels)
- wireguard-tools
- May require capabilities: `CAP_NET_ADMIN`

### Windows
- WireGuard for Windows
- Service-based architecture
- Requires admin privileges

### Platform-Specific Code
```rust
#[cfg(target_os = "macos")]
pub fn install_wireguard() -> Result<(), Error> {
    Command::new("brew")
        .args(&["install", "wireguard-tools"])
        .status()?;
    Ok(())
}

#[cfg(target_os = "linux")]
pub fn install_wireguard() -> Result<(), Error> {
    // Detect distro and use appropriate package manager
    if Path::new("/etc/debian_version").exists() {
        Command::new("sudo")
            .args(&["apt", "install", "-y", "wireguard"])
            .status()?;
    } else if Path::new("/etc/redhat-release").exists() {
        Command::new("sudo")
            .args(&["dnf", "install", "-y", "wireguard-tools"])
            .status()?;
    }
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn install_wireguard() -> Result<(), Error> {
    // Download and run installer
    // Or: winget install WireGuard.WireGuard
    Command::new("winget")
        .args(&["install", "WireGuard.WireGuard"])
        .status()?;
    Ok(())
}
```

## Deployment Models

### 1. Fully Embedded (Simplest for Users)
```
VibeCode Desktop contains:
- Embedded Headscale binary
- WireGuard configuration manager
- Automatic setup wizard
```

**Pros**: Zero external dependencies, one-click setup
**Cons**: Requires always-on desktop app for coordination

### 2. Optional Separate Server
```
User can choose:
- Embedded mode (desktop-based)
- Server mode (NAS/VPS for always-on)
```

**Pros**: Flexibility, can migrate to server later
**Cons**: More complex setup options

### 3. Hybrid
```
- Desktop uses embedded Headscale
- Optionally sync to cloud for multi-device
```

**Pros**: Best of both worlds
**Cons**: Most complex

## Performance Comparison

### Latency
- **Direct WireGuard**: ~1ms overhead
- **WireGuard + Headscale (direct)**: ~1ms overhead
- **WireGuard + Headscale (relayed)**: ~10-50ms overhead
- **Tailscale**: ~1-50ms (same as Headscale)

### Throughput
- **Direct WireGuard**: ~1-10 Gbps (CPU-limited)
- **Same with Tailscale/Headscale**: Same performance

### Resource Usage
- **WireGuard kernel module**: <10MB RAM
- **Headscale server**: ~20-50MB RAM
- **Tailscale client**: ~50-100MB RAM

## Cost Analysis

### Infrastructure Costs

**Tailscale**:
- Free: Up to 3 users, 100 devices
- Personal Pro: $48/year
- Team: $5/user/month

**WireGuard + Headscale**:
- WireGuard: Free (open source)
- Headscale: Free (open source)
- Infrastructure: $0 (embedded) or $5-10/month (VPS)

### Development Costs

**Tailscale Integration**: ~2 weeks
- Simple API integration
- Minimal NAT traversal code
- Built-in coordination

**WireGuard + Headscale**: ~4-6 weeks
- WireGuard interface management
- Headscale deployment/embedding
- NAT traversal implementation
- Key management system
- Platform-specific code

**Direct WireGuard** (no Headscale): ~8-12 weeks
- All of above plus:
- Custom mesh coordination
- Manual NAT traversal
- Custom key distribution

## Recommendation

### Short Term: Tailscale
**Reasoning**:
- Fastest time-to-market (2 weeks)
- Proven NAT traversal
- Built-in coordination
- Lower development risk
- Free for most users

### Long Term: WireGuard + Headscale
**Reasoning**:
- Full data sovereignty
- No external service dependency
- Can embed in VibeCode Desktop
- Compatible with Tailscale clients (migration path)
- Lower operating costs at scale

### Migration Path

**Phase 1** (Now): Implement Tailscale
- Quick wins on security
- Validate zero-trust architecture
- User feedback on UX

**Phase 2** (3-6 months): Add Headscale support
- Develop in parallel
- Beta test with power users
- Maintain Tailscale compatibility

**Phase 3** (6-12 months): Promote self-hosted
- Offer embedded Headscale as default
- Keep Tailscale as fallback
- Gradual migration for existing users

## Implementation Checklist

### Prerequisites
- [ ] WireGuard kernel module/userspace
- [ ] Headscale binary (for coordination option)
- [ ] Rust WireGuard bindings
- [ ] Platform detection logic

### Phase 1: Core WireGuard (Week 1-2)
- [ ] WireGuard detection
- [ ] Keypair generation
- [ ] Interface configuration
- [ ] Status monitoring
- [ ] IP address retrieval

### Phase 2: Headscale Integration (Week 3-4)
- [ ] Embed Headscale binary
- [ ] Auto-start coordination server
- [ ] Peer registration
- [ ] ACL configuration
- [ ] Key distribution

### Phase 3: Service Binding (Week 5)
- [ ] Bind code-server to WireGuard IP
- [ ] Bind AI backend to WireGuard IP
- [ ] Firewall configuration
- [ ] Service health checks

### Phase 4: UX (Week 6)
- [ ] Setup wizard
- [ ] Status dashboard
- [ ] Connection troubleshooting
- [ ] Platform-specific install guides

### Phase 5: Testing (Week 7-8)
- [ ] Cross-platform testing
- [ ] NAT traversal testing
- [ ] Performance benchmarks
- [ ] Security audit
- [ ] Documentation

## Testing Strategy

### Unit Tests
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keypair_generation() {
        let (priv_key, pub_key) = WireGuardManager::generate_keypair().unwrap();
        assert_eq!(priv_key.len(), 44); // Base64-encoded 32 bytes
        assert_eq!(pub_key.len(), 44);
    }

    #[test]
    fn test_config_generation() {
        let config = WireGuardConfig {
            interface: "wg0".to_string(),
            private_key: "PRIVATE_KEY".to_string(),
            address: "10.0.0.2/24".to_string(),
            listen_port: 51820,
            peers: vec![],
        };

        // Test config file generation
    }
}
```

### Integration Tests
```bash
# Test WireGuard interface creation
sudo wg-quick up wg0
ip addr show wg0

# Test connectivity
ping 10.0.0.2

# Test service binding
curl http://10.0.0.2:8080

# Test from outside WireGuard (should fail)
curl http://192.168.1.100:8080  # Connection refused ✅
```

### Security Tests
```bash
# Verify encryption
tcpdump -i wg0 -n
# Should show encrypted WireGuard packets

# Verify no public exposure
nmap -p 8080 <public-ip>
# Should show port filtered/closed ✅

# Verify firewall rules
iptables -L -n | grep 8080
```

## Risks and Mitigations

### Risk 1: Complex NAT Traversal
**Impact**: Users behind strict NAT can't connect
**Mitigation**: Use Headscale with DERP relay fallback

### Risk 2: Platform-Specific Issues
**Impact**: Different behavior on macOS/Linux/Windows
**Mitigation**: Extensive cross-platform testing, platform-specific code paths

### Risk 3: Key Management Complexity
**Impact**: Users lose private keys, security compromise
**Mitigation**: Use system keychain, backup procedures, key rotation

### Risk 4: Privilege Requirements
**Impact**: WireGuard requires admin/root on most platforms
**Mitigation**: Proper privilege escalation prompts, clear user messaging

### Risk 5: Development Complexity
**Impact**: Longer time-to-market than Tailscale
**Mitigation**: Start with Tailscale, migrate to WireGuard+Headscale later

## Conclusion

### WireGuard + Headscale is Viable

**Technical Feasibility**: ✅ High
- WireGuard is mature and well-supported
- Headscale provides Tailscale-compatible coordination
- Can be embedded in Tauri app

**Security Posture**: ✅ Equivalent to Tailscale
- Same encryption (WireGuard protocol)
- Self-hosted coordination (better data sovereignty)
- Full control over infrastructure

**Development Effort**: ⚠️ Higher than Tailscale
- 4-6 weeks vs 2 weeks for Tailscale
- More platform-specific code
- More testing required

**User Experience**: ⚠️ Requires More Setup
- Manual WireGuard installation
- Coordination server deployment (if separate)
- More moving parts

### Recommended Approach

1. **Implement Tailscale first** (2 weeks)
   - Validate architecture
   - Get user feedback
   - Establish security baseline

2. **Develop WireGuard+Headscale in parallel** (6 weeks)
   - Offer as "Advanced" option
   - Beta test with power users
   - Maintain Tailscale compatibility

3. **Gradual Migration** (ongoing)
   - Promote self-hosted for privacy-conscious users
   - Keep Tailscale as "Easy" option
   - Both use WireGuard underneath

### Key Advantages of WireGuard+Headscale

1. **Data Sovereignty**: No external coordination server
2. **Cost**: Zero recurring costs
3. **Control**: Full customization of policies
4. **Embedding**: Can ship entire stack in VibeCode
5. **Compliance**: Easier for regulated industries

### When to Choose WireGuard over Tailscale

- Privacy-critical deployments
- Air-gapped networks
- Enterprise with existing WireGuard
- Cost-sensitive at scale (100+ users)
- Full data sovereignty required

---

**Status**: Research Complete ✅
**Recommendation**: Implement Tailscale now, WireGuard+Headscale as phase 2
**Timeline**: 2 weeks (Tailscale) + 6 weeks (WireGuard) = 8 weeks total
**Next Steps**: Begin Tailscale integration per `ZERO_TRUST_ARCHITECTURE.md`
