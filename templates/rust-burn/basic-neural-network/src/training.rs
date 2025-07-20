use crate::{data::MNISTBatcher, model::ModelConfig};
use burn::{
    backend::{Autodiff, Backend},
    data::dataloader::DataLoaderBuilder,
    lr_scheduler::noam::NoamLrSchedulerConfig,
    nn::loss::CrossEntropyLoss,
    optim::AdamConfig,
    record::CompactRecorder,
    tensor::backend::AutodiffBackend,
    train::{
        metric::{AccuracyMetric, LossMetric},
        LearnerBuilder, MetricEarlyStoppingStrategy, StoppingCondition,
    },
};
use std::path::Path;

/// Training configuration
#[derive(Debug)]
pub struct TrainingConfig {
    pub epochs: usize,
    pub batch_size: usize,
    pub learning_rate: f64,
    pub weight_decay: f64,
    pub early_stopping_patience: usize,
    pub save_every: usize,
}

impl Default for TrainingConfig {
    fn default() -> Self {
        Self {
            epochs: 10,
            batch_size: 32,
            learning_rate: 1e-3,
            weight_decay: 1e-4,
            early_stopping_patience: 5,
            save_every: 5,
        }
    }
}

/// Training function
pub fn train<B: AutodiffBackend>(
    device: B::Device,
    training_config: TrainingConfig,
    model_config: ModelConfig,
) -> anyhow::Result<()>
where
    B::FloatTensorPrimitive: Send,
    B::Device: Clone,
    B::InnerBackend: Send,
{
    log::info!("Starting training with config: {:?}", training_config);
    log::info!("Model config: {:?}", model_config);

    // Create datasets
    let train_dataset = crate::data::MNISTDataset::train();
    let test_dataset = crate::data::MNISTDataset::test();

    log::info!("Train dataset size: {}", train_dataset.len());
    log::info!("Test dataset size: {}", test_dataset.len());

    // Create data loaders
    let batcher_train = MNISTBatcher::<B>::new(device.clone());
    let batcher_test = MNISTBatcher::<B::InnerBackend>::new(device.clone());

    let dataloader_train = DataLoaderBuilder::new(batcher_train)
        .batch_size(training_config.batch_size)
        .shuffle(1234)
        .build(train_dataset);

    let dataloader_test = DataLoaderBuilder::new(batcher_test)
        .batch_size(training_config.batch_size)
        .shuffle(1234)
        .build(test_dataset);

    // Initialize model
    let model = model_config.init::<B>(&device);

    // Initialize optimizer
    let optimizer = AdamConfig::new()
        .with_weight_decay(Some(training_config.weight_decay))
        .init();

    // Initialize learning rate scheduler
    let lr_scheduler = NoamLrSchedulerConfig::new(training_config.learning_rate)
        .with_warmup_steps(1000)
        .with_model_size(model_config.hidden_size)
        .init();

    // Create output directory
    let output_dir = Path::new("./burn-models");
    std::fs::create_dir_all(output_dir)?;

    // Create learner
    let learner = LearnerBuilder::new(output_dir)
        .metric_train_numeric(AccuracyMetric::new())
        .metric_valid_numeric(AccuracyMetric::new())
        .metric_train_numeric(LossMetric::new())
        .metric_valid_numeric(LossMetric::new())
        .with_file_checkpointer(CompactRecorder::new())
        .early_stopping(MetricEarlyStoppingStrategy::new::<LossMetric<B>>(
            StoppingCondition::NoImprovementSince {
                n_epochs: training_config.early_stopping_patience,
            },
        ))
        .devices(vec![device])
        .num_epochs(training_config.epochs)
        .summary()
        .build(model, optimizer, lr_scheduler);

    // Start training
    log::info!("Starting training loop...");
    let trained_model = learner.fit(dataloader_train, dataloader_test);

    // Save final model
    let final_model_path = output_dir.join("final_model");
    trained_model
        .save_file(final_model_path.clone(), &CompactRecorder::new())
        .map_err(|e| anyhow::anyhow!("Failed to save model: {}", e))?;

    log::info!("Training completed! Model saved to: {:?}", final_model_path);

    Ok(())
}

/// Evaluation function
pub fn evaluate<B: Backend>(
    device: B::Device,
    model_config: ModelConfig,
    model_path: &Path,
) -> anyhow::Result<f64>
where
    B::FloatTensorPrimitive: Send,
{
    log::info!("Loading model from: {:?}", model_path);

    // Load model
    let model = model_config
        .init::<B>(&device)
        .load_file(model_path, &CompactRecorder::new(), &device)
        .map_err(|e| anyhow::anyhow!("Failed to load model: {}", e))?;

    // Create test dataset and dataloader
    let test_dataset = crate::data::MNISTDataset::test();
    let batcher_test = MNISTBatcher::<B>::new(device);
    let dataloader_test = DataLoaderBuilder::new(batcher_test)
        .batch_size(32)
        .build(test_dataset);

    // Evaluate
    let mut correct = 0;
    let mut total = 0;

    for batch in dataloader_test {
        let output = model.forward(batch.images);
        let predictions = output.argmax(1);
        let targets = batch.targets;

        let batch_correct = predictions
            .equal(targets)
            .int()
            .sum()
            .into_scalar();

        correct += batch_correct as i32;
        total += batch.targets.shape()[0];
    }

    let accuracy = correct as f64 / total as f64;
    log::info!("Test accuracy: {:.4}", accuracy);

    Ok(accuracy)
}

#[cfg(test)]
mod tests {
    use super::*;
    use burn_ndarray::NdArray;

    type TestBackend = Autodiff<NdArray<f32>>;

    #[test]
    fn test_training_config() {
        let config = TrainingConfig::default();
        assert_eq!(config.epochs, 10);
        assert_eq!(config.batch_size, 32);
        assert!(config.learning_rate > 0.0);
    }

    #[test]
    #[ignore] // This is a longer running test
    fn test_training_integration() {
        env_logger::init();
        
        let device = burn_ndarray::NdArrayDevice::Cpu;
        let model_config = ModelConfig::new();
        let training_config = TrainingConfig {
            epochs: 1, // Just one epoch for testing
            batch_size: 16,
            ..Default::default()
        };

        let result = train::<TestBackend>(device, training_config, model_config);
        assert!(result.is_ok());
    }
}