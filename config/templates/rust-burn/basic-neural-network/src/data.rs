use burn::{
    data::{dataloader::batcher::Batcher, dataset::Dataset},
    tensor::{backend::Backend, Data, ElementConversion, Int, Shape, Tensor},
};
use serde::{Deserialize, Serialize};

use crate::model::MNISTBatch;

/// MNIST dataset item
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct MNISTItem {
    pub image: Vec<f32>,
    pub label: usize,
}

/// MNIST dataset wrapper
pub struct MNISTDataset {
    dataset: Vec<MNISTItem>,
}

impl MNISTDataset {
    /// Create a new MNIST dataset
    pub fn new() -> Self {
        Self::train()
    }

    /// Create training dataset with synthetic data for demonstration
    pub fn train() -> Self {
        let mut dataset = Vec::new();
        
        // Generate synthetic MNIST-like data for demonstration
        for i in 0..1000 {
            let label = i % 10;
            let mut image = vec![0.0; 784]; // 28x28 = 784
            
            // Add some pattern based on the label
            for j in 0..784 {
                let row = j / 28;
                let col = j % 28;
                
                // Create simple patterns for each digit
                let value = match label {
                    0 => if (row - 14).abs() < 3 && (col - 14).abs() < 3 { 1.0 } else { 0.0 },
                    1 => if col > 10 && col < 18 { 1.0 } else { 0.0 },
                    2 => if row < 10 || row > 18 { 1.0 } else { 0.0 },
                    _ => (row as f32 / 28.0 + col as f32 / 28.0 + label as f32 / 10.0) % 1.0,
                };
                
                image[j] = value + fastrand::f32() * 0.1; // Add noise
            }
            
            dataset.push(MNISTItem { image, label });
        }
        
        Self { dataset }
    }

    /// Create test dataset with synthetic data
    pub fn test() -> Self {
        let mut dataset = Vec::new();
        
        // Generate smaller test dataset
        for i in 0..200 {
            let label = i % 10;
            let mut image = vec![0.0; 784];
            
            // Similar pattern generation as training, but with different noise
            for j in 0..784 {
                let row = j / 28;
                let col = j % 28;
                
                let value = match label {
                    0 => if (row - 14).abs() < 3 && (col - 14).abs() < 3 { 1.0 } else { 0.0 },
                    1 => if col > 10 && col < 18 { 1.0 } else { 0.0 },
                    2 => if row < 10 || row > 18 { 1.0 } else { 0.0 },
                    _ => (row as f32 / 28.0 + col as f32 / 28.0 + label as f32 / 10.0) % 1.0,
                };
                
                image[j] = value + fastrand::f32() * 0.05; // Less noise for test
            }
            
            dataset.push(MNISTItem { image, label });
        }
        
        Self { dataset }
    }
}

impl Dataset<MNISTItem> for MNISTDataset {
    fn get(&self, index: usize) -> Option<MNISTItem> {
        self.dataset.get(index).cloned()
    }

    fn len(&self) -> usize {
        self.dataset.len()
    }
}

/// Batcher for MNIST dataset
#[derive(Clone)]
pub struct MNISTBatcher<B: Backend> {
    device: B::Device,
}

impl<B: Backend> MNISTBatcher<B> {
    pub fn new(device: B::Device) -> Self {
        Self { device }
    }
}

impl<B: Backend> Batcher<MNISTItem, MNISTBatch<B>> for MNISTBatcher<B> {
    fn batch(&self, items: Vec<MNISTItem>) -> MNISTBatch<B> {
        let images = items
            .iter()
            .map(|item| {
                let data = Data::new(item.image.clone(), Shape::new([28, 28]));
                Tensor::<B, 2>::from_data(data, &self.device)
            })
            .collect::<Vec<_>>();

        let targets = items
            .iter()
            .map(|item| item.label.elem::<Int>())
            .collect::<Vec<_>>();

        let images = Tensor::stack(images, 0).flatten(1, 2); // [batch_size, 784]
        let targets = Tensor::from_ints(targets.as_slice(), &self.device);

        MNISTBatch { images, targets }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use burn_ndarray::NdArray;

    type TestBackend = NdArray<f32>;

    #[test]
    fn test_dataset_creation() {
        let dataset = MNISTDataset::train();
        assert_eq!(dataset.len(), 1000);
        
        let item = dataset.get(0).unwrap();
        assert_eq!(item.image.len(), 784);
        assert!(item.label < 10);
    }

    #[test]
    fn test_batcher() {
        let device = burn_ndarray::NdArrayDevice::Cpu;
        let batcher = MNISTBatcher::<TestBackend>::new(device);
        
        let items = vec![
            MNISTItem { image: vec![0.0; 784], label: 0 },
            MNISTItem { image: vec![1.0; 784], label: 1 },
        ];
        
        let batch = batcher.batch(items);
        assert_eq!(batch.images.shape(), [2, 784]);
        assert_eq!(batch.targets.shape(), [2]);
    }

    #[test]
    fn test_dataset_consistency() {
        let train_dataset = MNISTDataset::train();
        let test_dataset = MNISTDataset::test();
        
        assert!(train_dataset.len() > test_dataset.len());
        
        // Check that all labels are valid
        for i in 0..train_dataset.len().min(10) {
            let item = train_dataset.get(i).unwrap();
            assert!(item.label < 10);
            assert_eq!(item.image.len(), 784);
        }
    }
}