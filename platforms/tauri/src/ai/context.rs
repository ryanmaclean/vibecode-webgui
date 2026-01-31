// AI Context Management Module - Intelligent context building and management
// Determines what code/files to send to AI for optimal results

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// Context for AI requests
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIContext {
    /// Primary file being edited
    pub current_file: Option<FileContext>,
    /// Related files (imports, dependencies)
    pub related_files: Vec<FileContext>,
    /// Project metadata
    pub project: Option<ProjectContext>,
    /// User preferences
    pub preferences: ContextPreferences,
}

/// Context for a single file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileContext {
    pub path: PathBuf,
    pub content: String,
    pub language: String,
    pub size_bytes: usize,
    pub line_count: usize,
}

/// Project-level context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectContext {
    pub root_path: PathBuf,
    pub project_type: ProjectType,
    pub dependencies: Vec<String>,
    pub build_files: Vec<PathBuf>,
    pub readme_content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProjectType {
    NodeJS,
    Rust,
    Python,
    Go,
    Java,
    Ruby,
    Unknown,
}

/// User preferences for context management
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextPreferences {
    /// Max tokens to send in context
    pub max_context_tokens: usize,
    /// Include related files automatically
    pub auto_include_related: bool,
    /// Include project documentation
    pub include_readme: bool,
    /// Privacy mode (minimize context)
    pub privacy_mode: bool,
}

impl Default for ContextPreferences {
    fn default() -> Self {
        ContextPreferences {
            max_context_tokens: 8000,
            auto_include_related: true,
            include_readme: true,
            privacy_mode: false,
        }
    }
}

/// Context builder for AI requests
pub struct ContextBuilder {
    current_file: Option<FileContext>,
    related_files: Vec<FileContext>,
    project: Option<ProjectContext>,
    preferences: ContextPreferences,
}

impl ContextBuilder {
    pub fn new() -> Self {
        ContextBuilder {
            current_file: None,
            related_files: Vec::new(),
            project: None,
            preferences: ContextPreferences::default(),
        }
    }

    pub fn with_current_file(mut self, path: PathBuf, content: String, language: String) -> Self {
        self.current_file = Some(FileContext {
            size_bytes: content.len(),
            line_count: content.lines().count(),
            path,
            content,
            language,
        });
        self
    }

    pub fn with_related_file(mut self, path: PathBuf, content: String, language: String) -> Self {
        self.related_files.push(FileContext {
            size_bytes: content.len(),
            line_count: content.lines().count(),
            path,
            content,
            language,
        });
        self
    }

    pub fn with_project(mut self, project: ProjectContext) -> Self {
        self.project = Some(project);
        self
    }

    pub fn with_preferences(mut self, preferences: ContextPreferences) -> Self {
        self.preferences = preferences;
        self
    }

    pub fn build(self) -> AIContext {
        AIContext {
            current_file: self.current_file,
            related_files: self.related_files,
            project: self.project,
            preferences: self.preferences,
        }
    }
}

impl Default for ContextBuilder {
    fn default() -> Self {
        Self::new()
    }
}

/// Context management utilities
pub struct ContextManager;

impl ContextManager {
    /// Detect project type from directory structure
    pub fn detect_project_type(root_path: &Path) -> ProjectType {
        if root_path.join("package.json").exists() {
            ProjectType::NodeJS
        } else if root_path.join("Cargo.toml").exists() {
            ProjectType::Rust
        } else if root_path.join("requirements.txt").exists() || root_path.join("pyproject.toml").exists() {
            ProjectType::Python
        } else if root_path.join("go.mod").exists() {
            ProjectType::Go
        } else if root_path.join("pom.xml").exists() || root_path.join("build.gradle").exists() {
            ProjectType::Java
        } else if root_path.join("Gemfile").exists() {
            ProjectType::Ruby
        } else {
            ProjectType::Unknown
        }
    }

    /// Extract imports from file content
    pub fn extract_imports(content: &str, language: &str) -> Vec<String> {
        let mut imports = Vec::new();

        match language {
            "javascript" | "typescript" => {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("import ") {
                        // Extract module name from: import { x } from 'module'
                        if let Some(from_pos) = trimmed.find(" from ") {
                            let module_part = &trimmed[from_pos + 6..];
                            let module = module_part
                                .trim()
                                .trim_matches(|c| c == '\'' || c == '"' || c == ';')
                                .to_string();
                            imports.push(module);
                        }
                    } else if trimmed.contains("require(") {
                        // Extract from: const x = require('module')
                        if let Some(req_pos) = trimmed.find("require(") {
                            let after_require = &trimmed[req_pos + 8..];
                            if let Some(end) = after_require.find(')') {
                                let module = after_require[..end]
                                    .trim()
                                    .trim_matches(|c| c == '\'' || c == '"')
                                    .to_string();
                                if !module.is_empty() {
                                    imports.push(module);
                                }
                            }
                        }
                    }
                }
            }
            "rust" => {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("use ") {
                        let use_part = trimmed[4..]
                            .trim_end_matches(';')
                            .trim()
                            .to_string();
                        imports.push(use_part);
                    }
                }
            }
            "python" => {
                for line in content.lines() {
                    let trimmed = line.trim();
                    if trimmed.starts_with("import ") {
                        let module = trimmed[7..].split_whitespace().next().unwrap_or("").to_string();
                        if !module.is_empty() {
                            imports.push(module);
                        }
                    } else if trimmed.starts_with("from ") {
                        if let Some(import_pos) = trimmed.find(" import ") {
                            let module = trimmed[5..import_pos].trim().to_string();
                            imports.push(module);
                        }
                    }
                }
            }
            _ => {}
        }

        imports
    }

    /// Estimate token count for context (rough approximation)
    pub fn estimate_tokens(context: &AIContext) -> usize {
        let mut total = 0;

        if let Some(ref file) = context.current_file {
            total += file.content.len() / 4; // Rough: 1 token H 4 chars
        }

        for file in &context.related_files {
            total += file.content.len() / 4;
        }

        if let Some(ref project) = context.project {
            if let Some(ref readme) = project.readme_content {
                total += readme.len() / 4;
            }
        }

        total
    }

    /// Trim context to fit token limit
    pub fn trim_to_token_limit(context: &mut AIContext, max_tokens: usize) {
        let current_tokens = Self::estimate_tokens(context);

        if current_tokens <= max_tokens {
            return;
        }

        // Strategy: Keep current file, trim related files
        let current_file_tokens = context
            .current_file
            .as_ref()
            .map(|f| f.content.len() / 4)
            .unwrap_or(0);

        let available_for_related = max_tokens.saturating_sub(current_file_tokens);

        // Sort related files by relevance (for now, just keep first N)
        let mut accumulated = 0;
        context.related_files.retain(|file| {
            let file_tokens = file.content.len() / 4;
            if accumulated + file_tokens <= available_for_related {
                accumulated += file_tokens;
                true
            } else {
                false
            }
        });

        // Remove README if still over limit
        if Self::estimate_tokens(context) > max_tokens {
            if let Some(ref mut project) = context.project {
                project.readme_content = None;
            }
        }
    }

    /// Build context for code completion
    pub fn build_completion_context(
        file_path: PathBuf,
        content: String,
        language: String,
        project_root: Option<PathBuf>,
    ) -> AIContext {
        let mut builder = ContextBuilder::new()
            .with_current_file(file_path.clone(), content.clone(), language.clone());

        // Add project context if available
        if let Some(root) = project_root {
            let project_type = Self::detect_project_type(&root);
            let project = ProjectContext {
                root_path: root.clone(),
                project_type,
                dependencies: Vec::new(),
                build_files: Vec::new(),
                readme_content: None,
            };
            builder = builder.with_project(project);
        }

        // Extract and resolve imports (simplified - would need file system access)
        let imports = Self::extract_imports(&content, &language);

        // Build and return context
        builder.build()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_context_builder() {
        let context = ContextBuilder::new()
            .with_current_file(
                PathBuf::from("test.rs"),
                "fn main() {}".to_string(),
                "rust".to_string(),
            )
            .build();

        assert!(context.current_file.is_some());
        assert_eq!(context.related_files.len(), 0);
    }

    #[test]
    fn test_extract_imports_typescript() {
        let content = r#"
import { useState } from 'react';
import axios from 'axios';
const fs = require('fs');
"#;
        let imports = ContextManager::extract_imports(content, "typescript");
        assert_eq!(imports.len(), 3);
        assert!(imports.contains(&"react".to_string()));
        assert!(imports.contains(&"axios".to_string()));
        assert!(imports.contains(&"fs".to_string()));
    }

    #[test]
    fn test_extract_imports_rust() {
        let content = r#"
use std::collections::HashMap;
use serde::{Serialize, Deserialize};
"#;
        let imports = ContextManager::extract_imports(content, "rust");
        assert_eq!(imports.len(), 2);
        assert!(imports[0].contains("HashMap"));
    }

    #[test]
    fn test_extract_imports_python() {
        let content = r#"
import os
import sys
from pathlib import Path
"#;
        let imports = ContextManager::extract_imports(content, "python");
        assert_eq!(imports.len(), 3);
        assert!(imports.contains(&"os".to_string()));
        assert!(imports.contains(&"pathlib".to_string()));
    }

    #[test]
    fn test_estimate_tokens() {
        let context = ContextBuilder::new()
            .with_current_file(
                PathBuf::from("test.rs"),
                "x".repeat(400),
                "rust".to_string(),
            )
            .build();

        let tokens = ContextManager::estimate_tokens(&context);
        assert!(tokens >= 90 && tokens <= 110); // ~100 tokens
    }

    #[test]
    fn test_trim_to_token_limit() {
        let mut context = ContextBuilder::new()
            .with_current_file(
                PathBuf::from("main.rs"),
                "x".repeat(1000),
                "rust".to_string(),
            )
            .with_related_file(
                PathBuf::from("lib.rs"),
                "y".repeat(1000),
                "rust".to_string(),
            )
            .with_related_file(
                PathBuf::from("util.rs"),
                "z".repeat(1000),
                "rust".to_string(),
            )
            .build();

        let before = ContextManager::estimate_tokens(&context);
        ContextManager::trim_to_token_limit(&mut context, 300);
        let after = ContextManager::estimate_tokens(&context);

        assert!(after <= 300);
        assert!(after < before);
    }

    #[test]
    fn test_default_preferences() {
        let prefs = ContextPreferences::default();
        assert_eq!(prefs.max_context_tokens, 8000);
        assert!(prefs.auto_include_related);
        assert!(!prefs.privacy_mode);
    }
}
