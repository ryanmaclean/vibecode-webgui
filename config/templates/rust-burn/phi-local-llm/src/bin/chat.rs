/*!
Interactive Chat Interface for Microsoft Phi Models

This binary provides a command-line chat interface for interacting with locally deployed
Microsoft Phi models, showcasing the power of small language models for on-device AI.
*/

use anyhow::{Context, Result};
use clap::{Parser, ValueEnum};
use std::io::{self, Write};
use tracing::{info, warn};
use burn_phi_local_llm::{PhiModel, PhiModelManager, PhiInference};

#[derive(Parser)]
#[command(name = "phi-chat")]
#[command(about = "Interactive chat with Microsoft Phi models")]
#[command(version = "1.0.0")]
struct Args {
    /// Which Phi model to use
    #[arg(short, long, default_value = "phi3")]
    model: PhiModelChoice,

    /// Maximum tokens to generate
    #[arg(short, long, default_value = "512")]
    max_tokens: usize,

    /// Temperature for sampling (0.0 to 1.0)
    #[arg(short, long, default_value = "0.7")]
    temperature: f32,

    /// System prompt to set context
    #[arg(short, long)]
    system: Option<String>,

    /// Backend to use for inference
    #[arg(short, long, default_value = "ndarray")]
    backend: String,

    /// Enable coding assistant mode
    #[arg(long)]
    coding_mode: bool,

    /// Enable math assistant mode
    #[arg(long)]
    math_mode: bool,
}

#[derive(Clone, ValueEnum)]
enum PhiModelChoice {
    Phi2,
    Phi3,
    Phi35,
    Phi4,
    Phi4Mini,
}

impl From<PhiModelChoice> for PhiModel {
    fn from(choice: PhiModelChoice) -> Self {
        match choice {
            PhiModelChoice::Phi2 => PhiModel::Phi2 {
                parameters: "2.7B".to_string(),
                context_length: 2048,
                specialization: vec![
                    "language comprehension".to_string(),
                    "reasoning".to_string(),
                ],
            },
            PhiModelChoice::Phi3 => PhiModel::Phi3 {
                parameters: "3.8B".to_string(),
                context_length: 4096,
                specialization: vec![
                    "coding".to_string(),
                    "math".to_string(),
                    "reasoning".to_string(),
                ],
            },
            PhiModelChoice::Phi35 => PhiModel::Phi3_5 {
                parameters: "3.8B".to_string(),
                context_length: 131072,
                specialization: vec![
                    "multilingual".to_string(),
                    "general performance".to_string(),
                ],
            },
            PhiModelChoice::Phi4 => PhiModel::Phi4 {
                parameters: "14B".to_string(),
                context_length: 16384,
                specialization: vec![
                    "complex reasoning".to_string(),
                    "mathematics".to_string(),
                    "logic".to_string(),
                ],
            },
            PhiModelChoice::Phi4Mini => PhiModel::Phi4Mini {
                parameters: "3.8B".to_string(),
                context_length: 8192,
                specialization: vec![
                    "instruction following".to_string(),
                    "reasoning".to_string(),
                ],
            },
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter("info")
        .init();

    let args = Args::parse();
    let model: PhiModel = args.model.into();

    println!("🔥 VibeCode Phi Chat Interface");
    println!("================================================");
    println!("{}", model.display_info());
    println!("================================================");

    if args.coding_mode {
        println!("💻 Coding Assistant Mode Enabled");
    }
    if args.math_mode {
        println!("🧮 Math Assistant Mode Enabled");
    }
    println!();

    // Initialize model manager and ensure model is available
    let model_manager = PhiModelManager::default();
    let model_path = model_manager.ensure_model(&model).await
        .context("Failed to ensure model availability")?;

    info!("Model ready at: {:?}", model_path);

    // Initialize inference engine (placeholder - would integrate with actual Burn inference)
    let mut chat_session = ChatSession::new(model, args.system, args.coding_mode, args.math_mode);

    println!("Type 'exit' to quit, 'help' for commands, or start chatting!");
    println!();

    // Main chat loop
    loop {
        print!("You: ");
        io::stdout().flush()?;

        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        let input = input.trim();

        if input.is_empty() {
            continue;
        }

        match input.to_lowercase().as_str() {
            "exit" | "quit" => {
                println!("Goodbye! 👋");
                break;
            }
            "help" => {
                print_help();
                continue;
            }
            "clear" => {
                print!("\x1B[2J\x1B[1;1H"); // Clear screen
                continue;
            }
            "info" => {
                println!("\n{}\n", chat_session.model.display_info());
                continue;
            }
            _ => {}
        }

        // Generate response (placeholder implementation)
        print!("Phi: ");
        let response = chat_session.generate_response(input, args.max_tokens, args.temperature).await?;
        println!("{}\n", response);
    }

    Ok(())
}

fn print_help() {
    println!("\n📚 Available Commands:");
    println!("  exit/quit  - Exit the chat");
    println!("  help       - Show this help message");
    println!("  clear      - Clear the screen");
    println!("  info       - Show model information");
    println!("\n💡 Tips:");
    println!("  - Use specific prompts for better results");
    println!("  - Coding mode: Ask for code examples, debugging help");
    println!("  - Math mode: Ask for mathematical problem solving");
    println!("  - Try: 'Explain this code:', 'Solve this equation:', etc.");
    println!();
}

/// Chat session management
struct ChatSession {
    model: PhiModel,
    conversation_history: Vec<(String, String)>, // (user, assistant) pairs
    system_prompt: Option<String>,
    coding_mode: bool,
    math_mode: bool,
}

impl ChatSession {
    fn new(model: PhiModel, system_prompt: Option<String>, coding_mode: bool, math_mode: bool) -> Self {
        let enhanced_system = if let Some(base) = system_prompt {
            Some(Self::enhance_system_prompt(base, coding_mode, math_mode))
        } else {
            Some(Self::default_system_prompt(coding_mode, math_mode))
        };

        Self {
            model,
            conversation_history: Vec::new(),
            system_prompt: enhanced_system,
            coding_mode,
            math_mode,
        }
    }

    fn default_system_prompt(coding_mode: bool, math_mode: bool) -> String {
        let mut prompt = "You are Phi, a helpful AI assistant created by Microsoft.".to_string();
        
        if coding_mode {
            prompt.push_str(" You specialize in helping with programming tasks, code generation, debugging, and software development best practices.");
        }
        
        if math_mode {
            prompt.push_str(" You excel at mathematical reasoning, problem solving, and explaining complex mathematical concepts clearly.");
        }
        
        prompt.push_str(" You provide accurate, helpful, and concise responses.");
        prompt
    }

    fn enhance_system_prompt(base: String, coding_mode: bool, math_mode: bool) -> String {
        let mut enhanced = base;
        
        if coding_mode {
            enhanced.push_str("\n\nCoding Assistant Mode: Focus on programming tasks, code quality, and best practices.");
        }
        
        if math_mode {
            enhanced.push_str("\n\nMath Assistant Mode: Emphasize mathematical accuracy and clear step-by-step explanations.");
        }
        
        enhanced
    }

    async fn generate_response(&mut self, input: &str, max_tokens: usize, temperature: f32) -> Result<String> {
        // Add to conversation history
        let enhanced_input = self.enhance_input(input);
        
        // In a real implementation, this would:
        // 1. Format the conversation with system prompt
        // 2. Tokenize the input using the appropriate tokenizer
        // 3. Run inference using Burn with the loaded model
        // 4. Decode the output tokens back to text
        // 5. Apply post-processing and safety filters

        // For now, provide a demonstration response
        let response = self.generate_demo_response(input).await;
        
        self.conversation_history.push((input.to_string(), response.clone()));
        
        // Keep conversation history manageable
        if self.conversation_history.len() > 10 {
            self.conversation_history.remove(0);
        }

        Ok(response)
    }

    fn enhance_input(&self, input: &str) -> String {
        let mut enhanced = input.to_string();

        if self.coding_mode && (input.contains("code") || input.contains("function") || input.contains("bug")) {
            enhanced = format!("[CODING TASK] {}", enhanced);
        }

        if self.math_mode && (input.contains("solve") || input.contains("calculate") || input.contains("equation")) {
            enhanced = format!("[MATH PROBLEM] {}", enhanced);
        }

        enhanced
    }

    async fn generate_demo_response(&self, input: &str) -> String {
        // Simulate processing time
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        // Generate contextual demo responses based on the model and input
        match &self.model {
            PhiModel::Phi2 { .. } => {
                if input.to_lowercase().contains("code") {
                    "I'd be happy to help with coding! As Phi-2, I can assist with code generation, explanation, and basic debugging. What specific programming task are you working on?".to_string()
                } else if input.to_lowercase().contains("math") {
                    "I can help with mathematical problems! Please share the specific math question or equation you'd like me to work on.".to_string()
                } else {
                    format!("Thank you for your question about '{}'. As Phi-2, I'm designed to help with language comprehension and reasoning tasks. How can I assist you further?", input)
                }
            }
            PhiModel::Phi3 { .. } => {
                if self.coding_mode && input.to_lowercase().contains("code") {
                    "As Phi-3 in coding mode, I'm optimized for programming tasks! I can help with:\n• Code generation and completion\n• Debugging and error analysis\n• Algorithm design\n• Best practices\n\nWhat would you like to work on?".to_string()
                } else if self.math_mode && input.to_lowercase().contains("math") {
                    "Phi-3 excels at mathematical reasoning! I can help with:\n• Problem solving step-by-step\n• Equation solving\n• Mathematical proofs\n• Concept explanation\n\nWhat math problem shall we tackle?".to_string()
                } else {
                    format!("I'm Phi-3, designed for coding, math, and reasoning tasks. Regarding '{}', I can provide detailed analysis and solutions. What specific aspect would you like me to focus on?", input)
                }
            }
            PhiModel::Phi4 { .. } => {
                "As Phi-4, I excel at complex reasoning and mathematical problem solving. I can provide sophisticated analysis with step-by-step reasoning. What challenging problem would you like me to work on?".to_string()
            }
            _ => {
                format!("I understand you're asking about '{}'. How can I help you with this?", input)
            }
        }
    }
}

// Placeholder struct for future Burn integration
pub struct PhiInference {
    // Would contain Burn model, tokenizer, etc.
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chat_session_creation() {
        let model = PhiModel::Phi3 {
            parameters: "3.8B".to_string(),
            context_length: 4096,
            specialization: vec!["coding".to_string()],
        };

        let session = ChatSession::new(model, None, true, false);
        assert!(session.coding_mode);
        assert!(!session.math_mode);
        assert!(session.system_prompt.is_some());
    }

    #[test]
    fn test_system_prompt_enhancement() {
        let base = "You are an AI assistant.".to_string();
        let enhanced = ChatSession::enhance_system_prompt(base, true, true);
        
        assert!(enhanced.contains("Coding Assistant Mode"));
        assert!(enhanced.contains("Math Assistant Mode"));
    }

    #[tokio::test]
    async fn test_demo_response_generation() {
        let model = PhiModel::Phi3 {
            parameters: "3.8B".to_string(),
            context_length: 4096,
            specialization: vec!["coding".to_string()],
        };

        let session = ChatSession::new(model, None, true, false);
        let response = session.generate_demo_response("help me write code").await;
        
        assert!(!response.is_empty());
        assert!(response.to_lowercase().contains("code") || response.to_lowercase().contains("coding"));
    }
}