// Tauri Command Wrappers for WireGuard VPN
// Exposes WireGuard functionality to the frontend via Tauri commands

use super::{WireGuardConfig, WireGuardInterface, WireGuardManager, WireGuardStatus};
use tauri::command;

/// Check if WireGuard is installed on the system
#[command]
pub async fn wireguard_is_installed() -> Result<bool, String> {
    Ok(WireGuardManager::is_installed())
}

/// Get WireGuard version
#[command]
pub async fn wireguard_get_version() -> Result<String, String> {
    WireGuardManager::get_version()
}

/// List all WireGuard interfaces
#[command]
pub async fn wireguard_list_interfaces() -> Result<Vec<String>, String> {
    WireGuardManager::list_interfaces()
}

/// Get status of a specific WireGuard interface
#[command]
pub async fn wireguard_get_interface_status(interface: String) -> Result<WireGuardInterface, String> {
    WireGuardManager::get_interface_status(&interface)
}

/// Get current WireGuard connection status
#[command]
pub async fn wireguard_status() -> Result<WireGuardStatus, String> {
    WireGuardManager::status()
}

/// Get IP address from WireGuard interface
#[command]
pub async fn wireguard_get_ip(interface: String) -> Result<String, String> {
    WireGuardManager::get_ip(&interface)
}

/// Get secure bind address for services (WireGuard IP only)
#[command]
pub async fn wireguard_get_secure_bind_addr(interface: String, port: u16) -> Result<String, String> {
    WireGuardManager::get_secure_bind_addr(&interface, port)
}

/// Verify WireGuard configuration
#[command]
pub async fn wireguard_verify_configuration(interface: String) -> Result<Vec<String>, String> {
    WireGuardManager::verify_configuration(&interface)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_wireguard_is_installed() {
        let result = wireguard_is_installed().await;
        assert!(result.is_ok());
        println!("WireGuard installed: {}", result.unwrap());
    }

    #[tokio::test]
    async fn test_wireguard_get_version() {
        if wireguard_is_installed().await.unwrap_or(false) {
            match wireguard_get_version().await {
                Ok(version) => {
                    println!("WireGuard version: {}", version);
                    assert!(!version.is_empty());
                }
                Err(e) => {
                    println!("Version error: {}", e);
                }
            }
        }
    }

    #[tokio::test]
    async fn test_wireguard_list_interfaces() {
        if wireguard_is_installed().await.unwrap_or(false) {
            match wireguard_list_interfaces().await {
                Ok(interfaces) => {
                    println!("WireGuard interfaces: {:?}", interfaces);
                }
                Err(e) => {
                    println!("List interfaces error: {}", e);
                }
            }
        }
    }

    #[tokio::test]
    async fn test_wireguard_status() {
        match wireguard_status().await {
            Ok(status) => {
                println!("Installed: {}", status.installed);
                println!("Interface: {:?}", status.interface);
                println!("Public Key: {:?}", status.public_key);
            }
            Err(e) => {
                println!("Status error: {}", e);
            }
        }
    }

    #[tokio::test]
    async fn test_wireguard_get_interface_status() {
        if wireguard_is_installed().await.unwrap_or(false) {
            if let Ok(interfaces) = wireguard_list_interfaces().await {
                if let Some(interface) = interfaces.first() {
                    match wireguard_get_interface_status(interface.clone()).await {
                        Ok(status) => {
                            println!("Interface: {}", status.name);
                            println!("Public Key: {:?}", status.public_key);
                            println!("Listen Port: {:?}", status.listen_port);
                            println!("Peers: {}", status.peers.len());
                        }
                        Err(e) => {
                            println!("Interface status error: {}", e);
                        }
                    }
                }
            }
        }
    }

    #[tokio::test]
    async fn test_wireguard_verify_configuration() {
        if wireguard_is_installed().await.unwrap_or(false) {
            if let Ok(interfaces) = wireguard_list_interfaces().await {
                if let Some(interface) = interfaces.first() {
                    match wireguard_verify_configuration(interface.clone()).await {
                        Ok(messages) => {
                            println!("Configuration verification:");
                            for msg in messages {
                                println!("  {}", msg);
                            }
                        }
                        Err(e) => {
                            println!("Verification error: {}", e);
                        }
                    }
                }
            }
        }
    }
}
