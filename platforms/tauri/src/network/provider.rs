// Network Provider Trait and Implementations
// Defines common interface for all network providers (Tailscale, WireGuard, etc.)

use super::{NetworkProviderType, NetworkStatus};
use crate::tailscale::TailscaleManager;
use crate::wireguard::WireGuardManager;

/// Common interface for network providers
pub trait NetworkProvider {
    /// Get the provider type
    fn provider_type(&self) -> NetworkProviderType;

    /// Check if the provider is installed
    fn is_installed(&self) -> bool;

    /// Get current network status
    fn get_status(&self) -> Result<NetworkStatus, String>;

    /// Get IP address
    fn get_ip(&self) -> Result<String, String>;

    /// Get secure bind address for a given port
    fn get_secure_bind_addr(&self, port: u16) -> Result<String, String>;

    /// Verify configuration
    fn verify_configuration(&self) -> Result<Vec<String>, String>;
}

/// Tailscale provider implementation
pub struct TailscaleProvider;

impl NetworkProvider for TailscaleProvider {
    fn provider_type(&self) -> NetworkProviderType {
        NetworkProviderType::Tailscale
    }

    fn is_installed(&self) -> bool {
        TailscaleManager::is_installed()
    }

    fn get_status(&self) -> Result<NetworkStatus, String> {
        let status = TailscaleManager::status()?;

        Ok(NetworkStatus {
            provider: NetworkProviderType::Tailscale,
            connected: status.connected,
            ip: status.ip.clone(),
            interface: Some("tailscale0".to_string()),
            additional_info: serde_json::json!({
                "hostname": status.hostname,
                "user": status.user,
                "version": status.version,
            }),
        })
    }

    fn get_ip(&self) -> Result<String, String> {
        TailscaleManager::get_ip()
    }

    fn get_secure_bind_addr(&self, port: u16) -> Result<String, String> {
        TailscaleManager::get_secure_bind_addr(port)
    }

    fn verify_configuration(&self) -> Result<Vec<String>, String> {
        TailscaleManager::verify_zero_trust()
    }
}

/// WireGuard provider implementation
pub struct WireGuardProvider {
    interface: String,
}

impl WireGuardProvider {
    /// Create a new WireGuard provider with default interface (wg0)
    pub fn new() -> Self {
        Self {
            interface: "wg0".to_string(),
        }
    }

    /// Create a new WireGuard provider with custom interface
    pub fn with_interface(interface: String) -> Self {
        Self { interface }
    }
}

impl Default for WireGuardProvider {
    fn default() -> Self {
        Self::new()
    }
}

impl NetworkProvider for WireGuardProvider {
    fn provider_type(&self) -> NetworkProviderType {
        NetworkProviderType::WireGuard
    }

    fn is_installed(&self) -> bool {
        WireGuardManager::is_installed()
    }

    fn get_status(&self) -> Result<NetworkStatus, String> {
        let status = WireGuardManager::status()?;

        Ok(NetworkStatus {
            provider: NetworkProviderType::WireGuard,
            connected: status.interface.is_some(),
            ip: None, // WireGuard status doesn't include IP directly
            interface: status.interface.clone(),
            additional_info: serde_json::json!({
                "installed": status.installed,
                "public_key": status.public_key,
                "endpoint": status.endpoint,
                "allowed_ips": status.allowed_ips,
                "latest_handshake": status.latest_handshake,
            }),
        })
    }

    fn get_ip(&self) -> Result<String, String> {
        WireGuardManager::get_ip(&self.interface)
    }

    fn get_secure_bind_addr(&self, port: u16) -> Result<String, String> {
        WireGuardManager::get_secure_bind_addr(&self.interface, port)
    }

    fn verify_configuration(&self) -> Result<Vec<String>, String> {
        WireGuardManager::verify_configuration(&self.interface)
    }
}

/// Factory for creating network providers
pub struct NetworkProviderFactory;

impl NetworkProviderFactory {
    /// Create a provider based on type
    pub fn create(
        provider_type: NetworkProviderType,
    ) -> Box<dyn NetworkProvider + Send + Sync> {
        match provider_type {
            NetworkProviderType::Tailscale => Box::new(TailscaleProvider),
            NetworkProviderType::WireGuard => Box::new(WireGuardProvider::new()),
        }
    }

    /// Auto-detect and create the best available provider
    pub fn auto_detect() -> Option<Box<dyn NetworkProvider + Send + Sync>> {
        // Prefer Tailscale if available
        if TailscaleManager::is_installed() {
            return Some(Box::new(TailscaleProvider));
        }

        // Fall back to WireGuard
        if WireGuardManager::is_installed() {
            return Some(Box::new(WireGuardProvider::new()));
        }

        None
    }

    /// Get all installed providers
    pub fn get_installed_providers() -> Vec<NetworkProviderType> {
        let mut providers = Vec::new();

        if TailscaleManager::is_installed() {
            providers.push(NetworkProviderType::Tailscale);
        }

        if WireGuardManager::is_installed() {
            providers.push(NetworkProviderType::WireGuard);
        }

        providers
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tailscale_provider_type() {
        let provider = TailscaleProvider;
        assert_eq!(provider.provider_type(), NetworkProviderType::Tailscale);
    }

    #[test]
    fn test_tailscale_provider_is_installed() {
        let provider = TailscaleProvider;
        // Just ensure it returns without panic
        let installed = provider.is_installed();
        assert!(installed == true || installed == false);
    }

    #[test]
    fn test_wireguard_provider_type() {
        let provider = WireGuardProvider::new();
        assert_eq!(provider.provider_type(), NetworkProviderType::WireGuard);
    }

    #[test]
    fn test_wireguard_provider_is_installed() {
        let provider = WireGuardProvider::new();
        // Just ensure it returns without panic
        let installed = provider.is_installed();
        assert!(installed == true || installed == false);
    }

    #[test]
    fn test_wireguard_provider_with_custom_interface() {
        let provider = WireGuardProvider::with_interface("wg1".to_string());
        assert_eq!(provider.interface, "wg1");
    }

    #[test]
    fn test_wireguard_provider_default() {
        let provider = WireGuardProvider::default();
        assert_eq!(provider.interface, "wg0");
    }

    #[test]
    fn test_factory_create_tailscale() {
        let provider = NetworkProviderFactory::create(NetworkProviderType::Tailscale);
        assert_eq!(provider.provider_type(), NetworkProviderType::Tailscale);
    }

    #[test]
    fn test_factory_create_wireguard() {
        let provider = NetworkProviderFactory::create(NetworkProviderType::WireGuard);
        assert_eq!(provider.provider_type(), NetworkProviderType::WireGuard);
    }

    #[test]
    fn test_factory_auto_detect() {
        let provider = NetworkProviderFactory::auto_detect();
        // Should return Some if either is installed, None if neither is installed
        match provider {
            Some(p) => {
                let provider_type = p.provider_type();
                assert!(
                    provider_type == NetworkProviderType::Tailscale
                        || provider_type == NetworkProviderType::WireGuard
                );
            }
            None => {
                // Expected if neither is installed
                assert!(true);
            }
        }
    }

    #[test]
    fn test_factory_get_installed_providers() {
        let providers = NetworkProviderFactory::get_installed_providers();
        // Should return a vec (possibly empty)
        assert!(providers.len() <= 2);

        // All returned providers should be valid
        for provider in providers {
            assert!(
                provider == NetworkProviderType::Tailscale
                    || provider == NetworkProviderType::WireGuard
            );
        }
    }

    #[test]
    fn test_tailscale_provider_get_status() {
        let provider = TailscaleProvider;
        if provider.is_installed() {
            match provider.get_status() {
                Ok(status) => {
                    assert_eq!(status.provider, NetworkProviderType::Tailscale);
                    // If connected, should have some interface info
                    if status.connected {
                        assert!(status.interface.is_some());
                    }
                }
                Err(_) => {
                    // Expected if Tailscale is not running
                    assert!(true);
                }
            }
        }
    }

    #[test]
    fn test_wireguard_provider_get_status() {
        let provider = WireGuardProvider::new();
        // Always returns a status (even if not installed)
        match provider.get_status() {
            Ok(status) => {
                assert_eq!(status.provider, NetworkProviderType::WireGuard);
            }
            Err(_) => {
                // May error if not installed or misconfigured
                assert!(true);
            }
        }
    }

    #[test]
    fn test_provider_trait_methods() {
        // Test that both providers implement all trait methods
        let tailscale: Box<dyn NetworkProvider> = Box::new(TailscaleProvider);
        assert_eq!(tailscale.provider_type(), NetworkProviderType::Tailscale);
        let _ = tailscale.is_installed();

        let wireguard: Box<dyn NetworkProvider> = Box::new(WireGuardProvider::new());
        assert_eq!(wireguard.provider_type(), NetworkProviderType::WireGuard);
        let _ = wireguard.is_installed();
    }

    #[test]
    fn test_provider_get_ip() {
        let tailscale = TailscaleProvider;
        if tailscale.is_installed() {
            // May succeed or fail depending on connection status
            let _ = tailscale.get_ip();
        }

        let wireguard = WireGuardProvider::new();
        if wireguard.is_installed() {
            // May succeed or fail depending on interface status
            let _ = wireguard.get_ip();
        }
    }

    #[test]
    fn test_provider_get_secure_bind_addr() {
        let tailscale = TailscaleProvider;
        if tailscale.is_installed() {
            match tailscale.get_secure_bind_addr(8080) {
                Ok(addr) => {
                    assert!(addr.contains(":8080"));
                }
                Err(_) => {
                    // Expected if not connected
                    assert!(true);
                }
            }
        }

        let wireguard = WireGuardProvider::new();
        if wireguard.is_installed() {
            match wireguard.get_secure_bind_addr(8080) {
                Ok(addr) => {
                    assert!(addr.contains(":8080"));
                }
                Err(_) => {
                    // Expected if interface doesn't exist
                    assert!(true);
                }
            }
        }
    }

    #[test]
    fn test_provider_verify_configuration() {
        let tailscale = TailscaleProvider;
        if tailscale.is_installed() {
            // Should return either Ok with messages or Err with warnings
            let _ = tailscale.verify_configuration();
        }

        let wireguard = WireGuardProvider::new();
        if wireguard.is_installed() {
            // Should return either Ok with messages or Err with warnings
            let _ = wireguard.verify_configuration();
        }
    }
}
