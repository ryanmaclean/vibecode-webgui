use bollard::container::ListContainersOptions;
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
        Ok(docker) => match docker.ping().await {
            Ok(_) => Ok(true),
            Err(e) => Err(format!("Docker ping failed: {}", e)),
        },
        Err(e) => Err(format!("Cannot connect to Docker: {}", e)),
    }
}

pub async fn get_docker_version() -> Result<String, String> {
    match Docker::connect_with_local_defaults() {
        Ok(docker) => match docker.version().await {
            Ok(version) => {
                let version_str = version.version.unwrap_or_else(|| "unknown".to_string());
                Ok(format!("Docker version: {}", version_str))
            }
            Err(e) => Err(format!("Failed to get Docker version: {}", e)),
        },
        Err(e) => Err(format!("Cannot connect to Docker: {}", e)),
    }
}

pub async fn get_docker_info() -> Result<serde_json::Value, String> {
    match Docker::connect_with_local_defaults() {
        Ok(docker) => match docker.info().await {
            Ok(info) => Ok(serde_json::json!({
                "containers": info.containers.unwrap_or(0),
                "images": info.images.unwrap_or(0),
                "memory_total": info.mem_total.unwrap_or(0),
                "cpus": info.ncpu.unwrap_or(0),
                "os_type": info.os_type.unwrap_or_else(|| "unknown".to_string()),
                "architecture": info.architecture.unwrap_or_else(|| "unknown".to_string()),
            })),
            Err(e) => Err(format!("Failed to get Docker info: {}", e)),
        },
        Err(e) => Err(format!("Cannot connect to Docker: {}", e)),
    }
}

pub async fn start_containers() -> Result<String, String> {
    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Cannot connect to Docker: {}", e))?;

    // List all stopped containers with vibecode prefix
    let mut filters = std::collections::HashMap::new();
    filters.insert("name", vec!["vibecode"]);

    let options = ListContainersOptions {
        all: true,
        filters,
        ..Default::default()
    };

    let containers = docker
        .list_containers(Some(options))
        .await
        .map_err(|e| format!("Failed to list containers: {}", e))?;

    let mut started_count = 0;
    for container in containers {
        if let Some(id) = container.id {
            if let Some(state) = container.state {
                if state != "running" {
                    docker
                        .start_container::<String>(&id, None)
                        .await
                        .map_err(|e| format!("Failed to start container {}: {}", id, e))?;
                    started_count += 1;
                }
            }
        }
    }

    Ok(format!("Started {} container(s)", started_count))
}

pub async fn stop_containers() -> Result<String, String> {
    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Cannot connect to Docker: {}", e))?;

    // List all running containers with vibecode prefix
    let mut filters = std::collections::HashMap::new();
    filters.insert("name", vec!["vibecode"]);

    let options = ListContainersOptions {
        all: true,
        filters,
        ..Default::default()
    };

    let containers = docker
        .list_containers(Some(options))
        .await
        .map_err(|e| format!("Failed to list containers: {}", e))?;

    let mut stopped_count = 0;
    for container in containers {
        if let Some(id) = container.id {
            if let Some(state) = container.state {
                if state == "running" {
                    docker
                        .stop_container(&id, None)
                        .await
                        .map_err(|e| format!("Failed to stop container {}: {}", id, e))?;
                    stopped_count += 1;
                }
            }
        }
    }

    Ok(format!("Stopped {} container(s)", stopped_count))
}

pub async fn restart_containers() -> Result<String, String> {
    let docker = Docker::connect_with_local_defaults()
        .map_err(|e| format!("Cannot connect to Docker: {}", e))?;

    // List all containers with vibecode prefix
    let mut filters = std::collections::HashMap::new();
    filters.insert("name", vec!["vibecode"]);

    let options = ListContainersOptions {
        all: true,
        filters,
        ..Default::default()
    };

    let containers = docker
        .list_containers(Some(options))
        .await
        .map_err(|e| format!("Failed to list containers: {}", e))?;

    let mut restarted_count = 0;
    for container in containers {
        if let Some(id) = container.id {
            docker
                .restart_container(&id, None)
                .await
                .map_err(|e| format!("Failed to restart container {}: {}", id, e))?;
            restarted_count += 1;
        }
    }

    Ok(format!("Restarted {} container(s)", restarted_count))
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
