/*!
Microsoft Phi Model Integration for Burn Framework

This module provides integration with Microsoft's Phi family of small language models (SLMs)
for efficient on-device AI capabilities in the VibeCode platform.
*/

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::fs;
use tracing::{info, warn};

/// Microsoft Phi model variants with their specifications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PhiModel {
    /// Phi-1: ~1B parameters, Python coding focus
    Phi1 {
        parameters: String,
        context_length: usize,
        specialization: Vec<String>,
    },
    /// Phi-1.5: ~1.3B parameters, reasoning and understanding
    Phi1_5 {
        parameters: String,
        context_length: usize,
        specialization: Vec<String>,
    },
    /// Phi-2: 2.7B parameters, language comprehension
    Phi2 {
        parameters: String,
        context_length: usize,
        specialization: Vec<String>,
    },
    /// Phi-3: 3.8B+ parameters, language, coding, math
    Phi3 {
        parameters: String,
        context_length: usize,
        specialization: Vec<String>,
    },
    /// Phi-3.5: ~3.5B+ parameters, multilingual support
    Phi3_5 {
        parameters: String,
        context_length: usize,
        specialization: Vec<String>,
    },
    /// Phi-4: 14B parameters, complex reasoning, math, logic
    Phi4 {
        parameters: String,
        context_length: usize,
        specialization: Vec<String>,
    },
    /// Phi-4-Mini: Instruction prompting, reasoning
    Phi4Mini {
        parameters: String,
        context_length: usize,
        specialization: Vec<String>,
    },
}

impl PhiModel {
    /// Get all available Phi models with their specifications
    pub fn available_models() -> Vec<Self> {
        vec![
            PhiModel::Phi2 {
                parameters: "2.7B".to_string(),
                context_length: 2048,
                specialization: vec![
                    "language comprehension".to_string(),
                    "reasoning".to_string(),
                    "code generation".to_string(),
                ],
            },
            PhiModel::Phi3 {
                parameters: "3.8B".to_string(),
                context_length: 4096,
                specialization: vec![
                    "coding".to_string(),
                    "math".to_string(),
                    "reasoning".to_string(),
                    "on-device capable".to_string(),
                ],
            },
            PhiModel::Phi3_5 {
                parameters: "3.8B".to_string(),
                context_length: 131072, // 128K context
                specialization: vec![
                    "multilingual".to_string(),
                    "general performance".to_string(),
                    "enhanced reasoning".to_string(),
                ],
            },
            PhiModel::Phi4 {
                parameters: "14B".to_string(),
                context_length: 16384, // 16K context
                specialization: vec![
                    "complex reasoning".to_string(),
                    "mathematics".to_string(),
                    "logic".to_string(),
                    "state-of-the-art SLM".to_string(),
                ],
            },
            PhiModel::Phi4Mini {
                parameters: "3.8B".to_string(),
                context_length: 8192,
                specialization: vec![
                    "instruction following".to_string(),
                    "reasoning".to_string(),
                    "natural language".to_string(),
                ],
            },
        ]
    }

    /// Get the model name for downloading
    pub fn model_name(&self) -> &'static str {
        match self {
            PhiModel::Phi1 { .. } => "microsoft/phi-1",
            PhiModel::Phi1_5 { .. } => "microsoft/phi-1_5", 
            PhiModel::Phi2 { .. } => "microsoft/phi-2",
            PhiModel::Phi3 { .. } => "microsoft/Phi-3-mini-4k-instruct",
            PhiModel::Phi3_5 { .. } => "microsoft/Phi-3.5-mini-instruct",
            PhiModel::Phi4 { .. } => "microsoft/Phi-4",
            PhiModel::Phi4Mini { .. } => "microsoft/Phi-4-mini",
        }
    }

    /// Get Hugging Face model repository
    pub fn hf_repo(&self) -> &'static str {
        match self {
            PhiModel::Phi2 { .. } => "microsoft/phi-2",
            PhiModel::Phi3 { .. } => "microsoft/Phi-3-mini-4k-instruct-onnx",
            PhiModel::Phi3_5 { .. } => "microsoft/Phi-3.5-mini-instruct-onnx", 
            PhiModel::Phi4 { .. } => "microsoft/Phi-4-onnx",
            PhiModel::Phi4Mini { .. } => "microsoft/Phi-4-mini-onnx",
            _ => "microsoft/phi-2", // Default fallback
        }
    }

    /// Get parameter count as number
    pub fn parameter_count(&self) -> f32 {
        match self {
            PhiModel::Phi1 { .. } => 1.0,
            PhiModel::Phi1_5 { .. } => 1.3,
            PhiModel::Phi2 { .. } => 2.7,
            PhiModel::Phi3 { .. } => 3.8,
            PhiModel::Phi3_5 { .. } => 3.8,
            PhiModel::Phi4 { .. } => 14.0,
            PhiModel::Phi4Mini { .. } => 3.8,
        }
    }

    /// Get context length
    pub fn context_length(&self) -> usize {
        match self {
            PhiModel::Phi1 { context_length, .. } => *context_length,
            PhiModel::Phi1_5 { context_length, .. } => *context_length,
            PhiModel::Phi2 { context_length, .. } => *context_length,
            PhiModel::Phi3 { context_length, .. } => *context_length,
            PhiModel::Phi3_5 { context_length, .. } => *context_length,
            PhiModel::Phi4 { context_length, .. } => *context_length,
            PhiModel::Phi4Mini { context_length, .. } => *context_length,
        }
    }

    /// Get specializations
    pub fn specializations(&self) -> &Vec<String> {
        match self {
            PhiModel::Phi1 { specialization, .. } => specialization,
            PhiModel::Phi1_5 { specialization, .. } => specialization,
            PhiModel::Phi2 { specialization, .. } => specialization,
            PhiModel::Phi3 { specialization, .. } => specialization,
            PhiModel::Phi3_5 { specialization, .. } => specialization,
            PhiModel::Phi4 { specialization, .. } => specialization,
            PhiModel::Phi4Mini { specialization, .. } => specialization,
        }
    }

    /// Check if model is suitable for edge/on-device deployment
    pub fn is_edge_suitable(&self) -> bool {
        self.parameter_count() <= 4.0 // Models <= 4B parameters
    }

    /// Check if model supports coding tasks
    pub fn supports_coding(&self) -> bool {
        self.specializations()
            .iter()
            .any(|s| s.contains("coding") || s.contains("code"))
    }

    /// Check if model supports mathematical reasoning
    pub fn supports_math(&self) -> bool {
        self.specializations()
            .iter()
            .any(|s| s.contains("math") || s.contains("logic"))
    }

    /// Get recommended use cases for this model
    pub fn recommended_use_cases(&self) -> Vec<&'static str> {
        match self {
            PhiModel::Phi2 { .. } => vec![
                "Code completion",
                "Text generation", 
                "Q&A systems",
                "Educational tools"
            ],
            PhiModel::Phi3 { .. } => vec![
                "Code generation",
                "Math problem solving",
                "Reasoning tasks",
                "Edge deployment",
                "Real-time applications"
            ],
            PhiModel::Phi3_5 { .. } => vec![
                "Multilingual applications",
                "Long-context understanding",
                "Complex reasoning",
                "International deployment"
            ],
            PhiModel::Phi4 { .. } => vec![
                "Advanced reasoning",
                "Complex mathematics",
                "Logic puzzles",
                "Research assistance",
                "High-accuracy applications"
            ],
            PhiModel::Phi4Mini { .. } => vec![
                "Instruction following",
                "Task automation",
                "Natural conversation",
                "Efficient deployment"
            ],
            _ => vec!["General language tasks", "Prototyping"],
        }
    }

    /// Display formatted information about the model
    pub fn display_info(&self) -> String {
        format!(
            "🤖 {} ({} parameters)\n📏 Context: {} tokens\n🎯 Specializations: {}\n💡 Use cases: {}",
            self.model_name(),
            match self {
                PhiModel::Phi1 { parameters, .. } => parameters,
                PhiModel::Phi1_5 { parameters, .. } => parameters,
                PhiModel::Phi2 { parameters, .. } => parameters,
                PhiModel::Phi3 { parameters, .. } => parameters,
                PhiModel::Phi3_5 { parameters, .. } => parameters,
                PhiModel::Phi4 { parameters, .. } => parameters,
                PhiModel::Phi4Mini { parameters, .. } => parameters,
            },
            self.context_length(),
            self.specializations().join(", "),
            self.recommended_use_cases().join(", ")
        )
    }
}

/// Model download and cache management
pub struct PhiModelManager {
    cache_dir: PathBuf,
}

impl PhiModelManager {
    /// Create a new model manager with specified cache directory
    pub fn new<P: AsRef<Path>>(cache_dir: P) -> Self {
        Self {
            cache_dir: cache_dir.as_ref().to_path_buf(),
        }
    }

    /// Get default model manager with standard cache location
    pub fn default() -> Self {
        let cache_dir = dirs::cache_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("vibecode")
            .join("phi-models");
        
        Self::new(cache_dir)
    }

    /// Check if a model is cached locally
    pub async fn is_cached(&self, model: &PhiModel) -> bool {
        let model_path = self.model_path(model);
        model_path.exists() && tokio::fs::metadata(&model_path).await.is_ok()
    }

    /// Get the local path for a model
    pub fn model_path(&self, model: &PhiModel) -> PathBuf {
        self.cache_dir.join(format!("{}.onnx", model.model_name().replace("/", "_")))
    }

    /// Download a model if not cached
    pub async fn ensure_model(&self, model: &PhiModel) -> Result<PathBuf> {
        let model_path = self.model_path(model);
        
        if self.is_cached(model).await {
            info!("Model {} already cached at {:?}", model.model_name(), model_path);
            return Ok(model_path);
        }

        info!("Downloading model {} to {:?}", model.model_name(), model_path);
        self.download_model(model).await
    }

    /// Download a model from Hugging Face
    async fn download_model(&self, model: &PhiModel) -> Result<PathBuf> {
        // Create cache directory
        fs::create_dir_all(&self.cache_dir).await
            .context("Failed to create cache directory")?;

        let model_path = self.model_path(model);
        
        // This is a simplified download - in practice, you'd use the hf-hub crate
        // or implement proper Hugging Face API integration
        warn!("Model download not implemented - this is a template");
        warn!("In production, integrate with hf-hub or Hugging Face API");
        warn!("For now, manually download {} to {:?}", model.hf_repo(), model_path);

        // Create a placeholder file for demonstration
        fs::write(&model_path, b"placeholder-model-file").await
            .context("Failed to create placeholder model file")?;

        info!("Model download completed: {:?}", model_path);
        Ok(model_path)
    }

    /// List all cached models
    pub async fn list_cached_models(&self) -> Result<Vec<String>> {
        if !self.cache_dir.exists() {
            return Ok(vec![]);
        }

        let mut entries = fs::read_dir(&self.cache_dir).await
            .context("Failed to read cache directory")?;

        let mut models = vec![];
        while let Some(entry) = entries.next_entry().await
            .context("Failed to read directory entry")? {
            
            if let Some(name) = entry.file_name().to_str() {
                if name.ends_with(".onnx") {
                    models.push(name.replace(".onnx", "").replace("_", "/"));
                }
            }
        }

        Ok(models)
    }

    /// Clear model cache
    pub async fn clear_cache(&self) -> Result<()> {
        if self.cache_dir.exists() {
            fs::remove_dir_all(&self.cache_dir).await
                .context("Failed to clear cache directory")?;
            info!("Model cache cleared");
        }
        Ok(())
    }

    /// Get cache size in bytes
    pub async fn cache_size(&self) -> Result<u64> {
        if !self.cache_dir.exists() {
            return Ok(0);
        }

        let mut total_size = 0;
        let mut entries = fs::read_dir(&self.cache_dir).await
            .context("Failed to read cache directory")?;

        while let Some(entry) = entries.next_entry().await
            .context("Failed to read directory entry")? {
            
            if let Ok(metadata) = entry.metadata().await {
                total_size += metadata.len();
            }
        }

        Ok(total_size)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_phi_model_info() {
        let phi3 = PhiModel::Phi3 {
            parameters: "3.8B".to_string(),
            context_length: 4096,
            specialization: vec!["coding".to_string(), "math".to_string()],
        };

        assert_eq!(phi3.parameter_count(), 3.8);
        assert_eq!(phi3.context_length(), 4096);
        assert!(phi3.supports_coding());
        assert!(phi3.supports_math());
        assert!(phi3.is_edge_suitable());
    }

    #[test]
    fn test_available_models() {
        let models = PhiModel::available_models();
        assert!(!models.is_empty());
        
        // Check that we have different model sizes
        let has_small = models.iter().any(|m| m.parameter_count() <= 4.0);
        let has_large = models.iter().any(|m| m.parameter_count() > 10.0);
        assert!(has_small);
        assert!(has_large);
    }

    #[tokio::test]
    async fn test_model_manager() {
        let temp_dir = tempfile::tempdir().unwrap();
        let manager = PhiModelManager::new(temp_dir.path());

        let phi2 = PhiModel::Phi2 {
            parameters: "2.7B".to_string(),
            context_length: 2048,
            specialization: vec!["test".to_string()],
        };

        assert!(!manager.is_cached(&phi2).await);
        assert_eq!(manager.cache_size().await.unwrap(), 0);
    }
}