use bollard::Docker;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum DockerError {
    #[error("Docker is not available: {0}")]
    NotAvailable(String),
    #[error("Docker connection error: {0}")]
    ConnectionError(String),
}

pub async fn check_docker_available() -> Result<bool, String> {
    match Docker::connect_with_local_defaults() {
        Ok(docker) => {
            match docker.ping().await {
                Ok(_) => Ok(true),
                Err(e) => Err(format!("Docker ping failed: {}", e)),
            }
        }
        Err(e) => Err(format!("Cannot connect to Docker: {}", e)),
    }
}

pub async fn get_docker_version() -> Result<String, String> {
    match Docker::connect_with_local_defaults() {
        Ok(docker) => {
            match docker.version().await {
                Ok(version) => {
                    let version_str = version.version.unwrap_or_else(|| "unknown".to_string());
                    Ok(format!("Docker version: {}", version_str))
                }
                Err(e) => Err(format!("Failed to get Docker version: {}", e)),
            }
        }
        Err(e) => Err(format!("Cannot connect to Docker: {}", e)),
    }
}

pub async fn get_docker_info() -> Result<serde_json::Value, String> {
    match Docker::connect_with_local_defaults() {
        Ok(docker) => {
            match docker.info().await {
                Ok(info) => {
                    Ok(serde_json::json!({
                        "containers": info.containers.unwrap_or(0),
                        "images": info.images.unwrap_or(0),
                        "memory_total": info.mem_total.unwrap_or(0),
                        "cpus": info.ncpu.unwrap_or(0),
                        "os_type": info.os_type.unwrap_or_else(|| "unknown".to_string()),
                        "architecture": info.architecture.unwrap_or_else(|| "unknown".to_string()),
                    }))
                }
                Err(e) => Err(format!("Failed to get Docker info: {}", e)),
            }
        }
        Err(e) => Err(format!("Cannot connect to Docker: {}", e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_docker_check() {
        let result = check_docker_available().await;
        println!("Docker check result: {:?}", result);
    }

    #[tokio::test]
    async fn test_docker_version() {
        let result = get_docker_version().await;
        println!("Docker version result: {:?}", result);
    }

    #[tokio::test]
    async fn test_docker_info() {
        let result = get_docker_info().await;
        println!("Docker info result: {:?}", result);
    }
}
