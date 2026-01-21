// MIT License - VM Management Module for VibeCode
use serde::{Deserialize, Serialize};
use std::process::{Command, Stdio};
use tauri::{AppHandle, Manager};
use std::path::PathBuf;
use tokio::time::{sleep, Duration};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VMStatus {
    pub name: String,
    pub running: bool,
    pub pid: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VMInfo {
    pub name: String,
    pub disk_path: String,
    pub efi_path: String,
    pub available: bool,
}

/// Get the path to the bundled VM manager binary
fn get_vm_manager_path(app: &AppHandle) -> Result<PathBuf, String> {
    let resource_path = app.path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;
    
    #[cfg(target_os = "macos")]
    let vm_binary = resource_path.join("binaries").join("vibecode-vm");
    
    #[cfg(not(target_os = "macos"))]
    let vm_binary = resource_path.join("binaries").join("vibecode-vm");
    
    if !vm_binary.exists() {
        return Err(format!("VM manager not found at: {}", vm_binary.display()));
    }
    
    Ok(vm_binary)
}

/// Get the path to VM images directory
fn get_vm_images_dir(app: &AppHandle) -> Result<PathBuf, String> {
    // First check if bundled resources exist
    let resource_path = app.path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;
    
    let bundled_vm_dir = resource_path.join("vm-images");
    
    // If bundled VMs don't exist, use user data directory
    if !bundled_vm_dir.exists() {
        let app_data = app.path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;
        
        let user_vm_dir = app_data.join("vms");
        std::fs::create_dir_all(&user_vm_dir)
            .map_err(|e| format!("Failed to create VM directory: {}", e))?;
        
        return Ok(user_vm_dir);
    }
    
    Ok(bundled_vm_dir)
}

/// List available VMs
#[tauri::command]
pub async fn vm_list(app: AppHandle) -> Result<Vec<VMInfo>, String> {
    let vm_dir = get_vm_images_dir(&app)?;
    let mut vms = Vec::new();
    
    // Look for .img files
    let entries = std::fs::read_dir(&vm_dir)
        .map_err(|e| format!("Failed to read VM directory: {}", e))?;
    
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();
        
        if let Some(extension) = path.extension() {
            if extension == "img" {
                let name = path.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("unknown")
                    .to_string();
                
                let disk_path = path.to_string_lossy().to_string();
                let efi_path = path.with_extension("").with_extension("nvram")
                    .to_string_lossy()
                    .to_string();
                
                let available = std::path::Path::new(&efi_path).exists();
                
                vms.push(VMInfo {
                    name,
                    disk_path,
                    efi_path,
                    available,
                });
            }
        }
    }
    
    Ok(vms)
}

/// Start a VM
#[tauri::command]
pub async fn vm_start(app: AppHandle, vm_name: String) -> Result<String, String> {
    let vm_binary = get_vm_manager_path(&app)?;
    let vm_dir = get_vm_images_dir(&app)?;
    
    // Check if VM exists
    let disk_path = vm_dir.join(format!("{}.img", vm_name));
    if !disk_path.exists() {
        return Err(format!("VM '{}' not found", vm_name));
    }
    
    // Start VM in background
    let output = Command::new(&vm_binary)
        .arg(&vm_name)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start VM: {}", e))?;
    
    let pid = output.id();
    
    Ok(format!("VM '{}' started with PID {}", vm_name, pid))
}

/// Stop a VM (by name)
#[tauri::command]
pub async fn vm_stop(vm_name: String) -> Result<String, String> {
    // For now, use pkill to find and stop the VM process
    let output = Command::new("pkill")
        .arg("-f")
        .arg(format!("vibecode-vm {}", vm_name))
        .output()
        .map_err(|e| format!("Failed to stop VM: {}", e))?;
    
    if output.status.success() {
        Ok(format!("VM '{}' stopped", vm_name))
    } else {
        Err(format!("Failed to stop VM '{}': VM may not be running", vm_name))
    }
}

/// Get VM status
#[tauri::command]
pub async fn vm_status(vm_name: String) -> Result<VMStatus, String> {
    // Use pgrep to check if VM is running
    let output = Command::new("pgrep")
        .arg("-f")
        .arg(format!("vibecode-vm {}", vm_name))
        .output()
        .map_err(|e| format!("Failed to check VM status: {}", e))?;
    
    let running = output.status.success();
    let pid = if running {
        String::from_utf8_lossy(&output.stdout)
            .trim()
            .parse::<u32>()
            .ok()
    } else {
        None
    };
    
    Ok(VMStatus {
        name: vm_name,
        running,
        pid,
    })
}

/// Copy bundled VMs to user directory on first run
#[tauri::command]
pub async fn vm_setup_first_run(app: AppHandle) -> Result<String, String> {
    let resource_path = app.path()
        .resource_dir()
        .map_err(|e| format!("Failed to get resource dir: {}", e))?;
    
    let bundled_vm_dir = resource_path.join("vm-images");
    
    if !bundled_vm_dir.exists() {
        return Err("No bundled VMs found".to_string());
    }
    
    let app_data = app.path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    
    let user_vm_dir = app_data.join("vms");
    std::fs::create_dir_all(&user_vm_dir)
        .map_err(|e| format!("Failed to create VM directory: {}", e))?;
    
    // Copy VM files if they don't exist in user directory
    let entries = std::fs::read_dir(&bundled_vm_dir)
        .map_err(|e| format!("Failed to read bundled VM directory: {}", e))?;
    
    let mut copied_count = 0;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let src = entry.path();
        let dest = user_vm_dir.join(entry.file_name());
        
        if !dest.exists() {
            std::fs::copy(&src, &dest)
                .map_err(|e| format!("Failed to copy {}: {}", src.display(), e))?;
            copied_count += 1;
        }
    }
    
    Ok(format!("Setup complete: {} VM files copied to {}", copied_count, user_vm_dir.display()))
}


/// Start OpenVSCode Server VM with port forwarding
#[tauri::command]

pub async fn vm_start_openvscode(app: AppHandle) -> Result<String, String> {

    
    let vm_binary = get_vm_manager_path(&app)?;
    
    // Start VM in background
    let mut cmd = Command::new(&vm_binary);
    cmd.arg("openvscode")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    
    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to start VM: {}", e))?;
    
    // Wait for VM to boot (30 seconds for Alpine to boot and start OpenVSCode Server)
    println!("Waiting for VM to boot and OpenVSCode Server to start...");
    sleep(Duration::from_secs(30)).await;
    
    // Set up SSH port forwarding
    // Try common NAT IP ranges: 192.168.64.x, 10.0.2.x
    // We'll try to connect via SSH and forward port 8080
    let vm_ips = vec!["192.168.64.2", "192.168.64.3", "10.0.2.15"];
    let mut forwarded = false;
    
    for vm_ip in vm_ips {
        // Try SSH port forwarding: ssh -L 8080:localhost:8080 root@vm-ip -N -f
        let ssh_cmd = Command::new("ssh")
            .arg("-L")
            .arg("8080:localhost:8080")
            .arg("-o")
            .arg("StrictHostKeyChecking=no")
            .arg("-o")
            .arg("UserKnownHostsFile=/dev/null")
            .arg("-o")
            .arg("ConnectTimeout=5")
            .arg(format!("root@{}", vm_ip))
            .arg("-N")
            .arg("-f")
            .output();
        
        if let Ok(output) = ssh_cmd {
            if output.status.success() {
                println!("✅ Port forwarding set up to {}", vm_ip);
                forwarded = true;
                break;
            }
        }
    }
    
    if !forwarded {
        println!("⚠️  Could not set up automatic port forwarding. VM may need manual SSH configuration.");
    }
    
    let pid = child.id();
    Ok(format!("OpenVSCode VM started with PID {}. OpenVSCode Server should be accessible at http://localhost:8080", pid))
}
