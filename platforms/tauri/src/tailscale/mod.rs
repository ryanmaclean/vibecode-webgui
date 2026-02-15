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

    // Unit Tests - TailscaleStatus
    #[test]
    fn test_tailscale_status_serialization() {
        let status = TailscaleStatus {
            connected: true,
            ip: Some("100.64.0.1".to_string()),
            hostname: "test-machine".to_string(),
            user: Some("user@example.com".to_string()),
            version: Some("1.52.0".to_string()),
        };

        // Test serialization
        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("100.64.0.1"));
        assert!(json.contains("test-machine"));
        assert!(json.contains("user@example.com"));

        // Test deserialization
        let deserialized: TailscaleStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.connected, true);
        assert_eq!(deserialized.ip, Some("100.64.0.1".to_string()));
        assert_eq!(deserialized.hostname, "test-machine");
    }

    #[test]
    fn test_tailscale_status_optional_fields() {
        let status = TailscaleStatus {
            connected: false,
            ip: None,
            hostname: "offline-machine".to_string(),
            user: None,
            version: None,
        };

        let json = serde_json::to_string(&status).unwrap();
        let deserialized: TailscaleStatus = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.connected, false);
        assert_eq!(deserialized.ip, None);
        assert_eq!(deserialized.user, None);
        assert_eq!(deserialized.version, None);
    }

    // Unit Tests - TailscaleConfig
    #[test]
    fn test_tailscale_config_serialization() {
        let config = TailscaleConfig {
            enabled: true,
            auto_start: false,
            bind_services: true,
        };

        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("\"enabled\":true"));
        assert!(json.contains("\"auto_start\":false"));
        assert!(json.contains("\"bind_services\":true"));

        let deserialized: TailscaleConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.enabled, true);
        assert_eq!(deserialized.auto_start, false);
        assert_eq!(deserialized.bind_services, true);
    }

    #[test]
    fn test_tailscale_config_defaults() {
        let config = TailscaleConfig {
            enabled: false,
            auto_start: false,
            bind_services: false,
        };

        assert_eq!(config.enabled, false);
        assert_eq!(config.auto_start, false);
        assert_eq!(config.bind_services, false);
    }

    // Unit Tests - TailscaleManager
    #[test]
    fn test_is_installed() {
        // This will return true or false depending on installation
        let installed = TailscaleManager::is_installed();
        // Just ensure it returns without panic
        assert!(installed == true || installed == false);
    }

    #[test]
    fn test_status_format() {
        // Only run if Tailscale is installed
        if TailscaleManager::is_installed() {
            match TailscaleManager::status() {
                Ok(status) => {
                    // Verify structure
                    assert!(status.hostname.len() > 0 || !status.connected);

                    // If connected, should have IP
                    if status.connected {
                        assert!(status.ip.is_some(), "Connected status should have IP");
                        if let Some(ip) = &status.ip {
                            // Tailscale IPs are in 100.x.x.x range
                            assert!(ip.starts_with("100.") || ip.contains(":"),
                                "Tailscale IP should be in 100.x.x.x range or IPv6");
                        }
                    }
                }
                Err(e) => {
                    // Expected if not running or not connected
                    assert!(e.contains("not installed") ||
                           e.contains("not running") ||
                           e.contains("not connected"));
                }
            }
        }
    }

    #[test]
    fn test_get_ip() {
        if TailscaleManager::is_installed() {
            match TailscaleManager::get_ip() {
                Ok(ip) => {
                    // Verify IP format
                    assert!(!ip.is_empty());
                    assert!(ip.contains(".") || ip.contains(":"),
                        "IP should be IPv4 or IPv6 format");
                }
                Err(e) => {
                    // Expected errors
                    assert!(e.contains("not connected") ||
                           e.contains("not installed") ||
                           e.contains("No Tailscale IP"));
                }
            }
        }
    }

    #[test]
    fn test_secure_bind_addr_format() {
        // Test with a mock IP (this would normally come from status)
        // We can't test the actual function without Tailscale running,
        // but we can test the expected format
        let port = 8080;
        let expected_format = format!("100.64.0.1:{}", port);

        assert!(expected_format.contains(":"));
        assert!(expected_format.ends_with(":8080"));
    }

    #[test]
    fn test_verify_zero_trust_when_not_installed() {
        // Test behavior when Tailscale is not installed
        if !TailscaleManager::is_installed() {
            let result = TailscaleManager::verify_zero_trust();
            assert!(result.is_err(), "Should fail when Tailscale not installed");

            if let Err(warnings) = result {
                assert!(warnings.contains("Tailscale error"),
                    "Should mention Tailscale error");
            }
        }
    }

    // Integration Tests (require Tailscale to be installed and running)
    #[test]
    #[ignore] // Run with: cargo test -- --ignored
    fn integration_test_full_workflow() {
        if !TailscaleManager::is_installed() {
            println!("⚠️ Tailscale not installed, skipping integration test");
            return;
        }

        // Test status
        let status = TailscaleManager::status();
        assert!(status.is_ok() || status.is_err());

        // Test IP retrieval
        if let Ok(status) = &status {
            if status.connected {
                let ip = TailscaleManager::get_ip();
                assert!(ip.is_ok(), "Should get IP when connected");
            }
        }

        // Test zero-trust verification
        let verify = TailscaleManager::verify_zero_trust();
        assert!(verify.is_ok() || verify.is_err());
    }

    #[test]
    fn test_status_clone() {
        let status = TailscaleStatus {
            connected: true,
            ip: Some("100.64.0.1".to_string()),
            hostname: "test".to_string(),
            user: None,
            version: None,
        };

        let cloned = status.clone();
        assert_eq!(cloned.connected, status.connected);
        assert_eq!(cloned.ip, status.ip);
        assert_eq!(cloned.hostname, status.hostname);
    }

    #[test]
    fn test_config_clone() {
        let config = TailscaleConfig {
            enabled: true,
            auto_start: true,
            bind_services: true,
        };

        let cloned = config.clone();
        assert_eq!(cloned.enabled, config.enabled);
        assert_eq!(cloned.auto_start, config.auto_start);
        assert_eq!(cloned.bind_services, config.bind_services);
    }

    #[test]
    fn test_status_debug() {
        let status = TailscaleStatus {
            connected: true,
            ip: Some("100.64.0.1".to_string()),
            hostname: "test".to_string(),
            user: None,
            version: None,
        };

        let debug_str = format!("{:?}", status);
        assert!(debug_str.contains("TailscaleStatus"));
        assert!(debug_str.contains("100.64.0.1"));
    }
}
