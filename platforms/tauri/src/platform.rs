// Platform detection module

use serde::{Deserialize, Serialize};
use tauri::command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlatformInfo {
    pub os: String,
    pub arch: String,
}

#[command]
pub async fn get_platform_info() -> Result<PlatformInfo, String> {
    Ok(PlatformInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    })
}

#[cfg(target_os = "linux")]
pub mod linux {
    use tauri::command;

    #[command]
    pub async fn linux_get_distro_info() -> Result<String, String> {
        Ok("Unknown".to_string())
    }

    #[command]
    pub async fn linux_check_kvm() -> Result<bool, String> {
        Ok(false)
    }

    #[command]
    pub async fn linux_get_xdg_dirs() -> Result<serde_json::Value, String> {
        Ok(serde_json::json!({}))
    }

    #[command]
    pub async fn linux_init_directories() -> Result<String, String> {
        Ok("OK".to_string())
    }

    #[command]
    pub async fn linux_send_notification(
        _title: String,
        _body: String,
    ) -> Result<(), String> {
        Ok(())
    }

    #[command]
    pub async fn linux_notification_capabilities() -> Result<serde_json::Value, String> {
        Ok(serde_json::json!({}))
    }

    #[command]
    pub async fn linux_start_qemu_vm(_name: String) -> Result<String, String> {
        Err("Not implemented".to_string())
    }

    #[command]
    pub async fn linux_list_qemu_vms() -> Result<Vec<String>, String> {
        Ok(vec![])
    }

    #[command]
    pub async fn linux_stop_qemu_vm(_name: String) -> Result<String, String> {
        Err("Not implemented".to_string())
    }

    #[command]
    pub async fn linux_check_requirements() -> Result<serde_json::Value, String> {
        Ok(serde_json::json!({}))
    }

    #[command]
    pub async fn linux_get_setup_instructions() -> Result<String, String> {
        Ok("No instructions available".to_string())
    }
}

#[cfg(target_os = "macos")]
pub mod macos {
    use tauri::command;

    #[command]
    pub async fn macos_get_system_info() -> Result<serde_json::Value, String> {
        Ok(serde_json::json!({}))
    }

    #[command]
    pub async fn macos_is_sandboxed() -> Result<bool, String> {
        Ok(false)
    }
}

#[cfg(target_os = "windows")]
pub mod windows {
    use tauri::command;

    #[command]
    pub async fn windows_get_system_info() -> Result<serde_json::Value, String> {
        Ok(serde_json::json!({}))
    }

    #[command]
    pub async fn windows_check_requirements() -> Result<serde_json::Value, String> {
        Ok(serde_json::json!({}))
    }

    #[command]
    pub async fn windows_get_setup_instructions() -> Result<String, String> {
        Ok("No instructions available".to_string())
    }
}
