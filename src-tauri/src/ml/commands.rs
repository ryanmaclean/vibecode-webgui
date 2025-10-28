// src-tauri/src/ml/commands.rs
// Tauri commands for CoreML functionality
// TODO: Re-enable once CoreML Swift library is complete

use serde_json::Value;
use tauri::command;

/// Check if ML acceleration is available
#[command]
pub fn ml_is_available() -> bool {
    // TODO: Re-enable Swift integration
    // #[cfg(target_os = "macos")]
    // {
    //     unsafe {
    //         extern "C" {
    //             fn vibe_ml_is_available() -> bool;
    //         }
    //         vibe_ml_is_available()
    //     }
    // }

    // Temporarily disabled for MVP
    false
}

/// Get device information for ML acceleration
#[command]
pub fn ml_get_device_info() -> Result<Value, String> {
    // TODO: Re-enable Swift integration
    // #[cfg(target_os = "macos")]
    // {
    //     unsafe {
    //         extern "C" {
    //             fn vibe_ml_get_device_info() -> *const i8;
    //         }
    //
    //         let c_str = vibe_ml_get_device_info();
    //         if c_str.is_null() {
    //             return Err("Failed to get device info".to_string());
    //         }
    //
    //         let c_str = CStr::from_ptr(c_str);
    //         let s = c_str.to_str()
    //             .map_err(|e| format!("Failed to convert to string: {}", e))?;
    //
    //         let json: Value = serde_json::from_str(s)
    //             .map_err(|e| format!("Failed to parse JSON: {}", e))?;
    //
    //         Ok(json)
    //     }
    // }

    Err("ML acceleration temporarily disabled for MVP".to_string())
}

/// Get ML capabilities
#[command]
pub fn ml_get_capabilities() -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        // Use the device info to determine capabilities
        let info = ml_get_device_info()?;
        
        Ok(serde_json::json!({
            "available": true,
            "platform": "macos",
            "metal": true,
            "coreML": true,
            "device": info,
        }))
    }
    
    #[cfg(not(target_os = "macos"))]
    {
        Ok(serde_json::json!({
            "available": false,
            "platform": "unsupported",
            "metal": false,
            "coreML": false,
        }))
    }
}

/// Initialize ML accelerator
#[command]
pub fn ml_init() -> Result<String, String> {
    // TODO: Re-enable Swift integration
    // #[cfg(target_os = "macos")]
    // {
    //     unsafe {
    //         extern "C" {
    //             fn vibe_ml_init() -> *mut std::ffi::c_void;
    //         }
    //
    //         let ptr = vibe_ml_init();
    //         if ptr.is_null() {
    //             return Err("Failed to initialize ML accelerator".to_string());
    //         }
    //
    //         Ok("ML accelerator initialized successfully".to_string())
    //     }
    // }

    Err("ML acceleration temporarily disabled for MVP".to_string())
}

