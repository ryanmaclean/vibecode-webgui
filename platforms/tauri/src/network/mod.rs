// Network Provider Abstraction Layer
// Provides unified interface for different networking solutions (Tailscale, WireGuard, etc.)

pub mod provider;
pub use provider::*;

use serde::{Deserialize, Serialize};

/// Common network status across all providers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkStatus {
    pub provider: NetworkProviderType,
    pub connected: bool,
    pub ip: Option<String>,
    pub interface: Option<String>,
    pub additional_info: serde_json::Value,
}

/// Supported network providers
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NetworkProviderType {
    Tailscale,
    WireGuard,
}

impl std::fmt::Display for NetworkProviderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            NetworkProviderType::Tailscale => write!(f, "tailscale"),
            NetworkProviderType::WireGuard => write!(f, "wireguard"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_network_provider_type_serialization() {
        let tailscale = NetworkProviderType::Tailscale;
        let json = serde_json::to_string(&tailscale).unwrap();
        assert_eq!(json, "\"tailscale\"");

        let wireguard = NetworkProviderType::WireGuard;
        let json = serde_json::to_string(&wireguard).unwrap();
        assert_eq!(json, "\"wireguard\"");
    }

    #[test]
    fn test_network_provider_type_deserialization() {
        let tailscale: NetworkProviderType = serde_json::from_str("\"tailscale\"").unwrap();
        assert_eq!(tailscale, NetworkProviderType::Tailscale);

        let wireguard: NetworkProviderType = serde_json::from_str("\"wireguard\"").unwrap();
        assert_eq!(wireguard, NetworkProviderType::WireGuard);
    }

    #[test]
    fn test_network_provider_type_display() {
        assert_eq!(NetworkProviderType::Tailscale.to_string(), "tailscale");
        assert_eq!(NetworkProviderType::WireGuard.to_string(), "wireguard");
    }

    #[test]
    fn test_network_status_serialization() {
        let status = NetworkStatus {
            provider: NetworkProviderType::Tailscale,
            connected: true,
            ip: Some("100.64.0.1".to_string()),
            interface: Some("tailscale0".to_string()),
            additional_info: serde_json::json!({"version": "1.52.0"}),
        };

        let json = serde_json::to_string(&status).unwrap();
        assert!(json.contains("tailscale"));
        assert!(json.contains("100.64.0.1"));
        assert!(json.contains("1.52.0"));

        let deserialized: NetworkStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.provider, NetworkProviderType::Tailscale);
        assert_eq!(deserialized.connected, true);
        assert_eq!(deserialized.ip, Some("100.64.0.1".to_string()));
    }

    #[test]
    fn test_network_status_clone() {
        let status = NetworkStatus {
            provider: NetworkProviderType::WireGuard,
            connected: false,
            ip: None,
            interface: Some("wg0".to_string()),
            additional_info: serde_json::json!({}),
        };

        let cloned = status.clone();
        assert_eq!(cloned.provider, status.provider);
        assert_eq!(cloned.connected, status.connected);
        assert_eq!(cloned.ip, status.ip);
        assert_eq!(cloned.interface, status.interface);
    }
}
