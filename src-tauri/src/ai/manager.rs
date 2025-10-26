// AI Manager - Core AI functionality and provider orchestration

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;
use once_cell::sync::OnceCell;
use reqwest::Client;
use serde::{Deserialize, Serialize};

use super::commands::{AIChatRequest, AIChatResponse, AIMessage};

pub struct AIManager {
    config: AIConfig,
    client: Client,
    local_models: Arc<RwLock<LocalModelStatus>>,
}

impl AIManager {
    /// Get global singleton instance
    pub fn global() -> &'static AIManager {
        static INSTANCE: OnceCell<AIManager> = OnceCell::new();
        INSTANCE.get_or_init(|| AIManager::new())
    }

    pub fn new() -> Self {
        AIManager {
            config: AIConfig::from_env(),
            client: Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .unwrap(),
            local_models: Arc::new(RwLock::new(LocalModelStatus::default())),
        }
    }

    /// Primary chat interface with intelligent routing
    pub async fn chat(&self, request: AIChatRequest) -> Result<AIChatResponse, String> {
        // Route to appropriate provider
        let provider = self.select_provider(&request).await?;

        let response = match provider.as_str() {
            "ollama" => self.chat_ollama(request).await?,
            "openai" => self.chat_openai(request).await?,
            "anthropic" => self.chat_anthropic(request).await?,
            "openrouter" => self.chat_openrouter(request).await?,
            _ => return Err(format!("Unknown provider: {}", provider)),
        };

        Ok(response)
    }

    /// Ollama local model chat
    async fn chat_ollama(&self, request: AIChatRequest) -> Result<AIChatResponse, String> {
        let url = "http://localhost:11434/api/chat";

        let ollama_messages: Vec<serde_json::Value> = request
            .messages
            .iter()
            .map(|msg| {
                serde_json::json!({
                    "role": msg.role,
                    "content": msg.content,
                })
            })
            .collect();

        let ollama_request = serde_json::json!({
            "model": request.model,
            "messages": ollama_messages,
            "stream": false,
            "options": {
                "temperature": request.temperature.unwrap_or(0.7),
                "num_predict": request.max_tokens.unwrap_or(2000),
            }
        });

        let response = self
            .client
            .post(url)
            .json(&ollama_request)
            .send()
            .await
            .map_err(|e| format!("Ollama request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Ollama error: {}", response.status()));
        }

        let data: serde_json::Value = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

        Ok(AIChatResponse {
            content: data["message"]["content"]
                .as_str()
                .unwrap_or("")
                .to_string(),
            model: request.model,
            provider: "ollama".to_string(),
            tokens_used: None,
            cached: false,
        })
    }

    /// OpenAI chat (stub for future implementation)
    async fn chat_openai(&self, request: AIChatRequest) -> Result<AIChatResponse, String> {
        Err("OpenAI provider not yet implemented".to_string())
    }

    /// Anthropic chat (stub for future implementation)
    async fn chat_anthropic(&self, request: AIChatRequest) -> Result<AIChatResponse, String> {
        Err("Anthropic provider not yet implemented".to_string())
    }

    /// OpenRouter chat (stub for future implementation)
    async fn chat_openrouter(&self, request: AIChatRequest) -> Result<AIChatResponse, String> {
        Err("OpenRouter provider not yet implemented".to_string())
    }

    /// Select best provider based on availability and preferences
    async fn select_provider(&self, request: &AIChatRequest) -> Result<String, String> {
        // Explicit provider specified
        if !request.provider.is_empty() && request.provider != "auto" {
            return Ok(request.provider.clone());
        }

        // Check if local model is available and preferred
        let local_status = self.local_models.read().await;
        if local_status.ollama_available {
            return Ok("ollama".to_string());
        }

        // Fallback to cloud providers
        if self.config.openrouter_key.is_some() {
            return Ok("openrouter".to_string());
        }

        if self.config.openai_key.is_some() {
            return Ok("openai".to_string());
        }

        Err("No AI providers available".to_string())
    }

    /// Check local model status
    pub async fn check_local_models(&self) -> Result<LocalModelStatus, String> {
        let mut status = LocalModelStatus::default();

        // Check Ollama
        match self
            .client
            .get("http://localhost:11434/api/tags")
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => {
                if let Ok(data) = response.json::<serde_json::Value>().await {
                    status.ollama_available = true;
                    status.ollama_models = data["models"]
                        .as_array()
                        .map(|models| {
                            models
                                .iter()
                                .filter_map(|m| m["name"].as_str().map(String::from))
                                .collect()
                        })
                        .unwrap_or_default();
                }
            }
            _ => {}
        }

        // Update global status
        let mut global_status = self.local_models.write().await;
        *global_status = status.clone();

        Ok(status)
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct LocalModelStatus {
    pub ollama_available: bool,
    pub ollama_models: Vec<String>,
    pub localai_available: bool,
}

#[derive(Debug, Clone)]
struct AIConfig {
    openai_key: Option<String>,
    anthropic_key: Option<String>,
    openrouter_key: Option<String>,
}

impl AIConfig {
    fn from_env() -> Self {
        AIConfig {
            openai_key: std::env::var("OPENAI_API_KEY").ok(),
            anthropic_key: std::env::var("ANTHROPIC_API_KEY").ok(),
            openrouter_key: std::env::var("OPENROUTER_API_KEY").ok(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_check_local_models() {
        let manager = AIManager::new();
        let result = manager.check_local_models().await;

        // Should succeed even if Ollama not running
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_select_provider() {
        let manager = AIManager::new();

        let request = AIChatRequest {
            messages: vec![],
            model: "test".to_string(),
            provider: "ollama".to_string(),
            temperature: None,
            max_tokens: None,
        };

        let provider = manager.select_provider(&request).await;
        assert!(provider.is_ok());
    }
}
