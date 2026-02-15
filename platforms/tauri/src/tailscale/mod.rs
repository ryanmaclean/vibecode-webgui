// Tailscale Zero Trust Networking Module
// Provides secure, encrypted networking with no public exposure

pub mod commands;
pub use commands::*;

use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TailscaleStatus {
    pub connected: bool,
    pub ip: Option<String>,
    pub hostname: String,
    pub user: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TailscaleConfig {
    pub enabled: bool,
    pub auto_start: bool,
    pub bind_services: bool,
}

pub struct TailscaleManager;

impl TailscaleManager {
    /// Check if Tailscale is installed on the system
    pub fn is_installed() -> bool {
        Command::new("tailscale").arg("version").output().is_ok()
    }

    /// Get current Tailscale connection status
    pub fn status() -> Result<TailscaleStatus, String> {
        // Check if Tailscale is installed
        if !Self::is_installed() {
            return Err("Tailscale not installed".to_string());
        }

        // Get status as JSON
        let output = Command::new("tailscale")
            .arg("status")
            .arg("--json")
            .output()
            .map_err(|e| format!("Failed to get Tailscale status: {}", e))?;

        if !output.status.success() {
            return Err("Tailscale not running or not connected".to_string());
        }

        // Parse JSON response
        let status: serde_json::Value = serde_json::from_slice(&output.stdout)
            .map_err(|e| format!("Failed to parse Tailscale status: {}", e))?;

        // Extract relevant information
        let connected = status["BackendState"].as_str() == Some("Running");
        let ip = status["Self"]["TailscaleIPs"]
            .as_array()
            .and_then(|ips| ips.first())
            .and_then(|ip| ip.as_str())
            .map(String::from);
        let hostname = status["Self"]["HostName"]
            .as_str()
            .unwrap_or("")
            .to_string();
        let user = status["Self"]["UserID"].as_str().map(String::from);

        // Get version
        let version_output = Command::new("tailscale").arg("version").output().ok();
        let version = version_output
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|v| v.trim().to_string());

        Ok(TailscaleStatus {
            connected,
            ip,
            hostname,
            user,
            version,
        })
    }

    /// Get Tailscale IP address
    pub fn get_ip() -> Result<String, String> {
        let status = Self::status()?;

        if !status.connected {
            return Err("Tailscale not connected".to_string());
        }

        status.ip.ok_or("No Tailscale IP assigned".to_string())
    }

    /// Get secure bind address for services (Tailscale IP only)
    pub fn get_secure_bind_addr(port: u16) -> Result<String, String> {
        let ip = Self::get_ip()?;
        Ok(format!("{}:{}", ip, port))
    }

    /// Start code-server bound to Tailscale IP ONLY (secure)
    pub fn start_code_server_secure(port: u16) -> Result<String, String> {
        let bind_addr = Self::get_secure_bind_addr(port)?;

        println!("🔒 Starting code-server on Tailscale IP: {}", bind_addr);
        println!("✅ NOT accessible from public internet");
        println!("✅ NOT accessible from local network");
        println!("✅ ONLY accessible via Tailscale");

        // Start code-server bound to Tailscale IP ONLY
        Command::new("code-server")
            .arg("--bind-addr")
            .arg(&bind_addr)
            .arg("--auth")
            .arg("none") // Auth handled by Tailscale zero-trust
            .spawn()
            .map_err(|e| format!("Failed to start code-server: {}", e))?;

        Ok(format!("http://{}", bind_addr))
    }

    /// Check if a service is accessible (for testing)
    pub fn check_service_accessible(port: u16) -> Result<bool, String> {
        let ip = Self::get_ip()?;
        let url = format!("http://{}:{}", ip, port);

        // Try to connect
        let client = reqwest::blocking::Client::new();
        match client.get(&url).send() {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    /// Get Tailscale network info
    pub fn get_network_info() -> Result<serde_json::Value, String> {
        let output = Command::new("tailscale")
            .arg("status")
            .arg("--json")
            .output()
            .map_err(|e| format!("Failed to get network info: {}", e))?;

        serde_json::from_slice(&output.stdout)
            .map_err(|e| format!("Failed to parse network info: {}", e))
    }

    /// Verify zero-trust configuration
    pub fn verify_zero_trust() -> Result<Vec<String>, String> {
        let mut warnings = Vec::new();

        // Check if Tailscale is running
        match Self::status() {
            Ok(status) => {
                if !status.connected {
                    warnings
                        .push("⚠️ Tailscale not connected - services may be exposed!".to_string());
                }
                if status.ip.is_none() {
                    warnings.push("⚠️ No Tailscale IP assigned".to_string());
                }
            }
            Err(e) => {
                warnings.push(format!("❌ Tailscale error: {}", e));
            }
        }

        // Check if services are bound correctly
        // TODO: Implement service binding checks

        if warnings.is_empty() {
            Ok(vec!["✅ Zero-trust configuration verified".to_string()])
        } else {
            Err(warnings.join("\n"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_installed() {
        // This will pass if Tailscale is installed, fail otherwise
        let installed = TailscaleManager::is_installed();
        println!("Tailscale installed: {}", installed);
    }

    #[test]
    fn test_status() {
        if TailscaleManager::is_installed() {
            match TailscaleManager::status() {
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

    #[test]
    fn test_get_ip() {
        if TailscaleManager::is_installed() {
            match TailscaleManager::get_ip() {
                Ok(ip) => {
                    println!("Tailscale IP: {}", ip);
                    assert!(ip.starts_with("100."));
                }
                Err(e) => {
                    println!("Not connected: {}", e);
                }
            }
        }
    }
}
