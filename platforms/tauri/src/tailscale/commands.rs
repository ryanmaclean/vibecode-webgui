// Tauri Command Wrappers for Tailscale Zero-Trust Networking
// Exposes Tailscale functionality to the frontend via Tauri commands

use super::{TailscaleConfig, TailscaleManager, TailscaleStatus};
use tauri::command;

/// Check if Tailscale is installed on the system
#[command]
pub async fn tailscale_is_installed() -> Result<bool, String> {
    Ok(TailscaleManager::is_installed())
}

/// Get current Tailscale connection status
#[command]
pub async fn tailscale_status() -> Result<TailscaleStatus, String> {
    TailscaleManager::status()
}

/// Get Tailscale IP address
#[command]
pub async fn tailscale_get_ip() -> Result<String, String> {
    TailscaleManager::get_ip()
}

/// Get secure bind address for services (Tailscale IP only)
#[command]
pub async fn tailscale_get_secure_bind_addr(port: u16) -> Result<String, String> {
    TailscaleManager::get_secure_bind_addr(port)
}

/// Start code-server bound to Tailscale IP ONLY (secure)
#[command]
pub async fn tailscale_start_code_server_secure(port: u16) -> Result<String, String> {
    TailscaleManager::start_code_server_secure(port)
}

/// Check if a service is accessible (for testing)
#[command]
pub async fn tailscale_check_service_accessible(port: u16) -> Result<bool, String> {
    TailscaleManager::check_service_accessible(port)
}

/// Get Tailscale network info
#[command]
pub async fn tailscale_get_network_info() -> Result<serde_json::Value, String> {
    TailscaleManager::get_network_info()
}

/// Verify zero-trust configuration
#[command]
pub async fn tailscale_verify_zero_trust() -> Result<Vec<String>, String> {
    TailscaleManager::verify_zero_trust()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_tailscale_is_installed() {
        let result = tailscale_is_installed().await;
        assert!(result.is_ok());
        println!("Tailscale installed: {}", result.unwrap());
    }

    #[tokio::test]
    async fn test_tailscale_status() {
        if tailscale_is_installed().await.unwrap_or(false) {
            match tailscale_status().await {
                Ok(status) => {
                    println!("Connected: {}", status.connected);
                    println!("IP: {:?}", status.ip);
                    println!("Hostname: {}", status.hostname);
                }
                Err(e) => {
                    println!("Status error: {}", e);
                }
            }
        }
    }

    #[tokio::test]
    async fn test_tailscale_get_ip() {
        if tailscale_is_installed().await.unwrap_or(false) {
            match tailscale_get_ip().await {
                Ok(ip) => {
                    println!("Tailscale IP: {}", ip);
                    // Tailscale IPs start with 100.x.x.x
                    assert!(ip.starts_with("100."));
                }
                Err(e) => {
                    println!("Not connected: {}", e);
                }
            }
        }
    }

    #[tokio::test]
    async fn test_tailscale_get_secure_bind_addr() {
        if tailscale_is_installed().await.unwrap_or(false) {
            match tailscale_get_secure_bind_addr(3000).await {
                Ok(addr) => {
                    println!("Secure bind address: {}", addr);
                    assert!(addr.contains(":3000"));
                }
                Err(e) => {
                    println!("Could not get bind address: {}", e);
                }
            }
        }
    }

    #[tokio::test]
    async fn test_tailscale_verify_zero_trust() {
        if tailscale_is_installed().await.unwrap_or(false) {
            match tailscale_verify_zero_trust().await {
                Ok(messages) => {
                    println!("Zero-trust verification passed:");
                    for msg in messages {
                        println!("  {}", msg);
                    }
                }
                Err(warnings) => {
                    println!("Zero-trust warnings: {}", warnings);
                }
            }
        }
    }
}
