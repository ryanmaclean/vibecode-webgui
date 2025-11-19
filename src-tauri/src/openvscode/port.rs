use std::net::TcpListener;

/// Find an available port in the given range
pub fn find_available_port(start: u16, end: u16) -> Result<u16, String> {
    for port in start..=end {
        if is_port_available(port) {
            return Ok(port);
        }
    }
    Err(format!("No available ports in range {}-{}", start, end))
}

/// Check if a port is available
fn is_port_available(port: u16) -> bool {
    TcpListener::bind(("127.0.0.1", port)).is_ok()
}

/// Check if a port is in use
pub fn is_port_in_use(port: u16) -> bool {
    !is_port_available(port)
}

/// Get port from existing process (using lsof)
#[cfg(target_os = "macos")]
pub fn get_port_from_process(process_name: &str) -> Option<u16> {
    use std::process::Command;

    let output = Command::new("lsof")
        .args(&["-nP", "-iTCP", "-sTCP:LISTEN"])
        .output()
        .ok()?;

    let stdout = String::from_utf8_lossy(&output.stdout);

    for line in stdout.lines() {
        if line.contains(process_name) {
            // Parse port from line like: "code 1234 user TCP *:8080 (LISTEN)"
            if let Some(port_part) = line.split("*:").nth(1) {
                if let Some(port_str) = port_part.split_whitespace().next() {
                    return port_str.parse().ok();
                }
            }
        }
    }

    None
}

#[cfg(not(target_os = "macos"))]
pub fn get_port_from_process(_process_name: &str) -> Option<u16> {
    None
}
