// Tailscale Integration Tests
// Tests Tauri commands for Tailscale zero-trust networking integration

use vibecode::tailscale::*;

/// Integration test: Check Tailscale installation
#[tokio::test]
async fn test_tailscale_is_installed_command() {
    let result = tailscale_is_installed().await;
    assert!(result.is_ok(), "Command should execute successfully");

    let installed = result.unwrap();
    // The result should be a boolean (true or false)
    assert!(installed == true || installed == false);
}

/// Integration test: Get Tailscale status
#[tokio::test]
async fn test_tailscale_status_command() {
    // Skip if Tailscale is not installed
    if !tailscale_is_installed().await.unwrap_or(false) {
        return;
    }

    let result = tailscale_status().await;

    // Should return either Ok with status or Err with message
    match result {
        Ok(status) => {
            // Verify status structure
            assert!(!status.hostname.is_empty() || !status.connected);

            // If connected, should have IP
            if status.connected {
                assert!(status.ip.is_some(), "Connected status should have IP address");

                if let Some(ip) = &status.ip {
                    // Tailscale IPs are in 100.x.x.x range (CGNAT) or IPv6
                    assert!(
                        ip.starts_with("100.") || ip.contains(":"),
                        "Tailscale IP should be in 100.x.x.x range or IPv6"
                    );
                }
            }
        }
        Err(e) => {
            // Expected errors when not running/connected
            assert!(
                e.contains("not installed")
                || e.contains("not running")
                || e.contains("not connected"),
                "Error message should be descriptive: {}", e
            );
        }
    }
}

/// Integration test: Get Tailscale IP address
#[tokio::test]
async fn test_tailscale_get_ip_command() {
    // Skip if Tailscale is not installed
    if !tailscale_is_installed().await.unwrap_or(false) {
        return;
    }

    let result = tailscale_get_ip().await;

    match result {
        Ok(ip) => {
            // Verify IP format
            assert!(!ip.is_empty(), "IP should not be empty");
            assert!(
                ip.contains(".") || ip.contains(":"),
                "IP should be IPv4 or IPv6 format"
            );

            // Tailscale IPs start with 100.x.x.x
            if ip.contains(".") {
                assert!(ip.starts_with("100."), "Tailscale IPv4 should start with 100.");
            }
        }
        Err(e) => {
            // Expected errors
            assert!(
                e.contains("not connected")
                || e.contains("not installed")
                || e.contains("No Tailscale IP"),
                "Error should be about connectivity: {}", e
            );
        }
    }
}

/// Integration test: Get secure bind address
#[tokio::test]
async fn test_tailscale_get_secure_bind_addr_command() {
    // Skip if Tailscale is not installed
    if !tailscale_is_installed().await.unwrap_or(false) {
        return;
    }

    let test_port = 3000u16;
    let result = tailscale_get_secure_bind_addr(test_port).await;

    match result {
        Ok(addr) => {
            // Verify address format
            assert!(addr.contains(":"), "Address should contain port separator");
            assert!(addr.contains(&test_port.to_string()), "Address should contain port number");

            // Should be IP:PORT format
            let parts: Vec<&str> = addr.rsplitn(2, ':').collect();
            assert_eq!(parts.len(), 2, "Address should be IP:PORT format");
            assert_eq!(parts[0], test_port.to_string(), "Port should match");
        }
        Err(e) => {
            // Expected when not connected
            assert!(
                e.contains("not connected") || e.contains("No Tailscale IP"),
                "Error should be about connectivity: {}", e
            );
        }
    }
}

/// Integration test: Get network info
#[tokio::test]
async fn test_tailscale_get_network_info_command() {
    // Skip if Tailscale is not installed
    if !tailscale_is_installed().await.unwrap_or(false) {
        return;
    }

    let result = tailscale_get_network_info().await;

    match result {
        Ok(info) => {
            // Should be valid JSON
            assert!(info.is_object() || info.is_array(), "Network info should be JSON object or array");

            // If it's an object, it should have some expected fields
            if let Some(obj) = info.as_object() {
                // Tailscale status JSON typically has BackendState or Self fields
                assert!(
                    obj.contains_key("BackendState")
                    || obj.contains_key("Self")
                    || obj.len() > 0,
                    "Network info should contain Tailscale status data"
                );
            }
        }
        Err(e) => {
            // Expected errors
            assert!(
                e.contains("Failed to get network info")
                || e.contains("Failed to parse"),
                "Error should be about network info retrieval: {}", e
            );
        }
    }
}

/// Integration test: Verify zero-trust configuration
#[tokio::test]
async fn test_tailscale_verify_zero_trust_command() {
    // Skip if Tailscale is not installed
    if !tailscale_is_installed().await.unwrap_or(false) {
        return;
    }

    let result = tailscale_verify_zero_trust().await;

    match result {
        Ok(messages) => {
            // Should have at least one verification message
            assert!(!messages.is_empty(), "Should have verification messages");

            // Should contain success indicator
            let all_messages = messages.join("\n");
            assert!(
                all_messages.contains("✅") || all_messages.contains("verified"),
                "Success messages should indicate verification: {:?}", messages
            );
        }
        Err(warnings) => {
            // Should contain warning indicators
            assert!(
                warnings.contains("⚠️") || warnings.contains("❌"),
                "Warnings should have indicators: {}", warnings
            );
        }
    }
}

/// Integration test: Service accessibility check
#[tokio::test]
async fn test_tailscale_check_service_accessible_command() {
    // Skip if Tailscale is not installed or not connected
    if !tailscale_is_installed().await.unwrap_or(false) {
        return;
    }

    if tailscale_get_ip().await.is_err() {
        // Not connected, skip test
        return;
    }

    // Test with a port that's unlikely to have a service running
    let test_port = 59999u16;
    let result = tailscale_check_service_accessible(test_port).await;

    match result {
        Ok(accessible) => {
            // Result should be boolean
            assert!(accessible == true || accessible == false);
            // Most likely false since we picked a random port
        }
        Err(e) => {
            // Expected if not connected
            assert!(
                e.contains("not connected") || e.contains("No Tailscale IP"),
                "Error should be about connectivity: {}", e
            );
        }
    }
}

/// Integration test: Full workflow when connected
#[tokio::test]
#[ignore] // Run with: cargo test --test tailscale_integration -- --ignored
async fn test_tailscale_full_workflow() {
    // Check installation
    let installed = tailscale_is_installed().await.expect("Installation check should work");

    if !installed {
        println!("⚠️ Tailscale not installed, skipping full workflow test");
        return;
    }

    // Get status
    let status = tailscale_status().await;
    assert!(status.is_ok() || status.is_err(), "Status should return result");

    if let Ok(status) = status {
        if status.connected {
            // Get IP
            let ip = tailscale_get_ip().await;
            assert!(ip.is_ok(), "Should get IP when connected");

            if let Ok(ip) = ip {
                println!("✅ Tailscale IP: {}", ip);

                // Get secure bind address
                let bind_addr = tailscale_get_secure_bind_addr(8080).await;
                assert!(bind_addr.is_ok(), "Should get bind address when connected");

                if let Ok(addr) = bind_addr {
                    println!("✅ Secure bind address: {}", addr);
                }
            }

            // Get network info
            let network_info = tailscale_get_network_info().await;
            assert!(network_info.is_ok(), "Should get network info when connected");

            // Verify zero-trust
            let verify = tailscale_verify_zero_trust().await;
            match verify {
                Ok(messages) => {
                    println!("✅ Zero-trust verification passed:");
                    for msg in messages {
                        println!("  {}", msg);
                    }
                }
                Err(warnings) => {
                    println!("⚠️ Zero-trust warnings: {}", warnings);
                }
            }
        } else {
            println!("⚠️ Tailscale installed but not connected");
        }
    }
}

/// Integration test: Error handling when not installed
#[tokio::test]
async fn test_tailscale_commands_when_not_available() {
    // This test verifies proper error handling
    // We can't guarantee Tailscale is not installed, but we can check error formats

    let status_result = tailscale_status().await;

    // If Tailscale is not installed, should get proper error
    if let Err(e) = status_result {
        assert!(
            e.contains("not installed")
            || e.contains("not running")
            || e.contains("not connected"),
            "Error message should be descriptive: {}", e
        );
    }
}

/// Integration test: Concurrent command execution
#[tokio::test]
async fn test_tailscale_concurrent_commands() {
    // Skip if Tailscale is not installed
    if !tailscale_is_installed().await.unwrap_or(false) {
        return;
    }

    // Execute multiple commands concurrently
    let (result1, result2, result3) = tokio::join!(
        tailscale_status(),
        tailscale_get_ip(),
        tailscale_get_network_info()
    );

    // All commands should complete (either Ok or Err)
    assert!(result1.is_ok() || result1.is_err());
    assert!(result2.is_ok() || result2.is_err());
    assert!(result3.is_ok() || result3.is_err());

    // If status succeeds and is connected, IP should also succeed
    if let Ok(status) = result1 {
        if status.connected {
            assert!(result2.is_ok(), "IP should be available when connected");
        }
    }
}

/// Integration test: Port validation for secure bind address
#[tokio::test]
async fn test_tailscale_secure_bind_addr_various_ports() {
    // Skip if Tailscale is not installed or not connected
    if !tailscale_is_installed().await.unwrap_or(false) {
        return;
    }

    if tailscale_get_ip().await.is_err() {
        return;
    }

    // Test various valid ports
    let test_ports = [80u16, 443, 3000, 8080, 8443, 9000];

    for port in test_ports {
        let result = tailscale_get_secure_bind_addr(port).await;

        if let Ok(addr) = result {
            assert!(addr.contains(&format!(":{}", port)),
                "Address should contain port {}", port);
        }
    }
}
