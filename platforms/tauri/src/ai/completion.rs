// AI Code Completion Module - Optimized code completion and suggestions
// Provides intelligent code completion, context-aware suggestions, and performance optimization

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Code completion request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionRequest {
    pub code: String,
    pub cursor: usize,
    pub language: String,
    pub file_path: Option<String>,
    pub context: Option<CompletionContext>,
    pub prefer_local: bool,
}

/// Completion context for better suggestions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionContext {
    /// Other files in the project
    pub related_files: Vec<String>,
    /// Current function/class context
    pub current_scope: Option<String>,
    /// Imports/dependencies
    pub imports: Vec<String>,
    /// Project type (e.g., "nodejs", "rust", "python")
    pub project_type: Option<String>,
}

/// Code completion response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionResponse {
    pub text: String,
    pub provider: String,
    pub model: String,
    pub latency_ms: u64,
    pub confidence: Option<f32>,
    pub suggestions: Vec<CompletionSuggestion>,
}

/// Individual completion suggestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompletionSuggestion {
    pub text: String,
    pub label: String,
    pub kind: CompletionKind,
    pub detail: Option<String>,
    pub documentation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CompletionKind {
    Function,
    Variable,
    Class,
    Method,
    Property,
    Keyword,
    Snippet,
    Text,
}

/// Completion optimization strategies
pub struct CompletionOptimizer;

impl CompletionOptimizer {
    /// Extract relevant context from code
    pub fn extract_context(code: &str, cursor: usize, language: &str) -> CompletionContext {
        let before_cursor = &code[..cursor.min(code.len())];

        CompletionContext {
            related_files: Vec::new(),
            current_scope: Self::detect_current_scope(before_cursor, language),
            imports: Self::extract_imports(before_cursor, language),
            project_type: Some(language.to_string()),
        }
    }

    /// Detect current scope (function, class, etc.)
    fn detect_current_scope(code: &str, language: &str) -> Option<String> {
        match language {
            "javascript" | "typescript" => {
                // Look for function or class declarations
                if let Some(func_pos) = code.rfind("function ") {
                    let rest = &code[func_pos..];
                    if let Some(name_end) = rest.find('(') {
                        return Some(rest[9..name_end].trim().to_string());
                    }
                }
                None
            }
            "rust" => {
                // Look for fn declarations
                if let Some(fn_pos) = code.rfind("fn ") {
                    let rest = &code[fn_pos..];
                    if let Some(name_end) = rest.find('(') {
                        return Some(rest[3..name_end].trim().to_string());
                    }
                }
                None
            }
            _ => None,
        }
    }

    /// Extract imports from code
    fn extract_imports(code: &str, language: &str) -> Vec<String> {
        let mut imports = Vec::new();

        match language {
            "javascript" | "typescript" => {
                for line in code.lines() {
                    if line.trim().starts_with("import ") || line.trim().starts_with("require(") {
                        imports.push(line.trim().to_string());
                    }
                }
            }
            "rust" => {
                for line in code.lines() {
                    if line.trim().starts_with("use ") {
                        imports.push(line.trim().to_string());
                    }
                }
            }
            "python" => {
                for line in code.lines() {
                    if line.trim().starts_with("import ") || line.trim().starts_with("from ") {
                        imports.push(line.trim().to_string());
                    }
                }
            }
            _ => {}
        }

        imports
    }

    /// Build optimized prompt for completion
    pub fn build_completion_prompt(request: &CompletionRequest) -> String {
        let before_cursor = &request.code[..request.cursor.min(request.code.len())];
        let after_cursor = &request.code[request.cursor.min(request.code.len())..];

        let mut prompt = format!(
            "Complete the following {} code at the cursor position (marked with <CURSOR>):\n\n",
            request.language
        );

        // Add context if available
        if let Some(ref context) = request.context {
            if let Some(ref scope) = context.current_scope {
                prompt.push_str(&format!("Current scope: {}\n", scope));
            }
            if !context.imports.is_empty() {
                prompt.push_str(&format!("Imports: {}\n", context.imports.join(", ")));
            }
            prompt.push('\n');
        }

        // Add code with cursor marker
        prompt.push_str(before_cursor);
        prompt.push_str("<CURSOR>");

        // Include limited after-cursor context
        let after_preview = &after_cursor[..after_cursor.len().min(100)];
        prompt.push_str(after_preview);

        prompt.push_str("\n\nProvide the code completion at <CURSOR>:");

        prompt
    }

    /// Select best model for completion based on language and context size
    pub fn select_completion_model(request: &CompletionRequest, prefer_local: bool) -> (String, String) {
        let code_size = request.code.len();

        if prefer_local {
            // Use fast local models
            match request.language.as_str() {
                "rust" | "javascript" | "typescript" | "python" | "go" => {
                    ("ollama".to_string(), "qwen2.5-coder:1.5b".to_string())
                }
                _ => {
                    ("ollama".to_string(), "llama3.2:1b".to_string())
                }
            }
        } else if code_size < 10_000 {
            // Small context - use fast model
            ("openrouter".to_string(), "google/gemini-flash-1.5".to_string())
        } else {
            // Large context - use capable model
            ("openrouter".to_string(), "anthropic/claude-3.5-sonnet".to_string())
        }
    }

    /// Cache key for completion request
    pub fn cache_key(request: &CompletionRequest) -> String {
        use std::collections::hash_map::DefaultHasher;
        use std::hash::{Hash, Hasher};

        let mut hasher = DefaultHasher::new();
        request.code.hash(&mut hasher);
        request.cursor.hash(&mut hasher);
        request.language.hash(&mut hasher);

        format!("completion:{:x}", hasher.finish())
    }
}

/// Completion post-processing
pub struct CompletionPostProcessor;

impl CompletionPostProcessor {
    /// Clean up completion response
    pub fn clean_completion(text: &str, language: &str) -> String {
        let mut cleaned = text.trim().to_string();

        // Remove markdown code blocks if present
        if cleaned.starts_with("```") {
            if let Some(first_newline) = cleaned.find('\n') {
                cleaned = cleaned[first_newline + 1..].to_string();
            }
            if cleaned.ends_with("```") {
                cleaned = cleaned[..cleaned.len() - 3].to_string();
            }
        }

        // Remove language-specific artifacts
        match language {
            "javascript" | "typescript" => {
                // Remove common completion artifacts
                cleaned = cleaned.replace("<CURSOR>", "");
            }
            "rust" => {
                // Remove cursor markers
                cleaned = cleaned.replace("<CURSOR>", "");
            }
            _ => {}
        }

        cleaned.trim().to_string()
    }

    /// Score completion quality (0.0 - 1.0)
    pub fn score_completion(completion: &str, language: &str, context: &str) -> f32 {
        let mut score: f32 = 1.0;

        // Penalize empty completions
        if completion.trim().is_empty() {
            return 0.0;
        }

        // Penalize very short completions (likely incomplete)
        if completion.len() < 3 {
            score *= 0.5;
        }

        // Bonus for proper syntax (language-specific)
        match language {
            "javascript" | "typescript" => {
                // Check for balanced braces
                let open_braces = completion.matches('{').count();
                let close_braces = completion.matches('}').count();
                if open_braces == close_braces {
                    score *= 1.2;
                }
            }
            "rust" => {
                // Check for common Rust patterns
                if completion.contains("::") || completion.contains("fn ") {
                    score *= 1.1;
                }
            }
            _ => {}
        }

        // Clamp score to 0.0 - 1.0
        score.min(1.0).max(0.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_imports_typescript() {
        let code = r#"
import { useState } from 'react';
import axios from 'axios';

function MyComponent() {
"#;
        let imports = CompletionOptimizer::extract_imports(code, "typescript");
        assert_eq!(imports.len(), 2);
        assert!(imports[0].contains("useState"));
    }

    #[test]
    fn test_extract_imports_rust() {
        let code = r#"
use std::collections::HashMap;
use serde::{Serialize, Deserialize};

fn main() {
"#;
        let imports = CompletionOptimizer::extract_imports(code, "rust");
        assert_eq!(imports.len(), 2);
        assert!(imports[0].contains("HashMap"));
    }

    #[test]
    fn test_detect_current_scope_rust() {
        let code = r#"
fn my_function() {
    let x = 5;
"#;
        let scope = CompletionOptimizer::detect_current_scope(code, "rust");
        assert_eq!(scope, Some("my_function".to_string()));
    }

    #[test]
    fn test_clean_completion() {
        let completion = "```rust\nfn hello() {}\n```";
        let cleaned = CompletionPostProcessor::clean_completion(completion, "rust");
        assert_eq!(cleaned, "fn hello() {}");
    }

    #[test]
    fn test_score_completion() {
        let good_completion = "function hello() { return 'world'; }";
        let score = CompletionPostProcessor::score_completion(good_completion, "javascript", "");
        assert!(score > 0.5);

        let empty_completion = "";
        let score = CompletionPostProcessor::score_completion(empty_completion, "javascript", "");
        assert_eq!(score, 0.0);
    }

    #[test]
    fn test_build_completion_prompt() {
        let request = CompletionRequest {
            code: "function hello() {\n  ".to_string(),
            cursor: 20,
            language: "javascript".to_string(),
            file_path: None,
            context: None,
            prefer_local: true,
        };

        let prompt = CompletionOptimizer::build_completion_prompt(&request);
        assert!(prompt.contains("<CURSOR>"));
        assert!(prompt.contains("javascript"));
    }

    #[test]
    fn test_select_completion_model() {
        let request = CompletionRequest {
            code: "fn main() {}".to_string(),
            cursor: 10,
            language: "rust".to_string(),
            file_path: None,
            context: None,
            prefer_local: true,
        };

        let (provider, model) = CompletionOptimizer::select_completion_model(&request, true);
        assert_eq!(provider, "ollama");
        assert!(model.contains("coder"));
    }
}
