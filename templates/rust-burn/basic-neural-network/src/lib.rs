/*!
# Burn Neural Network Template

This template demonstrates how to build a basic neural network using the Burn deep learning framework.
Burn is a modern, type-safe, and performant deep learning framework written in Rust.

## Features

- **Multi-layer Perceptron (MLP)**: A simple feedforward neural network
- **Type Safety**: Leverages Rust's type system for compile-time guarantees
- **Backend Agnostic**: Supports multiple compute backends (CPU, CUDA, Metal, WebGPU)
- **Training Loop**: Complete training pipeline with metrics and early stopping
- **Model Persistence**: Save and load trained models
- **Comprehensive Testing**: Unit tests and integration tests

## Architecture

The template consists of:

- `model.rs`: Neural network architecture definition
- `data.rs`: Dataset handling and data loading utilities
- `training.rs`: Training loop and evaluation functions
- `bin/train.rs`: Training executable
- `bin/inference.rs`: Inference executable

## Usage

### Training
```bash
cargo run --bin train
```

### Inference
```bash
cargo run --bin inference -- --model-path ./burn-models/final_model
```

### With GPU Support
```bash
# CUDA
cargo run --features cuda --bin train

# Metal (macOS)
cargo run --features metal --bin train

# WebGPU
cargo run --features wgpu --bin train
```

## Key Concepts

### Burn Framework Benefits
- **Performance**: Native Rust performance without Python overhead
- **Memory Safety**: Rust's ownership system prevents memory leaks and data races
- **Type Safety**: Compile-time shape and type checking
- **Portability**: Cross-platform support with multiple backends
- **Interoperability**: ONNX support for model import/export

### Model Design
The neural network uses:
- Input layer: 784 neurons (28x28 flattened images)
- Hidden layers: 2 layers with 128 neurons each
- Output layer: 10 neurons (classification classes)
- Activation: ReLU
- Regularization: Dropout (0.5)

### Training Features
- Adam optimizer with weight decay
- Learning rate scheduling (Noam scheduler)
- Early stopping based on validation loss
- Accuracy and loss metrics tracking
- Model checkpointing

## Extending the Template

You can extend this template by:

1. **Adding more complex architectures**: CNNs, RNNs, Transformers
2. **Using real datasets**: MNIST, CIFAR-10, custom datasets
3. **Implementing custom layers**: Attention, normalization, custom activations
4. **Adding data augmentation**: Random transforms, noise injection
5. **Integrating with production systems**: Model serving, API endpoints

## Performance Considerations

- Use appropriate backends for your hardware (CUDA for NVIDIA GPUs)
- Adjust batch size based on available memory
- Consider mixed precision training for larger models
- Use data parallelism for multi-GPU training

## Burn vs Other Frameworks

Compared to PyTorch/TensorFlow:
- **Compile-time safety**: Catch errors before runtime
- **Memory efficiency**: Lower memory usage, especially on CPU
- **Deployment simplicity**: No need for separate inference engines
- **Performance**: Competitive with native Rust performance
- **Ecosystem**: Growing but still maturing compared to Python frameworks
*/

pub mod data;
pub mod model;
pub mod training;

// Re-export commonly used types
pub use data::{MNISTBatch, MNISTBatcher, MNISTDataset, MNISTItem};
pub use model::{Model, ModelConfig};
pub use training::{evaluate, train, TrainingConfig};

// Version and metadata
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub const NAME: &str = env!("CARGO_PKG_NAME");
pub const DESCRIPTION: &str = env!("CARGO_PKG_DESCRIPTION");

/// Initialize logging for the application
pub fn init_logging() {
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();
}

/// Print banner with framework information
pub fn print_banner() {
    println!("🔥 {} v{}", NAME, VERSION);
    println!("📝 {}", DESCRIPTION);
    println!("⚡ Powered by Burn Deep Learning Framework v0.18.0");
    println!("🦀 Written in Rust for performance and safety");
    println!();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_info() {
        assert!(!VERSION.is_empty());
        assert!(!NAME.is_empty());
        assert!(!DESCRIPTION.is_empty());
    }

    #[test]
    fn test_banner() {
        // Just ensure it doesn't panic
        print_banner();
    }
}