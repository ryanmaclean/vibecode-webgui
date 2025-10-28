use burn::{
    config::Config,
    module::Module,
    nn::{
        self,
        loss::{CrossEntropyLoss, Reduction},
        Dropout, DropoutConfig, Linear, LinearConfig, Relu,
    },
    tensor::{backend::Backend, Tensor},
    train::{ClassificationOutput, TrainOutput, TrainStep, ValidStep},
};

/// Multi-layer perceptron model configuration
#[derive(Config, Debug)]
pub struct ModelConfig {
    pub input_size: usize,
    pub hidden_size: usize,
    pub num_classes: usize,
    pub dropout: f64,
}

impl ModelConfig {
    /// Returns the initialized model using the autodiff backend
    pub fn init<B: Backend>(&self, device: &B::Device) -> Model<B> {
        Model {
            linear1: LinearConfig::new(self.input_size, self.hidden_size).init(device),
            linear2: LinearConfig::new(self.hidden_size, self.hidden_size).init(device),
            linear3: LinearConfig::new(self.hidden_size, self.num_classes).init(device),
            dropout: DropoutConfig::new(self.dropout).init(),
            activation: Relu::new(),
        }
    }

    /// Initialize with default values for MNIST-like data
    pub fn new() -> Self {
        Self {
            input_size: 784, // 28x28 images
            hidden_size: 128,
            num_classes: 10,
            dropout: 0.5,
        }
    }
}

/// Multi-layer perceptron model
#[derive(Module, Debug)]
pub struct Model<B: Backend> {
    linear1: Linear<B>,
    linear2: Linear<B>,
    linear3: Linear<B>,
    dropout: Dropout,
    activation: Relu,
}

impl<B: Backend> Model<B> {
    /// Forward pass of the model
    pub fn forward(&self, input: Tensor<B, 2>) -> Tensor<B, 2> {
        let x = input
            .flatten(1, 2) // Flatten input to [batch_size, features]
            .apply(&self.linear1)
            .apply(&self.activation)
            .apply(&self.dropout);

        let x = x
            .apply(&self.linear2)
            .apply(&self.activation)
            .apply(&self.dropout);

        x.apply(&self.linear3)
    }

    /// Forward pass with classification output for training
    pub fn forward_classification(&self, item: MNISTBatch<B>) -> ClassificationOutput<B> {
        let targets = item.targets;
        let output = self.forward(item.images);
        
        ClassificationOutput::new(output, targets)
    }
}

/// MNIST batch structure
#[derive(Clone, Debug)]
pub struct MNISTBatch<B: Backend> {
    pub images: Tensor<B, 2>,
    pub targets: Tensor<B, 1, burn::tensor::Int>,
}

impl<B: Backend> TrainStep<MNISTBatch<B>, ClassificationOutput<B>> for Model<B> {
    fn step(&self, batch: MNISTBatch<B>) -> TrainOutput<ClassificationOutput<B>> {
        let item = self.forward_classification(batch);
        let loss = CrossEntropyLoss::new(None, &Reduction::Auto).forward(
            item.output.clone(),
            item.targets.clone(),
        );

        TrainOutput::new(self, loss.backward(), item)
    }
}

impl<B: Backend> ValidStep<MNISTBatch<B>, ClassificationOutput<B>> for Model<B> {
    fn step(&self, batch: MNISTBatch<B>) -> ClassificationOutput<B> {
        self.forward_classification(batch)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use burn_ndarray::NdArray;

    type TestBackend = NdArray<f32>;

    #[test]
    fn test_model_creation() {
        let device = burn_ndarray::NdArrayDevice::Cpu;
        let config = ModelConfig::new();
        let model: Model<TestBackend> = config.init(&device);
        
        // Test forward pass with dummy data
        let batch_size = 2;
        let input = Tensor::<TestBackend, 2>::random(
            [batch_size, config.input_size],
            burn::tensor::Distribution::Normal(0.0, 1.0),
            &device,
        );
        
        let output = model.forward(input);
        
        // Check output shape
        assert_eq!(output.shape(), [batch_size, config.num_classes]);
    }

    #[test]
    fn test_model_config() {
        let config = ModelConfig {
            input_size: 784,
            hidden_size: 256,
            num_classes: 10,
            dropout: 0.3,
        };
        
        assert_eq!(config.input_size, 784);
        assert_eq!(config.hidden_size, 256);
        assert_eq!(config.num_classes, 10);
        assert_eq!(config.dropout, 0.3);
    }
}