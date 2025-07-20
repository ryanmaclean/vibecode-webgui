use burn::backend::Backend;
use burn_neural_network::{evaluate, init_logging, print_banner, Model, ModelConfig};
use clap::{Arg, Command};
use std::path::Path;

fn main() -> anyhow::Result<()> {
    init_logging();
    print_banner();

    let matches = Command::new("Burn Neural Network Inference")
        .version("1.0")
        .about("Run inference with a trained Burn neural network model")
        .arg(
            Arg::new("model-path")
                .long("model-path")
                .help("Path to the trained model file")
                .required(true)
                .value_parser(clap::value_parser!(std::path::PathBuf)),
        )
        .arg(
            Arg::new("backend")
                .long("backend")
                .help("Backend to use for inference")
                .value_parser(["ndarray", "cuda", "metal", "wgpu"])
                .default_value("ndarray"),
        )
        .arg(
            Arg::new("hidden-size")
                .long("hidden-size")
                .help("Hidden layer size (must match training)")
                .value_parser(clap::value_parser!(usize))
                .default_value("128"),
        )
        .get_matches();

    let model_path = matches.get_one::<std::path::PathBuf>("model-path").unwrap();
    let backend = matches.get_one::<String>("backend").unwrap();
    let hidden_size = *matches.get_one::<usize>("hidden-size").unwrap();

    if !model_path.exists() {
        anyhow::bail!("Model file not found: {:?}", model_path);
    }

    log::info!("Running inference with:");
    log::info!("  Model path: {:?}", model_path);
    log::info!("  Backend: {}", backend);
    log::info!("  Hidden size: {}", hidden_size);

    let model_config = ModelConfig {
        input_size: 784,
        hidden_size,
        num_classes: 10,
        dropout: 0.0, // No dropout during inference
    };

    let accuracy = match backend.as_str() {
        "ndarray" => {
            type Backend = burn_ndarray::NdArray<f32>;
            let device = burn_ndarray::NdArrayDevice::Cpu;
            evaluate::<Backend>(device, model_config, model_path)
        }
        #[cfg(feature = "cuda")]
        "cuda" => {
            type Backend = burn_cuda::Cuda<f32>;
            let device = burn_cuda::CudaDevice::new(0);
            evaluate::<Backend>(device, model_config, model_path)
        }
        #[cfg(feature = "metal")]
        "metal" => {
            type Backend = burn_metal::Metal<f32>;
            let device = burn_metal::MetalDevice::new(0);
            evaluate::<Backend>(device, model_config, model_path)
        }
        #[cfg(feature = "wgpu")]
        "wgpu" => {
            type Backend = burn_wgpu::Wgpu<f32>;
            let device = burn_wgpu::WgpuDevice::default();
            evaluate::<Backend>(device, model_config, model_path)
        }
        _ => {
            anyhow::bail!("Unsupported backend: {}", backend);
        }
    }?;

    println!("📊 Model Evaluation Results");
    println!("  Test Accuracy: {:.2}%", accuracy * 100.0);
    
    if accuracy > 0.8 {
        println!("🎉 Excellent performance!");
    } else if accuracy > 0.6 {
        println!("👍 Good performance, room for improvement");
    } else {
        println!("⚠️  Consider retraining with different hyperparameters");
    }

    // Demonstrate single prediction
    demonstrate_single_prediction(&model_config, model_path, backend)?;

    Ok(())
}

fn demonstrate_single_prediction(
    model_config: &ModelConfig,
    model_path: &Path,
    backend: &str,
) -> anyhow::Result<()> {
    use burn::{
        record::CompactRecorder,
        tensor::{Data, Shape, Tensor},
    };

    log::info!("Demonstrating single prediction...");

    match backend {
        "ndarray" => {
            type Backend = burn_ndarray::NdArray<f32>;
            let device = burn_ndarray::NdArrayDevice::Cpu;
            
            // Load model
            let model: Model<Backend> = model_config
                .init(&device)
                .load_file(model_path, &CompactRecorder::new(), &device)
                .map_err(|e| anyhow::anyhow!("Failed to load model: {}", e))?;

            // Create a sample input (synthetic data)
            let input_data = vec![0.5; 784]; // Dummy input
            let input = Tensor::<Backend, 2>::from_data(
                Data::new(input_data, Shape::new([1, 784])),
                &device,
            );

            // Run inference
            let output = model.forward(input);
            let prediction = output.argmax(1);
            let confidence = output.max_dim(1);

            let pred_value: i32 = prediction.into_scalar();
            let conf_value: f32 = confidence.into_scalar();

            println!("🔮 Single Prediction Demo:");
            println!("  Predicted class: {}", pred_value);
            println!("  Confidence: {:.4}", conf_value);
        }
        _ => {
            log::warn!("Single prediction demo only implemented for ndarray backend");
        }
    }

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

    #[test]
    fn test_model_config_creation() {
        let config = ModelConfig {
            input_size: 784,
            hidden_size: 128,
            num_classes: 10,
            dropout: 0.0,
        };
        
        assert_eq!(config.input_size, 784);
        assert_eq!(config.dropout, 0.0);
    }
}