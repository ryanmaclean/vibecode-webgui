use burn::backend::{Autodiff, Backend};
use burn_neural_network::{init_logging, print_banner, train, ModelConfig, TrainingConfig};
use clap::{Arg, Command};
use std::str::FromStr;

fn main() -> anyhow::Result<()> {
    init_logging();
    print_banner();

    let matches = Command::new("Burn Neural Network Trainer")
        .version("1.0")
        .about("Train a neural network using the Burn deep learning framework")
        .arg(
            Arg::new("backend")
                .long("backend")
                .help("Backend to use for training")
                .value_parser(["ndarray", "cuda", "metal", "wgpu"])
                .default_value("ndarray"),
        )
        .arg(
            Arg::new("epochs")
                .long("epochs")
                .help("Number of training epochs")
                .value_parser(clap::value_parser!(usize))
                .default_value("10"),
        )
        .arg(
            Arg::new("batch-size")
                .long("batch-size")
                .help("Batch size for training")
                .value_parser(clap::value_parser!(usize))
                .default_value("32"),
        )
        .arg(
            Arg::new("learning-rate")
                .long("learning-rate")
                .help("Learning rate for optimization")
                .value_parser(clap::value_parser!(f64))
                .default_value("0.001"),
        )
        .arg(
            Arg::new("hidden-size")
                .long("hidden-size")
                .help("Hidden layer size")
                .value_parser(clap::value_parser!(usize))
                .default_value("128"),
        )
        .arg(
            Arg::new("dropout")
                .long("dropout")
                .help("Dropout rate")
                .value_parser(clap::value_parser!(f64))
                .default_value("0.5"),
        )
        .get_matches();

    let backend = matches.get_one::<String>("backend").unwrap();
    let epochs = *matches.get_one::<usize>("epochs").unwrap();
    let batch_size = *matches.get_one::<usize>("batch-size").unwrap();
    let learning_rate = *matches.get_one::<f64>("learning-rate").unwrap();
    let hidden_size = *matches.get_one::<usize>("hidden-size").unwrap();
    let dropout = *matches.get_one::<f64>("dropout").unwrap();

    log::info!("Training configuration:");
    log::info!("  Backend: {}", backend);
    log::info!("  Epochs: {}", epochs);
    log::info!("  Batch size: {}", batch_size);
    log::info!("  Learning rate: {}", learning_rate);
    log::info!("  Hidden size: {}", hidden_size);
    log::info!("  Dropout: {}", dropout);

    let training_config = TrainingConfig {
        epochs,
        batch_size,
        learning_rate,
        weight_decay: 1e-4,
        early_stopping_patience: 5,
        save_every: 5,
    };

    let model_config = ModelConfig {
        input_size: 784,
        hidden_size,
        num_classes: 10,
        dropout,
    };

    match backend.as_str() {
        "ndarray" => {
            type Backend = Autodiff<burn_ndarray::NdArray<f32>>;
            let device = burn_ndarray::NdArrayDevice::Cpu;
            train::<Backend>(device, training_config, model_config)
        }
        #[cfg(feature = "cuda")]
        "cuda" => {
            type Backend = Autodiff<burn_cuda::Cuda<f32>>;
            let device = burn_cuda::CudaDevice::new(0);
            train::<Backend>(device, training_config, model_config)
        }
        #[cfg(feature = "metal")]
        "metal" => {
            type Backend = Autodiff<burn_metal::Metal<f32>>;
            let device = burn_metal::MetalDevice::new(0);
            train::<Backend>(device, training_config, model_config)
        }
        #[cfg(feature = "wgpu")]
        "wgpu" => {
            type Backend = Autodiff<burn_wgpu::Wgpu<f32>>;
            let device = burn_wgpu::WgpuDevice::default();
            train::<Backend>(device, training_config, model_config)
        }
        _ => {
            anyhow::bail!("Unsupported backend: {}", backend);
        }
    }?;

    log::info!("Training completed successfully!");
    println!("🎉 Training finished! Check './burn-models/' for saved models.");

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cli_parsing() {
        // Test that the CLI can be created without panicking
        let _cmd = Command::new("test");
    }
}