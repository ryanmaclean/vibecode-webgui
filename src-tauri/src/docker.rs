use bollard::Docker;
use thiserror::Error;
use tracing::{info, error, warn, instrument};
use std::time::Instant;

#[derive(Error, Debug)]
pub enum DockerError {
    #[error("Docker is not available: {0}")]
    NotAvailable(String),
    #[error("Docker connection error: {0}")]
    ConnectionError(String),
}

#[instrument]
pub async fn check_docker_available() -> Result<bool, String> {
    let start = Instant::now();

    match Docker::connect_with_local_defaults() {
        Ok(docker) => {
            match docker.ping().await {
                Ok(_) => {
                    let duration = start.elapsed().as_millis();

                    log_docker_operation!(
                        tracing::Level::INFO,
                        "ping",
                        method = "GET",
                        endpoint = "/_ping",
                        duration_ms = duration,
                        status_code = 200
                    );

                    info!(duration_ms = duration, "Docker ping successful");
                    Ok(true)
                }
                Err(e) => {
                    let duration = start.elapsed().as_millis();

                    log_docker_operation!(
                        tracing::Level::ERROR,
                        "ping",
                        method = "GET",
                        endpoint = "/_ping",
                        duration_ms = duration,
                        status_code = 500,
                        error = %e
                    );

                    error!(error = %e, "Docker ping failed");
                    Err(format!("Docker ping failed: {}", e))
                }
            }
        }
        Err(e) => {
            log_docker_operation!(
                tracing::Level::ERROR,
                "connect",
                method = "CONNECT",
                endpoint = "unix:///var/run/docker.sock",
                duration_ms = start.elapsed().as_millis(),
                status_code = 503,
                error = %e
            );

            error!(error = %e, "Cannot connect to Docker");
            Err(format!("Cannot connect to Docker: {}", e))
        }
    }
}

#[instrument]
pub async fn get_docker_version() -> Result<String, String> {
    let start = Instant::now();

    match Docker::connect_with_local_defaults() {
        Ok(docker) => {
            match docker.version().await {
                Ok(version) => {
                    let duration = start.elapsed().as_millis();
                    let version_str = version.version.unwrap_or_else(|| "unknown".to_string());

                    log_docker_operation!(
                        tracing::Level::INFO,
                        "version",
                        method = "GET",
                        endpoint = "/version",
                        duration_ms = duration,
                        status_code = 200
                    );

                    info!(
                        version = %version_str,
                        duration_ms = duration,
                        "Retrieved Docker version"
                    );

                    Ok(format!("Docker version: {}", version_str))
                }
                Err(e) => {
                    let duration = start.elapsed().as_millis();

                    log_docker_operation!(
                        tracing::Level::ERROR,
                        "version",
                        method = "GET",
                        endpoint = "/version",
                        duration_ms = duration,
                        status_code = 500,
                        error = %e
                    );

                    error!(error = %e, "Failed to get Docker version");
                    Err(format!("Failed to get Docker version: {}", e))
                }
            }
        }
        Err(e) => {
            log_docker_operation!(
                tracing::Level::ERROR,
                "connect",
                method = "CONNECT",
                endpoint = "unix:///var/run/docker.sock",
                duration_ms = start.elapsed().as_millis(),
                status_code = 503,
                error = %e
            );

            error!(error = %e, "Cannot connect to Docker");
            Err(format!("Cannot connect to Docker: {}", e))
        }
    }
}

#[instrument]
pub async fn get_docker_info() -> Result<serde_json::Value, String> {
    let start = Instant::now();

    match Docker::connect_with_local_defaults() {
        Ok(docker) => {
            match docker.info().await {
                Ok(info) => {
                    let duration = start.elapsed().as_millis();
                    let containers = info.containers.unwrap_or(0);
                    let images = info.images.unwrap_or(0);
                    let memory_gb = info.mem_total.unwrap_or(0) / 1_073_741_824;
                    let cpus = info.ncpu.unwrap_or(0);

                    log_docker_operation!(
                        tracing::Level::INFO,
                        "info",
                        method = "GET",
                        endpoint = "/info",
                        duration_ms = duration,
                        status_code = 200
                    );

                    info!(
                        containers = containers,
                        images = images,
                        memory_gb = memory_gb,
                        cpus = cpus,
                        duration_ms = duration,
                        "Retrieved Docker system info"
                    );

                    // Log container count as performance metric
                    log_performance_metric!(
                        "docker_containers_total",
                        containers,
                        metric_type = "gauge"
                    );

                    log_performance_metric!(
                        "docker_images_total",
                        images,
                        metric_type = "gauge"
                    );

                    Ok(serde_json::json!({
                        "containers": containers,
                        "images": images,
                        "memory_total": info.mem_total.unwrap_or(0),
                        "cpus": cpus,
                        "os_type": info.os_type.unwrap_or_else(|| "unknown".to_string()),
                        "architecture": info.architecture.unwrap_or_else(|| "unknown".to_string()),
                    }))
                }
                Err(e) => {
                    let duration = start.elapsed().as_millis();

                    log_docker_operation!(
                        tracing::Level::ERROR,
                        "info",
                        method = "GET",
                        endpoint = "/info",
                        duration_ms = duration,
                        status_code = 500,
                        error = %e
                    );

                    error!(error = %e, "Failed to get Docker info");
                    Err(format!("Failed to get Docker info: {}", e))
                }
            }
        }
        Err(e) => {
            log_docker_operation!(
                tracing::Level::ERROR,
                "connect",
                method = "CONNECT",
                endpoint = "unix:///var/run/docker.sock",
                duration_ms = start.elapsed().as_millis(),
                status_code = 503,
                error = %e
            );

            error!(error = %e, "Cannot connect to Docker");
            Err(format!("Cannot connect to Docker: {}", e))
        }
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
