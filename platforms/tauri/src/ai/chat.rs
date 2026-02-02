// AI Chat Module - Specialized chat operations and utilities
// Provides enhanced chat functionality, conversation history, and message processing

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::commands::{AIChatRequest, AIChatResponse, AIMessage};

/// Conversation history manager
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub messages: Vec<AIMessage>,
    pub created_at: u64,
    pub updated_at: u64,
    pub metadata: HashMap<String, String>,
}

impl Conversation {
    pub fn new(id: String) -> Self {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Conversation {
            id,
            messages: Vec::new(),
            created_at: now,
            updated_at: now,
            metadata: HashMap::new(),
        }
    }

    pub fn add_message(&mut self, message: AIMessage) {
        self.messages.push(message);
        self.updated_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
    }

    pub fn get_messages(&self) -> &[AIMessage] {
        &self.messages
    }

    pub fn clear_messages(&mut self) {
        self.messages.clear();
        self.updated_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();
    }

    /// Get recent messages (last N messages)
    pub fn get_recent_messages(&self, count: usize) -> Vec<AIMessage> {
        let start = if self.messages.len() > count {
            self.messages.len() - count
        } else {
            0
        };
        self.messages[start..].to_vec()
    }

    /// Trim conversation to max token count (approximate)
    pub fn trim_to_token_limit(&mut self, max_tokens: usize) {
        // Rough estimation: 1 token H 4 characters
        let max_chars = max_tokens * 4;
        let mut total_chars = 0;
        let mut keep_from = 0;

        // Count from the end (keep most recent messages)
        for (i, msg) in self.messages.iter().enumerate().rev() {
            total_chars += msg.content.len();
            if total_chars > max_chars {
                keep_from = i + 1;
                break;
            }
        }

        if keep_from > 0 {
            self.messages = self.messages[keep_from..].to_vec();
            self.updated_at = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
        }
    }
}

/// Chat request builder with fluent API
pub struct ChatRequestBuilder {
    messages: Vec<AIMessage>,
    model: Option<String>,
    provider: Option<String>,
    temperature: Option<f32>,
    max_tokens: Option<u32>,
}

impl ChatRequestBuilder {
    pub fn new() -> Self {
        ChatRequestBuilder {
            messages: Vec::new(),
            model: None,
            provider: None,
            temperature: None,
            max_tokens: None,
        }
    }

    pub fn with_message(mut self, role: &str, content: &str) -> Self {
        self.messages.push(AIMessage {
            role: role.to_string(),
            content: content.to_string(),
        });
        self
    }

    pub fn with_messages(mut self, messages: Vec<AIMessage>) -> Self {
        self.messages = messages;
        self
    }

    pub fn with_model(mut self, model: &str) -> Self {
        self.model = Some(model.to_string());
        self
    }

    pub fn with_provider(mut self, provider: &str) -> Self {
        self.provider = Some(provider.to_string());
        self
    }

    pub fn with_temperature(mut self, temperature: f32) -> Self {
        self.temperature = Some(temperature);
        self
    }

    pub fn with_max_tokens(mut self, max_tokens: u32) -> Self {
        self.max_tokens = Some(max_tokens);
        self
    }

    pub fn build(self) -> AIChatRequest {
        AIChatRequest {
            messages: self.messages,
            model: self.model.unwrap_or_else(|| "auto".to_string()),
            provider: self.provider.unwrap_or_else(|| "auto".to_string()),
            temperature: self.temperature,
            max_tokens: self.max_tokens,
        }
    }
}

impl Default for ChatRequestBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// Chat utilities
pub struct ChatUtils;

impl ChatUtils {
    /// Extract code blocks from chat response
    pub fn extract_code_blocks(content: &str) -> Vec<CodeBlock> {
        let mut blocks = Vec::new();
        let mut in_block = false;
        let mut current_block = String::new();
        let mut current_language = String::new();

        for line in content.lines() {
            if line.starts_with("```") {
                if in_block {
                    // End of code block
                    blocks.push(CodeBlock {
                        language: current_language.clone(),
                        code: current_block.clone(),
                    });
                    current_block.clear();
                    current_language.clear();
                    in_block = false;
                } else {
                    // Start of code block
                    current_language = line[3..].trim().to_string();
                    in_block = true;
                }
            } else if in_block {
                current_block.push_str(line);
                current_block.push('\n');
            }
        }

        blocks
    }

    /// Count approximate tokens in text (rough estimation)
    pub fn estimate_tokens(text: &str) -> usize {
        // Rough estimation: 1 token H 4 characters for English text
        text.len() / 4
    }

    /// Summarize conversation for context
    pub fn summarize_conversation(messages: &[AIMessage]) -> String {
        if messages.is_empty() {
            return String::from("Empty conversation");
        }

        let user_messages = messages.iter().filter(|m| m.role == "user").count();
        let assistant_messages = messages.iter().filter(|m| m.role == "assistant").count();

        format!(
            "Conversation with {} user messages and {} assistant messages",
            user_messages, assistant_messages
        )
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeBlock {
    pub language: String,
    pub code: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_conversation_creation() {
        let conv = Conversation::new("test-123".to_string());
        assert_eq!(conv.id, "test-123");
        assert_eq!(conv.messages.len(), 0);
    }

    #[test]
    fn test_add_message() {
        let mut conv = Conversation::new("test".to_string());
        conv.add_message(AIMessage {
            role: "user".to_string(),
            content: "Hello".to_string(),
        });
        assert_eq!(conv.messages.len(), 1);
    }

    #[test]
    fn test_chat_request_builder() {
        let request = ChatRequestBuilder::new()
            .with_message("user", "Hello")
            .with_model("gpt-4")
            .with_temperature(0.7)
            .build();

        assert_eq!(request.messages.len(), 1);
        assert_eq!(request.model, "gpt-4");
        assert_eq!(request.temperature, Some(0.7));
    }

    #[test]
    fn test_extract_code_blocks() {
        let content = "Here's some code:\n```rust\nfn main() {}\n```\nAnd more text";
        let blocks = ChatUtils::extract_code_blocks(content);

        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].language, "rust");
        assert!(blocks[0].code.contains("fn main()"));
    }

    #[test]
    fn test_trim_to_token_limit() {
        let mut conv = Conversation::new("test".to_string());

        for i in 0..10 {
            conv.add_message(AIMessage {
                role: "user".to_string(),
                content: format!("Message {}: {}", i, "x".repeat(100)),
            });
        }

        assert_eq!(conv.messages.len(), 10);

        // Trim to ~100 tokens (400 chars)
        conv.trim_to_token_limit(100);

        // Should have fewer messages now
        assert!(conv.messages.len() < 10);
    }

    #[test]
    fn test_estimate_tokens() {
        let text = "This is a test message";
        let tokens = ChatUtils::estimate_tokens(text);
        assert!(tokens > 0);
        assert!(tokens < 50); // Should be reasonable estimate
    }
}
