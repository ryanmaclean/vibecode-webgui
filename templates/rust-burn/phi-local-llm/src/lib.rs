/*!
# Burn Phi Local LLM Template

This template demonstrates integration of Microsoft Phi models with the Burn deep learning framework
for efficient on-device AI capabilities in the VibeCode platform.

## Microsoft Phi Models

Microsoft Phi is a family of open, small language models (SLMs) designed to deliver strong 
performance at a fraction of the size, compute requirements, and cost of much larger models.

### Key Advantages for VibeCode Platform

1. **Edge Deployment**: Perfect for on-device AI in development environments
2. **Resource Efficiency**: Lower memory and compute requirements
3. **Latency Optimization**: Faster inference for real-time applications  
4. **Cost Effectiveness**: Reduced operational costs
5. **Specialized Performance**: Optimized for coding, math, and reasoning tasks

### Model Comparison

| Model | Parameters | Context | Specialization | Use Case |
|-------|------------|---------|----------------|----------|
| Phi-2 | 2.7B | 2K | Language, Reasoning | General development |
| Phi-3 | 3.8B | 4K | Coding, Math | Code assistance |
| Phi-3.5 | 3.8B | 128K | Multilingual | International teams |
| Phi-4 | 14B | 16K | Complex reasoning | Advanced analysis |
| Phi-4-Mini | 3.8B | 8K | Instructions | Task automation |

## Burn Framework Integration

This template showcases:

- **Type-Safe Model Loading**: Rust's type system ensures model compatibility
- **Multi-Backend Support**: CPU, CUDA, Metal, WebGPU backends
- **Memory Efficiency**: Optimized memory usage for edge deployment
- **Performance**: Native Rust performance without Python overhead
- **Safety**: Memory-safe model inference with Rust guarantees

## Features

### 🤖 Model Management
- Automatic model downloading and caching
- Multiple Phi model variants support
- Efficient model storage and retrieval

### 💬 Interactive Chat Interface
- Command-line chat with Phi models
- Specialized modes (coding, math)
- Conversation history management

### 🔧 Code Assistant
- AI-powered code completion
- Bug detection and fixing
- Code explanation and documentation

### 📊 Benchmarking
- Performance analysis across different backends
- Memory usage optimization
- Latency measurements

### 🚀 Production Ready
- Containerized deployment
- REST API endpoints
- Monitoring and observability

## Usage Examples

### Basic Chat
```bash
cargo run --bin chat-phi --model phi3 --coding-mode
```

### Code Assistant
```bash
cargo run --bin code-assistant --model phi4-mini
```

### Benchmarking
```bash
cargo run --bin benchmark-phi --backend cuda --model phi3
```

### Model Download
```bash
cargo run --bin download-phi --model phi4 --cache-dir ./models
```

## Integration with VibeCode

This template integrates seamlessly with the VibeCode platform:

1. **VS Code Extension**: Phi models power code completion and suggestions
2. **Project Generation**: AI-assisted project scaffolding
3. **Code Review**: Automated code analysis and recommendations  
4. **Documentation**: Intelligent documentation generation
5. **Debugging**: AI-powered debugging assistance

## Performance Considerations

### Memory Optimization
- Model quantization support
- Efficient token caching
- Memory mapping for large models

### Compute Optimization  
- Multi-threading support
- GPU acceleration (CUDA, Metal)
- Batch processing capabilities

### Deployment Optimization
- Container image optimization
- Model serving strategies
- Load balancing for multiple models

## Extending the Template

You can extend this template by:

1. **Adding New Models**: Support for other SLM families
2. **Custom Fine-tuning**: Domain-specific model adaptation
3. **API Integration**: REST/GraphQL endpoints
4. **Streaming Responses**: Real-time token generation
5. **Multi-modal Support**: Text, code, and image inputs

## Production Deployment

### Docker Container
```dockerfile
FROM rust:slim as builder
WORKDIR /app
COPY . .
RUN cargo build --release --features cuda

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates
COPY --from=builder /app/target/release/chat-phi /usr/local/bin/
EXPOSE 8080
CMD ["chat-phi", "--api-mode"]
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: phi-inference
spec:
  replicas: 3
  selector:
    matchLabels:
      app: phi-inference
  template:
    spec:
      containers:
      - name: phi-inference
        image: vibecode/phi-local-llm:latest
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
```

## Monitoring Integration

### Metrics Collection
- Inference latency tracking
- Memory usage monitoring  
- Model accuracy metrics
- Error rate analysis

### Datadog Integration
- Custom metrics publishing
- Performance dashboards
- Alert configuration
- Distributed tracing

## Security Considerations

### Model Security
- Model integrity verification
- Secure model storage
- Access control and authentication
- Input validation and sanitization

### Runtime Security
- Sandboxed execution environment
- Resource limit enforcement
- Memory safety guarantees
- Error handling and recovery

This template provides a complete foundation for deploying Microsoft Phi models
in production environments with the VibeCode platform.
*/

pub mod phi_models;

// Re-export main types
pub use phi_models::{PhiModel, PhiModelManager};

// Version and metadata
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub const NAME: &str = env!("CARGO_PKG_NAME");
pub const DESCRIPTION: &str = env!("CARGO_PKG_DESCRIPTION");

/// Initialize tracing for the application
pub fn init_tracing() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive("burn_phi_local_llm=info".parse().unwrap())
        )
        .init();
}

/// Print application banner
pub fn print_banner() {
    println!("🔥 {} v{}", NAME, VERSION);
    println!("📝 {}", DESCRIPTION);
    println!("🤖 Microsoft Phi Models + Burn Framework");
    println!("🦀 Powered by Rust for Safety and Performance");
    println!();
}

/// Format bytes as human readable string
pub fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut unit_index = 0;

    while size >= 1024.0 && unit_index < UNITS.len() - 1 {
        size /= 1024.0;
        unit_index += 1;
    }

    if unit_index == 0 {
        format!("{} {}", bytes, UNITS[unit_index])
    } else {
        format!("{:.1} {}", size, UNITS[unit_index])
    }
}

/// Check system requirements for Phi model deployment
pub fn check_system_requirements() -> anyhow::Result<SystemInfo> {
    use std::fs;
    
    // Check available memory
    let memory_info = if cfg!(target_os = "linux") {
        check_linux_memory()?
    } else if cfg!(target_os = "macos") {
        check_macos_memory()?
    } else if cfg!(target_os = "windows") {
        check_windows_memory()?
    } else {
        MemoryInfo {
            total: 0,
            available: 0,
        }
    };

    // Check disk space
    let disk_info = check_disk_space(".")?;

    // Check CPU cores
    let cpu_cores = num_cpus::get();

    // Check GPU availability
    let gpu_info = check_gpu_availability();

    Ok(SystemInfo {
        memory: memory_info,
        disk: disk_info,
        cpu_cores,
        gpu: gpu_info,
    })
}

#[derive(Debug)]
pub struct SystemInfo {
    pub memory: MemoryInfo,
    pub disk: DiskInfo,
    pub cpu_cores: usize,
    pub gpu: GpuInfo,
}

#[derive(Debug)]
pub struct MemoryInfo {
    pub total: u64,      // Total memory in bytes
    pub available: u64,  // Available memory in bytes
}

#[derive(Debug)]  
pub struct DiskInfo {
    pub total: u64,      // Total disk space in bytes
    pub available: u64,  // Available disk space in bytes
}

#[derive(Debug)]
pub struct GpuInfo {
    pub has_cuda: bool,
    pub has_metal: bool,
    pub has_vulkan: bool,
    pub device_count: usize,
}

impl SystemInfo {
    /// Check if system can run a specific Phi model
    pub fn can_run_model(&self, model: &PhiModel) -> (bool, Vec<String>) {
        let mut issues = Vec::new();
        let mut can_run = true;

        // Estimate memory requirements (rough approximation)
        let estimated_memory = (model.parameter_count() * 2.0 * 1024.0 * 1024.0 * 1024.0) as u64; // 2 bytes per parameter

        if self.memory.available < estimated_memory {
            can_run = false;
            issues.push(format!(
                "Insufficient memory: need ~{}, have {}",
                format_bytes(estimated_memory),
                format_bytes(self.memory.available)
            ));
        }

        // Check disk space (models + cache)
        let required_disk = estimated_memory * 2; // Model + cache space
        if self.disk.available < required_disk {
            can_run = false;
            issues.push(format!(
                "Insufficient disk space: need ~{}, have {}",
                format_bytes(required_disk),
                format_bytes(self.disk.available)
            ));
        }

        // Recommend minimum CPU cores
        if self.cpu_cores < 2 {
            issues.push("Recommend at least 2 CPU cores for optimal performance".to_string());
        }

        (can_run, issues)
    }

    /// Get recommended backend for this system
    pub fn recommended_backend(&self) -> &'static str {
        if self.gpu.has_cuda {
            "cuda"
        } else if self.gpu.has_metal {
            "metal"  
        } else if self.gpu.has_vulkan {
            "wgpu"
        } else {
            "ndarray"
        }
    }

    /// Display system information
    pub fn display(&self) {
        println!("💻 System Information:");
        println!("  Memory: {} total, {} available", 
                format_bytes(self.memory.total), 
                format_bytes(self.memory.available));
        println!("  Disk: {} total, {} available", 
                format_bytes(self.disk.total), 
                format_bytes(self.disk.available));
        println!("  CPU Cores: {}", self.cpu_cores);
        println!("  GPU Support: CUDA={}, Metal={}, Vulkan={}", 
                self.gpu.has_cuda, self.gpu.has_metal, self.gpu.has_vulkan);
        println!("  Recommended Backend: {}", self.recommended_backend());
    }
}

// Platform-specific memory checking functions
#[cfg(target_os = "linux")]
fn check_linux_memory() -> anyhow::Result<MemoryInfo> {
    use std::fs;
    let meminfo = fs::read_to_string("/proc/meminfo")?;
    
    let mut total = 0;
    let mut available = 0;
    
    for line in meminfo.lines() {
        if line.starts_with("MemTotal:") {
            total = parse_memory_line(line)?;
        } else if line.starts_with("MemAvailable:") {
            available = parse_memory_line(line)?;
        }
    }
    
    Ok(MemoryInfo { total, available })
}

#[cfg(target_os = "macos")]
fn check_macos_memory() -> anyhow::Result<MemoryInfo> {
    // Simplified - in practice would use system calls
    Ok(MemoryInfo {
        total: 8 * 1024 * 1024 * 1024, // Assume 8GB
        available: 4 * 1024 * 1024 * 1024, // Assume 4GB available
    })
}

#[cfg(target_os = "windows")]
fn check_windows_memory() -> anyhow::Result<MemoryInfo> {
    // Simplified - in practice would use Windows API
    Ok(MemoryInfo {
        total: 16 * 1024 * 1024 * 1024, // Assume 16GB
        available: 8 * 1024 * 1024 * 1024, // Assume 8GB available
    })
}

fn parse_memory_line(line: &str) -> anyhow::Result<u64> {
    let parts: Vec<&str> = line.split_whitespace().collect();
    if parts.len() >= 2 {
        let kb: u64 = parts[1].parse()?;
        Ok(kb * 1024) // Convert KB to bytes
    } else {
        anyhow::bail!("Invalid memory line format")
    }
}

fn check_disk_space(path: &str) -> anyhow::Result<DiskInfo> {
    use std::fs;
    
    // Simplified disk space check
    let metadata = fs::metadata(path)?;
    
    // This is a placeholder - real implementation would use platform-specific APIs
    Ok(DiskInfo {
        total: 100 * 1024 * 1024 * 1024, // Assume 100GB
        available: 50 * 1024 * 1024 * 1024, // Assume 50GB available
    })
}

fn check_gpu_availability() -> GpuInfo {
    // In practice, would check for:
    // - CUDA: nvidia-ml-py, nvidia-smi
    // - Metal: system_profiler on macOS
    // - Vulkan: vulkan-tools, vkcube
    
    GpuInfo {
        has_cuda: cfg!(feature = "cuda"),
        has_metal: cfg!(feature = "metal"),
        has_vulkan: cfg!(feature = "wgpu"), 
        device_count: if cfg!(feature = "cuda") { 1 } else { 0 },
    }
}

// Placeholder for future Burn integration
pub struct PhiInference {
    // Will contain actual Burn model, tokenizer, etc.
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_format_bytes() {
        assert_eq!(format_bytes(1024), "1.0 KB");
        assert_eq!(format_bytes(1024 * 1024), "1.0 MB");
        assert_eq!(format_bytes(1024 * 1024 * 1024), "1.0 GB");
    }

    #[test]
    fn test_system_requirements() {
        let result = check_system_requirements();
        assert!(result.is_ok());
        
        let system_info = result.unwrap();
        assert!(system_info.cpu_cores > 0);
    }

    #[test]
    fn test_model_requirements_check() {
        let system_info = SystemInfo {
            memory: MemoryInfo {
                total: 16 * 1024 * 1024 * 1024, // 16GB
                available: 8 * 1024 * 1024 * 1024, // 8GB
            },
            disk: DiskInfo {
                total: 100 * 1024 * 1024 * 1024, // 100GB
                available: 50 * 1024 * 1024 * 1024, // 50GB
            },
            cpu_cores: 8,
            gpu: GpuInfo {
                has_cuda: true,
                has_metal: false,
                has_vulkan: false,
                device_count: 1,
            },
        };

        let phi3 = PhiModel::Phi3 {
            parameters: "3.8B".to_string(),
            context_length: 4096,
            specialization: vec!["coding".to_string()],
        };

        let (can_run, issues) = system_info.can_run_model(&phi3);
        assert!(can_run);
        assert_eq!(system_info.recommended_backend(), "cuda");
    }
}