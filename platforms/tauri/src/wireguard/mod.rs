// WireGuard VPN Module
// Provides secure, encrypted networking with WireGuard

pub mod commands;
pub use commands::*;

use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WireGuardStatus {
    pub installed: bool,
    pub interface: Option<String>,
    pub public_key: Option<String>,
    pub endpoint: Option<String>,
    pub allowed_ips: Vec<String>,
    pub latest_handshake: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WireGuardConfig {
    pub enabled: bool,
    pub auto_start: bool,
    pub interface_name: String,
    pub bind_services: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WireGuardInterface {
    pub name: String,
    pub public_key: Option<String>,
    pub listen_port: Option<u16>,
    pub peers: Vec<WireGuardPeer>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WireGuardPeer {
    pub public_key: String,
    pub endpoint: Option<String>,
    pub allowed_ips: Vec<String>,
    pub latest_handshake: Option<String>,
    pub transfer_rx: u64,
    pub transfer_tx: u64,
}

pub struct WireGuardManager;

impl WireGuardManager {
    /// Check if WireGuard is installed on the system
    pub fn is_installed() -> bool {
        Command::new("wg").arg("version").output().is_ok()
    }

    /// Get WireGuard version
    pub fn get_version() -> Result<String, String> {
        if !Self::is_installed() {
            return Err("WireGuard not installed".to_string());
        }

        let output = Command::new("wg")
            .arg("version")
            .output()
            .map_err(|e| format!("Failed to get WireGuard version: {}", e))?;

        if !output.status.success() {
            return Err("Failed to get WireGuard version".to_string());
        }

        let version = String::from_utf8(output.stdout)
            .map_err(|e| format!("Failed to parse version: {}", e))?
            .trim()
            .to_string();

        Ok(version)
    }

    /// List all WireGuard interfaces
    pub fn list_interfaces() -> Result<Vec<String>, String> {
        if !Self::is_installed() {
            return Err("WireGuard not installed".to_string());
        }

        let output = Command::new("wg")
            .arg("show")
            .arg("interfaces")
            .output()
            .map_err(|e| format!("Failed to list interfaces: {}", e))?;

        if !output.status.success() {
            return Ok(Vec::new());
        }

        let interfaces_str = String::from_utf8(output.stdout)
            .map_err(|e| format!("Failed to parse interfaces: {}", e))?;

        let interfaces: Vec<String> = interfaces_str
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();

        Ok(interfaces)
    }

    /// Get status of a specific WireGuard interface
    pub fn get_interface_status(interface: &str) -> Result<WireGuardInterface, String> {
        if !Self::is_installed() {
            return Err("WireGuard not installed".to_string());
        }

        let output = Command::new("wg")
            .arg("show")
            .arg(interface)
            .arg("dump")
            .output()
            .map_err(|e| format!("Failed to get interface status: {}", e))?;

        if !output.status.success() {
            return Err(format!("Interface {} not found", interface));
        }

        let dump = String::from_utf8(output.stdout)
            .map_err(|e| format!("Failed to parse interface data: {}", e))?;

        Self::parse_interface_dump(interface, &dump)
    }

    /// Parse WireGuard dump output
    fn parse_interface_dump(
        interface_name: &str,
        dump: &str,
    ) -> Result<WireGuardInterface, String> {
        let lines: Vec<&str> = dump.lines().collect();

        if lines.is_empty() {
            return Err("Empty dump output".to_string());
        }

        // First line is interface info
        let interface_parts: Vec<&str> = lines[0].split('\t').collect();
        let public_key = interface_parts.get(1).map(|s| s.to_string());
        let listen_port = interface_parts
            .get(2)
            .and_then(|s| s.parse::<u16>().ok());

        // Remaining lines are peers
        let mut peers = Vec::new();
        for line in &lines[1..] {
            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() >= 4 {
                let peer = WireGuardPeer {
                    public_key: parts[0].to_string(),
                    endpoint: parts.get(2).map(|s| s.to_string()).filter(|s| !s.is_empty()),
                    allowed_ips: parts
                        .get(3)
                        .map(|s| s.split(',').map(|ip| ip.to_string()).collect())
                        .unwrap_or_default(),
                    latest_handshake: parts.get(4).map(|s| s.to_string()),
                    transfer_rx: parts.get(5).and_then(|s| s.parse().ok()).unwrap_or(0),
                    transfer_tx: parts.get(6).and_then(|s| s.parse().ok()).unwrap_or(0),
                };
                peers.push(peer);
            }
        }

        Ok(WireGuardInterface {
            name: interface_name.to_string(),
            public_key,
            listen_port,
            peers,
        })
    }

    /// Get current WireGuard connection status (checks first available interface)
    pub fn status() -> Result<WireGuardStatus, String> {
        if !Self::is_installed() {
            return Ok(WireGuardStatus {
                installed: false,
                interface: None,
                public_key: None,
                endpoint: None,
                allowed_ips: Vec::new(),
                latest_handshake: None,
            });
        }

        let interfaces = Self::list_interfaces()?;

        if interfaces.is_empty() {
            return Ok(WireGuardStatus {
                installed: true,
                interface: None,
                public_key: None,
                endpoint: None,
                allowed_ips: Vec::new(),
                latest_handshake: None,
            });
        }

        // Get status of first interface
        let interface_name = &interfaces[0];
        let interface = Self::get_interface_status(interface_name)?;

        // Get info from first peer if available
        let first_peer = interface.peers.first();

        Ok(WireGuardStatus {
            installed: true,
            interface: Some(interface.name.clone()),
            public_key: interface.public_key,
            endpoint: first_peer.and_then(|p| p.endpoint.clone()),
            allowed_ips: first_peer
                .map(|p| p.allowed_ips.clone())
                .unwrap_or_default(),
            latest_handshake: first_peer.and_then(|p| p.latest_handshake.clone()),
        })
    }

    /// Get IP address from interface
    pub fn get_ip(interface: &str) -> Result<String, String> {
        #[cfg(target_os = "linux")]
        {
            let output = Command::new("ip")
                .arg("addr")
                .arg("show")
                .arg(interface)
                .output()
                .map_err(|e| format!("Failed to get interface IP: {}", e))?;

            if !output.status.success() {
                return Err(format!("Interface {} not found", interface));
            }

            let output_str = String::from_utf8(output.stdout)
                .map_err(|e| format!("Failed to parse IP output: {}", e))?;

            // Parse IP address from output
            for line in output_str.lines() {
                if line.contains("inet ") {
                    if let Some(ip_part) = line.trim().split_whitespace().nth(1) {
                        if let Some(ip) = ip_part.split('/').next() {
                            return Ok(ip.to_string());
                        }
                    }
                }
            }

            Err("No IP address found".to_string())
        }

        #[cfg(not(target_os = "linux"))]
        {
            let output = Command::new("ifconfig")
                .arg(interface)
                .output()
                .map_err(|e| format!("Failed to get interface IP: {}", e))?;

            if !output.status.success() {
                return Err(format!("Interface {} not found", interface));
            }

            let output_str = String::from_utf8(output.stdout)
                .map_err(|e| format!("Failed to parse IP output: {}", e))?;

            // Parse IP address from ifconfig output
            for line in output_str.lines() {
                if line.contains("inet ") {
                    if let Some(ip_part) = line.trim().split_whitespace().nth(1) {
                        return Ok(ip_part.to_string());
                    }
                }
            }

            Err("No IP address found".to_string())
        }
    }

    /// Get secure bind address for services (WireGuard IP only)
    pub fn get_secure_bind_addr(interface: &str, port: u16) -> Result<String, String> {
        let ip = Self::get_ip(interface)?;
        Ok(format!("{}:{}", ip, port))
    }

    /// Verify WireGuard configuration
    pub fn verify_configuration(interface: &str) -> Result<Vec<String>, String> {
        let mut messages = Vec::new();

        // Check if interface exists
        let interfaces = Self::list_interfaces()?;
        if !interfaces.contains(&interface.to_string()) {
            return Err(format!("❌ Interface {} not found", interface));
        }

        messages.push(format!("✅ Interface {} exists", interface));

        // Check interface status
        match Self::get_interface_status(interface) {
            Ok(iface) => {
                if let Some(pubkey) = &iface.public_key {
                    messages.push(format!("✅ Public key configured: {}...", &pubkey[..16]));
                }

                if iface.peers.is_empty() {
                    messages.push("⚠️ No peers configured".to_string());
                } else {
                    messages.push(format!("✅ {} peer(s) configured", iface.peers.len()));
                }
            }
            Err(e) => {
                return Err(format!("❌ Failed to get interface status: {}", e));
            }
        }

        Ok(messages)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Unit Tests - WireGuardStatus
    #[test]
    fn test_wireguard_status_serialization() {
        let status = WireGuardStatus {
            installed: true,
            interface: Some("wg0".to_string()),
            public_key: Some("test-public-key".to_string()),
            endpoint: Some("192.168.1.1:51820".to_string()),
            allowed_ips: vec!["10.0.0.0/24".to_string()],
            latest_handshake: Some("1234567890".to_string()),
        };

        // Test serialization
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("wg0"));
        assert!(json.contains("test-public-key"));
        assert!(json.contains("192.168.1.1:51820"));

        // Test deserialization
        let deserialized: WireGuardStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.installed, true);
        assert_eq!(deserialized.interface, Some("wg0".to_string()));
    }

    #[test]
    fn test_wireguard_config_default() {
        let config = WireGuardConfig {
            enabled: true,
            auto_start: true,
            interface_name: "wg0".to_string(),
            bind_services: true,
        };

        assert!(config.enabled);
        assert!(config.auto_start);
        assert_eq!(config.interface_name, "wg0");
    }

    #[test]
    fn test_wireguard_interface_serialization() {
        let interface = WireGuardInterface {
            name: "wg0".to_string(),
            public_key: Some("test-key".to_string()),
            listen_port: Some(51820),
            peers: vec![],
        };

        let json = serde_json::to_string(&interface).unwrap();
        assert!(json.contains("wg0"));
        assert!(json.contains("51820"));
    }

    #[test]
    fn test_wireguard_peer_serialization() {
        let peer = WireGuardPeer {
            public_key: "peer-key".to_string(),
            endpoint: Some("192.168.1.1:51820".to_string()),
            allowed_ips: vec!["10.0.0.0/24".to_string()],
            latest_handshake: Some("1234567890".to_string()),
            transfer_rx: 1024,
            transfer_tx: 2048,
        };

        let json = serde_json::to_string(&peer).unwrap();
        assert!(json.contains("peer-key"));
        assert!(json.contains("192.168.1.1:51820"));
        assert!(json.contains("1024"));
        assert!(json.contains("2048"));
    }

    // Integration Tests - WireGuardManager
    #[test]
    fn test_wireguard_is_installed() {
        let installed = WireGuardManager::is_installed();
        println!("WireGuard installed: {}", installed);
        // Don't assert - WireGuard may not be installed in test environment
    }

    #[test]
    fn test_wireguard_get_version() {
        if WireGuardManager::is_installed() {
            match WireGuardManager::get_version() {
                Ok(version) => {
                    println!("WireGuard version: {}", version);
                    assert!(!version.is_empty());
                }
                Err(e) => {
                    println!("Failed to get version: {}", e);
                }
            }
        }
    }

    #[test]
    fn test_wireguard_list_interfaces() {
        if WireGuardManager::is_installed() {
            match WireGuardManager::list_interfaces() {
                Ok(interfaces) => {
                    println!("WireGuard interfaces: {:?}", interfaces);
                }
                Err(e) => {
                    println!("Failed to list interfaces: {}", e);
                }
            }
        }
    }

    #[test]
    fn test_wireguard_status() {
        match WireGuardManager::status() {
            Ok(status) => {
                println!("WireGuard status: {:?}", status);
                assert!(status.installed == WireGuardManager::is_installed());
            }
            Err(e) => {
                println!("Status error: {}", e);
            }
        }
    }
}
