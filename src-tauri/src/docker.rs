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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_docker_check() {
        let result = check_docker_available().await;
        println!("Docker check result: {:?}", result);
    }
}
