use crate::docker;
use tauri::command;

#[command]
pub fn greet(name: &str) -> String {
    format\!("Hello, {}\! Welcome to VibeCode.", name)
}

#[command]
pub async fn check_docker() -> Result<bool, String> {
    docker::check_docker_available().await
}

#[command]
pub async fn get_docker_version() -> Result<String, String> {
    docker::get_docker_version().await
}
