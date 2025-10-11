use mdns_sd::{ServiceDaemon, ServiceInfo};
use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Service discovery error types
#[derive(Debug, thiserror::Error)]
pub enum MdnsError {
    #[error("Failed to create mDNS daemon: {0}")]
    DaemonCreation(String),

    #[error("Failed to register service: {0}")]
    Registration(String),

    #[error("Failed to browse services: {0}")]
    Browse(String),

    #[error("Failed to get hostname: {0}")]
    Hostname(String),
}

/// Represents a discovered VibeCode session on the network
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredService {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub addresses: Vec<String>,
}

/// VibeCode mDNS service manager
pub struct VibeCodeService {
    daemon: ServiceDaemon,
    service_name: String,
}

impl VibeCodeService {
    /// Create a new VibeCode service instance
    pub fn new(user_name: &str) -> Result<Self, MdnsError> {
        let daemon = ServiceDaemon::new()
            .map_err(|e| MdnsError::DaemonCreation(e.to_string()))?;

        let service_name = format!("{}'s VibeCode", user_name);

        Ok(Self {
            daemon,
            service_name,
        })
    }

    /// Advertise this VibeCode instance on the local network
    pub fn advertise(&self, port: u16) -> Result<(), MdnsError> {
        let service_type = "_vibecode._tcp.local.";
        let instance_name = &self.service_name;

        // Get hostname - fallback to "localhost" if unavailable
        let host_name = hostname::get()
            .map_err(|e| MdnsError::Hostname(e.to_string()))?
            .to_string_lossy()
            .to_string();

        // Create service properties
        let properties = [
            ("version", "1.0.0"),
            ("protocol", "http"),
        ];

        let service_info = ServiceInfo::new(
            service_type,
            instance_name,
            &format!("{}.local.", host_name),
            (),
            port,
            &properties[..],
        )
        .map_err(|e| MdnsError::Registration(e.to_string()))?
        .enable_addr_auto();

        self.daemon
            .register(service_info)
            .map_err(|e| MdnsError::Registration(e.to_string()))?;

        Ok(())
    }

    /// Discover other VibeCode instances on the local network
    pub fn discover(&self) -> Result<Vec<DiscoveredService>, MdnsError> {
        let service_type = "_vibecode._tcp.local.";
        let receiver = self
            .daemon
            .browse(service_type)
            .map_err(|e| MdnsError::Browse(e.to_string()))?;

        let mut services = Vec::new();
        let timeout = Duration::from_secs(3);

        // Collect discovered services within timeout period
        while let Ok(event) = receiver.recv_timeout(timeout) {
            use mdns_sd::ServiceEvent::*;
            match event {
                ServiceResolved(info) => {
                    let addresses: Vec<String> = info
                        .get_addresses()
                        .iter()
                        .map(|addr| addr.to_string())
                        .collect();

                    services.push(DiscoveredService {
                        name: info.get_fullname().to_string(),
                        host: info.get_hostname().to_string(),
                        port: info.get_port(),
                        addresses,
                    });
                }
                _ => {}
            }
        }

        Ok(services)
    }

    /// Shutdown the mDNS daemon
    pub fn shutdown(&self) -> Result<(), MdnsError> {
        let _receiver = self.daemon
            .shutdown()
            .map_err(|e| MdnsError::DaemonCreation(format!("Shutdown failed: {}", e)))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_service_creation() {
        let service = VibeCodeService::new("TestUser");
        assert!(service.is_ok());
        let service = service.unwrap();
        assert_eq!(service.service_name, "TestUser's VibeCode");
    }

    #[test]
    fn test_discovered_service_serialization() {
        let service = DiscoveredService {
            name: "Test's VibeCode._vibecode._tcp.local.".to_string(),
            host: "testhost.local.".to_string(),
            port: 3000,
            addresses: vec!["192.168.1.100".to_string()],
        };

        let json = serde_json::to_string(&service).unwrap();
        assert!(json.contains("Test's VibeCode"));
        assert!(json.contains("3000"));
    }
}
